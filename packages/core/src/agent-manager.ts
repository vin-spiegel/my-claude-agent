import { EventEmitter } from 'events';
import { Agent } from './agent.js';
import { AgentConfig } from './types.js';
import { AgentLoader, AgentDefinition } from './agent-loader.js';

export interface ManagedAgent {
  id: string;
  agent: Agent;
  config: AgentConfig;
  definition?: AgentDefinition;
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
  private loader: AgentLoader;
  private baseDir: string;

  constructor(baseDir?: string) {
    super();
    this.baseDir = baseDir || process.cwd();
    this.loader = new AgentLoader(this.baseDir);
  }

  async init(): Promise<void> {
    const definitions = await this.loader.loadAll();
    
    for (const def of definitions) {
      await this.createAgentFromDefinition(def);
    }
  }

  async createAgentFromDefinition(definition: AgentDefinition): Promise<Agent> {
    const config = this.loader.toAgentConfig(definition);
    config.cwd = this.baseDir;
    const agent = new Agent(config);

    const managed: ManagedAgent = {
      id: definition.name,
      agent,
      config,
      definition,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.agents.set(definition.name, managed);
    this.emit('agent:created', { id: definition.name, config });

    if (!this.currentAgentId) {
      this.currentAgentId = definition.name;
      this.emit('agent:switched', { id: definition.name });
    }

    return agent;
  }

  async createAgent(id: string, config: AgentConfig = {}): Promise<Agent> {
    if (this.agents.has(id)) {
      throw new Error(`Agent with id '${id}' already exists`);
    }

    if (!config.cwd) {
      config.cwd = this.baseDir;
    }

    const agent = new Agent(config);
    const managed: ManagedAgent = {
      id,
      agent,
      config,
      definition: undefined,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.agents.set(id, managed);
    this.emit('agent:created', { id, config });

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

export function createAgentManager(baseDir?: string): AgentManager {
  return new AgentManager(baseDir);
}
