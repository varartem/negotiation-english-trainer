from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.ai_services.services import LLMService

from .models import Scenario
from .serializers import ScenarioSerializer


class ScenarioListCreateView(generics.ListCreateAPIView):
    queryset = Scenario.objects.all()
    serializer_class = ScenarioSerializer


class ScenarioDetailView(generics.RetrieveAPIView):
    queryset = Scenario.objects.all()
    serializer_class = ScenarioSerializer


@api_view(["POST"])
def random_scenario(request):
    counterparty_stance = request.data.get(
        "counterparty_stance",
        request.data.get("difficulty", Scenario.COUNTERPARTY_STANCE_NEUTRAL),
    )
    counterparty_stance = {
        "easy": Scenario.COUNTERPARTY_STANCE_OPEN,
        "medium": Scenario.COUNTERPARTY_STANCE_NEUTRAL,
        "hard": Scenario.COUNTERPARTY_STANCE_RESISTANT,
    }.get(counterparty_stance, counterparty_stance)
    data = LLMService().generate_random_scenario(counterparty_stance=counterparty_stance)
    serializer = ScenarioSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    scenario = serializer.save(is_random=True)
    return Response(ScenarioSerializer(scenario).data, status=status.HTTP_201_CREATED)
