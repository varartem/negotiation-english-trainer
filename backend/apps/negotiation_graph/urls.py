from django.urls import path

from .views import GraphDetailView, generate_graph


urlpatterns = [
    path("scenarios/<int:scenario_id>/graph/", generate_graph, name="scenario-graph"),
    path("graphs/<int:pk>/", GraphDetailView.as_view(), name="graph-detail"),
]
