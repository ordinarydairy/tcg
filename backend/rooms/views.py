import random

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from cards.models import Card

from .models import ExchangeRound, Room, RoomDeckCard, RoomMember
from accounts.serializers import PlayerSerializer


def generate_room_code():
    while True:
        code = f'{random.randint(0, 9999):04d}'
        if not Room.objects.filter(code=code).exists():
            return code


def normalize_room_code(code):
    return str(code or '').strip()


def save_room_deck(room, user, card_ids):
    if not isinstance(card_ids, list):
        return Response(
            {'detail': 'card_ids must be a list.'},
            status=400,
        )

    if len(card_ids) < 1:
        return Response(
            {'detail': 'Select at least 1 card.'},
            status=400,
        )

    if len(card_ids) > 3:
        return Response(
            {'detail': 'Select at most 3 cards.'},
            status=400,
        )

    try:
        normalized_ids = [int(card_id) for card_id in card_ids]
    except (TypeError, ValueError):
        return Response(
            {'detail': 'Invalid card ids.'},
            status=400,
        )

    if len(set(normalized_ids)) != len(normalized_ids):
        return Response(
            {'detail': 'Duplicate cards are not allowed.'},
            status=400,
        )

    cards = list(
        Card.objects.filter(
            id__in=normalized_ids,
            owner=user,
            pack_entry__isnull=True,
        )
    )

    if len(cards) != len(normalized_ids):
        return Response(
            {'detail': 'You can only bring cards you own.'},
            status=400,
        )

    RoomDeckCard.objects.filter(room=room, user=user).delete()
    RoomDeckCard.objects.bulk_create([
        RoomDeckCard(room=room, user=user, card=card)
        for card in cards
    ])
    return None


def decks_by_user_id(room):
    from cards.views import card_payload

    decks = {}
    deck_rows = (
        room.deck_cards
        .select_related('card', 'card__owner', 'card__creator')
        .all()
    )
    for row in deck_rows:
        decks.setdefault(row.user_id, []).append(card_payload(row.card))
    return decks


def serialize_room(room, viewer, request):
    decks = decks_by_user_id(room)
    members = room.members.select_related('user').all()
    is_host = room.host_id == viewer.id

    return {
        'code': room.code,
        'is_host': is_host,
        'meeting_started': room.meeting_started,
        'game_over': room.game_over,
        'host': PlayerSerializer(
            room.host,
            context={'viewer': viewer, 'request': request},
        ).data,
        'host_cards': decks.get(room.host_id, []),
        'members': [
            {
                **PlayerSerializer(
                    member.user,
                    context={'viewer': viewer, 'request': request},
                ).data,
                'cards': decks.get(member.user_id, []),
            }
            for member in members
        ],
    }


def deck_cards_for_user(room, user):
    return list(
        Card.objects.filter(
            id__in=RoomDeckCard.objects.filter(room=room, user=user).values_list(
                'card_id', flat=True
            )
        ).select_related('owner', 'creator')
    )


def eligible_add_cards(room, user):
    blocked = set(room.blocked_card_ids or [])
    in_deck = set(
        RoomDeckCard.objects.filter(room=room, user=user).values_list('card_id', flat=True)
    )
    return list(
        Card.objects.filter(owner=user, pack_entry__isnull=True)
        .exclude(id__in=blocked | in_deck)
        .select_related('owner', 'creator')
        .order_by('-created_at')
    )


def end_room_game(room):
    room.game_over = True
    room.current_sit_out_ids = []
    room.save(update_fields=['game_over', 'current_sit_out_ids'])
    ExchangeRound.objects.filter(room=room, completed=False).update(
        completed=True,
        status=ExchangeRound.STATUS_DONE,
    )


def participant_ids_for_room(room):
    return [room.host_id, *list(room.members.values_list('user_id', flat=True))]


def players_with_deck_cards(room):
    ready = []
    for user_id in participant_ids_for_room(room):
        if RoomDeckCard.objects.filter(room=room, user_id=user_id).count() >= 1:
            ready.append(user_id)
    return ready


def maybe_end_if_too_few_players(room):
    if len(players_with_deck_cards(room)) < 2:
        end_room_game(room)
        return True
    return False


def create_matched_exchange(room, user_one_id, user_two_id):
    from .matching import match_cards_with_gemini

    cards_one = deck_cards_for_user(room, user_one_id)
    cards_two = deck_cards_for_user(room, user_two_id)

    if not cards_one or not cards_two:
        return None

    match = match_cards_with_gemini(cards_one, cards_two)

    return ExchangeRound.objects.create(
        room=room,
        user_one_id=user_one_id,
        user_two_id=user_two_id,
        matched_card_one=match['card_a'],
        matched_card_two=match['card_b'],
        connection_note=match['connection_note'],
        icebreaker_question=match['icebreaker_question'],
        status=ExchangeRound.STATUS_ICEBREAKER,
    )


def execute_trade(exchange):
    card_one = exchange.matched_card_one
    card_two = exchange.matched_card_two
    if card_one is None or card_two is None:
        return False

    if card_one.owner_id != exchange.user_one_id or card_two.owner_id != exchange.user_two_id:
        return False

    RoomDeckCard.objects.filter(
        room=exchange.room,
        user_id=exchange.user_one_id,
        card=card_one,
    ).delete()
    RoomDeckCard.objects.filter(
        room=exchange.room,
        user_id=exchange.user_two_id,
        card=card_two,
    ).delete()

    card_one.owner_id = exchange.user_two_id
    card_two.owner_id = exchange.user_one_id
    card_one.save(update_fields=['owner'])
    card_two.save(update_fields=['owner'])

    blocked = list(exchange.room.blocked_card_ids or [])
    for card_id in (card_one.id, card_two.id):
        if card_id not in blocked:
            blocked.append(card_id)
    exchange.room.blocked_card_ids = blocked
    exchange.room.save(update_fields=['blocked_card_ids'])

    exchange.trade_completed = True
    exchange.save(update_fields=['trade_completed'])
    return True


def advance_after_trade_votes(exchange):
    if (
        exchange.user_one_wants_trade is None
        or exchange.user_two_wants_trade is None
    ):
        return

    if exchange.user_one_wants_trade and exchange.user_two_wants_trade:
        execute_trade(exchange)

    exchange.status = ExchangeRound.STATUS_BETWEEN
    exchange.save(update_fields=['status'])
    maybe_end_if_too_few_players(exchange.room)


def maybe_start_next_round(exchange):
    if not (exchange.user_one_ready and exchange.user_two_ready):
        return None

    room = exchange.room
    if room.game_over:
        return None

    exchange.completed = True
    exchange.status = ExchangeRound.STATUS_DONE
    exchange.save(update_fields=['completed', 'status'])

    # Wait until every active pair finishes before rematching the whole room
    if ExchangeRound.objects.filter(room=room, completed=False).exists():
        return None

    if maybe_end_if_too_few_players(room):
        return None

    pair_waiting_users(room)
    return None


def serialize_exchange(exchange, viewer, request):
    from cards.views import card_payload

    if exchange.user_one_id == viewer.id:
        partner = exchange.user_two
        my_answer = exchange.user_one_answer
        their_answer = exchange.user_two_answer
        my_card = exchange.matched_card_one
        their_card = exchange.matched_card_two
        my_trade_vote = exchange.user_one_wants_trade
        their_trade_vote = exchange.user_two_wants_trade
        i_am_ready = exchange.user_one_ready
        they_are_ready = exchange.user_two_ready
    else:
        partner = exchange.user_one
        my_answer = exchange.user_two_answer
        their_answer = exchange.user_one_answer
        my_card = exchange.matched_card_two
        their_card = exchange.matched_card_one
        my_trade_vote = exchange.user_two_wants_trade
        their_trade_vote = exchange.user_one_wants_trade
        i_am_ready = exchange.user_two_ready
        they_are_ready = exchange.user_one_ready

    both_answered = bool(exchange.user_one_answer and exchange.user_two_answer)
    room = exchange.room
    my_deck_count = RoomDeckCard.objects.filter(room=room, user=viewer).count()
    addable = eligible_add_cards(room, viewer)

    return {
        'id': exchange.id,
        'status': exchange.status,
        'partner': PlayerSerializer(
            partner,
            context={'viewer': viewer, 'request': request},
        ).data,
        'connection_note': exchange.connection_note,
        'icebreaker_question': exchange.icebreaker_question,
        'my_card': card_payload(my_card) if my_card else None,
        'their_card': card_payload(their_card) if their_card else None,
        'my_answer': my_answer,
        'their_answer': their_answer if both_answered else '',
        'answer_submitted': bool(my_answer),
        'both_answered': both_answered,
        'my_trade_vote': my_trade_vote,
        'their_trade_vote': their_trade_vote,
        'both_voted_trade': (
            exchange.user_one_wants_trade is not None
            and exchange.user_two_wants_trade is not None
        ),
        'trade_completed': exchange.trade_completed,
        'i_am_ready': i_am_ready,
        'they_are_ready': they_are_ready,
        'my_deck_count': my_deck_count,
        'addable_cards': [card_payload(card) for card in addable],
        'can_add_card': bool(addable) and my_deck_count < 3,
        'game_over': room.game_over or exchange.status == ExchangeRound.STATUS_DONE,
        'completed': exchange.completed,
        'sitting_out': False,
        'waiting_for_rematch': False,
    }


def played_with_players(room, viewer, request):
    """Players this viewer was paired with in any exchange in the room."""
    partner_ids = set()
    rounds = ExchangeRound.objects.filter(room=room).filter(
        Q(user_one=viewer) | Q(user_two=viewer)
    )
    for exchange in rounds:
        partner_ids.add(
            exchange.user_two_id
            if exchange.user_one_id == viewer.id
            else exchange.user_one_id
        )
    partner_ids.discard(viewer.id)
    if not partner_ids:
        return []

    from django.contrib.auth import get_user_model

    User = get_user_model()
    partners = list(User.objects.filter(id__in=partner_ids).order_by('display_name'))
    return PlayerSerializer(
        partners,
        many=True,
        context={'viewer': viewer, 'request': request},
    ).data


def exchange_idle_payload(room, viewer, request=None):
    sit_outs = set(room.current_sit_out_ids or [])
    others_playing = ExchangeRound.objects.filter(room=room, completed=False).exists()
    sitting_out = viewer.id in sit_outs
    payload = {
        'exchange': None,
        'game_over': room.game_over,
        'sitting_out': sitting_out,
        'waiting_for_rematch': (
            room.meeting_started
            and not room.game_over
            and (others_playing or sitting_out)
        ),
    }
    if room.game_over and request is not None:
        payload['played_with'] = played_with_players(room, viewer, request)
    return payload


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_room(request):
    card_ids = request.data.get('card_ids', [])
    code = generate_room_code()

    room = Room.objects.create(
        code=code,
        host=request.user,
    )

    error = save_room_deck(room, request.user, card_ids)
    if error is not None:
        room.delete()
        return error

    return Response(serialize_room(room, request.user, request))

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_room(request):
    code = normalize_room_code(request.data.get('code'))
    card_ids = request.data.get('card_ids', [])

    if not code:
        return Response(
            {'detail': 'Room code is required.'},
            status=400,
        )

    if not code.isdigit() or len(code) != 4:
        return Response(
            {'detail': 'Room code must be 4 digits.'},
            status=400,
        )

    room = Room.objects.filter(code=code).select_related('host').first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )

    error = save_room_deck(room, request.user, card_ids)
    if error is not None:
        return error

    # Host doesn't need to be added as a member
    if request.user != room.host:
        RoomMember.objects.get_or_create(
            room=room,
            user=request.user,
        )

        if room.meeting_started:
            pair_waiting_users(room)

    return Response(serialize_room(room, request.user, request))

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_room(request, code):
    room = Room.objects.filter(
        code=normalize_room_code(code)
    ).select_related('host').first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )

    # Only the host or a member can view the room
    is_host = room.host_id == request.user.id
    is_member = room.members.filter(user=request.user).exists()

    if not is_host and not is_member:
        return Response(
            {'detail': 'You are not in this room.'},
            status=403,
        )

    return Response(serialize_room(room, request.user, request))

def pair_waiting_users(room):
    if room.game_over:
        return

    from django.contrib.auth import get_user_model
    from .matching import pair_players_with_gemini

    User = get_user_model()
    participant_ids = participant_ids_for_room(room)

    # Drop exchanges whose players left the room
    for exchange in ExchangeRound.objects.filter(room=room, completed=False):
        if (
            exchange.user_one_id not in participant_ids
            or exchange.user_two_id not in participant_ids
        ):
            exchange.delete()

    paired_ids = set()
    for exchange in ExchangeRound.objects.filter(room=room, completed=False):
        paired_ids.add(exchange.user_one_id)
        paired_ids.add(exchange.user_two_id)

    waiting_ids = [
        user_id
        for user_id in participant_ids
        if user_id not in paired_ids
        and RoomDeckCard.objects.filter(room=room, user_id=user_id).count() >= 1
    ]

    if len(waiting_ids) < 2:
        # Keep existing sit-outs for anyone still waiting alone
        alone = [uid for uid in waiting_ids if uid not in paired_ids]
        if alone and not paired_ids:
            maybe_end_if_too_few_players(room)
        return

    previous_sit_outs = list(room.current_sit_out_ids or [])
    profiles = []
    users = {
        user.id: user
        for user in User.objects.filter(id__in=waiting_ids)
    }
    for user_id in waiting_ids:
        user = users.get(user_id)
        cards = deck_cards_for_user(room, user_id)
        profiles.append({
            'user_id': user_id,
            'display_name': getattr(user, 'display_name', None) or f'Player {user_id}',
            'cards': [
                {
                    'id': card.id,
                    'rarity': card.rarity,
                    'story': card.story or '',
                }
                for card in cards
            ],
        })

    pairs, sit_outs = pair_players_with_gemini(
        profiles,
        previous_sit_out_ids=previous_sit_outs,
    )

    room.current_sit_out_ids = sit_outs
    room.save(update_fields=['current_sit_out_ids'])

    for user_one_id, user_two_id in pairs:
        create_matched_exchange(room, user_one_id, user_two_id)

    if not pairs and not ExchangeRound.objects.filter(room=room, completed=False).exists():
        maybe_end_if_too_few_players(room)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def leave_room(request, code):
    room = Room.objects.filter(
        code=normalize_room_code(code)
    ).first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )

    # Host leaving = destroy the entire room
    if room.host_id == request.user.id:
        room.delete()

        return Response({
            'room_closed': True,
        })

    # Regular member leaving
    membership = RoomMember.objects.filter(
        room=room,
        user=request.user,
    ).first()

    if membership is None:
        return Response(
            {'detail': 'You are not in this room.'},
            status=403,
        )

    ExchangeRound.objects.filter(
        room=room
    ).filter(
        Q(user_one=request.user) |
        Q(user_two=request.user)
    ).delete()

    RoomDeckCard.objects.filter(room=room, user=request.user).delete()

    membership.delete()

    if room.meeting_started and not room.game_over:
        pair_waiting_users(room)

    return Response({'room_closed': False})



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_meeting(request, code):
    room = Room.objects.filter(
        code=normalize_room_code(code)
    ).first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )

    if room.host_id != request.user.id:
        return Response(
            {'detail': 'Only the host can start the meeting.'},
            status=403,
        )

    if room.meeting_started:
        return Response({
            'meeting_started': True,
            'game_over': room.game_over,
        })

    members = list(
        room.members.select_related('user')
    )

    participants = [room.host] + [
        member.user for member in members
    ]

    if len(participants) < 2:
        return Response(
            {'detail': 'At least two people are required.'},
            status=400,
        )

    for person in participants:
        if RoomDeckCard.objects.filter(room=room, user=person).count() < 1:
            return Response(
                {'detail': 'Every player needs at least one card in the room.'},
                status=400,
            )

    room.meeting_started = True
    room.game_over = False
    room.current_sit_out_ids = []
    room.save(update_fields=['meeting_started', 'game_over', 'current_sit_out_ids'])

    pair_waiting_users(room)

    return Response({
        'meeting_started': True,
        'game_over': room.game_over,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_room(request):
    room = Room.objects.filter(
        host=request.user
    ).order_by('-created_at').first()

    if room is None:
        membership = RoomMember.objects.filter(
            user=request.user
        ).select_related('room', 'room__host').order_by(
            '-joined_at'
        ).first()

        if membership:
            room = membership.room

    if room is None:
        return Response({'room': None})

    return Response({
        'room': serialize_room(room, request.user, request),
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_exchange(request, code):
    room = Room.objects.filter(
        code=normalize_room_code(code)
    ).first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )

    if room.game_over:
        return Response({
            'exchange': None,
            'game_over': True,
            'sitting_out': False,
            'waiting_for_rematch': False,
            'played_with': played_with_players(room, request.user, request),
        })

    exchange = (
        ExchangeRound.objects.filter(room=room, completed=False)
        .filter(Q(user_one=request.user) | Q(user_two=request.user))
        .select_related(
            'user_one',
            'user_two',
            'matched_card_one',
            'matched_card_two',
            'matched_card_one__owner',
            'matched_card_one__creator',
            'matched_card_two__owner',
            'matched_card_two__creator',
            'room',
        )
        .order_by('-created_at')
        .first()
    )

    if exchange is None:
        return Response(exchange_idle_payload(room, request.user, request))

    return Response({
        'exchange': serialize_exchange(exchange, request.user, request),
        'game_over': room.game_over,
        'sitting_out': False,
        'waiting_for_rematch': False,
        'played_with': (
            played_with_players(room, request.user, request)
            if room.game_over
            else []
        ),
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_icebreaker(request, code):
    room = Room.objects.filter(code=normalize_room_code(code)).first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )

    exchange = ExchangeRound.objects.filter(
        room=room,
        completed=False,
    ).filter(
        Q(user_one=request.user) | Q(user_two=request.user)
    ).first()

    if exchange is None:
        return Response(
            {'detail': 'Exchange not found.'},
            status=404,
        )

    if exchange.status != ExchangeRound.STATUS_ICEBREAKER:
        return Response(
            {'detail': 'Icebreaker answers are locked for this round.'},
            status=400,
        )

    answer = request.data.get('answer', '').strip()

    if not answer:
        return Response(
            {'detail': 'Answer is required.'},
            status=400,
        )

    if exchange.user_one_id == request.user.id:
        if exchange.user_one_answer:
            return Response({'detail': 'You already answered.'}, status=400)
        exchange.user_one_answer = answer
        exchange.save(update_fields=['user_one_answer'])
    else:
        if exchange.user_two_answer:
            return Response({'detail': 'You already answered.'}, status=400)
        exchange.user_two_answer = answer
        exchange.save(update_fields=['user_two_answer'])

    both_answered = bool(
        exchange.user_one_answer and exchange.user_two_answer
    )

    if both_answered:
        exchange.status = ExchangeRound.STATUS_TRADE
        exchange.save(update_fields=['status'])

    return Response({
        'submitted': True,
        'both_answered': both_answered,
        'exchange': serialize_exchange(exchange, request.user, request),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def vote_trade(request, code):
    room = Room.objects.filter(code=normalize_room_code(code)).first()
    if room is None:
        return Response({'detail': 'Room not found.'}, status=404)

    exchange = ExchangeRound.objects.filter(
        room=room,
        completed=False,
        status=ExchangeRound.STATUS_TRADE,
    ).filter(
        Q(user_one=request.user) | Q(user_two=request.user)
    ).select_related('matched_card_one', 'matched_card_two', 'room').first()

    if exchange is None:
        return Response({'detail': 'Exchange not found.'}, status=404)

    wants = request.data.get('wants_trade')
    if not isinstance(wants, bool):
        return Response({'detail': 'wants_trade must be true or false.'}, status=400)

    if exchange.user_one_id == request.user.id:
        if exchange.user_one_wants_trade is not None:
            return Response({'detail': 'You already voted.'}, status=400)
        exchange.user_one_wants_trade = wants
        exchange.save(update_fields=['user_one_wants_trade'])
    else:
        if exchange.user_two_wants_trade is not None:
            return Response({'detail': 'You already voted.'}, status=400)
        exchange.user_two_wants_trade = wants
        exchange.save(update_fields=['user_two_wants_trade'])

    advance_after_trade_votes(exchange)
    exchange.refresh_from_db()
    room.refresh_from_db()

    return Response({
        'exchange': serialize_exchange(exchange, request.user, request),
        'game_over': room.game_over,
        'played_with': (
            played_with_players(room, request.user, request)
            if room.game_over
            else []
        ),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_exchange_card(request, code):
    room = Room.objects.filter(code=normalize_room_code(code)).first()
    if room is None:
        return Response({'detail': 'Room not found.'}, status=404)

    if room.game_over:
        return Response({'detail': 'The game is over.'}, status=400)

    exchange = ExchangeRound.objects.filter(
        room=room,
        completed=False,
        status=ExchangeRound.STATUS_BETWEEN,
    ).filter(
        Q(user_one=request.user) | Q(user_two=request.user)
    ).first()

    if exchange is None:
        return Response({'detail': 'Exchange not found.'}, status=404)

    card_id = request.data.get('card_id')
    try:
        card_id = int(card_id)
    except (TypeError, ValueError):
        return Response({'detail': 'Invalid card_id.'}, status=400)

    deck_count = RoomDeckCard.objects.filter(room=room, user=request.user).count()
    if deck_count >= 3:
        return Response({'detail': 'Your room deck is full (max 3).'}, status=400)

    if card_id in (room.blocked_card_ids or []):
        return Response(
            {'detail': 'You can’t add a card gained from a trade in this game.'},
            status=400,
        )

    card = Card.objects.filter(
        id=card_id,
        owner=request.user,
        pack_entry__isnull=True,
    ).first()
    if card is None:
        return Response({'detail': 'You can only add cards you own.'}, status=400)

    if RoomDeckCard.objects.filter(room=room, user=request.user, card=card).exists():
        return Response({'detail': 'That card is already in your room deck.'}, status=400)

    RoomDeckCard.objects.create(room=room, user=request.user, card=card)

    return Response({
        'exchange': serialize_exchange(exchange, request.user, request),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ready_next_round(request, code):
    room = Room.objects.filter(code=normalize_room_code(code)).first()
    if room is None:
        return Response({'detail': 'Room not found.'}, status=404)

    if room.game_over:
        return Response({'detail': 'The game is over.', 'game_over': True}, status=400)

    exchange = ExchangeRound.objects.filter(
        room=room,
        completed=False,
        status=ExchangeRound.STATUS_BETWEEN,
    ).filter(
        Q(user_one=request.user) | Q(user_two=request.user)
    ).first()

    if exchange is None:
        return Response({'detail': 'Exchange not found.'}, status=404)

    if RoomDeckCard.objects.filter(room=room, user=request.user).count() < 1:
        return Response(
            {'detail': 'Add another card before continuing, or end the game.'},
            status=400,
        )

    if exchange.user_one_id == request.user.id:
        exchange.user_one_ready = True
        exchange.save(update_fields=['user_one_ready'])
    else:
        exchange.user_two_ready = True
        exchange.save(update_fields=['user_two_ready'])

    next_exchange = maybe_start_next_round(exchange)
    room.refresh_from_db()

    active = next_exchange
    if active is None:
        active = (
            ExchangeRound.objects.filter(room=room, completed=False)
            .filter(Q(user_one=request.user) | Q(user_two=request.user))
            .order_by('-created_at')
            .first()
        )

    if active is None:
        return Response(exchange_idle_payload(room, request.user, request))

    return Response({
        'exchange': serialize_exchange(active, request.user, request),
        'game_over': room.game_over,
        'sitting_out': False,
        'waiting_for_rematch': False,
        'played_with': (
            played_with_players(room, request.user, request)
            if room.game_over
            else []
        ),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def end_game(request, code):
    room = Room.objects.filter(code=normalize_room_code(code)).first()
    if room is None:
        return Response({'detail': 'Room not found.'}, status=404)

    is_host = room.host_id == request.user.id
    is_member = room.members.filter(user=request.user).exists()
    if not is_host and not is_member:
        return Response({'detail': 'You are not in this room.'}, status=403)

    end_room_game(room)

    return Response({
        'game_over': True,
        'played_with': played_with_players(room, request.user, request),
    })

