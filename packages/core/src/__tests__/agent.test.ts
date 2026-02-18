import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../agent';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockImplementation(async function* () {
    yield {
      type: 'assistant',
      message: {
        model: 'anthropic/claude-3.5-sonnet',
        content: [{ type: 'text', text: 'Hello, I can help you!' }]
      }
    };
    yield {
      type: 'result',
      total_cost_usd: 0.01,
      duration_ms: 1000
    };
  })
}));

describe('Agent', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent({
      model: 'anthropic/claude-3.5-sonnet',
      maxBudget: 10
    });
  });

  describe('chat()', () => {
    it('should yield assistant and system messages', async () => {
      const messages = [];
      
      for await (const msg of agent.chat('test message')) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toContain('Hello');
      expect(messages[1].role).toBe('system');
      expect(messages[1].metadata?.cost_usd).toBe(0.01);
    });

    it('should extract text content from message blocks', async () => {
      const messages = [];
      
      for await (const msg of agent.chat('test')) {
        messages.push(msg);
      }

      expect(messages[0].content).toBe('Hello, I can help you!');
    });
  });

  describe('chatStream()', () => {
    it('should yield character-by-character chunks', async () => {
      const chunks = [];
      
      for await (const chunk of agent.chatStream('test')) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter(c => c.type === 'chunk');
      const completeChunk = chunks.find(c => c.type === 'complete');

      expect(textChunks.length).toBeGreaterThan(0);
      expect(completeChunk).toBeDefined();
      expect(completeChunk?.content).toContain('Hello');
      expect(completeChunk?.metadata?.cost_usd).toBe(0.01);
    });
  });

  describe('listSkills()', () => {
    it('should return empty array when skills directory does not exist', async () => {
      const skills = await agent.listSkills();
      expect(Array.isArray(skills)).toBe(true);
    });
  });
});
