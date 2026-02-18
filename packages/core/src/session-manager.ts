import fs from 'fs/promises';
import path from 'path';
import { ChatMessage } from './types.js';

export interface Session {
  id: string;
  agentId: string;
  messages: ChatMessage[];
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  parentId?: string;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private persistDir: string;

  constructor(persistDir: string = './.sessions') {
    this.persistDir = persistDir;
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.persistDir, { recursive: true });
      await this.loadAll();
    } catch (error) {
      console.error('Failed to initialize SessionManager:', error);
    }
  }

  async create(agentId: string, parentId?: string): Promise<string> {
    const id = this.generateId();
    const session: Session = {
      id,
      agentId,
      messages: [],
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      parentId,
    };

    this.sessions.set(id, session);
    await this.persist(id);
    return id;
  }

  async get(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async update(id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    Object.assign(session, updates, { updatedAt: new Date() });
    await this.persist(id);
  }

  async addMessage(id: string, message: ChatMessage): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    session.messages.push(message);
    session.updatedAt = new Date();
    await this.persist(id);
  }

  async fork(originalId: string, newAgentId?: string): Promise<string> {
    const original = this.sessions.get(originalId);
    if (!original) {
      throw new Error(`Session ${originalId} not found`);
    }

    const forkedId = this.generateId();
    const forked: Session = {
      ...original,
      id: forkedId,
      agentId: newAgentId || original.agentId,
      parentId: originalId,
      messages: [...original.messages],
      context: { ...original.context },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(forkedId, forked);
    await this.persist(forkedId);
    return forkedId;
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
    const filePath = path.join(this.persistDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch {
    }
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }

  private async persist(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;

    const filePath = path.join(this.persistDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  private async loadAll(): Promise<void> {
    try {
      const files = await fs.readdir(this.persistDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.persistDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(content);
          session.createdAt = new Date(session.createdAt);
          session.updatedAt = new Date(session.updatedAt);
          this.sessions.set(session.id, session);
        }
      }
    } catch {
    }
  }

  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export function createSessionManager(persistDir?: string): SessionManager {
  return new SessionManager(persistDir);
}
