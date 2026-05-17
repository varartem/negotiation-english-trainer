import type { Evaluation } from "../types";

interface TutorFeedbackProps {
  evaluation?: Evaluation;
  idealAnswer: string;
  onRetry: () => void;
  onShowIdealAnswer: () => void;
}

type Tone = "positive" | "neutral" | "negative";

const emotionLabels: Record<string, string> = {
  anger: "злость",
  fear: "страх",
  sadness: "грусть",
  surprise: "удивление",
  joy: "радость",
  disgust: "отвращение",
  neutral: "нейтрально",
};

const pressureLabels: Record<string, string> = {
  low: "низкое давление",
  medium: "среднее давление",
  high: "высокое давление",
};

const moveLabels: Record<string, string> = {
  price_objection: "возражение по цене",
  discount_request: "запрос скидки",
  competitor_comparison: "сравнение с конкурентом",
  budget_objection: "возражение по бюджету",
  authority_objection: "нет полномочий",
  stalling: "затягивание",
  buying_signal: "сигнал покупки",
  concession: "уступка",
  threat_to_leave: "угроза уйти",
  need_clarification: "уточнение",
  closing_attempt: "попытка закрытия",
  value_explanation: "объяснение ценности",
  relationship_building: "выстраивание контакта",
};

const emotionTones: Record<string, Tone> = {
  anger: "negative",
  fear: "negative",
  sadness: "negative",
  surprise: "neutral",
  joy: "positive",
  disgust: "negative",
  neutral: "neutral",
};

const pressureTones: Record<string, Tone> = {
  low: "positive",
  medium: "neutral",
  high: "negative",
};

const moveTones: Record<string, Tone> = {
  price_objection: "negative",
  discount_request: "negative",
  competitor_comparison: "negative",
  budget_objection: "negative",
  authority_objection: "negative",
  stalling: "negative",
  buying_signal: "positive",
  concession: "positive",
  threat_to_leave: "negative",
  need_clarification: "neutral",
  closing_attempt: "positive",
  value_explanation: "neutral",
  relationship_building: "positive",
};

export default function TutorFeedback({ evaluation, idealAnswer, onRetry, onShowIdealAnswer }: TutorFeedbackProps) {
  return (
    <section className="panel feedback-panel">
      <div className="panel-header">
        <h2>Оценка тренера</h2>
      </div>

      {evaluation ? (
        <>
          <div className="score-grid">
            <Score label="Стратегия" value={evaluation.strategy_score} />
            <Score label="Английский" value={evaluation.english_score} />
            <Score label="Этап" value={evaluation.stage_fit_score} />
          </div>

          <div className="signal-list" aria-label="Сигналы диалога">
            <Signal
              label="Эмоция собеседника"
              value={emotionLabels[evaluation.emotion] ?? evaluation.emotion}
              tone={emotionTones[evaluation.emotion] ?? "neutral"}
            />
            <Signal
              label="Давление"
              value={pressureLabels[evaluation.pressure_level] ?? evaluation.pressure_level}
              tone={pressureTones[evaluation.pressure_level] ?? "neutral"}
            />
            <Signal
              label="Ход переговоров"
              value={moveLabels[evaluation.negotiation_move] ?? evaluation.negotiation_move}
              tone={moveTones[evaluation.negotiation_move] ?? "neutral"}
            />
          </div>

          <FeedbackList title="Общее" items={evaluation.feedback_json.feedback ?? []} />
          <FeedbackList title="Язык" items={evaluation.feedback_json.language_feedback ?? []} />
          <FeedbackList title="Стратегия" items={evaluation.feedback_json.strategy_feedback ?? []} />

          <div className="better-version">
            <h3>Лучший вариант</h3>
            <p>{evaluation.better_version}</p>
          </div>
        </>
      ) : (
        <p className="empty-state">Пока нет оценки.</p>
      )}

      <div className="button-row">
        <button className="secondary-button" type="button" onClick={onRetry}>
          Повторить этап
        </button>
        <button className="secondary-button" type="button" onClick={onShowIdealAnswer}>
          Показать идеальный ответ
        </button>
      </div>

      {idealAnswer ? (
        <div className="ideal-answer">
          <h3>Идеальный ответ</h3>
          <p>{idealAnswer}</p>
        </div>
      ) : null}
    </section>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const tone = getScoreTone(value);

  return (
    <div className={`score-card tone-${tone}`}>
      <span>{label}</span>
      <strong>
        {value}
        <small>/10</small>
      </strong>
    </div>
  );
}

function Signal({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`signal-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getScoreTone(value: number): Tone {
  if (value >= 8) {
    return "positive";
  }

  if (value >= 5) {
    return "neutral";
  }

  return "negative";
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="feedback-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
