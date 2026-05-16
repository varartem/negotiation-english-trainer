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
            <div className="message-heading">
              <span>{roleLabels[message.role] ?? message.role}</span>
              {message.role !== "user" && !message.audio_url ? (
                <button
                  className="mini-icon-button"
                  type="button"
                  title="Озвучить"
                  disabled={synthesizingIds.has(message.id)}
                  onClick={() => synthesizeMessage(message.id)}
                >
                  ▶
                </button>
              ) : null}
            </div>
            <p>{message.content}</p>
            {message.audio_url ? (
              <audio className="message-audio" controls preload="none" src={resolveAudioUrl(message.audio_url)} />
            ) : null}
          </article>
        ))}
      </div>

      {voiceError ? <p className="error-box compact-error">{voiceError}</p> : null}

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
          disabled={disabled || isTranscribing}
        />
        <button
          className={`icon-button ${isRecording ? "recording" : ""}`}
          type="button"
          title={isRecording ? "Остановить запись" : "Записать голос"}
          onClick={toggleRecording}
          disabled={disabled || isTranscribing}
        >
          {isRecording ? "■" : "●"}
        </button>
        <button className="primary-button" type="submit" disabled={!canSend}>
          {isTranscribing ? "Распознаю" : "Отправить"}
        </button>
      </form>
    </section>
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
