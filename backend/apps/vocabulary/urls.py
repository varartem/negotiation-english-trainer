from django.urls import path

from .views import VocabularyDetailView, VocabularyListCreateView


urlpatterns = [
    path("vocabulary/", VocabularyListCreateView.as_view(), name="vocabulary-list"),
    path("vocabulary/<int:pk>/", VocabularyDetailView.as_view(), name="vocabulary-detail"),
]
