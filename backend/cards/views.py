import mimetypes
import os
import random
from datetime import timedelta
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.friends import accepted_friend_ids, can_view_player_cards

from .models import Card, PackOpening, PackPull

ENV_PATHS = (
    Path(__file__).resolve().parent.parent / '.env',
    Path(__file__).resolve().parent.parent.parent / '.env',
    Path(__file__).resolve().parent.parent.parent / '.env.local',
)
PLACEHOLDER_KEYS = {'', 'paste_your_key_here'}


def gemini_api_key():
    for path in ENV_PATHS:
        load_dotenv(path, override=False)
    for name in ('GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY'):
        value = (os.getenv(name) or '').strip().strip('"').strip("'")
        if value.lower() not in PLACEHOLDER_KEYS:
            return value
    return ''


class PhotoScores(BaseModel):
    photo_quality: int = Field(ge=0, le=10)
    location_significance: int = Field(ge=0, le=10)
    occasion: int = Field(ge=0, le=10)
    uniqueness: int = Field(ge=0, le=10)
    memory_story: int = Field(ge=0, le=10)


def card_payload(card):
    return {
        'id': card.id,
        'image': f'/api/cards/{card.id}/image/',
        'story': card.story,
        'scores': {
            'photo_quality': card.photo_quality,
            'location_significance': card.location_significance,
            'occasion': card.occasion,
            'uniqueness': card.uniqueness,
            'memory_story': card.memory_story,
        },
        'overall_score': card.overall_score,
        'rarity': card.rarity,
        'created_at': card.created_at,
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def grade_photo(request):
    image = request.FILES.get('image')
    story = request.data.get('story', '')

    if image is None:
        return Response(
            {'error': 'No image was uploaded.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    api_key = gemini_api_key()

    if not api_key:
        return Response(
            {
                'error': (
                    'GEMINI_API_KEY was not found. Add it to backend/.env '
                    '(see backend/.env.example) and try the upload again.'
                ),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        client = genai.Client(api_key=api_key)

        image_bytes = image.read()
        image.seek(0)

        prompt = f"""
Grade this photo for a collectible photo-card application.

Give each category an integer score from 0 through 10.

Categories:

photo_quality:
Judge sharpness, lighting, and composition.

location_significance:
Judge how meaningful or special the location appears,
using the user's story as context. Do not reward a location
simply because it is famous.

occasion:
Judge whether the photo captures a meaningful occasion,
event, or moment.

uniqueness:
Judge how unusual, distinctive, or interesting the scene is.

memory_story:
Judge the personal meaning communicated by the user's story.

User's story:
{story if story else "No story was provided."}
"""

        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=[
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=image.content_type or 'image/jpeg',
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=PhotoScores,
            ),
        )

        scores = PhotoScores.model_validate_json(response.text)

        overall_score = (
            scores.photo_quality
            + scores.location_significance
            + scores.occasion
            + scores.uniqueness
            + scores.memory_story
        ) * 2

        if overall_score >= 90:
            rarity = 'Legendary'
        elif overall_score >= 75:
            rarity = 'Epic'
        elif overall_score >= 60:
            rarity = 'Rare'
        elif overall_score >= 40:
            rarity = 'Uncommon'
        else:
            rarity = 'Common'

        card = Card.objects.create(
            owner=request.user,
            image=image,
            story=story,
            photo_quality=scores.photo_quality,
            location_significance=scores.location_significance,
            occasion=scores.occasion,
            uniqueness=scores.uniqueness,
            memory_story=scores.memory_story,
            overall_score=overall_score,
            rarity=rarity,
        )

        return Response(card_payload(card))

    except Exception as error:
        return Response(
            {'error': str(error)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_cards(request):
    owner_id = request.query_params.get('user_id') or request.user.id
    try:
        owner_id = int(owner_id)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid user_id.'}, status=status.HTTP_400_BAD_REQUEST)
    if not can_view_player_cards(request.user, owner_id):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    cards = Card.objects.filter(owner_id=owner_id).order_by('-created_at')
    return Response([card_payload(card) for card in cards])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def card_image(request, card_id):
    card = get_object_or_404(Card, pk=card_id)
    if not can_view_player_cards(request.user, card.owner_id):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    try:
        image_file = card.image.open('rb')
    except FileNotFoundError:
        return Response({'detail': 'Image not found.'}, status=status.HTTP_404_NOT_FOUND)
    content_type = mimetypes.guess_type(card.image.name)[0] or 'application/octet-stream'
    return FileResponse(image_file, content_type=content_type)


PACK_COOLDOWN = timedelta(hours=2)
PACK_SIZE = 3


def stored_card_image(card):
    try:
        return bool(card.image) and card.image.storage.exists(card.image.name)
    except Exception:
        return False


def copy_friend_card(original, new_owner):
    try:
        with original.image.open('rb') as image_file:
            data = image_file.read()
    except FileNotFoundError:
        return None
    card = Card(
        owner=new_owner,
        story=original.story,
        photo_quality=original.photo_quality,
        location_significance=original.location_significance,
        occasion=original.occasion,
        uniqueness=original.uniqueness,
        memory_story=original.memory_story,
        overall_score=original.overall_score,
        rarity=original.rarity,
    )
    card.image.save(Path(original.image.name).name, ContentFile(data), save=True)
    return card


def pack_card_payload(pull):
    payload = card_payload(pull.card)
    payload['from_friend'] = pull.from_user.display_name
    return payload


def latest_opening(user):
    return PackOpening.objects.filter(user=user).prefetch_related('pulls__card', 'pulls__from_user').first()


def pack_status_payload(user):
    friends = accepted_friend_ids(user)
    friend_cards = list(Card.objects.filter(owner_id__in=friends)) if friends else []
    pool_size = sum(1 for card in friend_cards if stored_card_image(card))
    opening = latest_opening(user)
    remaining = 0
    if opening:
        elapsed = timezone.now() - opening.created_at
        remaining = max(0, int((PACK_COOLDOWN - elapsed).total_seconds()))
    cooldown_seconds = int(PACK_COOLDOWN.total_seconds())
    progress = 1 if remaining == 0 else (cooldown_seconds - remaining) / cooldown_seconds
    return {
        'ready': remaining == 0,
        'cooldown_seconds': cooldown_seconds,
        'remaining_seconds': remaining,
        'progress': progress,
        'friend_count': len(friends),
        'pool_size': pool_size,
        'last_opening': None
        if opening is None
        else {
            'created_at': opening.created_at,
            'cards': [pack_card_payload(pull) for pull in opening.pulls.all()],
        },
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pack_status(request):
    return Response(pack_status_payload(request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def open_pack(request):
    current = pack_status_payload(request.user)
    if not current['ready']:
        return Response(
            {**current, 'error': 'Mystery pack is on cooldown. Check back in a couple of hours.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if current['friend_count'] == 0:
        return Response(
            {**current, 'error': 'Add friends before you can open a mystery pack.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if current['pool_size'] == 0:
        return Response(
            {**current, 'error': 'Your friends have not uploaded any cards yet.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    readable = [
        card
        for card in Card.objects.filter(owner_id__in=accepted_friend_ids(request.user)).select_related('owner')
        if stored_card_image(card)
    ]
    random.shuffle(readable)
    sources = readable[:PACK_SIZE]
    if not sources:
        return Response(
            {**current, 'error': 'Your friends have not uploaded any cards yet.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    copies = []
    with transaction.atomic():
        opening = PackOpening.objects.create(user=request.user)
        for original in sources:
            copy = copy_friend_card(original, request.user)
            if copy is None:
                continue
            PackPull.objects.create(opening=opening, card=copy, from_user=original.owner)
            copies.append(copy)
        if not copies:
            opening.delete()
            return Response(
                {**current, 'error': 'Friend cards could not be read. Ask them to re-upload after this update.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    return Response(pack_status_payload(request.user), status=status.HTTP_201_CREATED)
