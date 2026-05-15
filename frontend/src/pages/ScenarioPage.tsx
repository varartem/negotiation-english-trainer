import { useState } from "react";
import { api, type ScenarioPayload } from "../api/client";
import ScenarioForm from "../components/ScenarioForm";
import type { DialogueSession, Difficulty } from "../types";

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
  difficulty: "medium",
  extra_context: "Собеседник сравнивает ваше предложение с более дешёвым конкурентом.",
};

export default function ScenarioPage({ onSessionReady }: ScenarioPageProps) {
  const [scenario, setScenario] = useState<ScenarioPayload>(initialScenario);
  const [randomDifficulty, setRandomDifficulty] = useState<Difficulty>("medium");
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
      const created = await api.createRandomScenario(randomDifficulty);
      await bootTraining(created.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать случайный сценарий");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="scenario-grid">
      <ScenarioForm value={scenario} onChange={setScenario} onSubmit={handleSubmit} disabled={isLoading} />
      <aside className="side-panel">
        <h2>Случайный сценарий</h2>
        <label className="field">
          <span>Сложность</span>
          <select value={randomDifficulty} onChange={(event) => setRandomDifficulty(event.target.value as Difficulty)}>
            <option value="easy">Легко</option>
            <option value="medium">Средне</option>
            <option value="hard">Сложно</option>
          </select>
        </label>
        <button className="primary-button" type="button" onClick={handleRandom} disabled={isLoading}>
          Сгенерировать и начать
        </button>
        {error ? <p className="error-box">{error}</p> : null}
      </aside>
    </section>
  );
}
