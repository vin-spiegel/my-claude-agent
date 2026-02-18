export interface AgentConfig {
  model?: string;
  skills?: string[];
  maxBudget?: number;
  cwd?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    duration_ms?: number;
    cost_usd?: number;
    model?: string;
  };
}

export interface Skill {
  name: string;
  description: string;
  content: string;
}

export interface AgentResponse {
  type: 'message' | 'error' | 'system';
  data: ChatMessage | Error | any;
}
