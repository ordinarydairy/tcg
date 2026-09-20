from django.urls import path

from . import views

urlpatterns = [
    path('', views.create_room, name='create-room'),
    path('join/', views.join_room, name='join-room'),
]