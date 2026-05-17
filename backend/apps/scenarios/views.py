from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.ai_services.errors import AIServiceError
from apps.ai_services.progress import stream_event_response
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
    counterparty_stance = _counterparty_stance_from_request(request)
    try:
        data = LLMService().generate_random_scenario(counterparty_stance=counterparty_stance)
    except AIServiceError as exc:
        raise AIServiceError(f"Не удалось сгенерировать сценарий переговоров: {exc}") from exc
    serializer = ScenarioSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    scenario = serializer.save(is_random=True)
    return Response(ScenarioSerializer(scenario).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def random_scenario_progress(request):
    counterparty_stance = _counterparty_stance_from_request(request)

    def worker(emit):
        emit(
            {
                "type": "progress",
                "progress": 8,
                "stage": "queued",
                "detail": "Запрос генерации сценария поставлен в очередь.",
            }
        )
        emit(
            {
                "type": "progress",
                "progress": 24,
                "stage": "generating_scenario",
                "detail": "Генерируем компанию, продукт, роли, цель и контекст переговоров.",
            }
        )

        def emit_field_delta(field: str, delta: str) -> None:
            emit(
                {
                    "type": "scenario_field_delta",
                    "progress": 68,
                    "stage": "generating_scenario",
                    "field": field,
                    "delta": delta,
                }
            )

        try:
            data = LLMService().stream_random_scenario(
                counterparty_stance=counterparty_stance,
                on_field_delta=emit_field_delta,
            )
        except AIServiceError as exc:
            raise AIServiceError(f"Не удалось сгенерировать сценарий переговоров: {exc}") from exc

        emit(
            {
                "type": "progress",
                "progress": 92,
                "stage": "saving_scenario",
                "detail": "Сохраняем сгенерированные данные сценария.",
            }
        )
        serializer = ScenarioSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        scenario = serializer.save(is_random=True)
        return ScenarioSerializer(scenario).data

    return stream_event_response(worker)


def _counterparty_stance_from_request(request) -> str:
    counterparty_stance = request.data.get(
        "counterparty_stance",
        request.data.get("difficulty", Scenario.COUNTERPARTY_STANCE_NEUTRAL),
    )
    return {
        "easy": Scenario.COUNTERPARTY_STANCE_OPEN,
        "medium": Scenario.COUNTERPARTY_STANCE_NEUTRAL,
        "hard": Scenario.COUNTERPARTY_STANCE_RESISTANT,
    }.get(counterparty_stance, counterparty_stance)
