import readline from 'readline';
import { createAgent } from '@agent/core';
import { CommandHandler } from './handler.js';

const agent = createAgent();
const handler = new CommandHandler(agent);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\x1b[36m🤖 >\x1b[0m '
});

console.log('\x1b[1m\x1b[35m');
console.log('╔════════════════════════════════════════╗');
console.log('║     Claude Agent REPL v1.0.0           ║');
console.log('╚════════════════════════════════════════╝');
console.log('\x1b[0m');
console.log('\x1b[33mCommands:\x1b[0m');
console.log('  /help     - Show this help');
console.log('  /skills   - List available skills');
console.log('  /exit     - Exit REPL\n');

rl.prompt();

rl.on('line', async (input) => {
  const trimmed = input.trim();

  if (!trimmed) {
    rl.prompt();
    return;
  }

  if (handler.isExitCommand(trimmed)) {
    console.log('\x1b[90mGoodbye!\x1b[0m');
    rl.close();
    return;
  }

  try {
    for await (const output of handler.handleCommand(trimmed)) {
      process.stdout.write(output);
    }
  } catch (error: any) {
    console.error('\n\x1b[31m❌ Error:\x1b[0m', error.message);
    console.log();
  }

  rl.prompt();
});

rl.on('close', () => {
  process.exit(0);
});
