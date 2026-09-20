import os
import random
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from cards.images import compress_image_bytes

ENV_PATHS = (
    Path(__file__).resolve().parent.parent / '.env',
    Path(__file__).resolve().parent.parent.parent / '.env',
    Path(__file__).resolve().parent.parent.parent / '.env.local',
)
PLACEHOLDER_KEYS = {'', 'paste_your_key_here'}

FALLBACK_ICEBREAKERS = [
    "If these two cards started a tiny club, what absurd rule would they put on the door?",
    "Your cards just became roommates. What houseplant do they immediately disagree about?",
    "Invent a snack these two photos would invent together on a rainy afternoon.",
    "If these cards swapped places for a day, what surprising detail would each notice first?",
    "Give these photos a band name and explain the vibe in one sentence.",
]


def gemini_api_key():
    for path in ENV_PATHS:
        load_dotenv(path, override=False)
    for name in ('GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY'):
        value = (os.getenv(name) or '').strip().strip('"').strip("'")
        if value.lower() not in PLACEHOLDER_KEYS:
            return value
    return ''


def read_card_bytes(card):
    if card.image_data:
        return bytes(card.image_data)
    if not card.image:
        return b''
    try:
        with card.image.open('rb') as handle:
            return handle.read()
    except Exception:
        return b''


class MatchResult(BaseModel):
    player_a_card_id: int
    player_b_card_id: int
    has_real_connection: bool
    connection_note: str = Field(
        description='Short note about what the cards share, or a quirky invented link.'
    )
    icebreaker_question: str = Field(
        description='One engaging icebreaker question for both players to answer.'
    )


def _fallback_match(cards_a, cards_b):
    card_a = random.choice(cards_a)
    card_b = random.choice(cards_b)
    return {
        'card_a': card_a,
        'card_b': card_b,
        'has_real_connection': False,
        'connection_note': (
            'No obvious overlap — so we invented a delightfully weird link anyway.'
        ),
        'icebreaker_question': random.choice(FALLBACK_ICEBREAKERS),
    }


def match_cards_with_gemini(cards_a, cards_b):
    """Pick one card from each list and an icebreaker. Returns dict with Card objs."""
    if not cards_a or not cards_b:
        raise ValueError('Both players need at least one card.')

    api_key = gemini_api_key()
    if not api_key:
        return _fallback_match(cards_a, cards_b)

    by_id = {card.id: card for card in [*cards_a, *cards_b]}
    parts = []

    def add_player_block(label, cards):
        parts.append(
            f'{label} cards (choose exactly one id from this list):\n'
            + '\n'.join(
                f'- id={card.id}; rarity={card.rarity}; '
                f'story={card.story or "(no story)"}'
                for card in cards
            )
        )
        for card in cards:
            payload = read_card_bytes(card)
            if not payload:
                continue
            try:
                compressed = compress_image_bytes(payload, max_side=640, quality=65)
            except Exception:
                compressed = payload
            parts.append(
                types.Part.from_bytes(
                    data=compressed,
                    mime_type='image/jpeg',
                )
            )
            parts.append(f'(image for card id={card.id})')

    add_player_block('Player A', cards_a)
    add_player_block('Player B', cards_b)

    parts.append(
        """
You are matching two players' photo-cards for a social TCG game.

Pick exactly one card from Player A and one from Player B that feel most similar
or share the strongest connection based on the photos, stories, and rarity.

If nothing meaningful is in common, set has_real_connection=false and invent a
fun, quirky, random connection instead (still wholesome and playful).

Then write one icebreaker question both players should answer, grounded in that
connection (real or invented). Keep the icebreaker to 1-2 sentences.
"""
    )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=MatchResult,
            ),
        )
        result = MatchResult.model_validate_json(response.text)
        ids_a = {card.id for card in cards_a}
        ids_b = {card.id for card in cards_b}
        card_a = by_id.get(result.player_a_card_id)
        card_b = by_id.get(result.player_b_card_id)
        if card_a is None or card_a.id not in ids_a:
            card_a = random.choice(cards_a)
        if card_b is None or card_b.id not in ids_b:
            card_b = random.choice(cards_b)
        return {
            'card_a': card_a,
            'card_b': card_b,
            'has_real_connection': result.has_real_connection,
            'connection_note': result.connection_note.strip()
            or 'A surprising little spark between these two photos.',
            'icebreaker_question': result.icebreaker_question.strip()
            or random.choice(FALLBACK_ICEBREAKERS),
        }
    except Exception:
        return _fallback_match(cards_a, cards_b)


class PlayerPairSpec(BaseModel):
    user_a_id: int
    user_b_id: int
    connection_reason: str = ''


class GroupPairingResult(BaseModel):
    pairs: list[PlayerPairSpec]
    sit_out_user_ids: list[int] = Field(
        default_factory=list,
        description='User ids sitting out this round when the count is odd.',
    )


def _fallback_group_pairs(user_ids, previous_sit_out_ids=None):
    ids = list(user_ids)
    random.shuffle(ids)
    previous = set(previous_sit_out_ids or [])
    sit_outs = []

    if len(ids) % 2 == 1:
        candidates = [uid for uid in ids if uid not in previous] or list(ids)
        sit_out = random.choice(candidates)
        ids.remove(sit_out)
        sit_outs.append(sit_out)

    pairs = []
    while len(ids) >= 2:
        pairs.append((ids.pop(), ids.pop()))
    return pairs, sit_outs


def pair_players_with_gemini(player_profiles, previous_sit_out_ids=None):
    """
    player_profiles: list of dicts
      {user_id, display_name, cards: [{id, rarity, story}]}
    Returns (pairs: list[(user_a_id, user_b_id)], sit_out_ids: list[int])
    """
    user_ids = [profile['user_id'] for profile in player_profiles]
    if len(user_ids) < 2:
        return [], list(user_ids)

    if len(user_ids) == 2:
        return [(user_ids[0], user_ids[1])], []

    api_key = gemini_api_key()
    if not api_key:
        return _fallback_group_pairs(user_ids, previous_sit_out_ids)

    roster_lines = []
    for profile in player_profiles:
        card_bits = [
            f'[{card["rarity"]}] {card["story"] or "(no story)"}'
            for card in profile['cards'][:3]
        ]
        roster_lines.append(
            f'- user_id={profile["user_id"]} ({profile["display_name"]}): '
            + ('; '.join(card_bits) if card_bits else '(no cards)')
        )

    previous_note = ''
    if previous_sit_out_ids:
        previous_note = (
            'Players who sat out last round (prefer not to sit them again unless needed): '
            f'{list(previous_sit_out_ids)}.\n'
        )

    prompt = f"""
You are seating players for a multiplayer photo-card social game.

Players and a short summary of the cards they brought:
{chr(10).join(roster_lines)}

{previous_note}
Form pairs of exactly two players, maximizing meaningful shared connections
between their cards (themes, places, moods, rarity vibes, stories).

Rules:
- Every user_id may appear in at most one pair OR in sit_out_user_ids.
- If there is an odd number of players, exactly one player sits out.
- If even, sit_out_user_ids must be empty.
- Prefer rotating sit-outs (don't pick the same sitter as last round if avoidable).
- Only use the user_ids listed above.
"""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=GroupPairingResult,
            ),
        )
        result = GroupPairingResult.model_validate_json(response.text)
        valid = set(user_ids)
        used = set()
        pairs = []

        for pair in result.pairs:
            a, b = pair.user_a_id, pair.user_b_id
            if a not in valid or b not in valid or a == b:
                continue
            if a in used or b in used:
                continue
            pairs.append((a, b))
            used.add(a)
            used.add(b)

        sit_outs = [
            uid for uid in result.sit_out_user_ids
            if uid in valid and uid not in used
        ]

        leftover = [uid for uid in user_ids if uid not in used and uid not in sit_outs]
        extra_pairs, extra_sits = _fallback_group_pairs(leftover, previous_sit_out_ids)
        pairs.extend(extra_pairs)
        for uid in extra_sits:
            if uid not in sit_outs:
                sit_outs.append(uid)

        assigned = {uid for pair in pairs for uid in pair} | set(sit_outs)
        missing = [uid for uid in user_ids if uid not in assigned]
        if missing:
            extra_pairs, extra_sits = _fallback_group_pairs(missing, previous_sit_out_ids)
            pairs.extend(extra_pairs)
            sit_outs.extend(extra_sits)

        return pairs, sit_outs
    except Exception:
        return _fallback_group_pairs(user_ids, previous_sit_out_ids)

