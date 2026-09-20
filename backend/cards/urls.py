from django.urls import path

from .views import card_image, get_cards, grade_photo, open_pack, pack_status

urlpatterns = [
    path('grade-photo/', grade_photo),
    path('cards/', get_cards),
    path('cards/<int:card_id>/image/', card_image),
    path('pack/', pack_status),
    path('pack/open/', open_pack),
]
