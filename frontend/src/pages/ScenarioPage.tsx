import { useState } from "react";
import { api, type ScenarioPayload } from "../api/client";
import ModelGenerationLoader from "../components/ModelGenerationLoader";
import ScenarioForm from "../components/ScenarioForm";
import type { CounterpartyStance, DialogueSession, Scenario } from "../types";

interface ScenarioPageProps {
  onSessionReady: (session: DialogueSession) => void;
}

const initialScenario: ScenarioPayload = {
  company_name: "Northstar Retail",
  company_description: "Розничная сеть среднего размера, которая улучшает планирование спроса.",
  product_name: "ForecastPro Pilot",
  product_description: "Платный пилот по прогнозированию с онбордингом и еженедельными встречами по результатам.",
  user_role: "Account Executive",
  counterparty_role: "Менеджер по закупкам",
  counterparty_description: "Аналитичный, осторожный и ориентированный на ROI.",
  negotiation_goal: "Договориться о платном пилоте без безусловной скидки.",
  counterparty_stance: "neutral",
  extra_context: "Собеседник сравнивает ваше предложение с более дешёвым конкурентом.",
};

type StreamScenarioField = Exclude<keyof ScenarioPayload, "counterparty_stance">;

const scenarioFields: StreamScenarioField[] = [
  "company_name",
  "company_description",
  "product_name",
  "product_description",
  "user_role",
  "counterparty_role",
  "counterparty_description",
  "negotiation_goal",
  "extra_context",
];

const scenarioFieldLabels: Record<StreamScenarioField, string> = {
  company_name: "название компании",
  company_description: "описание компании",
  product_name: "название продукта",
  product_description: "описание продукта",
  user_role: "вашу роль",
  counterparty_role: "роль собеседника",
  counterparty_description: "портрет собеседника",
  negotiation_goal: "цель переговоров",
  extra_context: "дополнительный контекст",
};

function emptyScenario(counterpartyStance: CounterpartyStance): ScenarioPayload {
  return {
    company_name: "",
    company_description: "",
    product_name: "",
    product_description: "",
    user_role: "",
    counterparty_role: "",
    counterparty_description: "",
    negotiation_goal: "",
    counterparty_stance: counterpartyStance,
    extra_context: "",
  };
}

function scenarioToPayload(scenario: Scenario): ScenarioPayload {
  return {
    company_name: scenario.company_name,
    company_description: scenario.company_description,
    product_name: scenario.product_name,
    product_description: scenario.product_description,
    user_role: scenario.user_role,
    counterparty_role: scenario.counterparty_role,
    counterparty_description: scenario.counterparty_description,
    negotiation_goal: scenario.negotiation_goal,
    counterparty_stance: scenario.counterparty_stance,
    extra_context: scenario.extra_context,
  };
}

function isScenarioField(field: string): field is StreamScenarioField {
  return scenarioFields.includes(field as StreamScenarioField);
}

export default function ScenarioPage({ onSessionReady }: ScenarioPageProps) {
  const [mode, setMode] = useState<"choice" | "manual">("choice");
  const [scenario, setScenario] = useState<ScenarioPayload>(initialScenario);
  const [generatedScenarioId, setGeneratedScenarioId] = useState<number | null>(null);
  const [generationLabel, setGenerationLabel] = useState("Генерируем сценарий переговоров");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bootTraining(createdScenarioId: number) {
    setGenerationLabel("Генерируем карту этапов переговоров: открытие, вопросы, ценность, возражения, цену и закрытие.");
    await api.generateGraph(createdScenarioId);
    setGenerationLabel("Создаём тренировочный диалог и первое сообщение собеседника.");
    const session = await api.startSession(createdScenarioId);
    setGenerationLabel("Открываем диалог для тренировки.");
    onSessionReady(session);
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      if (generatedScenarioId !== null) {
        await bootTraining(generatedScenarioId);
      } else {
        setGenerationLabel("Сохраняем введённые данные сценария.");
        const created = await api.createScenario(scenario);
        await bootTraining(created.id);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать сценарий");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRandom() {
    const counterpartyStance: CounterpartyStance = "neutral";
    setMode("manual");
    setScenario(emptyScenario(counterpartyStance));
    setGeneratedScenarioId(null);
    setGenerationLabel("Генерируем сценарий переговоров");
    setIsLoading(true);
    setError(null);
    try {
      const created = await api.createRandomScenarioProgress(counterpartyStance, (event) => {
        if (event.type === "progress") {
          setGenerationLabel(event.detail || "Генерируем сценарий переговоров");
          return;
        }

        if (event.type !== "scenario_field_delta" || !event.field || event.delta === undefined) {
          return;
        }

        const field = event.field;
        const delta = event.delta;
        if (!isScenarioField(field)) {
          return;
        }

        setGenerationLabel(`Генерируем ${scenarioFieldLabels[field]}.`);
        setScenario((current) => ({
          ...current,
          [field]: `${current[field]}${delta}`,
        }));
      });
      setScenario(scenarioToPayload(created));
      setGeneratedScenarioId(created.id);
      setGenerationLabel("Сценарий готов");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать случайный сценарий");
    } finally {
      setIsLoading(false);
    }
  }

  function handleScenarioChange(nextScenario: ScenarioPayload) {
    setScenario(nextScenario);
    if (generatedScenarioId !== null) {
      setGeneratedScenarioId(null);
    }
  }

  if (mode === "choice") {
    return (
      <section className="scenario-start">
        <div className="scenario-start-actions">
          <button className="start-primary" type="button" onClick={handleRandom} disabled={isLoading}>
            Сгенерировать сценарий
          </button>
          <button
            className="start-secondary"
            type="button"
            onClick={() => {
              setGeneratedScenarioId(null);
              setScenario(initialScenario);
              setMode("manual");
            }}
            disabled={isLoading}
          >
            Создать сценарий
          </button>
        </div>
        {error ? <p className="error-box">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="scenario-manual">
      <button className="manual-back-button" type="button" onClick={() => setMode("choice")} disabled={isLoading}>
        Назад
      </button>
      <ScenarioForm value={scenario} onChange={handleScenarioChange} onSubmit={handleSubmit} disabled={isLoading} />
      {isLoading ? <ModelGenerationLoader label={generationLabel} /> : null}
      {error ? <p className="error-box">{error}</p> : null}
    </section>
  );
}
