import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import AutoResizeTextarea from "./AutoResizeTextarea";
import type { ModelProgressHandler } from "../api/client";
import type { Message } from "../types";

interface ChatPanelProps {
  messages: Message[];
  disabled: boolean;
  onSend: (content: string) => void;
  onAddVocabulary: (phrase: string, context: string, sourceMessageId?: number) => void;
  onTranscribeAudio: (audio: Blob, onProgress?: ModelProgressHandler) => Promise<string>;
  onSynthesizeMessage: (messageId: number, onProgress?: ModelProgressHandler) => Promise<Message>;
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
  onTranscribeAudio,
  onSynthesizeMessage,
  resolveAudioUrl,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<{
    text: string;
    context: string;
    messageId?: number;
    position: { left: number; top: number };
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioProgressById, setAudioProgressById] = useState<Record<number, number>>({});
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);
  const recorderRef = useRef<RecorderState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const previousMessagesCountRef = useRef(messages.length);

  const canSend = useMemo(() => draft.trim().length > 0 && !disabled && !isTranscribing, [draft, disabled, isTranscribing]);

  useEffect(() => {
    function handleSelectionChange() {
      if (!window.getSelection()?.toString().trim()) {
        setSelected(null);
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    const previousMessagesCount = previousMessagesCountRef.current;
    previousMessagesCountRef.current = messages.length;
    if (!messagesElement) {
      return;
    }
    if (messages.length <= previousMessagesCount) {
      return;
    }
    messagesElement.scrollTo({ top: messagesElement.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  function sendDraft() {
    if (!canSend) {
      return;
    }
    onSend(draft.trim());
    setDraft("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sendDraft();
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    sendDraft();
  }

  function captureSelection(message: Message) {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!selection || !text || selection.rangeCount === 0) {
      setSelected(null);
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    setSelected({
      text,
      context: message.content,
      messageId: message.id,
      position: {
        left: Math.min(Math.max(110, center), window.innerWidth - 110),
        top: Math.max(44, rect.top - 10),
      },
    });
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
    setTranscriptionProgress(2);
    setVoiceError(null);

    const sampleRate = recorder.context.sampleRate;
    recorder.processor.disconnect();
    recorder.source.disconnect();
    recorder.gain.disconnect();
    recorder.stream.getTracks().forEach((track) => track.stop());
    await recorder.context.close();

    try {
      const audio = encodeWav(recorder.chunks, sampleRate);
      const text = await onTranscribeAudio(audio, (event) => {
        setTranscriptionProgress(event.progress);
      });
      if (text) {
        setDraft((current) => [current.trim(), text].filter(Boolean).join(" "));
      }
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Не удалось распознать аудио.");
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(0);
    }
  }

  function setAudioProgress(messageId: number, progress: number) {
    setAudioProgressById((current) => ({
      ...current,
      [messageId]: Math.max(0, Math.min(100, progress)),
    }));
  }

  function clearAudioProgress(messageId: number) {
    setAudioProgressById((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  }

  async function playMessage(message: Message) {
    if (audioProgressById[message.id] !== undefined) {
      return;
    }

    if (playingMessageId === message.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingMessageId(null);
      return;
    }

    setVoiceError(null);
    setAudioProgress(message.id, message.audio_url ? 88 : 2);
    try {
      let audioUrl = message.audio_url;
      if (!audioUrl) {
        const synthesizedMessage = await onSynthesizeMessage(message.id, (event) => {
          setAudioProgress(message.id, event.progress);
        });
        audioUrl = synthesizedMessage.audio_url;
      }

      if (!audioUrl) {
        throw new Error("TTS не вернула аудиофайл.");
      }

      setAudioProgress(message.id, 100);
      await playAudio(resolveAudioUrl(audioUrl), message.id);
    } catch (error) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingMessageId(null);
      setVoiceError(error instanceof Error ? error.message : "Не удалось озвучить сообщение.");
    } finally {
      clearAudioProgress(message.id);
    }
  }

  async function playAudio(src: string, messageId: number) {
    audioRef.current?.pause();

    const audio = new Audio(src);
    audio.preload = "auto";
    audioRef.current = audio;
    setPlayingMessageId(messageId);

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("canplay", handleCanPlay);
        audio.removeEventListener("error", handleError);
      };
      const handleCanPlay = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error("Не удалось загрузить аудиофайл."));
      };

      audio.addEventListener("canplay", handleCanPlay);
      audio.addEventListener("error", handleError);
      audio.load();
    });

    audio.addEventListener("ended", () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlayingMessageId(null);
      }
    });
    audio.addEventListener("pause", () => {
      if (audioRef.current === audio && audio.ended) {
        audioRef.current = null;
        setPlayingMessageId(null);
      }
    });

    await audio.play();
  }

  return (
    <section className="chat-panel">
      <div className="messages" ref={messagesRef}>
        {messages.map((message) => {
          const audioProgress = audioProgressById[message.id];
          const isAudioLoading = audioProgress !== undefined;
          const isPlaying = playingMessageId === message.id;

          return (
            <article
              className={`message message-${message.role}`}
              key={message.id}
              aria-label={roleLabels[message.role] ?? message.role}
              onMouseUp={() => captureSelection(message)}
            >
              {message.role !== "user" ? (
                <div className="message-actions">
                  <button
                    className={`mini-icon-button ${isAudioLoading ? "progress-button" : ""} ${
                      isPlaying ? "playing" : ""
                    }`}
                    type="button"
                    title={isAudioLoading ? "Готовим аудио" : isPlaying ? "Остановить" : "Воспроизвести"}
                    disabled={isAudioLoading}
                    onClick={() => playMessage(message)}
                  >
                    {isAudioLoading ? (
                      <ProgressIcon progress={audioProgress} />
                    ) : isPlaying ? (
                      <StopIcon />
                    ) : (
                      <PlayIcon />
                    )}
                  </button>
                </div>
              ) : null}
              <p>{message.content}</p>
            </article>
          );
        })}
      </div>

      {voiceError ? <p className="error-box compact-error">{voiceError}</p> : null}

      {selected ? (
        <button
          className="selection-bubble"
          type="button"
          style={{ left: selected.position.left, top: selected.position.top }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={addSelectedPhrase}
        >
          Добавить в словарь
        </button>
      ) : null}

      <form className="message-form" onSubmit={handleSubmit}>
        <div className="composer-box">
          <AutoResizeTextarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Ответ на английском..."
            rows={3}
            disabled={disabled || isTranscribing}
          />
          <div className="composer-actions">
            <button
              className={`voice-button ${isRecording ? "recording" : ""} ${
                isTranscribing ? "progress-button" : ""
              }`}
              type="button"
              title={isTranscribing ? "Распознаю речь" : isRecording ? "Остановить запись" : "Записать голос"}
              onClick={toggleRecording}
              disabled={disabled || isTranscribing}
            >
              {isTranscribing ? (
                <ProgressIcon progress={transcriptionProgress} />
              ) : isRecording ? (
                <StopIcon />
              ) : (
                <MicIcon />
              )}
            </button>
            <button className="send-button" type="submit" disabled={!canSend} aria-label="Отправить реплику">
              <SendIcon />
            </button>
          </div>
        </div>
        {isTranscribing ? (
          <div className="transcription-progress" aria-live="polite">
            <span>Распознаём вашу речь</span>
            <span>{Math.round(transcriptionProgress)}%</span>
            <div className="transcription-progress-track">
              <span style={{ width: `${Math.max(4, transcriptionProgress)}%` }} />
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  );
}

function ProgressIcon({ progress }: { progress: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, progress)) / 100) * circumference;

  return (
    <svg className="progress-icon" aria-hidden="true" viewBox="0 0 24 24">
      <circle className="progress-icon-track" cx="12" cy="12" r={radius} />
      <circle
        className="progress-icon-value"
        cx="12"
        cy="12"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
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
