from __future__ import annotations

from typing import Any

from django.conf import settings

from .schemas import NEGOTIATION_MOVES


JSON_SYSTEM_PROMPT = (
    "You are the AI core of a negotiation English training app. "
    "Return only valid JSON that matches the requested schema. "
    "Follow the language instructions in the user prompt exactly for every JSON string. "
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
    feedback_language = _evaluation_feedback_language()
    return f"""
Evaluate the learner's English negotiation reply.
Return learner-facing analysis in {feedback_language}: feedback, language_feedback, and strategy_feedback.
Use English only for better_version and for short quoted examples of the learner's English when necessary.

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
  "feedback": ["concise feedback in {feedback_language}"],
  "language_feedback": ["feedback in {feedback_language} about English wording, grammar, tone, and clarity"],
  "strategy_feedback": ["negotiation strategy feedback in {feedback_language}"],
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


def vocabulary_translation_prompt(phrase: str, context: str = "") -> str:
    context_text = context.strip() or "No additional context."
    return f"""
Translate ONLY the selected English phrase into natural Russian for a learner's vocabulary.
The selected phrase is the complete translation target, even if it is a fragment of a longer sentence.
Use the context only to choose the right meaning and tone.
Never translate, summarize, or include words that appear only in the context.
Keep the translation concise and suitable for a business negotiation setting.

Example:
Selected phrase: I appreciate the integrated approach
Context: I appreciate the integrated approach, but seeing concrete evidence is still non-negotiable.
Correct translation: Я ценю комплексный подход.
Incorrect translation: Я ценю комплексный подход, но конкретные доказательства остаются обязательным условием.

Selected phrase to translate:
<selected_phrase>
{phrase}
</selected_phrase>

Context for disambiguation only:
<context_not_for_translation>
{context_text}
</context_not_for_translation>

Return this exact JSON object:
{{"translation": "Russian translation"}}
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


def _evaluation_feedback_language() -> str:
    return str(getattr(settings, "EVALUATION_FEEDBACK_LANGUAGE", "Russian")).strip() or "Russian"


def current_node(session: Any) -> dict[str, Any]:
    graph = session.graph.graph_json
    return next(
        (node for node in graph.get("nodes", []) if node.get("id") == session.current_node_id),
        {},
    )


def dialogue_history(session: Any, limit: int = 8) -> list[dict[str, str]]:
    messages = list(session.messages.all())[-limit:]
    return [{"role": message.role, "content": message.content} for message in messages]
