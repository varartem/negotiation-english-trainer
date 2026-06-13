import { useEffect, useState } from "react";
import { api, resolveBackendUrl } from "./api/client";
import Layout from "./components/Layout";
import AccountPage from "./pages/AccountPage";
import AuthPage from "./pages/AuthPage";
import ScenarioPage from "./pages/ScenarioPage";
import TrainingPage from "./pages/TrainingPage";
import VocabularyPage from "./pages/VocabularyPage";
import WelcomePage from "./pages/WelcomePage";
import type { AccountUser, DialogueSession, DialogueSessionSummary } from "./types";

type AppTab = "home" | "training" | "vocabulary" | "account";
type AuthMode = "login" | "register";

const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanPath() {
  return window.location.pathname.replace(/^\/+|\/+$/g, "");
}

function getRoutePublicId() {
  const path = cleanPath();
  return PUBLIC_ID_PATTERN.test(path) ? path : null;
}

function getRouteAuthMode(): AuthMode | null {
  const path = cleanPath();
  if (path === "login" || path === "register") {
    return path;
  }
  return null;
}

function getRouteTab(): AppTab | null {
  const path = cleanPath();
  if (path === "") {
    return "home";
  }
  if (path === "training" || path === "vocabulary" || path === "account") {
    return path;
  }
  return null;
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
  const [currentUser, setCurrentUser] = useState<AccountUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(getRouteAuthMode() ?? "login");
  const [, setRouteRevision] = useState(0);
  const [session, setSession] = useState<DialogueSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<DialogueSessionSummary[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [scenarioResetKey, setScenarioResetKey] = useState(0);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  function navigateToPath(path: string) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
      setRouteRevision((revision) => revision + 1);
    }
  }

  function replacePath(path: string) {
    if (window.location.pathname !== path) {
      window.history.replaceState({}, "", path);
      setRouteRevision((revision) => revision + 1);
    }
  }

  function rememberSession(nextSession: DialogueSession | DialogueSessionSummary) {
    const summary = "messages" in nextSession ? toSessionSummary(nextSession) : nextSession;
    setSessionHistory((items) => [
      summary,
      ...items.filter((item) => item.public_id !== summary.public_id),
    ]);
  }

  function navigateToSession(nextSession: DialogueSession | DialogueSessionSummary) {
    navigateToPath(`/${nextSession.public_id}`);
  }

  function navigateHome() {
    navigateToPath("/");
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
      setActiveTab("training");
      setRouteError(error instanceof Error ? error.message : "Не удалось открыть диалог");
    } finally {
      setIsSessionLoading(false);
    }
  }

  async function syncAuthenticatedRoute() {
    const authRoute = getRouteAuthMode();
    if (authRoute) {
      setSession(null);
      setRouteError(null);
      setActiveTab("home");
      navigateHome();
      return;
    }

    const publicId = getRoutePublicId();
    if (publicId) {
      await openSessionByPublicId(publicId, false);
      return;
    }

    const routeTab = getRouteTab();
    setIsSessionLoading(false);
    setRouteError(null);
    setSession(null);
    setActiveTab(routeTab ?? "home");
    if (!routeTab) {
      navigateHome();
    }
  }

  async function loadSessions() {
    const sessions = await api.listSessions();
    setSessionHistory(sessions);
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
    navigateToPath("/training");
    setScenarioResetKey((key) => key + 1);
  }

  function handleOpenHome() {
    setSession(null);
    setRouteError(null);
    setActiveTab("home");
    navigateHome();
  }

  function handleOpenTraining() {
    setActiveTab("training");
    setRouteError(null);
    if (session) {
      navigateToSession(session);
      return;
    }
    navigateToPath("/training");
  }

  function handleOpenVocabulary() {
    setSession(null);
    setRouteError(null);
    setActiveTab("vocabulary");
    navigateToPath("/vocabulary");
  }

  function handleOpenAccount() {
    setSession(null);
    setRouteError(null);
    setActiveTab("account");
    navigateToPath("/account");
  }

  function handleAuthModeChange(nextMode: AuthMode) {
    setAuthMode(nextMode);
    navigateToPath(nextMode === "login" ? "/login" : "/register");
  }

  async function handleAuthenticated(user: AccountUser) {
    setCurrentUser(user);
    setSession(null);
    setRouteError(null);
    setActiveTab("home");
    navigateHome();
    try {
      await loadSessions();
    } catch {
      setSessionHistory([]);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setCurrentUser(null);
      setSession(null);
      setSessionHistory([]);
      setRouteError(null);
      setActiveTab("home");
      setAuthMode("login");
      navigateHome();
    }
  }

  useEffect(() => {
    let isActive = true;

    async function hydrate() {
      setIsAuthLoading(true);
      try {
        await api.getCsrfToken();
        const user = await api.getCurrentUser();
        if (!isActive) {
          return;
        }
        setCurrentUser(user);
        await loadSessions();
        if (!isActive) {
          return;
        }
        await syncAuthenticatedRoute();
      } catch {
        if (!isActive) {
          return;
        }
        setCurrentUser(null);
        setSession(null);
        setSessionHistory([]);
        setRouteError(null);
        const routeAuthMode = getRouteAuthMode();
        setAuthMode(routeAuthMode ?? "login");
        if (!routeAuthMode && cleanPath() !== "") {
          replacePath("/");
        }
      } finally {
        if (isActive) {
          setIsAuthLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    function handlePopState() {
      if (!currentUser) {
        const routeAuthMode = getRouteAuthMode();
        setAuthMode(routeAuthMode ?? "login");
        if (!routeAuthMode && cleanPath() !== "") {
          replacePath("/");
        }
        return;
      }
      void syncAuthenticatedRoute();
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentUser, session]);

  if (isAuthLoading) {
    return (
      <main className="auth-screen">
        <AppStateMessage message="Загружаю аккаунт..." />
      </main>
    );
  }

  if (!currentUser) {
    const routeAuthMode = getRouteAuthMode();
    if (routeAuthMode) {
      return (
        <AuthPage
          mode={routeAuthMode}
          onHome={navigateHome}
          onModeChange={handleAuthModeChange}
          onAuthenticated={handleAuthenticated}
        />
      );
    }

    return (
      <main className="public-main">
        <WelcomePage
          onLogin={() => handleAuthModeChange("login")}
          onRegister={() => handleAuthModeChange("register")}
        />
      </main>
    );
  }

  return (
    <Layout>
      <AppSidebar
        activeTab={activeTab}
        currentSession={session}
        currentUser={currentUser}
        sessions={sessionHistory}
        isLoading={isSessionLoading && sessionHistory.length === 0}
        onNewNegotiation={handleNewNegotiation}
        onOpenAccount={handleOpenAccount}
        onOpenHome={handleOpenHome}
        onOpenSession={(nextSession) => void openSessionByPublicId(nextSession.public_id)}
        onOpenTraining={handleOpenTraining}
        onOpenVocabulary={handleOpenVocabulary}
        onLogout={() => void handleLogout()}
      />
      <main className={session && activeTab === "training" ? "app-main app-main-chat" : "app-main"}>
        {activeTab === "account" ? (
          <AccountPage
            user={currentUser}
            onUserChange={setCurrentUser}
            onLogout={() => void handleLogout()}
          />
        ) : activeTab === "vocabulary" ? (
          <VocabularyPage />
        ) : activeTab === "home" ? (
          <ScenarioPage key={`home-${scenarioResetKey}`} onSessionReady={handleSessionReady} />
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
  currentUser: AccountUser;
  sessions: DialogueSessionSummary[];
  isLoading: boolean;
  onNewNegotiation: () => void;
  onOpenAccount: () => void;
  onOpenHome: () => void;
  onOpenSession: (session: DialogueSessionSummary) => void;
  onOpenTraining: () => void;
  onOpenVocabulary: () => void;
  onLogout: () => void;
}

function AppSidebar({
  activeTab,
  currentSession,
  currentUser,
  sessions,
  isLoading,
  onNewNegotiation,
  onOpenAccount,
  onOpenHome,
  onOpenSession,
  onOpenTraining,
  onOpenVocabulary,
  onLogout,
}: AppSidebarProps) {
  return (
    <aside className="app-sidebar" aria-label="Навигация">
      <div className="sidebar-content">
        <button className="sidebar-brand sidebar-brand-button" type="button" onClick={onOpenHome}>
          <span className="sidebar-mark">N</span>
          <span className="sidebar-label">Negotiation English</span>
        </button>

        <nav className="sidebar-nav" aria-label="Разделы">
          <button
            className={activeTab === "home" ? "sidebar-action active" : "sidebar-action"}
            type="button"
            title="Главная"
            onClick={onOpenHome}
          >
            <span className="sidebar-action-icon">
              <HomeIcon />
            </span>
            <span>Главная</span>
          </button>
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

        <div className="sidebar-account">
          <button
            className={activeTab === "account" ? "account-button active" : "account-button"}
            type="button"
            onClick={onOpenAccount}
            title="Аккаунт"
          >
            <span className="account-avatar">
              {currentUser.photo_url ? (
                <img src={resolveBackendUrl(currentUser.photo_url)} alt="" />
              ) : (
                avatarInitial(currentUser)
              )}
            </span>
            <span className="account-copy">
              <strong>{currentUser.name || currentUser.email}</strong>
              <small>{currentUser.email}</small>
            </span>
          </button>
          <button className="sidebar-action sidebar-logout" type="button" title="Выйти" onClick={onLogout}>
            <span className="sidebar-action-icon">
              <LogoutIcon />
            </span>
            <span>Выйти</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function avatarInitial(user: AccountUser) {
  return (user.name || user.email || "N").trim().slice(0, 1).toUpperCase();
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m4 11 8-7 8 7" />
      <path d="M6.5 10.5V20h11v-9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
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

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10" />
      <path d="M14 8l4 4-4 4" />
      <path d="M8 12h10" />
    </svg>
  );
}
