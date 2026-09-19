"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
https://docs.djangoproject.com/en/6.1/topics/http/urls/
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from accounts.friends import (
    FriendDetailView,
    FriendRequestView,
    FriendSearchView,
    FriendSuggestionsView,
    FriendsListView,
    PlayerDetailView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/users/<int:user_id>/', PlayerDetailView.as_view(), name='player-detail'),
    path('api/friends/', FriendsListView.as_view(), name='friends-list'),
    path('api/friends/suggestions/', FriendSuggestionsView.as_view(), name='friend-suggestions'),
    path('api/friends/search/', FriendSearchView.as_view(), name='friend-search'),
    path('api/friends/requests/', FriendRequestView.as_view(), name='friend-request'),
    path('api/friends/<int:user_id>/', FriendDetailView.as_view(), name='friend-detail'),
    path('api/', include('cards.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
