import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../session-manager';
import fs from 'fs/promises';
import path from 'path';

describe('SessionManager', () => {
  let manager: SessionManager;
  const testDir = './.test-sessions';

  beforeEach(async () => {
    manager = new SessionManager(testDir);
    await manager.init();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const sessionId = await manager.create('test-agent');
      
      const session = await manager.get(sessionId);
      expect(session).toBeDefined();
      expect(session?.agentId).toBe('test-agent');
      expect(session?.messages).toEqual([]);
    });

    it('should create session with parent', async () => {
      const parentId = await manager.create('agent-1');
      const childId = await manager.create('agent-2', parentId);
      
      const child = await manager.get(childId);
      expect(child?.parentId).toBe(parentId);
    });
  });

  describe('update', () => {
    it('should update session', async () => {
      const id = await manager.create('test-agent');
      
      await manager.update(id, {
        context: { key: 'value' }
      });
      
      const session = await manager.get(id);
      expect(session?.context).toEqual({ key: 'value' });
    });

    it('should throw if session not found', async () => {
      await expect(
        manager.update('non-existent', {})
      ).rejects.toThrow('Session non-existent not found');
    });
  });

  describe('addMessage', () => {
    it('should add message to session', async () => {
      const id = await manager.create('test-agent');
      
      await manager.addMessage(id, {
        role: 'user',
        content: 'Hello'
      });
      
      const session = await manager.get(id);
      expect(session?.messages).toHaveLength(1);
      expect(session?.messages[0].content).toBe('Hello');
    });
  });

  describe('fork', () => {
    it('should fork a session', async () => {
      const originalId = await manager.create('agent-1');
      await manager.addMessage(originalId, {
        role: 'user',
        content: 'Original message'
      });
      
      const forkedId = await manager.fork(originalId);
      
      const original = await manager.get(originalId);
      const forked = await manager.get(forkedId);
      
      expect(forked?.parentId).toBe(originalId);
      expect(forked?.messages).toHaveLength(1);
      expect(forked?.messages[0].content).toBe('Original message');
      expect(forked?.id).not.toBe(originalId);
    });

    it('should fork with different agent', async () => {
      const originalId = await manager.create('agent-1');
      const forkedId = await manager.fork(originalId, 'agent-2');
      
      const forked = await manager.get(forkedId);
      expect(forked?.agentId).toBe('agent-2');
    });
  });

  describe('delete', () => {
    it('should delete session', async () => {
      const id = await manager.create('test-agent');
      
      await manager.delete(id);
      
      const session = await manager.get(id);
      expect(session).toBeUndefined();
    });
  });

  describe('persistence', () => {
    it('should persist sessions to disk', async () => {
      const id = await manager.create('test-agent');
      await manager.addMessage(id, {
        role: 'user',
        content: 'Test'
      });
      
      const newManager = new SessionManager(testDir);
      await newManager.init();
      
      const loaded = await newManager.get(id);
      expect(loaded?.messages).toHaveLength(1);
      expect(loaded?.messages[0].content).toBe('Test');
    });
  });
});
