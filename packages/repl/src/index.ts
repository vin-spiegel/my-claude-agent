#!/usr/bin/env node
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAgentManager } from '@agent/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

const agentManager = createAgentManager(projectRoot);

await agentManager.init();

console.log(`\n🤖 Claude Agent REPL v1.0.0\n`);

if (agentManager.getAgentCount() === 0) {
  await agentManager.createAgent('main', {});
}

const currentAgent = agentManager.getCurrentAgent();
if (currentAgent) {
  await currentAgent.init();
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\x1b[36m> \x1b[0m'
});

console.log('Type /help for available commands, /exit to quit\n');
rl.prompt();

rl.on('line', async (input) => {
  const trimmed = input.trim();

  if (trimmed === '/exit' || trimmed === '/quit') {
    rl.close();
    return;
  }

  if (trimmed === '/help') {
    console.log('\nAvailable commands:');
    console.log('  /help     - Show this help');
    console.log('  /agents   - List available subagents');
    console.log('  /exit     - Exit REPL\n');
    rl.prompt();
    return;
  }

  if (trimmed === '/agents') {
    const agents = agentManager.listAgents();
    console.log('\nAvailable subagents:');
    agents.forEach(a => {
      const current = a.id === agentManager.getCurrentAgentId() ? ' (current)' : '';
      console.log(`  - ${a.id}${current}`);
    });
    console.log();
    rl.prompt();
    return;
  }

  if (!trimmed) {
    rl.prompt();
    return;
  }

  try {
    const agent = agentManager.getCurrentAgent();
    if (!agent) {
      console.log('\x1b[31m❌ No active agent\x1b[0m\n');
      rl.prompt();
      return;
    }

    console.log();
    let buffer = '';

    for await (const chunk of agent.chatStream(trimmed)) {
      if (chunk.type === 'chunk') {
        process.stdout.write(chunk.content);
        buffer += chunk.content;
      } else if (chunk.type === 'complete') {
        console.log('\n');
        
        if (chunk.metadata) {
          const meta: string[] = [];
          if (chunk.metadata.duration_ms) {
            meta.push(`⏱  ${(chunk.metadata.duration_ms / 1000).toFixed(2)}s`);
          }
          if (chunk.metadata.cost_usd) {
            meta.push(`💵 $${chunk.metadata.cost_usd.toFixed(4)}`);
          }
          
          if (chunk.metadata.modelUsage) {
            const models = Object.keys(chunk.metadata.modelUsage);
            if (models.length > 0) {
              meta.push(`🤖 ${models.join(', ')}`);
            }
          }
          
          if (meta.length > 0) {
            console.log(`\x1b[90m${meta.join(' | ')}\x1b[0m\n`);
          }
        }
      }
    }
  } catch (error: any) {
    console.log(`\x1b[31m❌ Error: ${error.message}\x1b[0m\n`);
  }

  rl.prompt();
});

rl.on('close', () => {
  console.log('\n👋 Goodbye!\n');
  agentManager.destroyAll();
  process.exit(0);
});
