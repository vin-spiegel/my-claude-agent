import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentManager } from '../agent-manager';
import { Agent } from '../agent';

vi.mock('../agent');

describe('AgentManager', () => {
  let manager: AgentManager;

  beforeEach(() => {
    manager = new AgentManager();
    vi.clearAllMocks();
  });

  describe('createAgent', () => {
    it('should create a new agent', async () => {
      const agent = await manager.createAgent('test-agent', {});
      
      expect(agent).toBeInstanceOf(Agent);
      expect(manager.hasAgent('test-agent')).toBe(true);
      expect(manager.getAgentCount()).toBe(1);
    });

    it('should throw if agent with same id exists', async () => {
      await manager.createAgent('test-agent', {});
      
      await expect(
        manager.createAgent('test-agent', {})
      ).rejects.toThrow("Agent with id 'test-agent' already exists");
    });

    it('should auto-switch to first agent', async () => {
      await manager.createAgent('first', {});
      
      expect(manager.getCurrentAgentId()).toBe('first');
    });

    it('should emit agent:created event', async () => {
      const spy = vi.fn();
      manager.on('agent:created', spy);
      
      await manager.createAgent('test', { model: 'test-model' });
      
      expect(spy).toHaveBeenCalledWith({
        id: 'test',
        config: { model: 'test-model' }
      });
    });
  });

  describe('getAgent', () => {
    it('should return agent by id', async () => {
      const created = await manager.createAgent('test', {});
      const retrieved = manager.getAgent('test');
      
      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent agent', () => {
      expect(manager.getAgent('non-existent')).toBeUndefined();
    });
  });

  describe('getCurrentAgent', () => {
    it('should return current agent', async () => {
      const agent = await manager.createAgent('test', {});
      
      expect(manager.getCurrentAgent()).toBe(agent);
    });

    it('should return undefined when no agents', () => {
      expect(manager.getCurrentAgent()).toBeUndefined();
    });
  });

  describe('switchAgent', () => {
    it('should switch to different agent', async () => {
      await manager.createAgent('first', {});
      await manager.createAgent('second', {});
      
      manager.switchAgent('second');
      
      expect(manager.getCurrentAgentId()).toBe('second');
    });

    it('should throw if agent does not exist', async () => {
      expect(() => {
        manager.switchAgent('non-existent');
      }).toThrow("Agent with id 'non-existent' does not exist");
    });

    it('should emit agent:switched event', async () => {
      await manager.createAgent('first', {});
      await manager.createAgent('second', {});
      
      const spy = vi.fn();
      manager.on('agent:switched', spy);
      
      manager.switchAgent('second');
      
      expect(spy).toHaveBeenCalledWith({ id: 'second' });
    });
  });

  describe('destroyAgent', () => {
    it('should destroy agent', async () => {
      await manager.createAgent('test', {});
      
      await manager.destroyAgent('test');
      
      expect(manager.hasAgent('test')).toBe(false);
      expect(manager.getAgentCount()).toBe(0);
    });

    it('should throw if agent does not exist', async () => {
      await expect(
        manager.destroyAgent('non-existent')
      ).rejects.toThrow("Agent with id 'non-existent' does not exist");
    });

    it('should switch to another agent if current was destroyed', async () => {
      await manager.createAgent('first', {});
      await manager.createAgent('second', {});
      
      await manager.destroyAgent('first');
      
      expect(manager.getCurrentAgentId()).toBe('second');
    });

    it('should emit agent:destroyed event', async () => {
      await manager.createAgent('test', {});
      
      const spy = vi.fn();
      manager.on('agent:destroyed', spy);
      
      await manager.destroyAgent('test');
      
      expect(spy).toHaveBeenCalledWith({ id: 'test' });
    });
  });

  describe('listAgents', () => {
    it('should list all agents', async () => {
      await manager.createAgent('first', { model: 'model-1' });
      await manager.createAgent('second', { model: 'model-2' });
      
      const list = manager.listAgents();
      
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe('first');
      expect(list[1].id).toBe('second');
    });

    it('should return empty array when no agents', () => {
      expect(manager.listAgents()).toEqual([]);
    });
  });

  describe('destroyAll', () => {
    it('should destroy all agents', async () => {
      await manager.createAgent('first', {});
      await manager.createAgent('second', {});
      
      await manager.destroyAll();
      
      expect(manager.getAgentCount()).toBe(0);
      expect(manager.getCurrentAgentId()).toBeNull();
    });
  });
});
