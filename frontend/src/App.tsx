import { useState } from "react";
import Layout from "./components/Layout";
import ScenarioPage from "./pages/ScenarioPage";
import TrainingPage from "./pages/TrainingPage";
import VocabularyPage from "./pages/VocabularyPage";
import type { DialogueSession } from "./types";

type AppTab = "training" | "vocabulary";

export default function App() {
  const [session, setSession] = useState<DialogueSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<DialogueSession[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>("training");
  const [scenarioResetKey, setScenarioResetKey] = useState(0);

  function rememberSession(nextSession: DialogueSession) {
    setSessionHistory((items) => [
      nextSession,
      ...items.filter((item) => item.id !== nextSession.id),
    ].slice(0, 8));
  }

  function handleSessionReady(nextSession: DialogueSession) {
    setSession(nextSession);
    rememberSession(nextSession);
    setActiveTab("training");
  }

  function handleSessionChange(nextSession: DialogueSession) {
    setSession(nextSession);
    rememberSession(nextSession);
  }

  function handleNewNegotiation() {
    setSession(null);
    setActiveTab("training");
    setScenarioResetKey((key) => key + 1);
  }

  return (
    <Layout>
      <AppSidebar
        activeTab={activeTab}
        currentSession={session}
        sessions={sessionHistory}
        onNewNegotiation={handleNewNegotiation}
        onOpenSession={(nextSession) => {
          setSession(nextSession);
          setActiveTab("training");
        }}
        onOpenTraining={() => setActiveTab("training")}
        onOpenVocabulary={() => setActiveTab("vocabulary")}
      />
      <main className={session && activeTab === "training" ? "app-main app-main-chat" : "app-main"}>
        {activeTab === "vocabulary" ? (
          <VocabularyPage />
        ) : session ? (
          <TrainingPage session={session} onSessionChange={handleSessionChange} />
        ) : (
          <ScenarioPage key={scenarioResetKey} onSessionReady={handleSessionReady} />
        )}
      </main>
    </Layout>
  );
}

interface AppSidebarProps {
  activeTab: AppTab;
  currentSession: DialogueSession | null;
  sessions: DialogueSession[];
  onNewNegotiation: () => void;
  onOpenSession: (session: DialogueSession) => void;
  onOpenTraining: () => void;
  onOpenVocabulary: () => void;
}

function AppSidebar({
  activeTab,
  currentSession,
  sessions,
  onNewNegotiation,
  onOpenSession,
  onOpenTraining,
  onOpenVocabulary,
}: AppSidebarProps) {
  return (
    <aside className="app-sidebar" aria-label="Навигация">
      <div className="sidebar-content">
        <span className="sidebar-brand" aria-label="Negotiation English">
          <span className="sidebar-mark">N</span>
          <span className="sidebar-label">Negotiation English</span>
        </span>

        <nav className="sidebar-nav" aria-label="Разделы">
          <button className="sidebar-action" type="button" title="Новые переговоры" onClick={onNewNegotiation}>
            <span className="sidebar-action-icon">
              <PlusIcon />
            </span>
            <span>Новые переговоры</span>
          </button>
          <button
            className={activeTab === "training" ? "sidebar-action active" : "sidebar-action"}
            type="button"
            title="Диалог"
            onClick={onOpenTraining}
          >
            <span className="sidebar-action-icon">
              <ChatIcon />
            </span>
            <span>Диалог</span>
          </button>
          <button
            className={activeTab === "vocabulary" ? "sidebar-action active" : "sidebar-action"}
            type="button"
            title="Словарь"
            onClick={onOpenVocabulary}
          >
            <span className="sidebar-action-icon">
              <BookIcon />
            </span>
            <span>Словарь</span>
          </button>
        </nav>

        <div className="sidebar-history" aria-label="История переговоров">
          <span>История</span>
          {sessions.length ? (
            sessions.map((item) => (
              <button
                className={currentSession?.id === item.id ? "history-item active" : "history-item"}
                type="button"
                key={item.id}
                onClick={() => onOpenSession(item)}
              >
                <strong>{item.scenario.product_name}</strong>
                <small>{item.scenario.counterparty_role}</small>
              </button>
            ))
          ) : (
            <p>Пока пусто</p>
          )}
        </div>
      </div>
    </aside>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v4A3.5 3.5 0 0 1 15.5 15H11l-5 4v-4.5A3.5 3.5 0 0 1 5 12V7.5z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21V5.5z" />
      <path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H19" />
    </svg>
  );
}
