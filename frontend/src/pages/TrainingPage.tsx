import { useEffect, useMemo, useState } from "react";
import { api, resolveBackendUrl } from "../api/client";
import ChatPanel from "../components/ChatPanel";
import GraphView from "../components/GraphView";
import TutorFeedback from "../components/TutorFeedback";
import type { ModelProgressHandler } from "../api/client";
import type { DialogueSession, Evaluation, Message } from "../types";

interface TrainingPageProps {
  session: DialogueSession;
  onSessionChange: (session: DialogueSession) => void;
}

export default function TrainingPage({ session, onSessionChange }: TrainingPageProps) {
  const [idealAnswer, setIdealAnswer] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isContextIntroVisible, setIsContextIntroVisible] = useState(true);

  const latestEvaluation = useMemo<Evaluation | undefined>(() => {
    return [...session.messages]
      .reverse()
      .find((message) => message.role === "user" && message.evaluation)?.evaluation;
  }, [session.messages]);

  const currentNode = useMemo(() => {
    return session.graph.graph_json.nodes.find((node) => node.id === session.current_node_id);
  }, [session.current_node_id, session.graph.graph_json.nodes]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [session.id]);

  useEffect(() => {
    setIsContextIntroVisible(true);
    const timeoutId = window.setTimeout(() => setIsContextIntroVisible(false), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [session.id]);

  async function handleSend(content: string) {
    const optimisticMessage: Message = {
      id: -Date.now(),
      session: session.id,
      role: "user",
      node_id: session.current_node_id,
      content,
      audio_url: "",
      created_at: new Date().toISOString(),
    };

    onSessionChange({
      ...session,
      messages: [...session.messages, optimisticMessage],
    });
    setIsSending(true);
    setError(null);
    try {
      const response = await api.sendMessage(session.id, content);
      onSessionChange(response.session);
      setIdealAnswer("");
    } catch (error) {
      onSessionChange(session);
      setError(error instanceof Error ? error.message : "Не удалось отправить реплику");
    } finally {
      setIsSending(false);
    }
  }

  async function handleTranscribeAudio(audio: Blob, onProgress?: ModelProgressHandler) {
    const response = await api.transcribeAudio(audio, onProgress);
    return response.text;
  }

  async function handleSynthesizeMessage(messageId: number, onProgress?: ModelProgressHandler) {
    const response = await api.synthesizeMessage(messageId, onProgress);
    onSessionChange({
      ...session,
      messages: session.messages.map((message) =>
        message.id === response.message.id ? response.message : message,
      ),
    });
    return response.message;
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
    await api.createVocabulary({
      phrase: trimmed,
      context,
      source_message: sourceMessageId ?? null,
    });
  }

  const currentStageLabel = currentNode?.label || currentNode?.type || session.current_node_id;

  return (
    <section className="training-layout">
      {error ? <p className="error-box">{error}</p> : null}

      <div className="training-workspace">
        <aside
          className={`dialog-context-card ${isContextIntroVisible ? "context-card-open" : "context-card-collapsed"}`}
          aria-label="Контекст диалога"
          tabIndex={0}
        >
          <div className="context-card-head">
            <h2>Контекст</h2>
            {isContextIntroVisible ? (
              <svg className="context-progress" viewBox="0 0 20 20" aria-hidden="true">
                <circle className="context-progress-track" cx="10" cy="10" r="8" />
                <circle className="context-progress-value" cx="10" cy="10" r="8" />
              </svg>
            ) : null}
          </div>
          <dl className="context-card-body">
            <div>
              <dt>Продукт</dt>
              <dd>{session.scenario.product_name}</dd>
            </div>
            <div>
              <dt>Собеседник</dt>
              <dd>{session.scenario.counterparty_role}</dd>
            </div>
            <div>
              <dt>Цель</dt>
              <dd>{session.scenario.negotiation_goal}</dd>
            </div>
            <div>
              <dt>Этап</dt>
              <dd>{currentStageLabel}</dd>
            </div>
          </dl>
        </aside>
        <ChatPanel
          messages={session.messages}
          disabled={isSending || session.status !== "active"}
          onSend={handleSend}
          onAddVocabulary={handleAddVocabulary}
          onTranscribeAudio={handleTranscribeAudio}
          onSynthesizeMessage={handleSynthesizeMessage}
          resolveAudioUrl={resolveBackendUrl}
        />
        <div className="analytics-hover-zone" aria-hidden="true" />
        <aside
          className="analytics-drawer"
          id="analytics-panel"
          aria-label="Аналитика переговоров"
          tabIndex={0}
        >
          <div className="analytics-drawer-header">
            <div>
              <h2>Аналитика</h2>
            </div>
          </div>

          <GraphView graph={session.graph.graph_json} currentNodeId={session.current_node_id} />
          <TutorFeedback
            evaluation={latestEvaluation}
            idealAnswer={idealAnswer}
            onRetry={handleRetry}
            onShowIdealAnswer={handleIdealAnswer}
          />
        </aside>
      </div>
    </section>
  );
}
