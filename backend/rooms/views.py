import random
import string


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from cards.models import Card

from .models import ExchangeRound, Room, RoomMember
from accounts.serializers import PlayerSerializer


def generate_room_code():
    characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

    while True:
        code = ''.join(random.choices(characters, k=6))

        if not Room.objects.filter(code=code).exists():
            return code


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_room(request):
    code = generate_room_code()

    room = Room.objects.create(
        code=code,
        host=request.user,
    )

    return Response({
        'code': room.code,
        'is_host': True,
        'meeting_started': room.meeting_started,

        'host': PlayerSerializer(
            request.user,
            context={'viewer': request.user, 'request': request},
        ).data,

        'members': [],
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_room(request):
    code = request.data.get('code', '').strip().upper()

    if not code:
        return Response(
            {'detail': 'Room code is required.'},
            status=400,
        )

    room = Room.objects.filter(code=code).select_related('host').first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )


    # Host doesn't need to be added as a member
    if request.user != room.host:
        RoomMember.objects.get_or_create(
            room=room,
            user=request.user,
        )

        if room.meeting_started:
            pair_waiting_users(room)

    members = room.members.select_related('user').all()

    return Response({
        'code': room.code,
        'is_host': request.user == room.host,
        'meeting_started': room.meeting_started,

        'host': PlayerSerializer(
            room.host,
            context={'viewer': request.user, 'request': request},
        ).data,

        'members': [
            PlayerSerializer(
                member.user,
                context={'viewer': request.user, 'request': request},
            ).data
            for member in members
        ],
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_room(request, code):
    room = Room.objects.filter(
        code=code.upper()
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

    members = room.members.select_related('user').all()

    return Response({
        'code': room.code,
        'is_host': is_host,
        'meeting_started': room.meeting_started,

        'host': PlayerSerializer(
            room.host,
            context={'viewer': request.user, 'request': request},
        ).data,

        'members': [
            PlayerSerializer(
                member.user,
                context={'viewer': request.user, 'request': request},
            ).data
            for member in members
        ],
    })

def pair_waiting_users(room):
    participant_ids = [room.host_id]

    participant_ids += list(
        room.members.values_list('user_id', flat=True)
    )

    # Only exchanges involving people who are STILL in this room count.
    exchanges = ExchangeRound.objects.filter(
        room=room,
        completed=False,
    )

    # Remove broken exchanges where somebody is no longer in the room.
    for exchange in exchanges:
        if (
            exchange.user_one_id not in participant_ids
            or exchange.user_two_id not in participant_ids
        ):
            exchange.delete()

    # Re-query after deleting invalid exchanges.
    exchanges = ExchangeRound.objects.filter(
        room=room,
        completed=False,
    )

    paired_ids = set()

    for exchange in exchanges:
        paired_ids.add(exchange.user_one_id)
        paired_ids.add(exchange.user_two_id)

    waiting_ids = [
        user_id
        for user_id in participant_ids
        if user_id not in paired_ids
    ]

    random.shuffle(waiting_ids)

    while len(waiting_ids) >= 2:
        user_one_id = waiting_ids.pop()
        user_two_id = waiting_ids.pop()

        ExchangeRound.objects.create(
            room=room,
            user_one_id=user_one_id,
            user_two_id=user_two_id,
            icebreaker_question=(
                'What is a place you would love to visit and why?'
            ),
        )



@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def leave_room(request, code):
    room = Room.objects.filter(
        code=code.upper()
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

    # Delete this person's current exchange
    ExchangeRound.objects.filter(
        room=room
    ).filter(
        Q(user_one=request.user) |
        Q(user_two=request.user)
    ).delete()

    # Remove them from the room
    membership.delete()

    # Re-pair the people who are still in the meeting
    if room.meeting_started:
        pair_waiting_users(room)

    return Response({'room_closed': False})



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_meeting(request, code):
    room = Room.objects.filter(
        code=code.upper()
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
        })

    members = list(
        room.members.select_related('user')
    )

    # Host + everyone who joined
    participants = [room.host] + [
        member.user for member in members
    ]

    if len(participants) < 2:
        return Response(
            {'detail': 'At least two people are required.'},
            status=400,
        )

    room.meeting_started = True
    room.save(update_fields=['meeting_started'])

    pair_waiting_users(room)

    return Response({
        'meeting_started': True,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_room(request):
    # Check whether they're hosting a room
    room = Room.objects.filter(
        host=request.user
    ).order_by('-created_at').first()

    # Otherwise check whether they're a member
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

    members = room.members.select_related('user').all()

    return Response({
        'room': {
            'code': room.code,
            'is_host': room.host_id == request.user.id,
            'meeting_started': room.meeting_started,

            'host': PlayerSerializer(
                room.host,
                context={
                    'viewer': request.user,
                    'request': request,
                },
            ).data,

            'members': [
                PlayerSerializer(
                    member.user,
                    context={
                        'viewer': request.user,
                        'request': request,
                    },
                ).data
                for member in members
            ],
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_exchange(request, code):
    room = Room.objects.filter(
        code=code.upper()
    ).first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )

    exchange = ExchangeRound.objects.filter(
        room=room
    ).filter(
        Q(user_one=request.user) | Q(user_two=request.user)
    ).select_related(
        'user_one',
        'user_two',
    ).first()

    if exchange is None:
        return Response({
            'exchange': None,
        })

    if exchange.user_one_id == request.user.id:
        partner = exchange.user_two
        my_answer = exchange.user_one_answer
        my_give_card = exchange.user_one_gives_card
        my_want_card = exchange.user_one_wants_card
    else:
        partner = exchange.user_one
        my_answer = exchange.user_two_answer
        my_give_card = exchange.user_two_gives_card
        my_want_card = exchange.user_two_wants_card

    return Response({
        'exchange': {
            'id': exchange.id,

            'partner': PlayerSerializer(
                partner,
                context={
                    'viewer': request.user,
                    'request': request,
                },
            ).data,

            'icebreaker_question': exchange.icebreaker_question,

            'my_answer': my_answer,
            'answer_submitted': bool(my_answer),

            'my_give_card_id': (
                my_give_card.id if my_give_card else None
            ),
            'my_want_card_id': (
                my_want_card.id if my_want_card else None
            ),
            'cards_submitted': bool(
                my_give_card and my_want_card
            ),

            'completed': exchange.completed,
        }
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_icebreaker(request, code):
    room = Room.objects.filter(code=code.upper()).first()

    if room is None:
        return Response(
            {'detail': 'Room not found.'},
            status=404,
        )

    exchange = ExchangeRound.objects.filter(
        room=room
    ).filter(
        Q(user_one=request.user) | Q(user_two=request.user)
    ).first()

    if exchange is None:
        return Response(
            {'detail': 'Exchange not found.'},
            status=404,
        )

    answer = request.data.get('answer', '').strip()

    if not answer:
        return Response(
            {'detail': 'Answer is required.'},
            status=400,
        )

    if exchange.user_one_id == request.user.id:
        exchange.user_one_answer = answer
        exchange.save(update_fields=['user_one_answer'])
    else:
        exchange.user_two_answer = answer
        exchange.save(update_fields=['user_two_answer'])

    both_answered = bool(
        exchange.user_one_answer and exchange.user_two_answer
    )

    return Response({
        'submitted': True,
        'both_answered': both_answered,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def select_exchange_cards(request, code):
    room = Room.objects.filter(code=code.upper()).first()

    if room is None:
        return Response({'detail': 'Room not found.'}, status=404)

    exchange = ExchangeRound.objects.filter(
        room=room
    ).filter(
        Q(user_one=request.user) | Q(user_two=request.user)
    ).first()

    if exchange is None:
        return Response({'detail': 'Exchange not found.'}, status=404)

    give_card_id = request.data.get('give_card_id')
    want_card_id = request.data.get('want_card_id')

    if not give_card_id or not want_card_id:
        return Response(
            {'detail': 'You must select both cards.'},
            status=400,
        )

    # Figure out who the partner is
    if exchange.user_one_id == request.user.id:
        partner = exchange.user_two
    else:
        partner = exchange.user_one

    # The card you're giving MUST belong to you
    give_card = Card.objects.filter(
        id=give_card_id,
        owner=request.user,
    ).first()

    if give_card is None:
        return Response(
            {'detail': 'You do not own the card you are giving.'},
            status=400,
        )

    # The card you want MUST belong to your partner
    want_card = Card.objects.filter(
        id=want_card_id,
        owner=partner,
    ).first()

    if want_card is None:
        return Response(
            {'detail': 'That card does not belong to your partner.'},
            status=400,
        )

    # Save to the correct side of the exchange
    if exchange.user_one_id == request.user.id:
        exchange.user_one_gives_card = give_card
        exchange.user_one_wants_card = want_card

        exchange.save(update_fields=[
            'user_one_gives_card',
            'user_one_wants_card',
        ])

    else:
        exchange.user_two_gives_card = give_card
        exchange.user_two_wants_card = want_card

        exchange.save(update_fields=[
            'user_two_gives_card',
            'user_two_wants_card',
        ])

    return Response({
        'submitted': True,
        'give_card_id': give_card.id,
        'want_card_id': want_card.id,
    })