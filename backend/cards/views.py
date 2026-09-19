import mimetypes
import os

from pathlib import Path

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Card

load_dotenv(Path(__file__).resolve().parent.parent / '.env')


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

    api_key = os.getenv('GEMINI_API_KEY')

    if not api_key:
        return Response(
            {'error': 'GEMINI_API_KEY was not found.'},
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
    cards = Card.objects.filter(owner=request.user).order_by('-created_at')
    return Response([card_payload(card) for card in cards])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def card_image(request, card_id):
    card = get_object_or_404(Card, pk=card_id, owner=request.user)
    content_type = mimetypes.guess_type(card.image.name)[0] or 'application/octet-stream'
    return FileResponse(card.image.open('rb'), content_type=content_type)
