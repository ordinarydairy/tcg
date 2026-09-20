from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models


def card_storage():
    Path(settings.PRIVATE_MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)


def card_upload_to(instance, filename):
    suffix = Path(filename).suffix.lower() or '.jpg'
    return f'{instance.owner_id}/{uuid4().hex}{suffix}'


class Card(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cards',
    )
    image = models.ImageField(upload_to=card_upload_to, storage=card_storage)
    story = models.TextField(blank=True)

    photo_quality = models.IntegerField()
    location_significance = models.IntegerField()
    occasion = models.IntegerField()
    uniqueness = models.IntegerField()
    memory_story = models.IntegerField()

    overall_score = models.IntegerField()
    rarity = models.CharField(max_length=20)

    created_at = models.DateTimeField(auto_now_add=True)

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
