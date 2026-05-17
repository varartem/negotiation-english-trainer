import type {
  CounterpartyStance,
  DialogueSession,
  DialogueSessionSummary,
  Message,
  NegotiationGraph,
  Scenario,
  VocabularyItem,
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

export interface ModelProgressEvent<TPayload = unknown> {
  type: "progress" | "done" | "error" | "assistant_delta" | "scenario_field_delta";
  progress: number;
  stage: string;
  detail?: string;
  delta?: string;
  field?: string;
  message?: string;
  payload?: TPayload;
}

export type ModelProgressHandler = (event: ModelProgressEvent) => void;

async function errorMessageFromResponse(response: Response): Promise<string> {
  const details = await response.text();
  if (!details) {
    return `Request failed: ${response.status}`;
  }

  try {
    const parsed = JSON.parse(details) as { detail?: unknown; message?: unknown };
    const message = parsed.detail ?? parsed.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // The backend can also return plain text for non-DRF errors.
  }

  return details;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: isFormData
      ? init.headers
      : {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await errorMessageFromResponse(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function streamRequest<T>(
  path: string,
  init: RequestInit = {},
  onProgress?: ModelProgressHandler,
): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: isFormData
      ? init.headers
      : {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await errorMessageFromResponse(response));
  }

  if (!response.body) {
    return response.json() as Promise<T>;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let payload: T | undefined;
  let isDone = false;

  function handleLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const event = JSON.parse(trimmed) as ModelProgressEvent<T>;
    onProgress?.(event);
    if (event.type === "error") {
      throw new Error(event.message || "Model request failed");
    }
    if (event.type === "done") {
      payload = event.payload;
      isDone = true;
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      handleLine(line);
    }
  }

  buffer += decoder.decode();
  handleLine(buffer);

  if (!isDone || payload === undefined) {
    throw new Error("Model stream finished without a result.");
  }

  return payload;
}

export function resolveBackendUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

export type ScenarioPayload = Omit<Scenario, "id" | "is_random" | "created_at" | "updated_at">;

export const api = {
  createScenario(payload: ScenarioPayload) {
    return request<Scenario>("/scenarios/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createRandomScenario(counterpartyStance: CounterpartyStance) {
    return request<Scenario>("/scenarios/random/", {
      method: "POST",
      body: JSON.stringify({ counterparty_stance: counterpartyStance }),
    });
  },

  createRandomScenarioProgress(counterpartyStance: CounterpartyStance, onProgress?: ModelProgressHandler) {
    return streamRequest<Scenario>(
      "/scenarios/random/progress/",
      {
        method: "POST",
        body: JSON.stringify({ counterparty_stance: counterpartyStance }),
      },
      onProgress,
    );
  },

  generateGraph(scenarioId: number) {
    return request<NegotiationGraph>(`/scenarios/${scenarioId}/graph/`, {
      method: "POST",
      body: JSON.stringify({ max_depth: 6 }),
    });
  },

  startSession(scenarioId: number) {
    return request<DialogueSession>(`/scenarios/${scenarioId}/sessions/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  listSessions() {
    return request<DialogueSessionSummary[]>("/sessions/");
  },

  getSession(sessionId: number) {
    return request<DialogueSession>(`/sessions/${sessionId}/`);
  },

  getSessionByPublicId(publicId: string) {
    return request<DialogueSession>(`/sessions/by-public-id/${publicId}/`);
  },

  sendMessage(sessionId: number, content: string, onProgress?: ModelProgressHandler) {
    return streamRequest<{ session: DialogueSession }>(
      `/sessions/${sessionId}/messages/progress/`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
      onProgress,
    );
  },

  transcribeAudio(audio: Blob, onProgress?: ModelProgressHandler) {
    const formData = new FormData();
    formData.append("audio", audio, "speech.wav");
    return streamRequest<{ text: string }>(
      "/speech/transcribe/progress/",
      {
        method: "POST",
        body: formData,
      },
      onProgress,
    );
  },

  synthesizeMessage(messageId: number, onProgress?: ModelProgressHandler) {
    return streamRequest<{ message: Message }>(
      `/messages/${messageId}/speech/progress/`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      onProgress,
    );
  },

  retry(sessionId: number) {
    return request<{ session: DialogueSession }>(`/sessions/${sessionId}/retry/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  idealAnswer(sessionId: number) {
    return request<{ ideal_answer: string }>(`/sessions/${sessionId}/ideal-answer/`);
  },

  listVocabulary() {
    return request<VocabularyItem[]>("/vocabulary/");
  },

  createVocabulary(payload: Partial<VocabularyItem> & { phrase: string }) {
    return request<VocabularyItem>("/vocabulary/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateVocabulary(itemId: number, payload: Partial<Pick<VocabularyItem, "phrase" | "translation" | "context">>) {
    return request<VocabularyItem>(`/vocabulary/${itemId}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteVocabulary(itemId: number) {
    return request<void>(`/vocabulary/${itemId}/`, {
      method: "DELETE",
    });
  },
};
