from django.urls import path

from .views import card_image, donate_pack_card, get_cards, grade_photo, open_pack, pack_status, pull_pack_card
from .trades import accept_trade, cancel_trade, trade_detail, trades_collection

urlpatterns = [
    path('grade-photo/', grade_photo),
    path('cards/', get_cards),
    path('cards/<int:card_id>/image/', card_image),
    path('pack/', pack_status),
    path('pack/donate/', donate_pack_card),
    path('pack/pull/', pull_pack_card),
    path('pack/open/', open_pack),
    path('trades/', trades_collection),
    path('trades/<int:trade_id>/', trade_detail),
    path('trades/<int:trade_id>/accept/', accept_trade),
    path('trades/<int:trade_id>/cancel/', cancel_trade),
]
