from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.ai_services.progress import stream_event_response, stream_progress_response
from apps.ai_services.services import LLMService, TTSService
from apps.negotiation_graph.models import NegotiationGraph
from apps.scenarios.models import Scenario

from .models import DialogueSession, Evaluation, Message
from .serializers import (
    DialogueSessionSerializer,
    DialogueSessionSummarySerializer,
    EvaluationSerializer,
    MessageSerializer,
    UserMessageCreateSerializer,
)


SESSION_QUERYSET = DialogueSession.objects.select_related("scenario", "graph").prefetch_related("messages")


class SessionListView(generics.ListAPIView):
    queryset = DialogueSession.objects.select_related("scenario").order_by("-updated_at")
    serializer_class = DialogueSessionSummarySerializer


class SessionDetailView(generics.RetrieveAPIView):
    queryset = SESSION_QUERYSET
    serializer_class = DialogueSessionSerializer


class SessionPublicDetailView(generics.RetrieveAPIView):
    queryset = SESSION_QUERYSET
    serializer_class = DialogueSessionSerializer
    lookup_field = "public_id"
    lookup_url_kwarg = "public_id"


@api_view(["POST"])
def start_session(request, scenario_id: int):
    scenario = generics.get_object_or_404(Scenario, pk=scenario_id)
    graph = scenario.graphs.first()
    if graph is None:
        graph_json = LLMService().generate_graph(scenario=scenario, max_depth=6)
        graph = NegotiationGraph.objects.create(scenario=scenario, max_depth=6, graph_json=graph_json)

    session = DialogueSession.objects.create(
        scenario=scenario,
        graph=graph,
        current_node_id=graph.graph_json["start_node_id"],
    )
    opening = Message.objects.create(
        session=session,
        role=Message.ROLE_ASSISTANT,
        node_id=session.current_node_id,
        content="Hello. I am ready to discuss the proposal. What would you like to focus on first?",
    )
    data = DialogueSessionSerializer(session).data
    data["opening_message"] = MessageSerializer(opening).data
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def send_message(request, session_id: int):
    session = generics.get_object_or_404(
        DialogueSession.objects.select_related("scenario", "graph"),
        pk=session_id,
    )
    serializer = UserMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    payload = create_dialogue_turn(session, serializer.validated_data["content"])
    return Response(payload, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def send_message_progress(request, session_id: int):
    serializer = UserMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    content = serializer.validated_data["content"]

    def worker(emit):
        emit({"type": "progress", "progress": 8, "stage": "queued", "detail": "Реплика поставлена в очередь."})
        session = DialogueSession.objects.select_related("scenario", "graph").get(pk=session_id)

        def emit_delta(delta: str) -> None:
            emit(
                {
                    "type": "assistant_delta",
                    "progress": 88,
                    "stage": "counterparty_reply",
                    "delta": delta,
                }
            )

        return create_dialogue_turn(
            session,
            content,
            emit_event=emit,
            emit_assistant_delta=emit_delta,
        )

    return stream_event_response(worker)


@api_view(["POST"])
def retry_stage(request, session_id: int):
    session = generics.get_object_or_404(DialogueSession, pk=session_id)
    session.status = DialogueSession.STATUS_ACTIVE
    session.save(update_fields=["status", "updated_at"])
    tutor_message = Message.objects.create(
        session=session,
        role=Message.ROLE_TUTOR,
        node_id=session.current_node_id,
        content="Повторите этот этап. Сфокусируйтесь на критериях успеха текущего состояния переговоров.",
    )
    return Response(
        {
            "session": DialogueSessionSerializer(session).data,
            "tutor_message": MessageSerializer(tutor_message).data,
        }
    )


@api_view(["GET"])
def ideal_answer(request, session_id: int):
    session = generics.get_object_or_404(
        DialogueSession.objects.select_related("scenario", "graph"),
        pk=session_id,
    )
    return Response({"ideal_answer": LLMService().generate_ideal_answer(session)})


@api_view(["POST"])
def synthesize_message(request, message_id: int):
    message = generics.get_object_or_404(Message, pk=message_id)
    file_prefix = f"message_{message.id}_{message.created_at.strftime('%Y%m%d%H%M%S')}"
    message.audio_url = TTSService().synthesize(message.content, file_prefix=file_prefix)
    message.save(update_fields=["audio_url"])
    return Response({"message": MessageSerializer(message).data})


@api_view(["POST"])
def synthesize_message_progress(request, message_id: int):
    def worker(emit):
        emit(4, "queued", "Запрос TTS поставлен в очередь.")
        message = Message.objects.get(pk=message_id)
        if message.audio_url:
            emit(100, "cached_audio", "Аудио уже готово.")
            return {"message": MessageSerializer(message).data}

        file_prefix = f"message_{message.id}_{message.created_at.strftime('%Y%m%d%H%M%S')}"
        message.audio_url = TTSService().synthesize(
            message.content,
            file_prefix=file_prefix,
            progress_callback=emit,
        )
        message.save(update_fields=["audio_url"])
        return {"message": MessageSerializer(message).data}

    return stream_progress_response(worker)


def create_dialogue_turn(
    session: DialogueSession,
    content: str,
    *,
    emit_event=None,
    emit_assistant_delta=None,
) -> dict:
    def emit_progress(progress: int, stage: str, detail: str) -> None:
        if emit_event is not None:
            emit_event(
                {
                    "type": "progress",
                    "progress": progress,
                    "stage": stage,
                    "detail": detail,
                }
            )

    emit_progress(14, "saving_user_message", "Сохраняем вашу реплику.")
    user_message = Message.objects.create(
        session=session,
        role=Message.ROLE_USER,
        node_id=session.current_node_id,
        content=content,
    )

    llm = LLMService()
    emit_progress(32, "evaluating_reply", "Оцениваем реплику и выбираем следующий этап.")
    evaluation_data = llm.evaluate_user_reply(session=session, message_content=user_message.content)
    next_node_id = choose_next_node_id(session, evaluation_data)
    session.current_node_id = next_node_id
    session.status = status_for_node(session.graph.graph_json, next_node_id)
    session.save(update_fields=["current_node_id", "status", "updated_at"])

    evaluation = Evaluation.objects.create(
        message=user_message,
        general_sentiment=evaluation_data["general_sentiment"],
        emotion=evaluation_data["emotion"],
        pressure_level=evaluation_data["pressure_level"],
        negotiation_move=evaluation_data["negotiation_move"],
        strategy_score=evaluation_data["strategy_score"],
        english_score=evaluation_data["english_score"],
        stage_fit_score=evaluation_data["stage_fit_score"],
        feedback_json={
            "feedback": evaluation_data["feedback"],
            "language_feedback": evaluation_data["language_feedback"],
            "strategy_feedback": evaluation_data["strategy_feedback"],
        },
        better_version=evaluation_data["better_version"],
    )

    emit_progress(72, "counterparty_reply", "Собеседник отвечает.")
    if emit_assistant_delta is None:
        assistant_content = llm.generate_counterparty_reply(session=session, evaluation=evaluation_data)
    else:
        assistant_content = llm.stream_counterparty_reply(
            session=session,
            evaluation=evaluation_data,
            on_delta=emit_assistant_delta,
        )

    assistant_message = Message.objects.create(
        session=session,
        role=Message.ROLE_ASSISTANT,
        node_id=session.current_node_id,
        content=assistant_content,
    )

    emit_progress(96, "saving_counterparty_reply", "Сохраняем ответ собеседника.")
    return {
        "session": DialogueSessionSerializer(session).data,
        "user_message": MessageSerializer(user_message).data,
        "evaluation": EvaluationSerializer(evaluation).data,
        "assistant_message": MessageSerializer(assistant_message).data,
    }


def choose_next_node_id(session: DialogueSession, evaluation_data: dict) -> str:
    if evaluation_data["stage_fit_score"] <= 4:
        dead_end = find_node_by_type(session.graph.graph_json, "dead_end")
        return dead_end["id"] if dead_end else session.current_node_id

    edges = [
        edge
        for edge in session.graph.graph_json.get("edges", [])
        if edge["source"] == session.current_node_id
    ]
    if not edges:
        return session.current_node_id
    return edges[0]["target"]


def status_for_node(graph_json: dict, node_id: str) -> str:
    node = next((item for item in graph_json.get("nodes", []) if item["id"] == node_id), {})
    if node.get("type") == "success":
        return DialogueSession.STATUS_SUCCESS
    if node.get("type") == "dead_end":
        return DialogueSession.STATUS_DEAD_END
    return DialogueSession.STATUS_ACTIVE


def find_node_by_type(graph_json: dict, node_type: str) -> dict | None:
    return next((item for item in graph_json.get("nodes", []) if item.get("type") == node_type), None)
