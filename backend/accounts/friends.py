from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Friendship
from .serializers import PlayerSerializer

User = get_user_model()


def related_friendship(user, other):
    return Friendship.objects.filter(
        Q(from_user=user, to_user=other) | Q(from_user=other, to_user=user)
    ).first()


def other_user_id(link, user):
    return link.to_user_id if link.from_user_id == user.id else link.from_user_id


class FriendsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        accepted = Friendship.objects.filter(status=Friendship.ACCEPTED).filter(
            Q(from_user=user) | Q(to_user=user)
        ).select_related('from_user', 'to_user')
        incoming = Friendship.objects.filter(
            to_user=user,
            status=Friendship.PENDING,
        ).select_related('from_user')
        friends = [
            link.to_user if link.from_user_id == user.id else link.from_user
            for link in accepted
        ]
        return Response({
            'friends': PlayerSerializer(friends, many=True, context={'viewer': user, 'request': request}).data,
            'incoming': PlayerSerializer(
                [link.from_user for link in incoming],
                many=True,
                context={'viewer': user, 'request': request},
            ).data,
        })


class FriendSuggestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        linked_ids = Friendship.objects.filter(Q(from_user=user) | Q(to_user=user)).values_list(
            'from_user_id', 'to_user_id'
        )
        exclude_ids = {user.id}
        for from_id, to_id in linked_ids:
            exclude_ids.add(from_id)
            exclude_ids.add(to_id)
        players = User.objects.exclude(id__in=exclude_ids).order_by('display_name')[:20]
        return Response({
            'users': PlayerSerializer(players, many=True, context={'viewer': user, 'request': request}).data,
        })


class FriendSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if len(query) < 1:
            return Response({'users': []})
        players = User.objects.exclude(id=request.user.id).filter(
            display_name__icontains=query,
        ).order_by('display_name')[:20]
        return Response({
            'users': PlayerSerializer(players, many=True, context={'viewer': request.user, 'request': request}).data,
        })


class FriendRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_id = request.data.get('user_id')
        if user_id is None:
            return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if int(user_id) == request.user.id:
            return Response({'detail': 'You cannot friend yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        other = User.objects.filter(id=user_id).first()
        if other is None:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        link = related_friendship(request.user, other)
        if link is None:
            Friendship.objects.create(from_user=request.user, to_user=other, status=Friendship.PENDING)
        elif link.status == Friendship.ACCEPTED:
            return Response({'detail': 'You are already friends.'}, status=status.HTTP_400_BAD_REQUEST)
        elif link.to_user_id == request.user.id:
            link.status = Friendship.ACCEPTED
            link.save(update_fields=['status'])
        elif link.from_user_id == request.user.id:
            return Response(
                PlayerSerializer(other, context={'viewer': request.user, 'request': request}).data,
            )

        other.refresh_from_db()
        return Response(
            PlayerSerializer(other, context={'viewer': request.user, 'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class FriendDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        if user_id == request.user.id:
            return Response({'detail': 'You cannot unfriend yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        other = User.objects.filter(id=user_id).first()
        if other is None:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        link = related_friendship(request.user, other)
        if link is None:
            return Response({'detail': 'No friendship to remove.'}, status=status.HTTP_404_NOT_FOUND)
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlayerDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        player = User.objects.filter(id=user_id).first()
        if player is None:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PlayerSerializer(player, context={'viewer': request.user, 'request': request}).data)
