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

const statusLabels: Record<string, string> = {
  active: "Активна",
  success: "Успех",
  dead_end: "Тупик",
  abandoned: "Завершена",
};

export default function TrainingPage({ session, onSessionChange, onNewScenario }: TrainingPageProps) {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [idealAnswer, setIdealAnswer] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestEvaluation = useMemo<Evaluation | undefined>(() => {
    return [...session.messages]
      .reverse()
      .find((message) => message.role === "user" && message.evaluation)?.evaluation;
  }, [session.messages]);

  useEffect(() => {
    api.listVocabulary().then(setVocabulary).catch(() => setVocabulary([]));
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

  return (
    <section className="training-layout">
      <div className="session-strip">
        <div>
          <span className={`status-pill status-${session.status}`}>{statusLabels[session.status] ?? session.status}</span>
          <h2>{session.scenario.product_name}</h2>
          <p>{session.scenario.negotiation_goal}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onNewScenario}>
          Новый сценарий
        </button>
      </div>

      {error ? <p className="error-box">{error}</p> : null}

      <div className="trainer-grid">
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
        <GraphView graph={session.graph.graph_json} currentNodeId={session.current_node_id} />
        <TutorFeedback
          evaluation={latestEvaluation}
          idealAnswer={idealAnswer}
          onRetry={handleRetry}
          onShowIdealAnswer={handleIdealAnswer}
        />
        <VocabularyTable items={vocabulary} onDelete={handleDeleteVocabulary} />
      </div>
    </section>
  );
}
