#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { createAgent } from '@agent/core';
import { App } from './components/App.js';

const agent = createAgent();

const { waitUntilExit, clear } = render(<App agent={agent} />, {
  exitOnCtrlC: true,
  patchConsole: false,
});

waitUntilExit().then(() => {
  clear();
  process.stdout.write('\x1Bc');
});
