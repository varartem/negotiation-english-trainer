from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.ai_services.errors import AIServiceError
from apps.ai_services.services import LLMService
from apps.scenarios.models import Scenario

from .models import NegotiationGraph
from .serializers import NegotiationGraphSerializer


class GraphDetailView(generics.RetrieveAPIView):
    serializer_class = NegotiationGraphSerializer

    def get_queryset(self):
        return NegotiationGraph.objects.select_related("scenario").filter(scenario__user=self.request.user)


@api_view(["POST"])
def generate_graph(request, scenario_id: int):
    scenario = generics.get_object_or_404(Scenario, pk=scenario_id, user=request.user)
    max_depth = int(request.data.get("max_depth", 6))
    try:
        graph_json = LLMService().generate_graph(scenario=scenario, max_depth=max_depth)
    except AIServiceError as exc:
        raise AIServiceError(f"Не удалось сгенерировать граф переговоров: {exc}") from exc
    graph = NegotiationGraph.objects.create(
        scenario=scenario,
        max_depth=max_depth,
        graph_json=graph_json,
    )
    return Response(NegotiationGraphSerializer(graph).data, status=status.HTTP_201_CREATED)
