from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from io import BytesIO

User = get_user_model()


def png_file(name='photo.png'):
    buffer = BytesIO()
    Image.new('RGB', (8, 8), color='purple').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


class AuthApiTests(TestCase):
    def test_register_creates_session_and_profile(self):
        response = self.client.post(
            reverse('register'),
            {
                'email': 'player@example.com',
                'password': 'secretpass123',
                'display_name': 'Claire',
                'profile_photo': png_file(),
            },
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body['email'], 'player@example.com')
        self.assertEqual(body['display_name'], 'Claire')
        self.assertTrue(body['profile_photo'])

        me = self.client.get(reverse('me'))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['user']['display_name'], 'Claire')

    def test_login_and_logout(self):
        User.objects.create_user(
            email='player@example.com',
            password='secretpass123',
            display_name='Claire',
        )
        bad = self.client.post(
            reverse('login'),
            {'email': 'player@example.com', 'password': 'wrong-password'},
            content_type='application/json',
        )
        self.assertEqual(bad.status_code, 400)

        ok = self.client.post(
            reverse('login'),
            {'email': 'player@example.com', 'password': 'secretpass123'},
            content_type='application/json',
        )
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()['display_name'], 'Claire')

        logout = self.client.post(reverse('logout'))
        self.assertEqual(logout.status_code, 204)
        me = self.client.get(reverse('me'))
        self.assertIsNone(me.json()['user'])

    def test_duplicate_email_is_rejected(self):
        User.objects.create_user(
            email='player@example.com',
            password='secretpass123',
            display_name='Claire',
        )
        response = self.client.post(
            reverse('register'),
            {
                'email': 'player@example.com',
                'password': 'anotherpass123',
                'display_name': 'Other',
            },
        )
        self.assertEqual(response.status_code, 400)
