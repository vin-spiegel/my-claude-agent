import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "dotenv";
import path from "path";
import { AgentConfig, ChatMessage, Skill, StreamChunk } from "./types.js";
import fs from "fs/promises";

config({ path: path.resolve(process.cwd(), "../../.env") });

export class Agent {
  private config: AgentConfig;

  constructor(config: AgentConfig = {}) {
    this.config = {
      model: config.model || process.env.DEFAULT_MODEL || "anthropic/claude-3.5-sonnet",
      maxBudget: config.maxBudget || (process.env.MAX_BUDGET_USD ? parseFloat(process.env.MAX_BUDGET_USD) : 10.0),
      cwd: config.cwd || process.cwd(),
      skills: config.skills,
    };
  }

  async *chat(message: string): AsyncGenerator<ChatMessage> {
    const options: any = {
      settingSources: ["user", "project"],
      allowedTools: ["Skill", "Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      cwd: this.config.cwd,
      model: this.config.model,
      maxBudgetUsd: this.config.maxBudget,
      permissionMode: "acceptEdits",
    };

    for await (const msg of query({ prompt: message, options: options })) {
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
    const options: any = {
      settingSources: ["user", "project"],
      allowedTools: ["Skill", "Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      cwd: this.config.cwd,
      model: this.config.model,
      maxBudgetUsd: this.config.maxBudget,
      permissionMode: "acceptEdits",
    };

    let buffer = '';
    let totalDuration = 0;
    let totalCost = 0;

    for await (const msg of query({ prompt: message, options: options })) {
      if (msg.type === 'assistant' && msg.message?.content) {
        const content = this.extractContent(msg);
        
        const words = content.split(' ');
        for (let i = 0; i < words.length; i++) {
          const word = words[i] + (i < words.length - 1 ? ' ' : '');
          buffer += word;
          yield {
            type: 'chunk',
            content: word
          };
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      } else if (msg.type === 'result') {
        const resultMsg = msg as any;
        totalDuration = resultMsg.duration_ms || 0;
        totalCost = resultMsg.total_cost_usd || 0;
      }
    }

    yield {
      type: 'complete',
      content: buffer,
      metadata: {
        duration_ms: totalDuration,
        cost_usd: totalCost
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
            return JSON.stringify(block);
          })
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
