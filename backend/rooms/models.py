from django.conf import settings
from django.db import models


class Room(models.Model):
    code = models.CharField(max_length=4, unique=True)

    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hosted_rooms',
    )

    meeting_started = models.BooleanField(default=False)
    game_over = models.BooleanField(default=False)
    blocked_card_ids = models.JSONField(default=list, blank=True)
    current_sit_out_ids = models.JSONField(default=list, blank=True)

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


class RoomDeckCard(models.Model):
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='deck_cards',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='room_deck_cards',
    )
    card = models.ForeignKey(
        'cards.Card',
        on_delete=models.CASCADE,
        related_name='+',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['room', 'user', 'card'],
                name='unique_room_deck_card',
            )
        ]


class ExchangeRound(models.Model):
    STATUS_ICEBREAKER = 'icebreaker'
    STATUS_TRADE = 'trade'
    STATUS_BETWEEN = 'between_rounds'
    STATUS_DONE = 'done'

    STATUS_CHOICES = [
        (STATUS_ICEBREAKER, 'Icebreaker'),
        (STATUS_TRADE, 'Trade'),
        (STATUS_BETWEEN, 'Between rounds'),
        (STATUS_DONE, 'Done'),
    ]

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='exchange_rounds',
    )

    user_one = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='exchange_rounds_as_user_one',
    )

    user_two = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='exchange_rounds_as_user_two',
    )

    matched_card_one = models.ForeignKey(
        'cards.Card',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    matched_card_two = models.ForeignKey(
        'cards.Card',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )

    connection_note = models.TextField(blank=True)
    icebreaker_question = models.TextField(blank=True)

    user_one_answer = models.TextField(blank=True)
    user_two_answer = models.TextField(blank=True)

    user_one_wants_trade = models.BooleanField(null=True, blank=True)
    user_two_wants_trade = models.BooleanField(null=True, blank=True)
    trade_completed = models.BooleanField(default=False)

    user_one_ready = models.BooleanField(default=False)
    user_two_ready = models.BooleanField(default=False)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ICEBREAKER,
    )

    completed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user_one} ↔ {self.user_two} ({self.room.code})'
