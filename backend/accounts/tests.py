from rest_framework.test import APIClient
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
        missing = self.client.post(
            reverse('login'),
            {'email': 'missing@example.com', 'password': 'secretpass123'},
            content_type='application/json',
        )
        self.assertEqual(missing.status_code, 400)
        self.assertIn('No account is connected to this email.', missing.json()['email'])

        bad = self.client.post(
            reverse('login'),
            {'email': 'player@example.com', 'password': 'wrong-password'},
            content_type='application/json',
        )
        self.assertEqual(bad.status_code, 400)
        self.assertIn('Incorrect password.', bad.json()['password'])

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

    def test_owner_can_save_bio(self):
        user = User.objects.create_user(
            email='player@example.com',
            password='secretpass123',
            display_name='Claire',
        )
        self.client.force_login(user)
        response = self.client.patch(
            reverse('me'),
            {'bio': '  Collector of rare cards.  '},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['user']['bio'], 'Collector of rare cards.')
        user.refresh_from_db()
        self.assertEqual(user.bio, 'Collector of rare cards.')

    def test_owner_can_change_profile_photo(self):
        user = User.objects.create_user(
            email='player@example.com',
            password='secretpass123',
            display_name='Claire',
            profile_photo=png_file('old.png'),
        )
        client = APIClient()
        client.force_login(user)
        response = client.patch(
            reverse('me'),
            {'profile_photo': png_file('new.png')},
            format='multipart',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['user']['profile_photo'])
        user.refresh_from_db()
        self.assertIn('profiles/', user.profile_photo.name)

    def test_anonymous_cannot_save_bio(self):
        response = self.client.patch(
            reverse('me'),
            {'bio': 'Nope'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 401)

class FriendshipApiTests(TestCase):
    def setUp(self):
        self.claire = User.objects.create_user(
            email='claire@example.com',
            password='secretpass123',
            display_name='Claire',
        )
        self.sam = User.objects.create_user(
            email='sam@example.com',
            password='secretpass123',
            display_name='Sam',
        )
        self.riley = User.objects.create_user(
            email='riley@example.com',
            password='secretpass123',
            display_name='Riley',
        )
        self.client.force_login(self.claire)

    def test_suggestions_and_search(self):
        suggestions = self.client.get(reverse('friend-suggestions'))
        names = {user['display_name'] for user in suggestions.json()['users']}
        self.assertEqual(names, {'Sam', 'Riley'})

        search = self.client.get(reverse('friend-search'), {'q': 'sa'})
        self.assertEqual(search.json()['users'][0]['display_name'], 'Sam')

    def test_send_request_accept_and_unfriend(self):
        send = self.client.post(
            reverse('friend-request'),
            {'user_id': self.sam.id},
            content_type='application/json',
        )
        self.assertEqual(send.status_code, 201)
        self.assertEqual(send.json()['friendship_status'], 'pending_sent')

        self.client.force_login(self.sam)
        incoming = self.client.get(reverse('friends-list'))
        self.assertEqual(incoming.json()['incoming'][0]['display_name'], 'Claire')

        accept = self.client.post(
            reverse('friend-request'),
            {'user_id': self.claire.id},
            content_type='application/json',
        )
        self.assertEqual(accept.json()['friendship_status'], 'friends')

        friends = self.client.get(reverse('friends-list'))
        self.assertEqual(friends.json()['friends'][0]['display_name'], 'Claire')

        profile = self.client.get(reverse('player-detail', args=[self.claire.id]))
        self.assertEqual(profile.json()['friendship_status'], 'friends')
        self.assertNotIn('email', profile.json())

        remove = self.client.delete(reverse('friend-detail', args=[self.claire.id]))
        self.assertEqual(remove.status_code, 204)
        self.assertEqual(self.client.get(reverse('friends-list')).json()['friends'], [])
