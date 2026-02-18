#!/usr/bin/env node
import React from 'react';
import path from 'path';
import { fileURLToPath } from 'url';
import { render } from 'ink';
import { createAgentManager } from '@agent/core';
import { App } from './components/App.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const agentManager = createAgentManager(projectRoot);

await agentManager.init();

console.log(`[DEBUG] AgentManager loaded ${agentManager.getAgentCount()} agents from .claude/agents/`);
console.log(`[DEBUG] Current agent: ${agentManager.getCurrentAgentId()}`);

if (agentManager.getAgentCount() === 0) {
  console.log(`[DEBUG] No agents found, creating default 'main' agent`);
  await agentManager.createAgent('main', {});
}

const currentAgent = agentManager.getCurrentAgent();
if (currentAgent) {
  await currentAgent.init();
  console.log(`[DEBUG] Agent initialized and ready for subagent delegation`);
}

const { waitUntilExit, clear } = render(<App agentManager={agentManager} />, {
  exitOnCtrlC: true,
  patchConsole: false,
});

waitUntilExit().then(() => {
  clear();
  process.stdout.write('\x1Bc');
  agentManager.destroyAll();
});
