import { useEffect, useState } from "react";
import { api } from "./api/client";
import Layout from "./components/Layout";
import ScenarioPage from "./pages/ScenarioPage";
import TrainingPage from "./pages/TrainingPage";
import VocabularyPage from "./pages/VocabularyPage";
import type { DialogueSession, DialogueSessionSummary } from "./types";

type AppTab = "training" | "vocabulary";

const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRoutePublicId() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return PUBLIC_ID_PATTERN.test(path) ? path : null;
}

function toSessionSummary(session: DialogueSession): DialogueSessionSummary {
  return {
    id: session.id,
    public_id: session.public_id,
    scenario: session.scenario,
    current_node_id: session.current_node_id,
    status: session.status,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

export default function App() {
  const [session, setSession] = useState<DialogueSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<DialogueSessionSummary[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>("training");
  const [scenarioResetKey, setScenarioResetKey] = useState(0);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  function rememberSession(nextSession: DialogueSession | DialogueSessionSummary) {
    const summary = "messages" in nextSession ? toSessionSummary(nextSession) : nextSession;
    setSessionHistory((items) => [
      summary,
      ...items.filter((item) => item.public_id !== summary.public_id),
    ]);
  }

  function navigateToSession(nextSession: DialogueSession | DialogueSessionSummary) {
    const nextPath = `/${nextSession.public_id}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }

  function navigateHome() {
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
    }
  }

  async function openSessionByPublicId(publicId: string, pushRoute = true) {
    setIsSessionLoading(true);
    setRouteError(null);
    try {
      const loadedSession = await api.getSessionByPublicId(publicId);
      setSession(loadedSession);
      rememberSession(loadedSession);
      setActiveTab("training");
      if (pushRoute) {
        navigateToSession(loadedSession);
      }
    } catch (error) {
      setSession(null);
      setRouteError(error instanceof Error ? error.message : "Не удалось открыть диалог");
    } finally {
      setIsSessionLoading(false);
    }
  }

  function handleSessionReady(nextSession: DialogueSession) {
    setSession(nextSession);
    rememberSession(nextSession);
    navigateToSession(nextSession);
    setRouteError(null);
    setActiveTab("training");
  }

  function handleSessionChange(nextSession: DialogueSession) {
    setSession(nextSession);
    rememberSession(nextSession);
    if (getRoutePublicId() !== nextSession.public_id) {
      navigateToSession(nextSession);
    }
  }

  function handleNewNegotiation() {
    setSession(null);
    setRouteError(null);
    setActiveTab("training");
    navigateHome();
    setScenarioResetKey((key) => key + 1);
  }

  function handleOpenTraining() {
    setActiveTab("training");
    setRouteError(null);
    if (session) {
      navigateToSession(session);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function hydrate() {
      const publicId = getRoutePublicId();
      setIsSessionLoading(Boolean(publicId));
      setRouteError(null);
      try {
        const sessions = await api.listSessions();
        if (!isActive) {
          return;
        }
        setSessionHistory(sessions);

        if (!publicId) {
          setIsSessionLoading(false);
          return;
        }

        const loadedSession = await api.getSessionByPublicId(publicId);
        if (!isActive) {
          return;
        }
        setSession(loadedSession);
        rememberSession(loadedSession);
      } catch (error) {
        if (!isActive) {
          return;
        }
        setSession(null);
        setRouteError(error instanceof Error ? error.message : "Не удалось загрузить историю диалогов");
      } finally {
        if (isActive) {
          setIsSessionLoading(false);
        }
      }
    }

    function handlePopState() {
      const publicId = getRoutePublicId();
      if (publicId) {
        void openSessionByPublicId(publicId, false);
        return;
      }
      setSession(null);
      setRouteError(null);
      setActiveTab("training");
    }

    void hydrate();
    window.addEventListener("popstate", handlePopState);

    return () => {
      isActive = false;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <Layout>
      <AppSidebar
        activeTab={activeTab}
        currentSession={session}
        sessions={sessionHistory}
        isLoading={isSessionLoading && sessionHistory.length === 0}
        onNewNegotiation={handleNewNegotiation}
        onOpenSession={(nextSession) => void openSessionByPublicId(nextSession.public_id)}
        onOpenTraining={handleOpenTraining}
        onOpenVocabulary={() => setActiveTab("vocabulary")}
      />
      <main className={session && activeTab === "training" ? "app-main app-main-chat" : "app-main"}>
        {activeTab === "vocabulary" ? (
          <VocabularyPage />
        ) : isSessionLoading ? (
          <AppStateMessage message="Загружаю диалог..." />
        ) : routeError ? (
          <AppStateMessage message="Диалог не найден или недоступен." details={routeError} />
        ) : session ? (
          <TrainingPage session={session} onSessionChange={handleSessionChange} />
        ) : (
          <ScenarioPage key={scenarioResetKey} onSessionReady={handleSessionReady} />
        )}
      </main>
    </Layout>
  );
}

function AppStateMessage({ message, details }: { message: string; details?: string }) {
  return (
    <section className="app-state">
      <div>
        <strong>{message}</strong>
        {details ? <p>{details}</p> : null}
      </div>
    </section>
  );
}

interface AppSidebarProps {
  activeTab: AppTab;
  currentSession: DialogueSession | null;
  sessions: DialogueSessionSummary[];
  isLoading: boolean;
  onNewNegotiation: () => void;
  onOpenSession: (session: DialogueSessionSummary) => void;
  onOpenTraining: () => void;
  onOpenVocabulary: () => void;
}

function AppSidebar({
  activeTab,
  currentSession,
  sessions,
  isLoading,
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
          {isLoading ? (
            <p>Загружаю...</p>
          ) : sessions.length ? (
            sessions.map((item) => (
              <button
                className={currentSession?.public_id === item.public_id ? "history-item active" : "history-item"}
                type="button"
                key={item.public_id}
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
