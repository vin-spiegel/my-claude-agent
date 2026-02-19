import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "dotenv";
import path from "path";
import { AgentConfig, AgentEvent, ChatMessage, Skill, StreamChunk } from "./types.js";
import { AgentLoader } from "./agent-loader.js";
import fs from "fs/promises";

config({ path: path.resolve(process.cwd(), "../../.env") });

export class Agent {
  private config: AgentConfig;
  private loader: AgentLoader;
  private subagentDefinitions: Record<string, any> = {};

  constructor(config: AgentConfig = {}) {
    this.config = {
      model: config.model || process.env.DEFAULT_MODEL || "anthropic/claude-3.5-sonnet",
      maxBudget: config.maxBudget || (process.env.MAX_BUDGET_USD ? parseFloat(process.env.MAX_BUDGET_USD) : 10.0),
      cwd: config.cwd || process.cwd(),
      skills: config.skills,
      instructions: config.instructions,
    };
    
    this.loader = new AgentLoader(config.cwd);
  }

  async init(): Promise<void> {
    const definitions = await this.loader.loadAll();
    
    for (const def of definitions) {
      this.subagentDefinitions[def.name] = {
        description: def.description,
        prompt: def.instructions,
        tools: def.tools,
        disallowedTools: def.disallowedTools,
        model: def.model || 'inherit',
        permissionMode: def.permissionMode,
        maxTurns: def.maxTurns,
        skills: def.skills,
        memory: def.memory,
      };
    }
  }

  getSubagentNames(): string[] {
    return Object.keys(this.subagentDefinitions);
  }

  getSubagentInfo(): Array<{ name: string; description: string }> {
    return Object.entries(this.subagentDefinitions).map(([name, def]: [string, any]) => ({
      name,
      description: def.description || '',
    }));
  }

  async *chat(message: string): AsyncGenerator<ChatMessage> {
    const options: any = {
      settingSources: ["user", "project"],
      allowedTools: ["Task", "Skill", "Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      agents: this.subagentDefinitions,
      cwd: this.config.cwd,
      model: this.config.model,
      maxBudgetUsd: this.config.maxBudget,
      permissionMode: "acceptEdits",
    };

    console.log(`[Agent.chat] Available subagents:`, Object.keys(this.subagentDefinitions));

    for await (const msg of query({ prompt: message, options })) {
      if (msg.type === 'assistant') {
        yield {
          role: 'assistant',
          content: this.extractContent(msg),
          metadata: {
            model: msg.message?.model,
          }
        };
      } else if (msg.type === 'result') {
        const resultMsg = msg as any;
        yield {
          role: 'system',
          content: resultMsg.result || '',
          metadata: {
            duration_ms: resultMsg.duration_ms,
            cost_usd: resultMsg.total_cost_usd,
          }
        };
      }
    }
  }

  async *chatStream(message: string): AsyncGenerator<StreamChunk> {
    const subagentNames = Object.keys(this.subagentDefinitions);

    const options: any = {
      settingSources: ["user", "project"],
      allowedTools: ["Task", "Skill", "Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      agents: this.subagentDefinitions,
      cwd: this.config.cwd,
      model: this.config.model,
      maxBudgetUsd: this.config.maxBudget,
      permissionMode: "acceptEdits",
      includePartialMessages: true,
    };



    let buffer = '';
    let totalDuration = 0;
    let totalCost = 0;
    let modelUsage: any = {};

    // Track active tool names by tool_use_id for result display
    const activeTools = new Map<string, string>();

    for await (const msg of query({ prompt: message, options })) {
      if (msg.type === 'stream_event') {
        const event = (msg as any).event;
        const parentToolId = (msg as any).parent_tool_use_id;
        const isSubagent = !!parentToolId;
        const prefix = isSubagent ? '  → ' : '';
        

        if (event.type === 'content_block_start') {
          if (event.content_block?.type === 'thinking') {
            const marker = isSubagent ? `${prefix}💭 ` : `💭 `;
            yield { type: 'chunk', content: marker };
          } else if (event.content_block?.type === 'tool_use') {
            const toolName = event.content_block.name;
            const toolId = event.content_block.id;
            if (toolId) {
              activeTools.set(toolId, toolName);
            }
            if (toolName === 'Task') {
              const marker = `\n🚀 Delegating to subagent...\n`;
              yield { type: 'chunk', content: marker };
            } else {
              const marker = `${prefix}🔧 ${toolName}\n`;
              yield { type: 'chunk', content: marker };
            }
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta') {
            const text = event.delta.text;
            buffer += text;
            yield { type: 'chunk', content: text };
          }
        } else if (event.type === 'content_block_stop') {
          // Add newline after any content block ends to separate from next block
          yield { type: 'chunk', content: '\n' };
        }
      } else if (msg.type === 'tool_progress') {
        // Show tool execution progress (elapsed time)
        const toolMsg = msg as any;
        const toolName = toolMsg.tool_name || 'tool';
        const elapsed = toolMsg.elapsed_time_seconds || 0;
        const isSubagent = !!toolMsg.parent_tool_use_id;
        const prefix = isSubagent ? '  → ' : '';
        if (elapsed > 0 && elapsed % 5 === 0) {
          yield { type: 'chunk', content: `${prefix}⏳ ${toolName} (${elapsed}s)\n` };
        }
      } else if (msg.type === 'user') {
        // Tool results come as user messages with tool_use_result
        const userMsg = msg as any;
        if (userMsg.tool_use_result !== undefined) {
          const isSubagent = !!userMsg.parent_tool_use_id;
          const prefix = isSubagent ? '  → ' : '';
          const result = this.formatToolResult(userMsg.tool_use_result);
          if (result) {
            yield { type: 'chunk', content: `${prefix}📋 ${result}\n` };
          }
        }
      } else if (msg.type === 'assistant' && msg.message?.content) {
        const content = this.extractContent(msg);
        if (!buffer) {
          buffer = content;
          yield {
            type: 'chunk',
            content: content
          };
        }
      } else if (msg.type === 'result') {
        const resultMsg = msg as any;
        totalDuration = resultMsg.duration_ms || 0;
        totalCost = resultMsg.total_cost_usd || 0;
        modelUsage = resultMsg.modelUsage || {};
        

      }
    }

    yield {
      type: 'complete',
      content: buffer,
      metadata: {
        duration_ms: totalDuration,
        cost_usd: totalCost,
        modelUsage
      }
    };
  }

  /** Structured event stream for SSE server — parses SDK events directly */
  async *chatEvents(message: string): AsyncGenerator<AgentEvent> {
    const options: any = {
      settingSources: ["user", "project"],
      allowedTools: ["Task", "Skill", "Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      agents: this.subagentDefinitions,
      cwd: this.config.cwd,
      model: this.config.model,
      maxBudgetUsd: this.config.maxBudget,
      permissionMode: "acceptEdits",
      includePartialMessages: true,
    };

    let buffer = '';
    let totalDuration = 0;
    let totalCost = 0;
    let modelUsage: Record<string, unknown> = {};
    const activeTools = new Map<string, string>();
    // Track pending Task tool_use to extract agent name from input
    let pendingTaskId = '';
    let pendingTaskInput = '';
    const emittedSubagents = new Set<string>();

    for await (const msg of query({ prompt: message, options })) {
      if (msg.type === 'stream_event') {
        const event = (msg as any).event;

        if (event.type === 'content_block_start') {
          if (event.content_block?.type === 'tool_use') {
            const toolName = event.content_block.name;
            const toolId = event.content_block.id || '';
            activeTools.set(toolId, toolName);

            if (toolName === 'Task') {
              pendingTaskId = toolId;
              pendingTaskInput = '';
            } else {
              yield { event: 'tool-start', tool: toolName, id: toolId };
            }
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta') {
            const text = event.delta.text;
            buffer += text;
            yield { event: 'text', content: text };
          } else if (event.delta?.type === 'input_json_delta' && pendingTaskId) {
            pendingTaskInput += event.delta.partial_json || '';
            // Try to extract agent name early
            if (!emittedSubagents.has(pendingTaskId)) {
              const nameMatch = pendingTaskInput.match(/"agent"\s*:\s*"([^"]+)"/);
              if (nameMatch) {
                emittedSubagents.add(pendingTaskId);
                yield { event: 'subagent-start', name: nameMatch[1] };
              }
            }
          }
        } else if (event.type === 'content_block_stop') {
          // If Task tool_use ended without finding agent name, emit generic
          if (pendingTaskId && !emittedSubagents.has(pendingTaskId)) {
            emittedSubagents.add(pendingTaskId);
            yield { event: 'subagent-start', name: '' };
          }
          pendingTaskId = '';
          pendingTaskInput = '';
        }
      } else if (msg.type === 'tool_progress') {
        const toolMsg = msg as any;
        const toolName = toolMsg.tool_name || 'tool';
        const elapsed = toolMsg.elapsed_time_seconds || 0;
        if (elapsed > 0 && elapsed % 5 === 0) {
          yield { event: 'progress', tool: toolName, elapsed };
        }
      } else if (msg.type === 'user') {
        const userMsg = msg as any;
        if (userMsg.tool_use_result !== undefined) {
          const toolId = userMsg.tool_use_id || '';
          const toolName = activeTools.get(toolId) || '';

          // Detect skill loaded
          const result = this.formatToolResult(userMsg.tool_use_result);
          if (toolName === 'Skill' && result) {
            const match = result.match(/Skill "(.+)" loaded/);
            if (match) {
              yield { event: 'skill-loaded', name: match[1] };
            }
          }

          yield { event: 'tool-result', tool: toolName, id: toolId, result: result || '' };
        }
      } else if (msg.type === 'assistant' && msg.message?.content) {
        // Non-streaming assistant message (fallback)
        const content = this.extractContent(msg);
        if (content && !buffer) {
          buffer = content;
          yield { event: 'text', content };
        }
      } else if (msg.type === 'result') {
        const resultMsg = msg as any;
        totalDuration = resultMsg.duration_ms || 0;
        totalCost = resultMsg.total_cost_usd || 0;
        modelUsage = resultMsg.modelUsage || {};
      }
    }

    yield {
      event: 'done',
      content: buffer,
      metadata: { duration_ms: totalDuration, cost_usd: totalCost, modelUsage },
    };
  }

  async listSkills(): Promise<Skill[]> {
    const skillsDir = path.join(this.config.cwd!, "../../.claude/skills");
    
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      const skills: Skill[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
          try {
            const content = await fs.readFile(skillPath, 'utf-8');
            const descMatch = content.match(/description:\s*(.+)/);
            
            skills.push({
              name: entry.name,
              description: descMatch ? descMatch[1].trim() : '',
              content
            });
          } catch {
            continue;
          }
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  private formatToolResult(result: unknown): string {
    if (result === undefined || result === null) return '';

    let text = '';
    if (typeof result === 'string') {
      text = result;
    } else if (typeof result === 'object') {
      const obj = result as any;

      // Try to format known JSON structures first
      const formatted = this.formatKnownResult(obj);
      if (formatted) return formatted;

      // Handle MCP CallToolResult format: { content: [{ type: 'text', text: '...' }] }
      if (Array.isArray(obj.content)) {
        text = obj.content
          .map((c: any) => c.text || '')
          .filter((t: string) => t)
          .join('\n');
      } else {
        text = JSON.stringify(result);
      }
    } else {
      text = String(result);
    }

    if (!text) return '';

    // Truncate long results for display
    const maxLen = 500;
    const trimmed = text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
    return trimmed.trim();
  }

  private formatKnownResult(obj: any): string | null {
    // Skill invocation result
    if (obj.success !== undefined && obj.commandName) {
      return obj.success
        ? `✅ Skill "${obj.commandName}" loaded`
        : `❌ Skill "${obj.commandName}" failed`;
    }

    // Task async launch
    if (obj.isAsync && obj.status === 'async_launched') {
      const desc = obj.description || obj.agentId || 'task';
      return `🚀 Task launched: ${desc}`;
    }

    // Task retrieval (completed/failed)
    if (obj.retrieval_status && obj.task) {
      const task = obj.task;
      const status = task.status === 'completed' ? '✅' : '❌';
      const desc = task.description || task.task_id || 'task';
      const output = task.output ? ` → ${task.output.replace(/\n/g, ' ').slice(0, 150)}` : '';
      return `${status} Task done: ${desc}${output ? output + (task.output?.length > 150 ? '...' : '') : ''}`;
    }

    // File Read result
    if (obj.type === 'text' && obj.file?.filePath) {
      const name = obj.file.filePath.split(/[/\\]/).pop() || obj.file.filePath;
      const lines = obj.file.numLines || obj.file.totalLines || '?';
      return `📄 ${name} (${lines} lines)`;
    }

    // Bash/tool execution result with stdout
    if (obj.stdout !== undefined || obj.exitCode !== undefined) {
      const code = obj.exitCode ?? obj.exit_code ?? '?';
      const icon = code === 0 ? '✅' : '⚠️';
      const out = (obj.stdout || '').slice(0, 300);
      return `${icon} exit=${code}${out ? ':\n' + out + (obj.stdout?.length > 300 ? '...' : '') : ''}`;
    }

    return null;
  }

  private extractContent(msg: any): string {
    if (typeof msg === 'string') {
      return msg;
    }

    if (msg.message?.content) {
      if (Array.isArray(msg.message.content)) {
        return msg.message.content
          .map((block: any) => {
            if (block.type === 'text') return block.text;
            if (block.text) return block.text;
            if (block.type === 'tool_use') return '';
            return '';
          })
          .filter((text: string) => text.length > 0)
          .join('\n');
      }
      return String(msg.message.content);
    }

    if (msg.result) {
      return String(msg.result);
    }

    return JSON.stringify(msg);
  }
}

export function createAgent(config?: AgentConfig): Agent {
  return new Agent(config);
}
