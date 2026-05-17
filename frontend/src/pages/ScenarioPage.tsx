import { useState } from "react";
import { api, type ScenarioPayload } from "../api/client";
import ScenarioForm from "../components/ScenarioForm";
import type { DialogueSession } from "../types";

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

export default function ScenarioPage({ onSessionReady }: ScenarioPageProps) {
  const [mode, setMode] = useState<"choice" | "manual">("choice");
  const [scenario, setScenario] = useState<ScenarioPayload>(initialScenario);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bootTraining(createdScenarioId: number) {
    await api.generateGraph(createdScenarioId);
    const session = await api.startSession(createdScenarioId);
    onSessionReady(session);
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      const created = await api.createScenario(scenario);
      await bootTraining(created.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать сценарий");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRandom() {
    setIsLoading(true);
    setError(null);
    try {
      const created = await api.createRandomScenario("neutral");
      await bootTraining(created.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать случайный сценарий");
    } finally {
      setIsLoading(false);
    }
  }

  if (mode === "choice") {
    return (
      <section className="scenario-start">
        <div className="scenario-start-actions">
          <button className="start-primary" type="button" onClick={handleRandom} disabled={isLoading}>
            Сгенерировать сценарий переговоров
          </button>
          <button className="start-secondary" type="button" onClick={() => setMode("manual")} disabled={isLoading}>
            Задать сценарий переговоров вручную
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
      <ScenarioForm value={scenario} onChange={setScenario} onSubmit={handleSubmit} disabled={isLoading} />
      {error ? <p className="error-box">{error}</p> : null}
    </section>
  );
}
