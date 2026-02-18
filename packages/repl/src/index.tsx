#!/usr/bin/env node
import React from 'react';
import path from 'path';
import { render } from 'ink';
import { createAgentManager } from '@agent/core';
import { App } from './components/App.js';

const projectRoot = path.resolve(process.cwd(), '../..');
const agentManager = createAgentManager(projectRoot);

await agentManager.init();

console.log(`[DEBUG] Loaded ${agentManager.getAgentCount()} agents`);
console.log(`[DEBUG] Current agent: ${agentManager.getCurrentAgentId()}`);
console.log(`[DEBUG] Available agents:`, agentManager.listAgents().map(a => a.id));

if (agentManager.getAgentCount() === 0) {
  await agentManager.createAgent('main', {});
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
