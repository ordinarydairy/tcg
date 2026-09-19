from django.shortcuts import render

# Create your views here.

import os

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from rest_framework.decorators import api_view, parser_classes

from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

load_dotenv()


class PhotoScores(BaseModel):
    photo_quality: int = Field(ge=0, le=10)
    location_significance: int = Field(ge=0, le=10)
    occasion: int = Field(ge=0, le=10)
    uniqueness: int = Field(ge=0, le=10)
    memory_story: int = Field(ge=0, le=10)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def grade_photo(request):
    image = request.FILES.get("image")
    story = request.data.get("story", "")

    if image is None:
        return Response(
            {"error": "No image was uploaded."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return Response(
            {"error": "GEMINI_API_KEY was not found."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        client = genai.Client(api_key=api_key)

        image_bytes = image.read()

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
            model="gemini-3.6-flash",
            contents=[
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=image.content_type or "image/jpeg",
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PhotoScores,
            ),
        )

        scores = PhotoScores.model_validate_json(response.text)

        return Response(scores.model_dump())

    except Exception as error:
        return Response(
            {"error": str(error)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )