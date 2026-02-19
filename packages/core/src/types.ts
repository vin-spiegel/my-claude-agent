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
    duration_ms?: number;
    cost_usd?: number;
    modelUsage?: Record<string, any>;
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

/** Structured event for SSE server (not REPL) */
export type AgentEvent =
  | { event: 'text'; content: string }
  | { event: 'tool-start'; tool: string; id: string }
  | { event: 'tool-result'; tool: string; id: string; result: string }
  | { event: 'subagent-start'; name: string }
  | { event: 'subagent-end' }
  | { event: 'skill-loaded'; name: string }
  | { event: 'thinking'; content: string }
  | { event: 'progress'; tool: string; elapsed: number }
  | { event: 'done'; content: string; metadata?: Record<string, unknown> }
  | { event: 'error'; message: string };
