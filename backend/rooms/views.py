import random
import string

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Room, RoomMember


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
        'host': {
            'id': request.user.id,
            'display_name': request.user.display_name,
            'tag': request.user.tag,
        },
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

    members = room.members.select_related('user').all()

    return Response({
        'code': room.code,
        'is_host': request.user == room.host,

        'host': {
            'id': room.host.id,
            'display_name': room.host.display_name,
            'tag': room.host.tag,
        },

        'members': [
            {
                'id': member.user.id,
                'display_name': member.user.display_name,
                'tag': member.user.tag,
            }
            for member in members
        ],
    })