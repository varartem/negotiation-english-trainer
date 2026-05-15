from django.urls import path

from .views import ScenarioDetailView, ScenarioListCreateView, random_scenario


urlpatterns = [
    path("scenarios/", ScenarioListCreateView.as_view(), name="scenario-list"),
    path("scenarios/random/", random_scenario, name="scenario-random"),
    path("scenarios/<int:pk>/", ScenarioDetailView.as_view(), name="scenario-detail"),
]
