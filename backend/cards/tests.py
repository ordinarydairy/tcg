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

    def test_friend_can_list_and_view_cards(self):
        Friendship.objects.create(from_user=self.owner, to_user=self.other, status=Friendship.ACCEPTED)
        self.client.force_login(self.other)
        listing = self.client.get('/api/cards/', {'user_id': self.owner.id})
        self.assertEqual(listing.status_code, 200)
        body = listing.json()[0]
        self.assertEqual(body['id'], self.card.id)
        self.assertEqual(body['creator_display_name'], 'Owner')
        self.assertEqual(body['creator_tag'], self.owner.tag)
        image = self.client.get(f'/api/cards/{self.card.id}/image/')
        self.assertEqual(image.status_code, 200)

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
        self.assertEqual(cards[0]['creator_display_name'], 'Sam')
        self.assertEqual(cards[0]['creator_tag'], self.sam.tag)
        self.assertEqual(Card.objects.filter(owner=self.claire).count(), 1)
        copied = self.client.get('/api/cards/')
        self.assertEqual(copied.json()[0]['creator_display_name'], 'Sam')
        self.assertEqual(copied.json()[0]['creator_tag'], self.sam.tag)

        blocked = self.client.post('/api/pack/open/')
        self.assertEqual(blocked.status_code, 429)
        self.assertFalse(blocked.json()['ready'])

        PackOpening.objects.filter(user=self.claire).update(
            created_at=timezone.now() - timedelta(hours=3),
        )
        again = self.client.post('/api/pack/open/')
        self.assertEqual(again.status_code, 201)


class TradeTests(TestCase):
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
        Friendship.objects.create(
            from_user=self.claire,
            to_user=self.sam,
            status=Friendship.ACCEPTED,
        )
        self.claire_card = make_card(self.claire, name='claire.png')
        self.sam_card = make_card(self.sam, name='sam.png')
        self.client.force_login(self.claire)

    def test_cannot_trade_with_non_friend(self):
        response = self.client.post(
            '/api/trades/',
            {'user_id': self.riley.id, 'card_ids': []},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_empty_offer_then_partner_adds_and_both_accept(self):
        created = self.client.post(
            '/api/trades/',
            {'user_id': self.sam.id, 'card_ids': []},
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201)
        trade_id = created.json()['id']
        self.assertEqual(created.json()['your_cards'], [])
        self.assertEqual(created.json()['partner']['display_name'], 'Sam')

        listed = self.client.get('/api/trades/')
        self.assertEqual(len(listed.json()['trades']), 1)

        self.client.force_login(self.sam)
        updated = self.client.patch(
            f'/api/trades/{trade_id}/',
            {'card_ids': [self.sam_card.id]},
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()['your_cards'][0]['id'], self.sam_card.id)

        sam_accept = self.client.post(f'/api/trades/{trade_id}/accept/')
        self.assertEqual(sam_accept.json()['status'], 'pending')
        self.assertTrue(sam_accept.json()['you_accepted'])
        self.assertFalse(sam_accept.json()['they_accepted'])

        self.client.force_login(self.claire)
        claire_accept = self.client.post(f'/api/trades/{trade_id}/accept/')
        self.assertEqual(claire_accept.json()['status'], 'completed')
        self.sam_card.refresh_from_db()
        self.assertEqual(self.sam_card.owner_id, self.claire.id)
        self.claire_card.refresh_from_db()
        self.assertEqual(self.claire_card.owner_id, self.claire.id)

    def test_both_sides_swap_cards(self):
        created = self.client.post(
            '/api/trades/',
            {'user_id': self.sam.id, 'card_ids': [self.claire_card.id]},
            content_type='application/json',
        )
        trade_id = created.json()['id']
        self.client.force_login(self.sam)
        self.client.patch(
            f'/api/trades/{trade_id}/',
            {'card_ids': [self.sam_card.id]},
            content_type='application/json',
        )
        self.client.post(f'/api/trades/{trade_id}/accept/')
        self.client.force_login(self.claire)
        done = self.client.post(f'/api/trades/{trade_id}/accept/')
        self.assertEqual(done.json()['status'], 'completed')
        self.claire_card.refresh_from_db()
        self.sam_card.refresh_from_db()
        self.assertEqual(self.claire_card.owner_id, self.sam.id)
        self.assertEqual(self.sam_card.owner_id, self.claire.id)

    def test_changing_cards_resets_acceptances(self):
        created = self.client.post(
            '/api/trades/',
            {'user_id': self.sam.id, 'card_ids': [self.claire_card.id]},
            content_type='application/json',
        )
        trade_id = created.json()['id']
        self.client.post(f'/api/trades/{trade_id}/accept/')
        self.client.patch(
            f'/api/trades/{trade_id}/',
            {'card_ids': []},
            content_type='application/json',
        )
        detail = self.client.get(f'/api/trades/{trade_id}/')
        self.assertFalse(detail.json()['you_accepted'])
        self.assertFalse(detail.json()['they_accepted'])

    def test_existing_pending_trade_is_reused(self):
        first = self.client.post(
            '/api/trades/',
            {'user_id': self.sam.id, 'card_ids': []},
            content_type='application/json',
        )
        second = self.client.post(
            '/api/trades/',
            {'user_id': self.sam.id, 'card_ids': []},
            content_type='application/json',
        )
        self.assertEqual(first.json()['id'], second.json()['id'])
        self.assertEqual(second.status_code, 200)

    def test_cancel_trade(self):
        created = self.client.post(
            '/api/trades/',
            {'user_id': self.sam.id, 'card_ids': []},
            content_type='application/json',
        )
        trade_id = created.json()['id']
        cancelled = self.client.post(f'/api/trades/{trade_id}/cancel/')
        self.assertEqual(cancelled.json()['status'], 'cancelled')

