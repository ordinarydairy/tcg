from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps


def compress_image_bytes(payload, max_side=1600, quality=80):
    """Return JPEG bytes scaled down so photos do not fill Postgres."""
    image = Image.open(BytesIO(bytes(payload)))
    image = ImageOps.exif_transpose(image)
    if image.mode != 'RGB':
        image = image.convert('RGB')
    image.thumbnail((max_side, max_side))
    buffer = BytesIO()
    image.save(buffer, format='JPEG', quality=quality, optimize=True)
    return buffer.getvalue()


def compress_uploaded_image(uploaded, max_side=1600, quality=80):
    """Return a JPEG upload and its bytes, scaled down to save database space."""
    uploaded.seek(0)
    payload = compress_image_bytes(uploaded.read(), max_side=max_side, quality=quality)
    name = f'{Path(getattr(uploaded, "name", "photo") or "photo").stem}.jpg'
    compressed = InMemoryUploadedFile(
        file=BytesIO(payload),
        field_name=getattr(uploaded, 'field_name', None),
        name=name,
        content_type='image/jpeg',
        size=len(payload),
        charset=None,
    )
    return compressed, payload


def jpeg_name(path_or_name):
    stem = Path(path_or_name or 'photo').stem or 'photo'
    return f'{stem}.jpg'


def compact_payload_for_storage(payload, name='photo.jpg', max_side=1600, quality=80):
    compressed = compress_image_bytes(payload, max_side=max_side, quality=quality)
    return ContentFile(compressed, name=jpeg_name(name)), compressed
