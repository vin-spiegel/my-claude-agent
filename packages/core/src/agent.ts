import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "dotenv";
import path from "path";
import { AgentConfig, ChatMessage, Skill, StreamChunk } from "./types.js";
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

    for await (const msg of query({ prompt: message, options })) {
      if (msg.type === 'stream_event') {
        const event = (msg as any).event;
        const parentToolId = (msg as any).parent_tool_use_id;
        const prefix = parentToolId ? '  [subagent] ' : '';
        
        if (event.type === 'content_block_start') {
          if (event.content_block?.type === 'thinking') {
            const marker = `\n${prefix}💭 Thinking...\n`;
            yield { type: 'chunk', content: marker };
          } else if (event.content_block?.type === 'tool_use') {
            const toolName = event.content_block.name;
            if (toolName === 'Task') {
              const marker = `\n${prefix}🚀 Delegating to subagent...\n`;
              yield { type: 'chunk', content: marker };
            } else {
              const marker = `\n${prefix}🔧 Using ${toolName}...\n`;
              yield { type: 'chunk', content: marker };
            }
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta') {
            const text = event.delta.text;
            buffer += text;
            yield { type: 'chunk', content: text };
          } else if (event.delta?.type === 'thinking_delta') {
            const text = event.delta.thinking || '';
            yield { type: 'chunk', content: `${prefix}${text}` };
          }
        } else if (event.type === 'content_block_stop') {
          yield { type: 'chunk', content: '\n' };
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
