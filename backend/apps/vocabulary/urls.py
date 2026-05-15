from django.urls import path

from .views import VocabularyDeleteView, VocabularyListCreateView


urlpatterns = [
    path("vocabulary/", VocabularyListCreateView.as_view(), name="vocabulary-list"),
    path("vocabulary/<int:pk>/", VocabularyDeleteView.as_view(), name="vocabulary-delete"),
]
