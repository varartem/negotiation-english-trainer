import { useEffect, useMemo, useState } from "react";
import { api, resolveBackendUrl } from "../api/client";
import ChatPanel from "../components/ChatPanel";
import GraphView from "../components/GraphView";
import TutorFeedback from "../components/TutorFeedback";
import VocabularyTable from "../components/VocabularyTable";
import type { DialogueSession, Evaluation, VocabularyItem } from "../types";

interface TrainingPageProps {
  session: DialogueSession;
  onSessionChange: (session: DialogueSession) => void;
  onNewScenario: () => void;
}

export default function TrainingPage({ session, onSessionChange, onNewScenario }: TrainingPageProps) {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [idealAnswer, setIdealAnswer] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isAnalyticsPinned, setIsAnalyticsPinned] = useState(false);

  const latestEvaluation = useMemo<Evaluation | undefined>(() => {
    return [...session.messages]
      .reverse()
      .find((message) => message.role === "user" && message.evaluation)?.evaluation;
  }, [session.messages]);

  const currentNode = useMemo(() => {
    return session.graph.graph_json.nodes.find((node) => node.id === session.current_node_id);
  }, [session.current_node_id, session.graph.graph_json.nodes]);

  useEffect(() => {
    api.listVocabulary().then(setVocabulary).catch(() => setVocabulary([]));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const collapsePinnedPanel = () => {
      if (media.matches) {
        setIsAnalyticsPinned(false);
        setIsAnalyticsOpen(false);
      }
    };

    collapsePinnedPanel();
    media.addEventListener("change", collapsePinnedPanel);
    return () => media.removeEventListener("change", collapsePinnedPanel);
  }, []);

  async function refreshSession() {
    const updated = await api.getSession(session.id);
    onSessionChange(updated);
  }

  async function handleSend(content: string) {
    setIsSending(true);
    setError(null);
    try {
      const response = await api.sendMessage(session.id, content);
      onSessionChange(response.session);
      setIdealAnswer("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось отправить реплику");
    } finally {
      setIsSending(false);
    }
  }

  async function handleTranscribeAudio(audio: Blob) {
    const response = await api.transcribeAudio(audio);
    return response.text;
  }

  async function handleSynthesizeMessage(messageId: number) {
    const response = await api.synthesizeMessage(messageId);
    onSessionChange({
      ...session,
      messages: session.messages.map((message) =>
        message.id === response.message.id ? response.message : message,
      ),
    });
  }

  async function handleRetry() {
    setError(null);
    try {
      const response = await api.retry(session.id);
      onSessionChange(response.session);
      setIdealAnswer("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось повторить этап");
    }
  }

  async function handleIdealAnswer() {
    setError(null);
    try {
      const response = await api.idealAnswer(session.id);
      setIdealAnswer(response.ideal_answer);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось загрузить идеальный ответ");
    }
  }

  async function handleAddVocabulary(phrase: string, context: string, sourceMessageId?: number) {
    const trimmed = phrase.trim();
    if (!trimmed) {
      return;
    }
    const created = await api.createVocabulary({
      phrase: trimmed,
      context,
      source_message: sourceMessageId ?? null,
    });
    setVocabulary((items) => [created, ...items]);
  }

  async function handleDeleteVocabulary(itemId: number) {
    await api.deleteVocabulary(itemId);
    setVocabulary((items) => items.filter((item) => item.id !== itemId));
  }

  function handleTogglePin() {
    const nextPinned = !isAnalyticsPinned;
    setIsAnalyticsPinned(nextPinned);
    if (nextPinned) {
      setIsAnalyticsOpen(true);
    }
  }

  const currentStageLabel = currentNode?.label || currentNode?.type || session.current_node_id;

  return (
    <section
      className={[
        "training-layout",
        isAnalyticsOpen ? "analytics-open" : "",
        isAnalyticsPinned ? "analytics-pinned" : "",
      ].join(" ")}
    >
      <header className="session-header">
        <div className="session-header-main">
          <div className="session-meta-line">
            <span className="counterparty-chip">{session.scenario.counterparty_role}</span>
          </div>
          <h2>{session.scenario.product_name}</h2>
          <p>{session.scenario.negotiation_goal}</p>
        </div>
        <div className="session-actions">
          <div className="stage-chip" title="Текущий этап">
            <strong>{currentStageLabel}</strong>
          </div>
          <button className="secondary-button" type="button" onClick={onNewScenario}>
            Новый сценарий
          </button>
          <button
            className="analytics-toggle"
            type="button"
            aria-expanded={isAnalyticsOpen}
            aria-controls="analytics-panel"
            onClick={() => setIsAnalyticsOpen((value) => !value)}
          >
            <PanelIcon />
            <span>Аналитика</span>
          </button>
        </div>
      </header>

      {error ? <p className="error-box">{error}</p> : null}

      <div className="training-workspace">
        <ChatPanel
          messages={session.messages}
          disabled={isSending || session.status !== "active"}
          onSend={handleSend}
          onAddVocabulary={handleAddVocabulary}
          onRefresh={refreshSession}
          onTranscribeAudio={handleTranscribeAudio}
          onSynthesizeMessage={handleSynthesizeMessage}
          resolveAudioUrl={resolveBackendUrl}
        />
        <aside
          className="analytics-drawer"
          id="analytics-panel"
          aria-label="Аналитика переговоров"
          aria-hidden={!isAnalyticsOpen}
        >
          <div className="analytics-drawer-header">
            <div>
              <h2>Аналитика</h2>
            </div>
            <div className="drawer-actions">
              <button
                className={`icon-button pin-button ${isAnalyticsPinned ? "active" : ""}`}
                type="button"
                aria-pressed={isAnalyticsPinned}
                title={isAnalyticsPinned ? "Открепить панель" : "Закрепить панель"}
                onClick={handleTogglePin}
              >
                <PinIcon />
              </button>
              <button
                className="icon-button"
                type="button"
                title="Закрыть аналитику"
                onClick={() => {
                  setIsAnalyticsOpen(false);
                  setIsAnalyticsPinned(false);
                }}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <GraphView graph={session.graph.graph_json} currentNodeId={session.current_node_id} />
          <TutorFeedback
            evaluation={latestEvaluation}
            idealAnswer={idealAnswer}
            onRetry={handleRetry}
            onShowIdealAnswer={handleIdealAnswer}
          />
          <VocabularyTable items={vocabulary} onDelete={handleDeleteVocabulary} />
        </aside>
      </div>

      {isAnalyticsOpen && !isAnalyticsPinned ? (
        <button
          className="drawer-scrim"
          type="button"
          aria-label="Закрыть аналитику"
          onClick={() => setIsAnalyticsOpen(false)}
        />
      ) : null}
    </section>
  );
}

function PanelIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 5.5h16M4 12h10M4 18.5h16" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14 4l6 6-3 1-4 4v4l-2 2-2-6-6-2 2-2h4l4-4 1-3z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
