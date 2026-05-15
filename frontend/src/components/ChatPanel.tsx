import { FormEvent, useMemo, useState } from "react";
import type { Message } from "../types";

interface ChatPanelProps {
  messages: Message[];
  disabled: boolean;
  onSend: (content: string) => void;
  onAddVocabulary: (phrase: string, context: string, sourceMessageId?: number) => void;
  onRefresh: () => void;
}

const roleLabels: Record<string, string> = {
  user: "Вы",
  assistant: "Собеседник",
  tutor: "Тренер",
  system: "Система",
};

export default function ChatPanel({ messages, disabled, onSend, onAddVocabulary, onRefresh }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<{ text: string; context: string; messageId?: number } | null>(null);

  const canSend = useMemo(() => draft.trim().length > 0 && !disabled, [draft, disabled]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    onSend(draft.trim());
    setDraft("");
  }

  function captureSelection(message: Message) {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (text) {
      setSelected({ text, context: message.content, messageId: message.id });
    }
  }

  async function addSelectedPhrase() {
    if (!selected) {
      return;
    }
    await onAddVocabulary(selected.text, selected.context, selected.messageId);
    setSelected(null);
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <h2>Диалог</h2>
        <button className="icon-button" type="button" title="Обновить сессию" onClick={onRefresh}>
          ↻
        </button>
      </div>

      <div className="messages">
        {messages.map((message) => (
          <article
            className={`message message-${message.role}`}
            key={message.id}
            onMouseUp={() => captureSelection(message)}
          >
            <span>{roleLabels[message.role] ?? message.role}</span>
            <p>{message.content}</p>
          </article>
        ))}
      </div>

      <div className="selection-row">
        <span>{selected ? selected.text : "Выделите фразу в диалоге, чтобы сохранить её"}</span>
        <button className="secondary-button" type="button" onClick={addSelectedPhrase} disabled={!selected}>
          Добавить фразу
        </button>
      </div>

      <form className="message-form" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Введите вашу реплику на английском..."
          rows={3}
          disabled={disabled}
        />
        <button className="primary-button" type="submit" disabled={!canSend}>
          Отправить
        </button>
      </form>
    </section>
  );
}
