"""
test_gemini_grading.py

A tiny script to prove Gemini can grade one photo and return scores.
This is the "hard part" of the project, tested by itself before any app.

WHAT IT DOES (read before running):
  1. Reads ONE photo from the path you set below.
  2. Sends it to the Google Gemini API and asks for 5 scores (0-10) as JSON.
  3. YOUR code averages the scores into a 0-100 total and picks a rarity.
  4. Prints everything so you can see it worked.

SETUP (do once):
  pip install google-genai

Then set the two values in the CONFIG section below and run:
  python test_gemini_grading.py
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(Path(__file__).resolve().parent / ".env")

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise SystemExit("GEMINI_API_KEY was not found. Put it in backend/.env")

# The photo to grade. Use the full path to a real image on your computer.
PHOTO_PATH = "/Users/sophi/OneDrive/Pictures/3.png"

# A short story the user would type about the photo (this feeds the memory score).
STORY = "This is where I graduated from college with my family."

# ---------------------------------------------------------------------------
# The rest is the working code - you should not need to change it.
# ---------------------------------------------------------------------------

MODEL = "gemini-3.6-flash"  # free-tier model that can read images

# Figure out the image type from the file name ending.
MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

PROMPT = (
    "You are grading a photo for a collectible-card app. "
    "Look at the image and the user's story, then rate it 0 to 10 on each "
    "category. Return ONLY JSON in exactly this shape, no extra text:\n"
    "{\n"
    '  "photo_quality": 0,\n'
    '  "location": 0,\n'
    '  "occasion": 0,\n'
    '  "uniqueness": 0,\n'
    '  "memory": 0,\n'
    '  "reasoning": "one short sentence"\n'
    "}\n\n"
    "User's story: " + STORY
)


def grade_photo():
    # Read the raw bytes of the photo.
    with open(PHOTO_PATH, "rb") as f:
        image_bytes = f.read()

    # Pick the mime type from the file ending (e.g. .jpg -> image/jpeg).
    ending = PHOTO_PATH[PHOTO_PATH.rfind("."):].lower()
    mime_type = MIME_BY_EXTENSION.get(ending, "image/jpeg")

    # Ask Gemini, forcing the answer to be JSON.
    client = genai.Client(api_key=API_KEY)
    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    # Turn the JSON text into a Python dictionary.
    scores = json.loads(response.text)
    return scores


def rarity_for(total):
    # total is 0-100. This is the backend deciding, not the AI.
    if total >= 90:
        return "Legendary"
    if total >= 75:
        return "Epic"
    if total >= 60:
        return "Rare"
    if total >= 40:
        return "Uncommon"
    return "Common"


def main():
    scores = grade_photo()

    # The five 0-10 scores, in a fixed order.
    categories = ["photo_quality", "location", "occasion", "uniqueness", "memory"]

    # Average the five scores, then scale from 0-10 up to 0-100.
    average_out_of_10 = sum(scores[c] for c in categories) / len(categories)
    total_out_of_100 = round(average_out_of_10 * 10)
    rarity = rarity_for(total_out_of_100)

    # Show the result.
    print("\n--- Photo scores (0-10) ---")
    for c in categories:
        print(f"  {c:15} {scores[c]}/10")
    print(f"\n  Overall:        {total_out_of_100}/100")
    print(f"  Rarity:         {rarity}")
    print(f"\n  AI reasoning:   {scores.get('reasoning', '')}\n")


if __name__ == "__main__":
    main()