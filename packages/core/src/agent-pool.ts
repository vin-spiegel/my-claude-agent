import { Agent } from './agent.js';
import { AgentConfig } from './types.js';

export interface AgentPoolConfig {
  minSize?: number;
  maxSize?: number;
  idleTimeout?: number;
}

interface PooledAgent {
  agent: Agent;
  type: string;
  createdAt: Date;
  lastUsed: Date;
  inUse: boolean;
}

export class AgentPool {
  private agents: Map<string, PooledAgent> = new Map();
  private config: Required<AgentPoolConfig>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: AgentPoolConfig = {}) {
    this.config = {
      minSize: config.minSize ?? 2,
      maxSize: config.maxSize ?? 10,
      idleTimeout: config.idleTimeout ?? 5 * 60 * 1000,
    };

    this.startCleanup();
  }

  async acquire(type: string, config?: AgentConfig): Promise<Agent> {
    const available = this.findAvailable(type);

    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      return available.agent;
    }

    if (this.agents.size >= this.config.maxSize) {
      throw new Error(`Agent pool exhausted (max: ${this.config.maxSize})`);
    }

    return this.spawn(type, config);
  }

  release(agent: Agent): void {
    for (const [id, pooled] of this.agents.entries()) {
      if (pooled.agent === agent) {
        pooled.inUse = false;
        pooled.lastUsed = new Date();
        return;
      }
    }
  }

  async warmUp(type: string, count: number, config?: AgentConfig): Promise<void> {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.spawn(type, config));
    }
    await Promise.all(promises);
  }

  getStats() {
    const total = this.agents.size;
    const available = Array.from(this.agents.values()).filter(a => !a.inUse).length;
    const inUse = total - available;

    return {
      total,
      available,
      inUse,
      maxSize: this.config.maxSize,
      utilizationRate: total > 0 ? (inUse / total) * 100 : 0,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.agents.clear();
  }

  private async spawn(type: string, config?: AgentConfig): Promise<Agent> {
    const agent = new Agent(config);
    const id = this.generateId();

    const pooled: PooledAgent = {
      agent,
      type,
      createdAt: new Date(),
      lastUsed: new Date(),
      inUse: true,
    };

    this.agents.set(id, pooled);
    return agent;
  }

  private findAvailable(type: string): PooledAgent | undefined {
    for (const pooled of this.agents.values()) {
      if (!pooled.inUse && pooled.type === type) {
        return pooled;
      }
    }
    return undefined;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      for (const [id, pooled] of this.agents.entries()) {
        if (!pooled.inUse) {
          const idleTime = now - pooled.lastUsed.getTime();
          if (idleTime > this.config.idleTimeout && this.agents.size > this.config.minSize) {
            this.agents.delete(id);
          }
        }
      }
    }, 60000);
  }

  private generateId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export function createAgentPool(config?: AgentPoolConfig): AgentPool {
  return new AgentPool(config);
}
