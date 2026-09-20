from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.friends import accepted_friend_ids
from accounts.serializers import PlayerSerializer

from .models import Card, Trade, TradeItem
from .views import card_payload

User = get_user_model()


def pending_between(user, other):
    return Trade.objects.filter(status=Trade.PENDING).filter(
        Q(initiator=user, partner=other) | Q(initiator=other, partner=user)
    ).first()


def locked_card_ids(exclude_trade_id=None):
    items = TradeItem.objects.filter(trade__status=Trade.PENDING)
    if exclude_trade_id is not None:
        items = items.exclude(trade_id=exclude_trade_id)
    return set(items.values_list('card_id', flat=True))


def trade_payload(trade, viewer, request):
    other = trade.other_user(viewer)
    items = list(trade.items.select_related('card', 'card__owner', 'offered_by').prefetch_related(
        'card__pack_pulls__from_user',
    ))
    your_cards = [card_payload(item.card) for item in items if item.offered_by_id == viewer.id]
    their_cards = [card_payload(item.card) for item in items if item.offered_by_id != viewer.id]
    you_accepted = (
        trade.initiator_accepted if trade.initiator_id == viewer.id else trade.partner_accepted
    )
    they_accepted = (
        trade.partner_accepted if trade.initiator_id == viewer.id else trade.initiator_accepted
    )
    return {
        'id': trade.id,
        'status': trade.status,
        'partner': PlayerSerializer(other, context={'viewer': viewer, 'request': request}).data,
        'you_accepted': you_accepted,
        'they_accepted': they_accepted,
        'your_cards': your_cards,
        'their_cards': their_cards,
        'is_initiator': trade.initiator_id == viewer.id,
    }


def parse_card_ids(data):
    raw = data.get('card_ids', [])
    if raw is None:
        raw = []
    if not isinstance(raw, list):
        return None, 'card_ids must be a list.'
    ids = []
    for value in raw:
        try:
            ids.append(int(value))
        except (TypeError, ValueError):
            return None, 'card_ids must be numbers.'
    return list(dict.fromkeys(ids)), None


def set_offered_cards(trade, user, card_ids):
    locked = locked_card_ids(exclude_trade_id=trade.id)
    cards = list(Card.objects.filter(id__in=card_ids, owner=user))
    if len(cards) != len(card_ids):
        return 'You can only offer cards from your collection.'
    if any(card.id in locked for card in cards):
        return 'One of those cards is already in another trade.'
    TradeItem.objects.filter(trade=trade, offered_by=user).delete()
    TradeItem.objects.bulk_create([
        TradeItem(trade=trade, card=card, offered_by=user)
        for card in cards
    ])
    trade.initiator_accepted = False
    trade.partner_accepted = False
    trade.save(update_fields=['initiator_accepted', 'partner_accepted', 'updated_at'])
    return None


def complete_trade(trade):
    items = list(trade.items.select_related('card'))
    card_ids = [item.card_id for item in items]
    cards = {
        card.id: card
        for card in Card.objects.select_for_update().filter(id__in=card_ids)
    }
    for item in items:
        card = cards.get(item.card_id)
        if card is None or card.owner_id != item.offered_by_id:
            return 'A card in this trade is no longer available.'
        recipient_id = (
            trade.partner_id if item.offered_by_id == trade.initiator_id else trade.initiator_id
        )
        card.owner_id = recipient_id
        card.save(update_fields=['owner'])
    trade.status = Trade.COMPLETED
    trade.save(update_fields=['status', 'updated_at'])
    return None


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def trades_collection(request):
    if request.method == 'GET':
        trades = Trade.objects.filter(
            Q(initiator=request.user) | Q(partner=request.user),
            status=Trade.PENDING,
        ).select_related('initiator', 'partner')
        return Response({
            'trades': [trade_payload(trade, request.user, request) for trade in trades],
        })

    other_id = request.data.get('user_id')
    if other_id is None:
        return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        other_id = int(other_id)
    except (TypeError, ValueError):
        return Response({'detail': 'user_id must be a number.'}, status=status.HTTP_400_BAD_REQUEST)
    if other_id == request.user.id:
        return Response({'detail': 'You cannot trade with yourself.'}, status=status.HTTP_400_BAD_REQUEST)
    if other_id not in accepted_friend_ids(request.user):
        return Response({'detail': 'You can only trade with friends.'}, status=status.HTTP_400_BAD_REQUEST)

    other = get_object_or_404(User, id=other_id)
    existing = pending_between(request.user, other)
    if existing:
        return Response(trade_payload(existing, request.user, request))

    card_ids, error = parse_card_ids(request.data)
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    trade = Trade.objects.create(initiator=request.user, partner=other)
    offer_error = set_offered_cards(trade, request.user, card_ids)
    if offer_error:
        trade.delete()
        return Response({'detail': offer_error}, status=status.HTTP_400_BAD_REQUEST)
    return Response(trade_payload(trade, request.user, request), status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def trade_detail(request, trade_id):
    trade = get_object_or_404(
        Trade.objects.select_related('initiator', 'partner'),
        id=trade_id,
    )
    if not trade.is_participant(request.user):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return Response(trade_payload(trade, request.user, request))
    if trade.status != Trade.PENDING:
        return Response({'detail': 'This trade is no longer open.'}, status=status.HTTP_400_BAD_REQUEST)
    card_ids, error = parse_card_ids(request.data)
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
    offer_error = set_offered_cards(trade, request.user, card_ids)
    if offer_error:
        return Response({'detail': offer_error}, status=status.HTTP_400_BAD_REQUEST)
    trade.refresh_from_db()
    return Response(trade_payload(trade, request.user, request))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_trade(request, trade_id):
    with transaction.atomic():
        trade = get_object_or_404(Trade.objects.select_for_update(), id=trade_id)
        if not trade.is_participant(request.user):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if trade.status != Trade.PENDING:
            return Response({'detail': 'This trade is no longer open.'}, status=status.HTTP_400_BAD_REQUEST)
        if trade.initiator_id == request.user.id:
            trade.initiator_accepted = True
        else:
            trade.partner_accepted = True
        trade.save(update_fields=['initiator_accepted', 'partner_accepted', 'updated_at'])
        if trade.initiator_accepted and trade.partner_accepted:
            complete_error = complete_trade(trade)
            if complete_error:
                return Response({'detail': complete_error}, status=status.HTTP_400_BAD_REQUEST)
        trade.refresh_from_db()
        return Response(trade_payload(trade, request.user, request))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_trade(request, trade_id):
    trade = get_object_or_404(Trade, id=trade_id)
    if not trade.is_participant(request.user):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    if trade.status != Trade.PENDING:
        return Response({'detail': 'This trade is no longer open.'}, status=status.HTTP_400_BAD_REQUEST)
    trade.status = Trade.CANCELLED
    trade.initiator_accepted = False
    trade.partner_accepted = False
    trade.save(update_fields=['status', 'initiator_accepted', 'partner_accepted', 'updated_at'])
    return Response(trade_payload(trade, request.user, request))
