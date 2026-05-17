from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .schemas import NEGOTIATION_MOVES


@dataclass
class MockLLMProvider:
    def generate_random_scenario(self, counterparty_stance: str = "neutral") -> dict[str, Any]:
        stance_details = {
            "open": {
                "description": "Открытый к обсуждению, задаёт вопросы и готов искать взаимовыгодное решение.",
                "context": "Собеседник уже видит потенциальную ценность, но хочет согласовать условия пилота.",
            },
            "neutral": {
                "description": "Осторожный, чувствительный к цене и заинтересованный в измеримом ROI.",
                "context": "Собеседник сравнивает ваше предложение с более дешёвым конкурентом.",
            },
            "resistant": {
                "description": "Скептичный, занятой и не уверен, что разговор стоит продолжать.",
                "context": "Собеседник считает, что похожие решения уже не дали результата, и не хочет тратить время.",
            },
        }.get(counterparty_stance, {})

        return {
            "company_name": "BrightPath Analytics",
            "company_description": "B2B SaaS-компания, которая помогает ритейлерам прогнозировать спрос.",
            "product_name": "ForecastPro Pilot",
            "product_description": "90-дневный пилот по прогнозированию с доступом к дашборду и поддержкой онбординга.",
            "user_role": "Account Executive",
            "counterparty_role": "Менеджер по закупкам",
            "counterparty_description": stance_details.get(
                "description",
                "Осторожный, чувствительный к цене и заинтересованный в измеримом ROI.",
            ),
            "negotiation_goal": "Договориться о платном пилоте без ранней скидки.",
            "counterparty_stance": counterparty_stance,
            "extra_context": stance_details.get(
                "context",
                "Собеседник сравнивает ваше предложение с более дешёвым конкурентом.",
            ),
        }

    def translate_vocabulary_phrase(self, phrase: str, context: str = "") -> str:
        known_translations = {
            "could you clarify the budget constraints?": "Могли бы вы уточнить бюджетные ограничения?",
            "what would success look like for you?": "Как для вас будет выглядеть успешный результат?",
            "let's align on the next step.": "Давайте согласуем следующий шаг.",
            "i understand your concern.": "Я понимаю ваше опасение.",
        }
        normalized = phrase.strip().lower()
        return known_translations.get(normalized, f"Перевод фразы: {phrase.strip()}")

    def generate_graph(self, scenario, max_depth: int = 6) -> dict[str, Any]:
        return {
            "nodes": [
                {
                    "id": "opening_1",
                    "type": "opening",
                    "label": "Открытие",
                    "tutor_task": "Начните разговор профессионально и задайте партнёрский тон.",
                    "counterparty_mood": "нейтральный",
                    "counterparty_intent": "первичный контакт",
                    "success_criteria": [
                        "поприветствовать профессионально",
                        "обозначить цель разговора",
                        "задать открывающий вопрос",
                    ],
                    "is_terminal": False,
                },
                {
                    "id": "discovery_1",
                    "type": "discovery",
                    "label": "Выявление потребностей",
                    "tutor_task": "Выясните приоритеты, ограничения и критерии принятия решения.",
                    "counterparty_mood": "заинтересованный",
                    "counterparty_intent": "поделиться потребностями",
                    "success_criteria": [
                        "задавать открытые вопросы",
                        "уточнить бизнес-результаты",
                        "не продавать слишком рано",
                    ],
                    "is_terminal": False,
                },
                {
                    "id": "value_1",
                    "type": "value_explanation",
                    "label": "Объяснение ценности",
                    "tutor_task": "Свяжите ценность продукта с целями, которые назвал собеседник.",
                    "counterparty_mood": "заинтересованный",
                    "counterparty_intent": "оценить ценность",
                    "success_criteria": [
                        "кратко пересказать потребность",
                        "объяснить релевантную ценность",
                        "говорить конкретным бизнес-языком",
                    ],
                    "is_terminal": False,
                },
                {
                    "id": "objection_1",
                    "type": "objection_handling",
                    "label": "Работа с возражением",
                    "tutor_task": "Отработайте сомнение без защиты и ранней скидки.",
                    "counterparty_mood": "скептичный",
                    "counterparty_intent": "проверить риск",
                    "success_criteria": [
                        "признать опасение",
                        "задать уточняющий вопрос",
                        "ответить через доказательства",
                    ],
                    "is_terminal": False,
                },
                {
                    "id": "price_1",
                    "type": "price_negotiation",
                    "label": "Обсуждение цены",
                    "tutor_task": "Обсудите цену, сохраняя ценность и обменивая уступки на обязательства.",
                    "counterparty_mood": "жёсткий",
                    "counterparty_intent": "снизить цену",
                    "success_criteria": [
                        "избегать безусловных скидок",
                        "обменивать уступки на обязательства",
                        "связывать цену с результатами",
                    ],
                    "is_terminal": False,
                },
                {
                    "id": "closing_1",
                    "type": "closing",
                    "label": "Закрытие",
                    "tutor_task": "Подтвердите следующие шаги и запросите понятное обязательство.",
                    "counterparty_mood": "готовый",
                    "counterparty_intent": "определить следующий шаг",
                    "success_criteria": [
                        "резюмировать договорённость",
                        "подтвердить ответственного и срок",
                        "запросить обязательство",
                    ],
                    "is_terminal": False,
                },
                {
                    "id": "success_1",
                    "type": "success",
                    "label": "Успех",
                    "tutor_task": "Вы пришли к сильному результату.",
                    "counterparty_mood": "позитивный",
                    "counterparty_intent": "согласиться",
                    "success_criteria": ["договорённость достигнута"],
                    "is_terminal": True,
                },
                {
                    "id": "dead_end_1",
                    "type": "dead_end",
                    "label": "Тупик",
                    "tutor_task": "Разговор потерял динамику или доверие.",
                    "counterparty_mood": "негативный",
                    "counterparty_intent": "выйти из переговоров",
                    "success_criteria": ["повторить текущий этап"],
                    "is_terminal": True,
                },
            ],
            "edges": [
                {
                    "id": "edge_opening_discovery",
                    "source": "opening_1",
                    "target": "discovery_1",
                    "condition": "пользователь открывает разговор и задаёт вопрос на выявление потребностей",
                },
                {
                    "id": "edge_discovery_value",
                    "source": "discovery_1",
                    "target": "value_1",
                    "condition": "пользователь выявляет релевантную потребность",
                },
                {
                    "id": "edge_value_objection",
                    "source": "value_1",
                    "target": "objection_1",
                    "condition": "пользователь объясняет ценность и приглашает к обсуждению рисков",
                },
                {
                    "id": "edge_objection_price",
                    "source": "objection_1",
                    "target": "price_1",
                    "condition": "пользователь уточняет возражение до обсуждения коммерческих условий",
                },
                {
                    "id": "edge_price_closing",
                    "source": "price_1",
                    "target": "closing_1",
                    "condition": "пользователь обменивает уступки на обязательства",
                },
                {
                    "id": "edge_closing_success",
                    "source": "closing_1",
                    "target": "success_1",
                    "condition": "пользователь подтверждает следующий шаг и обязательство",
                },
                {
                    "id": "edge_any_dead_end",
                    "source": "objection_1",
                    "target": "dead_end_1",
                    "condition": "пользователь игнорирует опасение, давит слишком сильно или сдаётся",
                },
            ],
            "start_node_id": "opening_1",
            "max_depth": max_depth,
            "scenario_summary": f"{scenario.user_role} ведёт переговоры с {scenario.counterparty_role} о {scenario.product_name}.",
        }

    def evaluate_user_reply(self, session, message_content: str) -> dict[str, Any]:
        text = message_content.lower()
        move = "need_clarification"
        sentiment = "neutral"
        emotion = "neutral"
        pressure = "low"
        strategy_score = 7
        english_score = 8
        stage_fit_score = 8
        feedback = ["Вы поддержали ход разговора и сохранили профессиональный тон."]
        language_feedback = ["Лучше формулировать вопросы короче и с ясным глаголом."]
        strategy_feedback = ["Связывайте следующий ход с бизнес-результатом, который назвал собеседник."]

        if any(word in text for word in ["discount", "cheaper", "price", "budget"]):
            move = "discount_request" if "discount" in text else "price_objection"
            pressure = "medium"
            strategy_feedback = ["Не предлагайте скидку до того, как поймёте настоящее возражение."]
        if any(word in text for word in ["why", "could you", "clarify", "what", "how"]):
            move = "need_clarification"
            stage_fit_score = 9
            feedback = ["Вы задали полезный вопрос на выявление потребности или уточнение."]
        if any(word in text for word in ["next step", "agree", "start", "sign", "commit"]):
            move = "closing_attempt"
            strategy_score = 8
        if any(word in text for word in ["angry", "ridiculous", "never", "waste"]):
            sentiment = "negative"
            emotion = "anger"
            pressure = "high"
            strategy_score = 4
            stage_fit_score = 4
            feedback = ["Реплика может звучать слишком конфронтационно для переговоров."]
        if len(message_content.split()) < 5:
            english_score = 6
            language_feedback = ["Добавьте больше контекста, чтобы собеседник мог ответить конкретно."]

        return {
            "general_sentiment": sentiment,
            "emotion": emotion,
            "pressure_level": pressure,
            "negotiation_move": move if move in NEGOTIATION_MOVES else "need_clarification",
            "strategy_score": strategy_score,
            "english_score": english_score,
            "stage_fit_score": stage_fit_score,
            "feedback": feedback,
            "language_feedback": language_feedback,
            "strategy_feedback": strategy_feedback,
            "better_version": self.generate_ideal_answer(session),
        }

    def generate_counterparty_reply(self, session, evaluation: dict[str, Any]) -> str:
        node_type = self._current_node(session).get("type")
        counterparty_stance = getattr(session.scenario, "counterparty_stance", "neutral")
        if session.status == "success":
            return "That works for me. Please send the pilot agreement and proposed kickoff date."
        if session.status == "dead_end":
            return "I do not think this is the right fit for us right now."
        if evaluation["pressure_level"] == "high":
            return "I understand your point, but this tone makes me less confident about moving forward."
        replies = {
            "opening": "Thanks for setting this up. I am interested, but I need to understand whether this is worth our time.",
            "discovery": "Our main issue is forecast accuracy during seasonal peaks, but budget is still a concern.",
            "value_explanation": "The value sounds relevant, but your competitor says they can do something similar for less.",
            "objection_handling": "If you can reduce the risk of the pilot, I can consider a commercial discussion.",
            "price_negotiation": "I could support this if the price is tied to clear milestones and a defined next step.",
            "closing": "Yes, send me the summary and I will review it with finance this week.",
        }
        reply = replies.get(node_type, "Please continue.")
        if counterparty_stance == "open":
            return reply.replace("but", "and", 1)
        if counterparty_stance == "resistant" and node_type not in {"closing"}:
            return f"I am still not convinced this is worth our time. {reply}"
        return reply

    def stream_counterparty_reply(self, session, evaluation: dict[str, Any], on_delta) -> str:
        reply = self.generate_counterparty_reply(session=session, evaluation=evaluation)
        for index, chunk in enumerate(reply.split(" ")):
            on_delta(chunk if index == 0 else f" {chunk}")
        return reply

    def generate_ideal_answer(self, session) -> str:
        node_type = self._current_node(session).get("type")
        answers = {
            "opening": "Thank you for meeting today. Could you share what outcome would make this conversation valuable for you?",
            "discovery": "Could you clarify which forecasting problems create the biggest cost or operational risk for your team?",
            "value_explanation": "Based on that priority, the pilot is designed to prove forecast accuracy improvements before a wider rollout.",
            "objection_handling": "I understand the concern. Before we discuss price, could you clarify which part of the proposal feels riskiest?",
            "price_negotiation": "If we adjust the pilot scope, could we agree on a kickoff date and success metrics today?",
            "closing": "To confirm, I will send the pilot terms today, and you will review them with finance by Friday. Does that work?",
        }
        return answers.get(node_type, "Could you clarify the business outcome you want to achieve?")

    def _current_node(self, session) -> dict[str, Any]:
        graph = session.graph.graph_json
        return next(
            (node for node in graph.get("nodes", []) if node["id"] == session.current_node_id),
            {},
        )


class MockSTTProvider:
    def transcribe(self, _audio_file, **kwargs) -> str:
        progress_callback = kwargs.get("progress_callback")
        if progress_callback:
            progress_callback(35, "mock_transcribing", "Mock STT обрабатывает запись.")
            progress_callback(92, "normalizing_text", "Mock STT готовит текст.")
        return ""


class MockTTSProvider:
    def synthesize(self, _text: str, **kwargs) -> str:
        progress_callback = kwargs.get("progress_callback")
        if progress_callback:
            progress_callback(35, "mock_synthesizing", "Mock TTS создает аудио.")
            progress_callback(92, "finalizing_audio", "Mock TTS готовит файл.")
        return ""
