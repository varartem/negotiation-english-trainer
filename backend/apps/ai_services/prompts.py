from __future__ import annotations

from typing import Any

from .schemas import NEGOTIATION_MOVES


JSON_SYSTEM_PROMPT = (
    "You are the AI core of a negotiation English training app. "
    "Return only valid JSON that matches the requested schema. "
    "Do not include markdown, comments, prose, or hidden reasoning."
)


COUNTERPARTY_STANCE_GUIDE = {
    "open": "The counterparty is cooperative, willing to share context, and interested in finding a workable deal.",
    "neutral": "The counterparty is undecided, cautious, and needs evidence before becoming engaged.",
    "resistant": "The counterparty is skeptical, guarded, and reluctant to continue, but can still be won over by strong listening and value.",
}


def scenario_prompt(counterparty_stance: str) -> str:
    return f"""
Create one realistic B2B sales negotiation training scenario.
The user trains English, but UI explanations may be in Russian.
Counterparty stance: {counterparty_stance}.
Stance guidance: {_counterparty_stance_guidance(counterparty_stance)}

Return this exact JSON object:
{{
  "company_name": "string",
  "company_description": "string in Russian",
  "product_name": "string",
  "product_description": "string in Russian",
  "user_role": "short English role",
  "counterparty_role": "short Russian role",
  "counterparty_description": "string in Russian",
  "negotiation_goal": "string in Russian",
  "counterparty_stance": "{counterparty_stance}",
  "extra_context": "string in Russian"
}}
""".strip()


def graph_prompt(scenario: Any, max_depth: int) -> str:
    return f"""
Build a compact negotiation state graph for this scenario.
Use {max_depth} as the preferred maximum number of non-terminal training stages.
Calibrate the counterparty mood, intent, and objections by the counterparty stance.

Scenario:
{scenario_summary(scenario)}

Return this exact JSON object:
{{
  "nodes": [
    {{
      "id": "snake_case_id",
      "type": "opening|discovery|value_explanation|objection_handling|price_negotiation|closing|success|dead_end",
      "label": "short Russian label",
      "tutor_task": "Russian task for the learner",
      "counterparty_mood": "Russian mood",
      "counterparty_intent": "Russian intent",
      "success_criteria": ["Russian criterion"],
      "is_terminal": false
    }}
  ],
  "edges": [
    {{
      "id": "snake_case_id",
      "source": "node_id",
      "target": "node_id",
      "condition": "Russian transition condition"
    }}
  ],
  "start_node_id": "opening node id",
  "max_depth": {max_depth},
  "scenario_summary": "one Russian sentence"
}}

Include a success terminal node and a dead_end terminal node.
Keep graph progression pedagogically useful for negotiation practice.
""".strip()


def evaluation_prompt(session: Any, message_content: str) -> str:
    node = current_node(session)
    moves = ", ".join(sorted(NEGOTIATION_MOVES))
    return f"""
Evaluate the learner's English negotiation reply.

Scenario:
{scenario_summary(session.scenario)}

Current graph node:
{node}

Recent dialogue:
{dialogue_history(session)}

Learner reply:
{message_content}

Return this exact JSON object:
{{
  "general_sentiment": "positive|neutral|negative",
  "emotion": "anger|fear|sadness|surprise|joy|disgust|neutral",
  "pressure_level": "low|medium|high",
  "negotiation_move": "one of: {moves}",
  "strategy_score": 1,
  "english_score": 1,
  "stage_fit_score": 1,
  "feedback": ["Russian concise feedback"],
  "language_feedback": ["Russian English-language feedback"],
  "strategy_feedback": ["Russian negotiation strategy feedback"],
  "better_version": "one improved learner reply in natural English"
}}

Scores must be integers from 1 to 10.
Stage fit should be low only when the reply damages trust or ignores the current task.
""".strip()


def counterparty_prompt(session: Any, evaluation: dict[str, Any]) -> str:
    node = current_node(session)
    return f"""
Roleplay the counterparty in the negotiation.
Stay in character and answer in natural spoken English.
Be concise: one or two sentences.
Calibrate cooperativeness by the counterparty stance: open should be constructive, neutral should require proof, resistant should push back without becoming impossible.

Scenario:
{scenario_summary(session.scenario)}

Current graph node:
{node}

Session status: {session.status}
Latest evaluation:
{evaluation}

Recent dialogue:
{dialogue_history(session)}

Return this exact JSON object:
{{"reply": "counterparty reply in English"}}
""".strip()


def ideal_answer_prompt(session: Any) -> str:
    return f"""
Write an ideal next learner reply for this negotiation stage.
The answer must be in natural professional English and be one or two sentences.

Scenario:
{scenario_summary(session.scenario)}

Current graph node:
{current_node(session)}

Recent dialogue:
{dialogue_history(session)}

Return this exact JSON object:
{{"ideal_answer": "ideal learner reply in English"}}
""".strip()


def scenario_summary(scenario: Any) -> str:
    return "\n".join(
        [
            f"Company: {scenario.company_name}. {scenario.company_description}",
            f"Product: {scenario.product_name}. {scenario.product_description}",
            f"Learner role: {scenario.user_role}",
            f"Counterparty role: {scenario.counterparty_role}. {scenario.counterparty_description}",
            f"Goal: {scenario.negotiation_goal}",
            (
                f"Counterparty stance: {scenario.counterparty_stance} "
                f"({_counterparty_stance_guidance(scenario.counterparty_stance)})"
            ),
            f"Extra context: {scenario.extra_context}",
        ]
    )


def _counterparty_stance_guidance(counterparty_stance: str) -> str:
    return COUNTERPARTY_STANCE_GUIDE.get(counterparty_stance, COUNTERPARTY_STANCE_GUIDE["neutral"])


def current_node(session: Any) -> dict[str, Any]:
    graph = session.graph.graph_json
    return next(
        (node for node in graph.get("nodes", []) if node.get("id") == session.current_node_id),
        {},
    )


def dialogue_history(session: Any, limit: int = 8) -> list[dict[str, str]]:
    messages = list(session.messages.all())[-limit:]
    return [{"role": message.role, "content": message.content} for message in messages]
