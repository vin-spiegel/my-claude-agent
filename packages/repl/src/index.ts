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

  if (trimmed === '/exit' || trimmed === '/quit') {
    console.log('\x1b[90mGoodbye!\x1b[0m');
    rl.close();
    return;
  }

  if (trimmed === '/help') {
    console.log('\x1b[33mAvailable commands:\x1b[0m');
    console.log('  /help     - Show this help');
    console.log('  /skills   - List available skills');
    console.log('  /exit     - Exit REPL');
    rl.prompt();
    return;
  }

  if (trimmed === '/skills') {
    try {
      const skills = await agent.listSkills();
      console.log('\n\x1b[32mAvailable Skills:\x1b[0m');
      skills.forEach(skill => {
        console.log(`  \x1b[36m${skill.name}\x1b[0m - ${skill.description}`);
      });
      console.log();
    } catch (error: any) {
      console.error('\x1b[31mError listing skills:\x1b[0m', error.message);
    }
    rl.prompt();
    return;
  }

  try {
    console.log();
    
    for await (const chunk of agent.chatStream(trimmed)) {
      if (chunk.type === 'chunk') {
        process.stdout.write(chunk.content);
      } else if (chunk.type === 'complete' && chunk.metadata) {
        console.log('\n');
        if (chunk.metadata.duration_ms) {
          console.log(`\x1b[90m⏱  ${(chunk.metadata.duration_ms / 1000).toFixed(2)}s\x1b[0m`);
        }
        if (chunk.metadata.cost_usd) {
          console.log(`\x1b[90m💵 $${chunk.metadata.cost_usd.toFixed(4)}\x1b[0m`);
        }
        console.log();
      }
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
