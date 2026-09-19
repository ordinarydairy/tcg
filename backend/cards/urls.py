from django.urls import path
from .views import grade_photo

urlpatterns = [
    path("grade-photo/", grade_photo),
]