import mimetypes
import os
import random
from datetime import timedelta
from pathlib import Path

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, field_validator
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.friends import can_view_player_cards
from cards.images import compress_uploaded_image

from .models import Card, MysteryPackEntry, PackOpening, PackPull, Trade, TradeItem

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
    photo_quality_reason: str = ''

    location_significance: int = Field(ge=0, le=10)
    location_significance_reason: str = ''

    occasion: int = Field(ge=0, le=10)
    occasion_reason: str = ''

    uniqueness: int = Field(ge=0, le=10)
    uniqueness_reason: str = ''

    memory_story: int = Field(ge=0, le=10)
    memory_story_reason: str = ''

    @field_validator(
        'photo_quality_reason',
        'location_significance_reason',
        'occasion_reason',
        'uniqueness_reason',
        'memory_story_reason',
        mode='before',
    )
    @classmethod
    def coerce_reason(cls, value):
        if value is None:
            return ''
        return str(value)


def card_creator(card):
    return card.creator or card.owner


def card_payload(card):
    creator = card_creator(card)

    return {
        'id': card.id,
        'image': f'/api/cards/{card.id}/image/',
        'creator_display_name': creator.display_name,
        'creator_tag': creator.tag,
        'story': card.story,

        'scores': {
            'photo_quality': card.photo_quality,
            'photo_quality_reason': card.photo_quality_reason,

            'location_significance': card.location_significance,
            'location_significance_reason': card.location_significance_reason,

            'occasion': card.occasion,
            'occasion_reason': card.occasion_reason,

            'uniqueness': card.uniqueness,
            'uniqueness_reason': card.uniqueness_reason,

            'memory_story': card.memory_story,
            'memory_story_reason': card.memory_story_reason,
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

        image, image_bytes = compress_uploaded_image(image, max_side=1200, quality=72)
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

For every category, also provide a short explanation of why you
gave that score.

Keep each explanation to 1-2 concise sentences.

Base explanations only on visible details in the photo and information
provided in the user's story. Do not invent people, places, events,
relationships, or other details that are not supported by the photo
or story.
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
            creator=request.user,
            image=image,
            image_content_type='image/jpeg',
            image_data=None,
            story=story,

            photo_quality=scores.photo_quality,
            photo_quality_reason=scores.photo_quality_reason or '',

            location_significance=scores.location_significance,
            location_significance_reason=scores.location_significance_reason or '',

            occasion=scores.occasion,
            occasion_reason=scores.occasion_reason or '',

            uniqueness=scores.uniqueness,
            uniqueness_reason=scores.uniqueness_reason or '',

            memory_story=scores.memory_story,
            memory_story_reason=scores.memory_story_reason or '',

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
    cards = (
        Card.objects.filter(owner_id=owner_id, pack_entry__isnull=True)
        .select_related('owner', 'creator')
        .order_by('-created_at')
    )
    return Response([card_payload(card) for card in cards])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def card_image(request, card_id):
    card = get_object_or_404(Card, pk=card_id)
    if not can_view_player_cards(request.user, card.owner_id):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    content_type = (
        card.image_content_type
        or mimetypes.guess_type(card.image.name)[0]
        or 'application/octet-stream'
    )
    try:
        image_file = card.image.open('rb')
    except FileNotFoundError:
        if card.image_data:
            return HttpResponse(bytes(card.image_data), content_type=content_type)
        return Response({'detail': 'Image not found.'}, status=status.HTTP_404_NOT_FOUND)
    return FileResponse(image_file, content_type=content_type)


PACK_COOLDOWN = timedelta(seconds=20)


def pack_card_payload(pull):
    payload = card_payload(pull.card)
    payload['from_friend'] = pull.from_user.display_name
    return payload


def latest_opening(user):
    return PackOpening.objects.filter(user=user).prefetch_related(
        'pulls__card__owner',
        'pulls__card__creator',
        'pulls__from_user',
    ).first()


def pack_remaining_seconds(user):
    if not user.last_pack_pull_at:
        return 0
    elapsed = timezone.now() - user.last_pack_pull_at
    return max(0, int((PACK_COOLDOWN - elapsed).total_seconds()))


def pack_status_payload(user):
    other_count = MysteryPackEntry.objects.exclude(donor=user).count()
    own_count = MysteryPackEntry.objects.filter(donor=user).count()
    remaining = pack_remaining_seconds(user)
    cooldown_seconds = int(PACK_COOLDOWN.total_seconds())
    progress = 1 if remaining == 0 else (cooldown_seconds - remaining) / cooldown_seconds
    opening = latest_opening(user)
    credits = user.pack_credits
    return {
        'ready': remaining == 0 and credits > 0 and other_count > 0,
        'credits': credits,
        'other_count': other_count,
        'own_count': own_count,
        'cooldown_seconds': cooldown_seconds,
        'remaining_seconds': remaining,
        'progress': progress,
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


def donate_error(user, message, http_status):
    return Response({**pack_status_payload(user), 'error': message}, status=http_status)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def donate_pack_card(request):
    card_id = request.data.get('card_id')
    if card_id is None:
        return donate_error(request.user, 'card_id is required.', status.HTTP_400_BAD_REQUEST)
    try:
        card_id = int(card_id)
    except (TypeError, ValueError):
        return donate_error(request.user, 'card_id must be a number.', status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        card = (
            Card.objects.select_for_update()
            .filter(pk=card_id, owner=request.user)
            .first()
        )
        if card is None:
            return donate_error(request.user, 'That card is not in your collection.', status.HTTP_404_NOT_FOUND)
        if TradeItem.objects.filter(trade__status=Trade.PENDING, card_id=card.id).exists():
            return donate_error(
                request.user,
                'That card is currently in a trade.',
                status.HTTP_400_BAD_REQUEST,
            )
        MysteryPackEntry.objects.create(donor=request.user, card=card)
        request.user.pack_credits += 1
        request.user.save(update_fields=['pack_credits'])

    return Response(pack_status_payload(request.user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pull_pack_card(request):
    current = pack_status_payload(request.user)
    if current['remaining_seconds'] > 0:
        return Response(
            {**current, 'error': 'Wait for the cooldown before pulling again.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if current['credits'] < 1:
        return Response(
            {**current, 'error': 'Trade a card into the pack before you can pull.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if current['other_count'] < 1:
        return Response(
            {**current, 'error': 'The mystery pack has no cards from other players yet.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        User = get_user_model()
        user = User.objects.select_for_update().get(pk=request.user.pk)
        remaining = pack_remaining_seconds(user)
        if remaining > 0:
            return Response(
                {**pack_status_payload(user), 'error': 'Wait for the cooldown before pulling again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if user.pack_credits < 1:
            return Response(
                {**pack_status_payload(user), 'error': 'Trade a card into the pack before you can pull.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ids = list(MysteryPackEntry.objects.exclude(donor=user).values_list('id', flat=True))
        if not ids:
            return Response(
                {**pack_status_payload(user), 'error': 'The mystery pack has no cards from other players yet.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry = MysteryPackEntry.objects.select_for_update().filter(pk=random.choice(ids)).first()
        if entry is None or entry.donor_id == user.id:
            return Response(
                {**pack_status_payload(user), 'error': 'That pack card is no longer available.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        card = Card.objects.select_for_update().get(pk=entry.card_id)
        donor = entry.donor
        entry.delete()
        card.owner = user
        card.save(update_fields=['owner'])
        opening = PackOpening.objects.create(user=user)
        PackPull.objects.create(opening=opening, card=card, from_user=donor)
        user.pack_credits -= 1
        user.last_pack_pull_at = timezone.now()
        user.save(update_fields=['pack_credits', 'last_pack_pull_at'])
        request.user.pack_credits = user.pack_credits
        request.user.last_pack_pull_at = user.last_pack_pull_at

    return Response(pack_status_payload(request.user), status=status.HTTP_201_CREATED)


# Backwards-compatible alias used by older clients.
open_pack = pull_pack_card
