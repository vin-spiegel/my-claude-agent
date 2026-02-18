import { Agent, Skill } from '@agent/core';

export class CommandHandler {
  constructor(private agent: Agent) {}

  async *handleCommand(input: string): AsyncGenerator<string> {
    const trimmed = input.trim();

    if (trimmed === '/help') {
      yield '\x1b[33mAvailable commands:\x1b[0m\n';
      yield '  /help     - Show this help\n';
      yield '  /skills   - List available skills\n';
      yield '  /exit     - Exit REPL\n';
      return;
    }

    if (trimmed === '/skills') {
      const skills = await this.agent.listSkills();
      yield '\n\x1b[32mAvailable Skills:\x1b[0m\n';
      for (const skill of skills) {
        yield `  \x1b[36m${skill.name}\x1b[0m - ${skill.description}\n`;
      }
      yield '\n';
      return;
    }

    for await (const chunk of this.agent.chatStream(trimmed)) {
      if (chunk.type === 'chunk') {
        yield chunk.content;
      } else if (chunk.type === 'complete' && chunk.metadata) {
        yield '\n\n';
        if (chunk.metadata.duration_ms) {
          yield `\x1b[90m⏱  ${(chunk.metadata.duration_ms / 1000).toFixed(2)}s\x1b[0m\n`;
        }
        if (chunk.metadata.cost_usd) {
          yield `\x1b[90m💵 $${chunk.metadata.cost_usd.toFixed(4)}\x1b[0m\n`;
        }
        yield '\n';
      }
    }
  }

  isExitCommand(input: string): boolean {
    const trimmed = input.trim();
    return trimmed === '/exit' || trimmed === '/quit';
  }
}
