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
    try:
        text = _repair_escaped_string_delimiters(_strip_thinking(raw_text.strip()))
        fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
        if fenced:
            text = fenced.group(1)
        else:
            text = _extract_balanced_object(text)

        loaded = _load_json_with_repair(text)

        if not isinstance(loaded, dict):
            raise AIServiceError("Модель вернула JSON не в виде объекта.")
        return loaded
    except Exception:
        print(f"\n{'='*50}\nERROR: Failed to parse JSON from AI model.\nRaw text:\n{raw_text}\n{'='*50}\n", flush=True)
        raise


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


def _load_json_with_repair(text: str) -> Any:
    original_error: json.JSONDecodeError | None = None
    seen: set[str] = set()
    for candidate in _json_repair_candidates(text):
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            if original_error is None:
                original_error = exc

    if original_error is None:
        raise AIServiceError("Модель вернула пустой JSON.")
    raise AIServiceError(f"Модель вернула невалидный JSON: {original_error}") from original_error


def _json_repair_candidates(text: str) -> list[str]:
    with_repaired_delimiters = _repair_escaped_string_delimiters(text)
    without_trailing_commas = _remove_trailing_commas(with_repaired_delimiters)
    with_escaped_quotes = _escape_unescaped_string_quotes(without_trailing_commas)
    return [
        text,
        with_repaired_delimiters,
        without_trailing_commas,
        _insert_missing_commas(without_trailing_commas),
        _remove_trailing_commas(_insert_missing_commas(with_escaped_quotes)),
    ]


def _repair_escaped_string_delimiters(text: str) -> str:
    result: list[str] = []
    in_string = False
    in_repaired_string = False
    escaped = False
    index = 0

    while index < len(text):
        char = text[index]

        if in_repaired_string:
            if text.startswith('\\"', index):
                next_index = _next_non_whitespace_index(text, index + 2)
                if next_index >= len(text) or text[next_index] in ":,]}":
                    result.append('"')
                    index += 2
                    in_repaired_string = False
                    continue
            result.append(char)
            index += 1
            continue

        if in_string:
            result.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
            continue

        if text.startswith('\\"', index) and _previous_non_whitespace(result) in {":", "{", "[", ","}:
            result.append('"')
            index += 2
            in_repaired_string = True
            continue

        result.append(char)
        if char == '"':
            in_string = True
        index += 1

    return "".join(result)


def _remove_trailing_commas(text: str) -> str:
    result: list[str] = []
    in_string = False
    escaped = False
    index = 0
    while index < len(text):
        char = text[index]
        if in_string:
            result.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
            continue

        if char == '"':
            in_string = True
            result.append(char)
            index += 1
            continue

        if char == ",":
            next_index = _next_non_whitespace_index(text, index + 1)
            if next_index < len(text) and text[next_index] in "}]":
                index += 1
                continue

        result.append(char)
        index += 1
    return "".join(result)


def _insert_missing_commas(text: str) -> str:
    result: list[str] = []
    in_string = False
    escaped = False
    last_significant = ""
    had_whitespace = False

    for char in text:
        if in_string:
            result.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
                last_significant = char
                had_whitespace = False
            continue

        if char.isspace():
            result.append(char)
            if last_significant:
                had_whitespace = True
            continue

        if had_whitespace and _is_json_value_end(last_significant) and _is_json_value_start(char):
            result.append(",")
            last_significant = ","

        result.append(char)
        had_whitespace = False
        if char == '"':
            in_string = True
        else:
            last_significant = char

    return "".join(result)


def _escape_unescaped_string_quotes(text: str) -> str:
    result: list[str] = []
    in_string = False
    escaped = False
    for index, char in enumerate(text):
        if not in_string:
            result.append(char)
            if char == '"':
                in_string = True
            continue

        if escaped:
            result.append(char)
            escaped = False
            continue

        if char == "\\":
            result.append(char)
            escaped = True
            continue

        if char != '"':
            result.append(char)
            continue

        next_index = _next_non_whitespace_index(text, index + 1)
        next_char = text[next_index] if next_index < len(text) else ""
        if not next_char or next_char in ':,]}' or next_char == '"':
            in_string = False
            result.append(char)
        else:
            result.append('\\"')

    return "".join(result)


def _next_non_whitespace_index(text: str, start: int) -> int:
    index = start
    while index < len(text) and text[index].isspace():
        index += 1
    return index


def _previous_non_whitespace(chars: list[str]) -> str:
    for char in reversed(chars):
        if not char.isspace():
            return char
    return ""


def _is_json_value_end(char: str) -> bool:
    return char in {'"', "}", "]"} or char.isdigit() or char in {"e", "l"}


def _is_json_value_start(char: str) -> bool:
    return char in {'"', "{", "[", "-", "t", "f", "n"} or char.isdigit()
