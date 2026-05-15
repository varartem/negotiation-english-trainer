import { useState } from "react";
import Layout from "./components/Layout";
import ScenarioPage from "./pages/ScenarioPage";
import TrainingPage from "./pages/TrainingPage";
import VocabularyPage from "./pages/VocabularyPage";
import type { DialogueSession } from "./types";

type AppTab = "training" | "vocabulary";

export default function App() {
  const [session, setSession] = useState<DialogueSession | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("training");

  function handleSessionReady(nextSession: DialogueSession) {
    setSession(nextSession);
    setActiveTab("training");
  }

  return (
    <Layout>
      <nav className="app-tabs" aria-label="Основные разделы">
        <button
          className={activeTab === "training" ? "app-tab app-tab-active" : "app-tab"}
          type="button"
          onClick={() => setActiveTab("training")}
        >
          Тренировка
        </button>
        <button
          className={activeTab === "vocabulary" ? "app-tab app-tab-active" : "app-tab"}
          type="button"
          onClick={() => setActiveTab("vocabulary")}
        >
          Словарь
        </button>
      </nav>

      {activeTab === "vocabulary" ? (
        <VocabularyPage />
      ) : session ? (
        <TrainingPage session={session} onSessionChange={setSession} onNewScenario={() => setSession(null)} />
      ) : (
        <ScenarioPage onSessionReady={handleSessionReady} />
      )}
    </Layout>
  );
}
