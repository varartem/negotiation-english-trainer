import type {
  AccountUser,
  CounterpartyStance,
  DialogueSession,
  DialogueSessionSummary,
  Message,
  NegotiationGraph,
  Scenario,
  VocabularyItem,
} from "../types";

function defaultApiBaseUrl() {
  const hostname = window.location.hostname || "localhost";
  return `${window.location.protocol}//${hostname}:8000/api`;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl()).replace(/\/$/, "");
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let csrfTokenRequest: Promise<string> | null = null;

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
    const parsed = JSON.parse(details) as { detail?: unknown; message?: unknown } | Record<string, unknown>;
    const message = parsed.detail ?? parsed.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    if (parsed && typeof parsed === "object") {
      const fieldMessages = Object.entries(parsed)
        .flatMap(([field, value]) => {
          if (Array.isArray(value)) {
            return value.map((item) => `${field}: ${String(item)}`);
          }
          if (typeof value === "string") {
            return [`${field}: ${value}`];
          }
          return [];
        })
        .join("\n");
      if (fieldMessages) {
        return fieldMessages;
      }
    }
  } catch {
    // The backend can also return plain text for non-DRF errors.
  }

  return details;
}

function getCookie(name: string): string {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? "";
}

async function ensureCsrfToken(): Promise<string> {
  const existingToken = getCookie("csrftoken");
  if (existingToken) {
    return decodeURIComponent(existingToken);
  }

  csrfTokenRequest ??= fetch(`${API_BASE_URL}/auth/csrf/`, {
    credentials: "include",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(await errorMessageFromResponse(response));
      }
      const data = (await response.json()) as { csrfToken?: string };
      return data.csrfToken ?? decodeURIComponent(getCookie("csrftoken"));
    })
    .finally(() => {
      csrfTokenRequest = null;
    });

  return csrfTokenRequest;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (UNSAFE_METHODS.has(method)) {
    headers.set("X-CSRFToken", await ensureCsrfToken());
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
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
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (UNSAFE_METHODS.has(method)) {
    headers.set("X-CSRFToken", await ensureCsrfToken());
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
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
  getCsrfToken() {
    return request<{ csrfToken: string }>("/auth/csrf/");
  },

  getCurrentUser() {
    return request<AccountUser>("/auth/me/");
  },

  register(payload: { name: string; email: string; password: string }) {
    return request<AccountUser>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return request<AccountUser>("/auth/login/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  logout() {
    return request<void>("/auth/logout/", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  updateAccount(payload: FormData) {
    return request<AccountUser>("/auth/me/", {
      method: "PATCH",
      body: payload,
    });
  },

  changePassword(payload: { current_password: string; new_password: string }) {
    return request<AccountUser>("/auth/password/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

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
