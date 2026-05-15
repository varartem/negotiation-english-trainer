from django.contrib import admin
from django.urls import include, path
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health(_request):
    return Response({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/", include("apps.scenarios.urls")),
    path("api/", include("apps.negotiation_graph.urls")),
    path("api/", include("apps.dialogue.urls")),
    path("api/", include("apps.vocabulary.urls")),
]
