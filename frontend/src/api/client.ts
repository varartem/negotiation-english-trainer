import type {
  DialogueSession,
  Difficulty,
  NegotiationGraph,
  Scenario,
  VocabularyItem,
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type ScenarioPayload = Omit<Scenario, "id" | "is_random" | "created_at" | "updated_at">;

export const api = {
  createScenario(payload: ScenarioPayload) {
    return request<Scenario>("/scenarios/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createRandomScenario(difficulty: Difficulty) {
    return request<Scenario>("/scenarios/random/", {
      method: "POST",
      body: JSON.stringify({ difficulty }),
    });
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

  getSession(sessionId: number) {
    return request<DialogueSession>(`/sessions/${sessionId}/`);
  },

  sendMessage(sessionId: number, content: string) {
    return request<{ session: DialogueSession }>(`/sessions/${sessionId}/messages/`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
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

  deleteVocabulary(itemId: number) {
    return request<void>(`/vocabulary/${itemId}/`, {
      method: "DELETE",
    });
  },
};
