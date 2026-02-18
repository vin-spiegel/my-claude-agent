#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { createAgentManager } from '@agent/core';
import { App } from './components/App.js';

const agentManager = createAgentManager();

await agentManager.init();

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
