from django.conf import settings
from django.db import models


class Room(models.Model):
    code = models.CharField(max_length=6, unique=True)

    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hosted_rooms',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.code


class RoomMember(models.Model):
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='members',
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='room_memberships',
    )

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['room', 'user'],
                name='unique_room_member',
            )
        ]