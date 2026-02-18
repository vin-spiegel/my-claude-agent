import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentPool } from '../agent-pool';
import { Agent } from '../agent';

vi.mock('../agent');

describe('AgentPool', () => {
  let pool: AgentPool;

  beforeEach(() => {
    pool = new AgentPool({
      minSize: 2,
      maxSize: 5,
      idleTimeout: 1000
    });
  });

  afterEach(() => {
    pool.destroy();
  });

  describe('acquire', () => {
    it('should create new agent when pool is empty', async () => {
      const agent = await pool.acquire('test-type');
      
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should reuse available agent of same type', async () => {
      const agent1 = await pool.acquire('test-type');
      pool.release(agent1);
      
      const agent2 = await pool.acquire('test-type');
      
      expect(agent2).toBe(agent1);
    });

    it('should create new agent for different type', async () => {
      const agent1 = await pool.acquire('type-1');
      pool.release(agent1);
      
      const agent2 = await pool.acquire('type-2');
      
      expect(agent2).not.toBe(agent1);
    });

    it('should throw when pool is exhausted', async () => {
      for (let i = 0; i < 5; i++) {
        await pool.acquire('test');
      }
      
      await expect(
        pool.acquire('test')
      ).rejects.toThrow('Agent pool exhausted (max: 5)');
    });
  });

  describe('release', () => {
    it('should mark agent as available', async () => {
      const agent = await pool.acquire('test');
      
      let stats = pool.getStats();
      expect(stats.inUse).toBe(1);
      expect(stats.available).toBe(0);
      
      pool.release(agent);
      
      stats = pool.getStats();
      expect(stats.inUse).toBe(0);
      expect(stats.available).toBe(1);
    });
  });

  describe('warmUp', () => {
    it('should pre-create agents', async () => {
      await pool.warmUp('test', 3);
      
      const stats = pool.getStats();
      expect(stats.total).toBe(3);
      expect(stats.available).toBe(3);
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', async () => {
      await pool.acquire('test');
      await pool.acquire('test');
      
      const stats = pool.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.inUse).toBe(2);
      expect(stats.available).toBe(0);
      expect(stats.maxSize).toBe(5);
      expect(stats.utilizationRate).toBe(100);
    });

    it('should calculate utilization rate correctly', async () => {
      const agent = await pool.acquire('test');
      await pool.warmUp('test', 3);
      
      const stats = pool.getStats();
      
      expect(stats.total).toBe(4);
      expect(stats.inUse).toBe(1);
      expect(stats.utilizationRate).toBe(25);
    });
  });
});
