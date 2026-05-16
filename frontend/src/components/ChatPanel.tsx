import { FormEvent, useMemo, useRef, useState } from "react";
import type { Message } from "../types";

interface ChatPanelProps {
  messages: Message[];
  disabled: boolean;
  onSend: (content: string) => void;
  onAddVocabulary: (phrase: string, context: string, sourceMessageId?: number) => void;
  onRefresh: () => void;
  onTranscribeAudio: (audio: Blob) => Promise<string>;
  onSynthesizeMessage: (messageId: number) => Promise<void>;
  resolveAudioUrl: (url: string) => string;
}

interface RecorderState {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  gain: GainNode;
  stream: MediaStream;
  chunks: Float32Array[];
}

const roleLabels: Record<string, string> = {
  user: "Вы",
  assistant: "Собеседник",
  tutor: "Тренер",
  system: "Система",
};

export default function ChatPanel({
  messages,
  disabled,
  onSend,
  onAddVocabulary,
  onRefresh,
  onTranscribeAudio,
  onSynthesizeMessage,
  resolveAudioUrl,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<{ text: string; context: string; messageId?: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [synthesizingIds, setSynthesizingIds] = useState<Set<number>>(new Set());
  const recorderRef = useRef<RecorderState | null>(null);

  const canSend = useMemo(() => draft.trim().length > 0 && !disabled && !isTranscribing, [draft, disabled, isTranscribing]);

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

  async function toggleRecording() {
    if (isRecording) {
      await stopRecording();
      return;
    }
    await startRecording();
  }

  async function startRecording() {
    setVoiceError(null);
    if (disabled || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Браузер не дал доступ к микрофону.");
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setVoiceError("В этом браузере нет Web Audio API.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const gain = context.createGain();
      const chunks: Float32Array[] = [];

      gain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(gain);
      gain.connect(context.destination);
      recorderRef.current = { context, source, processor, gain, stream, chunks };
      setIsRecording(true);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Не удалось включить микрофон.");
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }

    recorderRef.current = null;
    setIsRecording(false);
    setIsTranscribing(true);
    setVoiceError(null);

    const sampleRate = recorder.context.sampleRate;
    recorder.processor.disconnect();
    recorder.source.disconnect();
    recorder.gain.disconnect();
    recorder.stream.getTracks().forEach((track) => track.stop());
    await recorder.context.close();

    try {
      const audio = encodeWav(recorder.chunks, sampleRate);
      const text = await onTranscribeAudio(audio);
      if (text) {
        setDraft((current) => [current.trim(), text].filter(Boolean).join(" "));
      }
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Не удалось распознать аудио.");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function synthesizeMessage(messageId: number) {
    setVoiceError(null);
    setSynthesizingIds((ids) => new Set(ids).add(messageId));
    try {
      await onSynthesizeMessage(messageId);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Не удалось озвучить сообщение.");
    } finally {
      setSynthesizingIds((ids) => {
        const next = new Set(ids);
        next.delete(messageId);
        return next;
      });
    }
  }

  return (
    <section className="chat-panel">
      <div className="conversation-toolbar">
        <button className="icon-button ghost-button" type="button" title="Обновить сессию" onClick={onRefresh}>
          <RefreshIcon />
        </button>
      </div>

      <div className="messages">
        {messages.map((message) => (
          <article
            className={`message message-${message.role}`}
            key={message.id}
            aria-label={roleLabels[message.role] ?? message.role}
            onMouseUp={() => captureSelection(message)}
          >
            {message.role !== "user" && !message.audio_url ? (
              <div className="message-actions">
                <button
                  className="mini-icon-button"
                  type="button"
                  title="Озвучить"
                  disabled={synthesizingIds.has(message.id)}
                  onClick={() => synthesizeMessage(message.id)}
                >
                  <PlayIcon />
                </button>
              </div>
            ) : null}
            <p>{message.content}</p>
            {message.audio_url ? (
              <audio className="message-audio" controls preload="none" src={resolveAudioUrl(message.audio_url)} />
            ) : null}
          </article>
        ))}
      </div>

      {voiceError ? <p className="error-box compact-error">{voiceError}</p> : null}

      <div className="selection-row">
        <span>{selected ? selected.text : "Выделите фразу"}</span>
        <button className="secondary-button" type="button" onClick={addSelectedPhrase} disabled={!selected}>
          Добавить
        </button>
      </div>

      <form className="message-form" onSubmit={handleSubmit}>
        <div className="composer-box">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ответ на английском..."
            rows={3}
            disabled={disabled || isTranscribing}
          />
          <div className="composer-actions">
            {isTranscribing || isRecording ? (
              <span className="composer-state">{isTranscribing ? "Распознавание..." : "Запись"}</span>
            ) : null}
            <button
              className={`voice-button ${isRecording ? "recording" : ""}`}
              type="button"
              title={isRecording ? "Остановить запись" : "Записать голос"}
              onClick={toggleRecording}
              disabled={disabled || isTranscribing}
            >
              {isRecording ? <StopIcon /> : <MicIcon />}
            </button>
            <button className="send-button" type="submit" disabled={!canSend} aria-label="Отправить реплику">
              <SendIcon />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 6v5h-5M4 18v-5h5M19 11a7 7 0 0 0-12.3-4.5M5 13a7 7 0 0 0 12.3 4.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 8h8v8H8z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const samples = flattenChunks(chunks);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function flattenChunks(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
