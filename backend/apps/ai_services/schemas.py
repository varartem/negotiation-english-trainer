from __future__ import annotations

import json
import re
from typing import Any

from .errors import AIServiceError


NEGOTIATION_MOVES = {
    "price_objection",
    "discount_request",
    "competitor_comparison",
    "budget_objection",
    "authority_objection",
    "stalling",
    "buying_signal",
    "concession",
    "threat_to_leave",
    "need_clarification",
    "closing_attempt",
    "value_explanation",
    "relationship_building",
}

SCENARIO_FIELDS = {
    "company_name",
    "company_description",
    "product_name",
    "product_description",
    "user_role",
    "counterparty_role",
    "counterparty_description",
    "negotiation_goal",
    "counterparty_stance",
    "extra_context",
}

SENTIMENTS = {"positive", "neutral", "negative"}
EMOTIONS = {"anger", "fear", "sadness", "surprise", "joy", "disgust", "neutral"}
PRESSURE_LEVELS = {"low", "medium", "high"}
GRAPH_STAGE_ORDER = {
    "opening": 0,
    "discovery": 1,
    "value_explanation": 2,
    "objection_handling": 3,
    "price_negotiation": 4,
    "closing": 5,
    "success": 6,
}


def parse_json_object(raw_text: str) -> dict[str, Any]:
    text = _strip_thinking(raw_text.strip())
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        text = _extract_balanced_object(text)

    try:
        loaded = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AIServiceError(f"Модель вернула невалидный JSON: {exc}") from exc

    if not isinstance(loaded, dict):
        raise AIServiceError("Модель вернула JSON не в виде объекта.")
    return loaded


def normalize_scenario(payload: dict[str, Any], counterparty_stance: str) -> dict[str, Any]:
    if "counterparty_stance" not in payload and "difficulty" in payload:
        payload = {**payload, "counterparty_stance": payload["difficulty"]}

    missing = SCENARIO_FIELDS - payload.keys()
    if missing:
        raise AIServiceError(f"В сценарии нет обязательных полей: {', '.join(sorted(missing))}.")

    normalized = {field: str(payload.get(field, "")).strip() for field in SCENARIO_FIELDS}
    normalized["counterparty_stance"] = counterparty_stance
    return normalized


def normalize_graph(payload: dict[str, Any], max_depth: int) -> dict[str, Any]:
    nodes = payload.get("nodes")
    edges = payload.get("edges")
    start_node_id = payload.get("start_node_id")
    if not isinstance(nodes, list) or not nodes:
        raise AIServiceError("Граф переговоров должен содержать непустой список nodes.")
    if not isinstance(edges, list):
        raise AIServiceError("Граф переговоров должен содержать список edges.")
    if not isinstance(start_node_id, str) or not start_node_id:
        raise AIServiceError("Граф переговоров должен содержать start_node_id.")

    normalized_nodes = [_normalize_node(node, index) for index, node in enumerate(nodes)]
    node_ids = {node["id"] for node in normalized_nodes}
    if start_node_id not in node_ids:
        start_node_id = normalized_nodes[0]["id"]

    normalized_edges = []
    for index, edge in enumerate(edges):
        if not isinstance(edge, dict):
            continue
        source = str(edge.get("source", "")).strip()
        target = str(edge.get("target", "")).strip()
        if source not in node_ids or target not in node_ids:
            continue
        normalized_edges.append(
            {
                "id": str(edge.get("id") or f"edge_{index + 1}").strip(),
                "source": source,
                "target": target,
                "condition": str(edge.get("condition", "")).strip(),
            }
        )
    normalized_edges = _main_progression_edges(normalized_nodes, normalized_edges)

    if not any(node["is_terminal"] for node in normalized_nodes):
        normalized_nodes[-1]["is_terminal"] = True

    return {
        "nodes": normalized_nodes,
        "edges": normalized_edges,
        "start_node_id": start_node_id,
        "max_depth": max_depth,
        "scenario_summary": str(payload.get("scenario_summary", "")).strip(),
    }


def normalize_evaluation(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "general_sentiment": _choice(payload.get("general_sentiment"), SENTIMENTS, "neutral"),
        "emotion": _choice(payload.get("emotion"), EMOTIONS, "neutral"),
        "pressure_level": _choice(payload.get("pressure_level"), PRESSURE_LEVELS, "low"),
        "negotiation_move": _choice(payload.get("negotiation_move"), NEGOTIATION_MOVES, "need_clarification"),
        "strategy_score": _score(payload.get("strategy_score"), 7),
        "english_score": _score(payload.get("english_score"), 7),
        "stage_fit_score": _score(payload.get("stage_fit_score"), 7),
        "feedback": _string_list(payload.get("feedback")),
        "language_feedback": _string_list(payload.get("language_feedback")),
        "strategy_feedback": _string_list(payload.get("strategy_feedback")),
        "better_version": str(payload.get("better_version", "")).strip(),
    }


def normalize_text_field(payload: dict[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise AIServiceError(f"Модель не вернула поле {field}.")
    return value.strip()


def _normalize_node(node: Any, index: int) -> dict[str, Any]:
    if not isinstance(node, dict):
        raise AIServiceError("Каждый node в графе должен быть объектом.")
    success_criteria = node.get("success_criteria")
    if not isinstance(success_criteria, list):
        success_criteria = []
    return {
        "id": str(node.get("id") or f"node_{index + 1}").strip(),
        "type": str(node.get("type") or "discovery").strip(),
        "label": str(node.get("label") or f"Stage {index + 1}").strip(),
        "tutor_task": str(node.get("tutor_task") or "").strip(),
        "counterparty_mood": str(node.get("counterparty_mood") or "neutral").strip(),
        "counterparty_intent": str(node.get("counterparty_intent") or "").strip(),
        "success_criteria": [str(item).strip() for item in success_criteria if str(item).strip()],
        "is_terminal": bool(node.get("is_terminal", False)),
    }


def _main_progression_edges(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, str]]:
    edge_by_pair = {(edge["source"], edge["target"]): edge for edge in edges}
    path_nodes = [
        node
        for node, _index in sorted(
            ((node, index) for index, node in enumerate(nodes)),
            key=lambda item: (
                GRAPH_STAGE_ORDER.get(item[0]["type"], len(GRAPH_STAGE_ORDER)),
                item[1],
            ),
        )
        if node["type"] != "dead_end"
    ]
    main_edges = []
    for source, target in zip(path_nodes, path_nodes[1:]):
        existing = edge_by_pair.get((source["id"], target["id"]))
        main_edges.append(
            {
                "id": (existing or {}).get("id") or f"edge_{source['id']}_{target['id']}",
                "source": source["id"],
                "target": target["id"],
                "condition": (existing or {}).get("condition")
                or "пользователь успешно выполняет задачу текущего этапа",
            }
        )
    return main_edges


def _score(value: Any, default: int) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        score = default
    return max(1, min(10, score))


def _choice(value: Any, allowed: set[str], default: str) -> str:
    text = str(value or "").strip().lower()
    return text if text in allowed else default


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        items = value
    elif isinstance(value, str) and value.strip():
        items = [value]
    else:
        items = []
    return [str(item).strip() for item in items if str(item).strip()]


def _strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()


def _extract_balanced_object(text: str) -> str:
    start = text.find("{")
    if start == -1:
        raise AIServiceError("Модель не вернула JSON-объект.")

    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(text[start:], start=start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]

    raise AIServiceError("Модель вернула незавершённый JSON-объект.")
