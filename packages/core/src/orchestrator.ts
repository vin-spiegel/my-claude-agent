import { Agent } from './agent.js';

export type TaskPriority = 'required' | 'optional';

export interface OrchestratorTask<T = any> {
  name: string;
  priority: TaskPriority;
  execute: () => Promise<T>;
  timeout?: number;
}

export interface OrchestratorResult<T = any> {
  name: string;
  status: 'completed' | 'failed' | 'timeout' | 'skipped';
  data?: T;
  error?: Error;
  duration: number;
}

export interface OrchestratorConfig {
  defaultTimeout?: number;
  abortOnRequiredFailure?: boolean;
}

export class Orchestrator {
  private config: Required<OrchestratorConfig>;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 30000,
      abortOnRequiredFailure: config.abortOnRequiredFailure ?? true,
    };
  }

  async execute<T extends Record<string, any>>(
    tasks: OrchestratorTask[]
  ): Promise<Map<string, OrchestratorResult>> {
    const results = new Map<string, OrchestratorResult>();
    const pending = new Map<string, Promise<any>>();
    const startTimes = new Map<string, number>();

    for (const task of tasks) {
      const startTime = Date.now();
      startTimes.set(task.name, startTime);

      const timeoutMs = task.timeout ?? this.config.defaultTimeout;
      const promise = this.executeWithTimeout(task.execute(), timeoutMs, task.name);
      pending.set(task.name, promise);
    }

    const requiredTasks = tasks.filter(t => t.priority === 'required');
    const optionalTasks = tasks.filter(t => t.priority === 'optional');

    while (pending.size > 0) {
      const racePromises = Array.from(pending.entries()).map(([name, promise]) =>
        promise.then(
          (data) => ({ name, status: 'completed' as const, data }),
          (error) => ({ name, status: 'failed' as const, error })
        )
      );

      const result = await Promise.race(racePromises);
      const startTime = startTimes.get(result.name)!;
      const duration = Date.now() - startTime;

      results.set(result.name, {
        name: result.name,
        status: result.status,
        data: result.status === 'completed' ? result.data : undefined,
        error: result.status === 'failed' ? result.error : undefined,
        duration,
      });

      pending.delete(result.name);

      if (result.status === 'failed') {
        const task = tasks.find(t => t.name === result.name);
        if (task?.priority === 'required' && this.config.abortOnRequiredFailure) {
          this.abortPending(pending, results, startTimes);
          break;
        }
      }

      const requiredDone = requiredTasks.every(t => results.has(t.name));
      if (requiredDone) {
        this.skipOptional(optionalTasks, results, pending, startTimes);
        break;
      }
    }

    return results;
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    taskName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task '${taskName}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private abortPending(
    pending: Map<string, Promise<any>>,
    results: Map<string, OrchestratorResult>,
    startTimes: Map<string, number>
  ): void {
    for (const [name] of pending) {
      const startTime = startTimes.get(name)!;
      results.set(name, {
        name,
        status: 'skipped',
        duration: Date.now() - startTime,
      });
    }
    pending.clear();
  }

  private skipOptional(
    optionalTasks: OrchestratorTask[],
    results: Map<string, OrchestratorResult>,
    pending: Map<string, Promise<any>>,
    startTimes: Map<string, number>
  ): void {
    for (const task of optionalTasks) {
      if (!results.has(task.name)) {
        const startTime = startTimes.get(task.name)!;
        results.set(task.name, {
          name: task.name,
          status: 'skipped',
          duration: Date.now() - startTime,
        });
        pending.delete(task.name);
      }
    }
  }
}

export function createOrchestrator(config?: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}
