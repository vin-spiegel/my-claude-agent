import { describe, it, expect, vi } from 'vitest';
import { Orchestrator, OrchestratorTask } from '../orchestrator';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Orchestrator', () => {
  describe('priority-based fan-in', () => {
    it('should complete when all required tasks finish', async () => {
      const orchestrator = new Orchestrator();

      const tasks: OrchestratorTask[] = [
        {
          name: 'git',
          priority: 'required',
          execute: async () => {
            await delay(100);
            return { commits: 10 };
          },
        },
        {
          name: 'notion',
          priority: 'required',
          execute: async () => {
            await delay(150);
            return { pages: 5 };
          },
        },
        {
          name: 'slack',
          priority: 'optional',
          execute: async () => {
            await delay(1000);
            return { messages: 100 };
          },
        },
      ];

      const results = await orchestrator.execute(tasks);

      expect(results.get('git')?.status).toBe('completed');
      expect(results.get('notion')?.status).toBe('completed');
      expect(results.get('slack')?.status).toBe('skipped');
    });

    it('should include optional tasks if they complete before required', async () => {
      const orchestrator = new Orchestrator();

      const tasks: OrchestratorTask[] = [
        {
          name: 'slow-required',
          priority: 'required',
          execute: async () => {
            await delay(200);
            return { data: 'slow' };
          },
        },
        {
          name: 'fast-optional',
          priority: 'optional',
          execute: async () => {
            await delay(50);
            return { data: 'fast' };
          },
        },
      ];

      const results = await orchestrator.execute(tasks);

      expect(results.get('slow-required')?.status).toBe('completed');
      expect(results.get('fast-optional')?.status).toBe('completed');
    });
  });

  describe('timeout handling', () => {
    it('should timeout slow tasks', async () => {
      const orchestrator = new Orchestrator({ defaultTimeout: 100 });

      const tasks: OrchestratorTask[] = [
        {
          name: 'slow-task',
          priority: 'required',
          execute: async () => {
            await delay(200);
            return { data: 'should not reach' };
          },
        },
      ];

      const results = await orchestrator.execute(tasks);

      expect(results.get('slow-task')?.status).toBe('failed');
      expect(results.get('slow-task')?.error?.message).toContain('timed out');
    });

    it('should use task-specific timeout over default', async () => {
      const orchestrator = new Orchestrator({ defaultTimeout: 50 });

      const tasks: OrchestratorTask[] = [
        {
          name: 'custom-timeout',
          priority: 'required',
          timeout: 200,
          execute: async () => {
            await delay(100);
            return { data: 'completed' };
          },
        },
      ];

      const results = await orchestrator.execute(tasks);

      expect(results.get('custom-timeout')?.status).toBe('completed');
    });
  });

  describe('error handling', () => {
    it('should abort on required task failure by default', async () => {
      const orchestrator = new Orchestrator();

      const tasks: OrchestratorTask[] = [
        {
          name: 'failing-required',
          priority: 'required',
          execute: async () => {
            throw new Error('Required task failed');
          },
        },
        {
          name: 'pending-optional',
          priority: 'optional',
          execute: async () => {
            await delay(1000);
            return { data: 'should be skipped' };
          },
        },
      ];

      const results = await orchestrator.execute(tasks);

      expect(results.get('failing-required')?.status).toBe('failed');
      expect(results.get('pending-optional')?.status).toBe('skipped');
    });

    it('should continue on optional task failure', async () => {
      const orchestrator = new Orchestrator();

      const tasks: OrchestratorTask[] = [
        {
          name: 'good-required',
          priority: 'required',
          execute: async () => {
            await delay(100);
            return { data: 'success' };
          },
        },
        {
          name: 'failing-optional',
          priority: 'optional',
          execute: async () => {
            throw new Error('Optional failed');
          },
        },
      ];

      const results = await orchestrator.execute(tasks);

      expect(results.get('good-required')?.status).toBe('completed');
      expect(results.get('failing-optional')?.status).toBe('failed');
    });

    it('should not abort on required failure when configured', async () => {
      const orchestrator = new Orchestrator({ abortOnRequiredFailure: false });

      const tasks: OrchestratorTask[] = [
        {
          name: 'failing-required',
          priority: 'required',
          execute: async () => {
            throw new Error('Failed');
          },
        },
        {
          name: 'slow-required',
          priority: 'required',
          execute: async () => {
            await delay(100);
            return { data: 'completed' };
          },
        },
      ];

      const results = await orchestrator.execute(tasks);

      expect(results.get('failing-required')?.status).toBe('failed');
      expect(results.get('slow-required')?.status).toBe('completed');
    });
  });

  describe('duration tracking', () => {
    it('should track task duration', async () => {
      const orchestrator = new Orchestrator();

      const tasks: OrchestratorTask[] = [
        {
          name: 'timed-task',
          priority: 'required',
          execute: async () => {
            await delay(100);
            return { data: 'done' };
          },
        },
      ];

      const results = await orchestrator.execute(tasks);
      const duration = results.get('timed-task')?.duration;

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200);
    });
  });
});
