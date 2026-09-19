from django.urls import path
from .views import grade_photo, get_cards
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("grade-photo/", grade_photo),
    path("cards/", get_cards),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )