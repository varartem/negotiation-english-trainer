from django.urls import path

from .views import ScenarioDetailView, ScenarioListCreateView, random_scenario, random_scenario_progress


urlpatterns = [
    path("scenarios/", ScenarioListCreateView.as_view(), name="scenario-list"),
    path("scenarios/random/", random_scenario, name="scenario-random"),
    path("scenarios/random/progress/", random_scenario_progress, name="scenario-random-progress"),
    path("scenarios/<int:pk>/", ScenarioDetailView.as_view(), name="scenario-detail"),
]
