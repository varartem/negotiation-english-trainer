export type CounterpartyStance = "open" | "neutral" | "resistant";
export type SessionStatus = "active" | "success" | "dead_end" | "abandoned";
export type MessageRole = "user" | "assistant" | "tutor" | "system";

export interface Scenario {
  id: number;
  company_name: string;
  company_description: string;
  product_name: string;
  product_description: string;
  user_role: string;
  counterparty_role: string;
  counterparty_description: string;
  negotiation_goal: string;
  counterparty_stance: CounterpartyStance;
  extra_context: string;
  is_random: boolean;
  created_at: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  tutor_task: string;
  counterparty_mood: string;
  counterparty_intent: string;
  success_criteria: string[];
  is_terminal: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  condition: string;
}

export interface GraphJson {
  nodes: GraphNode[];
  edges: GraphEdge[];
  start_node_id: string;
  max_depth?: number;
  scenario_summary?: string;
}

export interface NegotiationGraph {
  id: number;
  scenario: number;
  max_depth: number;
  graph_json: GraphJson;
  created_at: string;
}

export interface Evaluation {
  id: number;
  message: number;
  general_sentiment: "positive" | "neutral" | "negative";
  emotion: string;
  pressure_level: "low" | "medium" | "high";
  negotiation_move: string;
  strategy_score: number;
  english_score: number;
  stage_fit_score: number;
  feedback_json: {
    feedback?: string[];
    language_feedback?: string[];
    strategy_feedback?: string[];
  };
  better_version: string;
  created_at: string;
}

export interface Message {
  id: number;
  session: number;
  role: MessageRole;
  node_id: string;
  content: string;
  audio_url: string;
  evaluation?: Evaluation;
  created_at: string;
}

export interface DialogueSession {
  id: number;
  public_id: string;
  scenario: Scenario;
  graph: NegotiationGraph;
  current_node_id: string;
  status: SessionStatus;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface DialogueSessionSummary {
  id: number;
  public_id: string;
  scenario: Scenario;
  current_node_id: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface VocabularyItem {
  id: number;
  phrase: string;
  translation: string;
  context: string;
  source_message: number | null;
  user_note: string;
  created_at: string;
}

export interface AccountUser {
  id: number;
  name: string;
  email: string;
  photo_url: string;
}
