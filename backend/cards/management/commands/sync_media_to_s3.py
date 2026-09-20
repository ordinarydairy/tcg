from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from cards.models import Card

User = get_user_model()


def upload_local(name, roots):
    if not name or default_storage.exists(name):
        return False
    for root in roots:
        path = Path(root) / name
        if path.is_file():
            with path.open('rb') as handle:
                default_storage.save(name, ContentFile(handle.read()))
            return True
    return False


class Command(BaseCommand):
    help = 'Copy local profile photos and card images into the shared object store.'

    def handle(self, *args, **options):
        if not getattr(settings, 'USE_S3_MEDIA', False):
            self.stderr.write('Shared object storage is not configured.')
            return

        roots = [settings.MEDIA_ROOT, settings.PRIVATE_MEDIA_ROOT]
        uploaded = 0
        for user in User.objects.exclude(profile_photo=''):
            if upload_local(user.profile_photo.name, roots):
                uploaded += 1
                self.stdout.write(f'Uploaded profile photo for {user.display_name}')
        for card in Card.objects.exclude(image=''):
            if upload_local(card.image.name, roots):
                uploaded += 1
                self.stdout.write(f'Uploaded card {card.id}')
        self.stdout.write(f'Done. Uploaded {uploaded} file(s).')
