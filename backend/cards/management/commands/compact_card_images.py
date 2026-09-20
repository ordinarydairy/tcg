from django.conf import settings
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from cards.images import compact_payload_for_storage
from cards.models import Card


def read_card_bytes(card):
    if card.image_data:
        return bytes(card.image_data)
    if not card.image:
        return b''
    try:
        with card.image.open('rb') as handle:
            return handle.read()
    except FileNotFoundError:
        if default_storage.exists(card.image.name):
            with default_storage.open(card.image.name, 'rb') as handle:
                return handle.read()
    return b''


class Command(BaseCommand):
    help = (
        'Re-encode card photos as smaller JPEGs and drop duplicate Postgres '
        'blobs when object storage is configured.'
    )

    def handle(self, *args, **options):
        updated = 0
        skipped = 0
        for card in Card.objects.iterator():
            payload = read_card_bytes(card)
            if not payload:
                skipped += 1
                continue
            original_size = len(payload)
            file, compressed = compact_payload_for_storage(
                payload,
                name=getattr(card.image, 'name', '') or f'card-{card.id}.jpg',
            )
            if card.image:
                try:
                    card.image.delete(save=False)
                except Exception:
                    pass
            card.image.save(file.name, file, save=False)
            card.image_content_type = 'image/jpeg'
            if getattr(settings, 'USE_S3_MEDIA', False):
                card.image_data = None
            else:
                card.image_data = compressed
            card.save(update_fields=['image', 'image_content_type', 'image_data'])
            updated += 1
            self.stdout.write(
                f'Card {card.id}: {original_size} -> {len(compressed)} bytes'
            )
        self.stdout.write(f'Done. Compacted {updated} card(s); skipped {skipped}.')
