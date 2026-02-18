export interface AgentConfig {
  model?: string;
  skills?: string[];
  maxBudget?: number;
  cwd?: string;
  instructions?: string;
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

export interface StreamChunk {
  type: 'chunk' | 'complete';
  content: string;
  metadata?: {
    model?: string;
    provider?: string;
    duration_ms?: number;
    cost_usd?: number;
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
