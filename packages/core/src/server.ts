import http from 'http';
import { URL } from 'url';
import { config } from 'dotenv';
import path from 'path';
import { Agent } from './agent.js';

// Resolve project root (server runs from packages/core)
const projectRoot = path.resolve(process.cwd(), '../..');

config({ path: path.join(projectRoot, '.env') });

const PORT = parseInt(process.env.API_PORT || '3030', 10);

// ── Agent singleton ──

const agent = new Agent({
  model: process.env.DEFAULT_MODEL,
  maxBudget: process.env.MAX_BUDGET_USD ? parseFloat(process.env.MAX_BUDGET_USD) : 10.0,
  cwd: projectRoot,
});

await agent.init();
console.log(`[server] Agent initialized (root: ${projectRoot})`);

// ── SSE helpers ──

function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendSSE(res: http.ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── CORS preflight ──

function handleCors(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

// ── Request body parser ──

async function parseBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// ── Routes ──

const server = http.createServer(async (req, res) => {
  if (handleCors(req, res)) return;

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // POST /api/chat — SSE stream response
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    let body: { message: string };
    try {
      body = JSON.parse(await parseBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    if (!body.message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'message is required' }));
      return;
    }

    res.writeHead(200, sseHeaders());

    try {
      for await (const evt of agent.chatEvents(body.message)) {
        sendSSE(res, evt.event, evt);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      sendSSE(res, 'error', { event: 'error', message: errMsg });
    }

    res.end();
    return;
  }

  // GET /api/agents — list loaded subagents
  if (url.pathname === '/api/agents' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ agents: agent.getSubagentInfo() }));
    return;
  }

  // GET /api/skills — list loaded skills
  if (url.pathname === '/api/skills' && req.method === 'GET') {
    const skills = await agent.listSkills();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      skills: skills.map(s => ({ name: s.name, description: s.description })),
    }));
    return;
  }

  // GET /api/health
  if (url.pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ status: 'ok', model: process.env.DEFAULT_MODEL }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[server] Agent API running on http://localhost:${PORT}`);
  console.log(`[server] POST /api/chat — SSE stream`);
  console.log(`[server] GET  /api/health — Health check`);
});
