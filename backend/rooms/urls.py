from django.urls import path

from . import views

urlpatterns = [
    path('', views.create_room, name='create-room'),
    path('join/', views.join_room, name='join-room'),
    path('current/', views.current_room, name='current-room'),

    path('<str:code>/', views.get_room, name='get-room'),
    path('<str:code>/leave/', views.leave_room, name='leave-room'),
    path('<str:code>/start/', views.start_meeting, name='start-meeting'),
    path('<str:code>/exchange/', views.current_exchange, name='current-exchange'),
    path('<str:code>/exchange/answer/', views.submit_icebreaker, name='submit-icebreaker',),
    path(
        '<str:code>/exchange/cards/',
        views.select_exchange_cards,
        name='select-exchange-cards',
    ),
    
]