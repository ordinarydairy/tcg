import mimetypes
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import FileSystemStorage, default_storage
from django.db import models


def card_storage():
    if getattr(settings, 'USE_S3_MEDIA', False):
        return default_storage
    Path(settings.PRIVATE_MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)


def card_upload_to(instance, filename):
    suffix = Path(filename).suffix.lower() or '.jpg'
    return f'cards/{instance.owner_id}/{uuid4().hex}{suffix}'


class Card(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cards',
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cards',
    )
    image = models.ImageField(upload_to=card_upload_to, storage=card_storage)
    image_content_type = models.CharField(max_length=100)
    image_data = models.BinaryField(null=True, blank=True)
    story = models.TextField(blank=True)

    photo_quality = models.IntegerField()
    location_significance = models.IntegerField()
    occasion = models.IntegerField()
    uniqueness = models.IntegerField()
    memory_story = models.IntegerField()

    photo_quality_reason = models.TextField(blank=True, default='')
    location_significance_reason = models.TextField(blank=True, default='')
    occasion_reason = models.TextField(blank=True, default='')
    uniqueness_reason = models.TextField(blank=True, default='')
    memory_story_reason = models.TextField(blank=True, default='')

    overall_score = models.IntegerField()
    rarity = models.CharField(max_length=20)

    created_at = models.DateTimeField(auto_now_add=True)

    REASON_FIELDS = (
        'photo_quality_reason',
        'location_significance_reason',
        'occasion_reason',
        'uniqueness_reason',
        'memory_story_reason',
    )

    def save(self, *args, **kwargs):
        if not self.creator_id and self.owner_id:
            self.creator_id = self.owner_id
        if not self.image_content_type:
            uploaded_type = getattr(self.image, 'content_type', None)
            guessed = mimetypes.guess_type(getattr(self.image, 'name', '') or '')[0]
            self.image_content_type = (uploaded_type or guessed or 'application/octet-stream')[:100]
        for name in self.REASON_FIELDS:
            if getattr(self, name) is None:
                setattr(self, name, '')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.rarity} Card ({self.overall_score}/100)"


class PackOpening(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pack_openings',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class PackPull(models.Model):
    opening = models.ForeignKey(
        PackOpening,
        on_delete=models.CASCADE,
        related_name='pulls',
    )
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='pack_pulls')
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gifted_pack_cards',
    )

    class Meta:
        ordering = ['id']


class Trade(models.Model):
    PENDING = 'pending'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'
    STATUS_CHOICES = (
        (PENDING, 'Pending'),
        (COMPLETED, 'Completed'),
        (CANCELLED, 'Cancelled'),
    )

    initiator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trades_started',
    )
    partner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trades_received',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    initiator_accepted = models.BooleanField(default=False)
    partner_accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def other_user(self, user):
        return self.partner if self.initiator_id == user.id else self.initiator

    def is_participant(self, user):
        return user.id in {self.initiator_id, self.partner_id}


class TradeItem(models.Model):
    trade = models.ForeignKey(Trade, on_delete=models.CASCADE, related_name='items')
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='trade_items')
    offered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='offered_trade_items',
    )

    class Meta:
        unique_together = ('trade', 'card')


class MysteryPackEntry(models.Model):
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pack_donations',
    )
    card = models.OneToOneField(
        Card,
        on_delete=models.CASCADE,
        related_name='pack_entry',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
