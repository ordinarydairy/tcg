from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image

from accounts.models import Friendship
from cards.models import PackOpening
from .models import Card

User = get_user_model()


def png_file(name='card.png'):
    buffer = BytesIO()
    Image.new('RGB', (8, 8), color='purple').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


def make_card(owner, name='card.png'):
    return Card.objects.create(
        owner=owner,
        image=png_file(name),
        story='a memory',
        photo_quality=5,
        location_significance=5,
        occasion=5,
        uniqueness=5,
        memory_story=5,
        overall_score=50,
        rarity='Uncommon',
    )


class CardOwnershipTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@example.com',
            password='secretpass123',
            display_name='Owner',
        )
        self.other = User.objects.create_user(
            email='other@example.com',
            password='secretpass123',
            display_name='Other',
        )
        self.card = make_card(self.owner)

    def test_anonymous_cannot_list_or_view_images(self):
        listing = self.client.get('/api/cards/')
        image = self.client.get(f'/api/cards/{self.card.id}/image/')
        self.assertEqual(listing.status_code, 403)
        self.assertEqual(image.status_code, 403)

    def test_owner_sees_only_their_cards(self):
        make_card(self.other, name='other.png')
        self.client.force_login(self.owner)
        response = self.client.get('/api/cards/')
        self.assertEqual(response.status_code, 200)
        ids = [item['id'] for item in response.json()]
        self.assertEqual(ids, [self.card.id])
        self.assertEqual(response.json()[0]['image'], f'/api/cards/{self.card.id}/image/')

    def test_other_user_cannot_fetch_card_image(self):
        self.client.force_login(self.other)
        response = self.client.get(f'/api/cards/{self.card.id}/image/')
        self.assertEqual(response.status_code, 404)

    def test_owner_can_fetch_card_image(self):
        self.client.force_login(self.owner)
        response = self.client.get(f'/api/cards/{self.card.id}/image/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get('Content-Type', '').startswith('image/'))

    def test_anonymous_cannot_grade_photo(self):
        response = self.client.post('/api/grade-photo/', {'image': png_file()})
        self.assertEqual(response.status_code, 403)


class MysteryPackTests(TestCase):
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
        self.client.force_login(self.claire)

    def test_pack_needs_friends_with_cards(self):
        empty = self.client.post('/api/pack/open/')
        self.assertEqual(empty.status_code, 400)

        Friendship.objects.create(from_user=self.claire, to_user=self.sam, status=Friendship.ACCEPTED)
        no_cards = self.client.post('/api/pack/open/')
        self.assertEqual(no_cards.status_code, 400)

        make_card(self.sam)
        opened = self.client.post('/api/pack/open/')
        self.assertEqual(opened.status_code, 201)
        cards = opened.json()['last_opening']['cards']
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]['from_friend'], 'Sam')
        self.assertEqual(Card.objects.filter(owner=self.claire).count(), 1)

        blocked = self.client.post('/api/pack/open/')
        self.assertEqual(blocked.status_code, 429)
        self.assertFalse(blocked.json()['ready'])

        PackOpening.objects.filter(user=self.claire).update(
            created_at=timezone.now() - timedelta(hours=3),
        )
        again = self.client.post('/api/pack/open/')
        self.assertEqual(again.status_code, 201)
