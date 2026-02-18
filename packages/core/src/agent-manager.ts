import { EventEmitter } from 'events';
import { Agent } from './agent.js';
import { AgentConfig } from './types.js';

export interface ManagedAgent {
  id: string;
  agent: Agent;
  config: AgentConfig;
  createdAt: Date;
  lastUsed: Date;
}

export interface AgentManagerEvents {
  'agent:created': (data: { id: string; config: AgentConfig }) => void;
  'agent:destroyed': (data: { id: string }) => void;
  'agent:switched': (data: { id: string }) => void;
}

/**
 * AgentManager - Manages multiple agent instances with lifecycle control
 * 
 * Features:
 * - Create/destroy agents dynamically
 * - Switch between agents
 * - Event-based communication
 * - Agent metadata tracking
 */
export class AgentManager extends EventEmitter {
  private agents: Map<string, ManagedAgent> = new Map();
  private currentAgentId: string | null = null;

  /**
   * Create a new agent with the given configuration
   */
  async createAgent(id: string, config: AgentConfig = {}): Promise<Agent> {
    if (this.agents.has(id)) {
      throw new Error(`Agent with id '${id}' already exists`);
    }

    const agent = new Agent(config);
    const managed: ManagedAgent = {
      id,
      agent,
      config,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.agents.set(id, managed);
    this.emit('agent:created', { id, config });

    // Auto-switch to first agent
    if (!this.currentAgentId) {
      this.currentAgentId = id;
      this.emit('agent:switched', { id });
    }

    return agent;
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: string): Agent | undefined {
    const managed = this.agents.get(id);
    if (managed) {
      managed.lastUsed = new Date();
      return managed.agent;
    }
    return undefined;
  }

  /**
   * Get the currently active agent
   */
  getCurrentAgent(): Agent | undefined {
    if (!this.currentAgentId) return undefined;
    return this.getAgent(this.currentAgentId);
  }

  /**
   * Get current agent ID
   */
  getCurrentAgentId(): string | null {
    return this.currentAgentId;
  }

  /**
   * Switch to a different agent
   */
  switchAgent(id: string): void {
    const managed = this.agents.get(id);
    if (!managed) {
      throw new Error(`Agent with id '${id}' does not exist`);
    }

    this.currentAgentId = id;
    managed.lastUsed = new Date();
    this.emit('agent:switched', { id });
  }

  /**
   * Destroy an agent and free resources
   */
  async destroyAgent(id: string): Promise<void> {
    const managed = this.agents.get(id);
    if (!managed) {
      throw new Error(`Agent with id '${id}' does not exist`);
    }

    this.agents.delete(id);
    this.emit('agent:destroyed', { id });

    // Switch to another agent if current was destroyed
    if (this.currentAgentId === id) {
      const remaining = Array.from(this.agents.keys());
      this.currentAgentId = remaining.length > 0 ? remaining[0] : null;
      
      if (this.currentAgentId) {
        this.emit('agent:switched', { id: this.currentAgentId });
      }
    }
  }

  /**
   * List all managed agents
   */
  listAgents(): Array<{ id: string; config: AgentConfig; createdAt: Date; lastUsed: Date }> {
    return Array.from(this.agents.values()).map(({ id, config, createdAt, lastUsed }) => ({
      id,
      config,
      createdAt,
      lastUsed,
    }));
  }

  /**
   * Check if an agent exists
   */
  hasAgent(id: string): boolean {
    return this.agents.has(id);
  }

  /**
   * Get total number of managed agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Destroy all agents
   */
  async destroyAll(): Promise<void> {
    const ids = Array.from(this.agents.keys());
    for (const id of ids) {
      await this.destroyAgent(id);
    }
  }
}

export function createAgentManager(): AgentManager {
  return new AgentManager();
}
