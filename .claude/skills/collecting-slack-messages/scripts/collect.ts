#!/usr/bin/env tsx
/// <reference types="node" />
import path from "path";
import { writeFileSync } from "fs";
/**
 * Slack Message Collector
 *
 * Collects messages from Slack channels for the past N days.
 * Resolves user IDs to real names. Outputs clean, readable text
 * grouped by channel and date (KST timezone).
 *
 * Environment variables:
 *   SLACK_BOT_TOKEN   - Slack Bot User OAuth Token (xoxb-...)
 *   SLACK_CHANNEL_IDS - Comma-separated channel IDs (e.g., C0A237STLBG,C0BBBBBBBBB)
 *
 * Usage:
 *   tsx collect.ts [days]     # default: 7 days
 *   tsx collect.ts 14         # last 14 days
 */

const SLACK_API = "https://slack.com/api";
const KST_OFFSET_MS = 9 * 3600 * 1000;

// ── Slack API helpers ──

async function slackApi<T = any>(method: string, params: Record<string, string>): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const url = new URL(`${SLACK_API}/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
}

// ── User name cache ──

const userCache = new Map<string, string>();

async function resolveUser(userId: string): Promise<string> {
  if (userCache.has(userId)) return userCache.get(userId)!;

  try {
    const data = await slackApi("users.info", { user: userId });
    const name = data.user?.real_name || data.user?.name || userId;
    userCache.set(userId, name);
    return name;
  } catch {
    userCache.set(userId, userId);
    return userId;
  }
}

// ── Channel info ──

async function getChannelName(channelId: string): Promise<string> {
  try {
    const data = await slackApi("conversations.info", { channel: channelId });
    return data.channel?.name || channelId;
  } catch {
    return channelId;
  }
}

// ── Message collection (handles pagination) ──

interface SlackMessage {
  user?: string;
  text?: string;
  ts: string;
  subtype?: string;
  bot_id?: string;
}

async function fetchMessages(channelId: string, oldest: string): Promise<SlackMessage[]> {
  const all: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      channel: channelId,
      oldest,
      limit: "200",
    };
    if (cursor) params.cursor = cursor;

    const data = await slackApi("conversations.history", params);
    all.push(...(data.messages || []));
    cursor = data.response_metadata?.next_cursor;
  } while (cursor);

  return all;
}

// ── Formatting ──

function toKST(ts: string): Date {
  const epochMs = parseFloat(ts) * 1000;
  return new Date(epochMs + KST_OFFSET_MS);
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const dow = weekdays[d.getUTCDay()];
  return `${y}-${m}-${day} (${dow})`;
}

function formatTime(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

function replaceMentions(text: string): string {
  // Replace <@UXXXX> with resolved names (sync from cache, fallback to ID)
  return text.replace(/<@(U[A-Z0-9]+)>/g, (_, id) => `@${userCache.get(id) || id}`);
}

// ── Main ──

async function main() {
  const token = process.env.SLACK_BOT_TOKEN;
  const channelIds = process.env.SLACK_CHANNEL_IDS;

  if (!token) {
    console.log("⚠️  SLACK_BOT_TOKEN not set. Slack data unavailable.");
    process.exit(0);
  }
  if (!channelIds) {
    console.log("⚠️  SLACK_CHANNEL_IDS not set. No channels to collect.");
    process.exit(0);
  }

  const days = parseInt(process.argv[2] || "7", 10);
  const oldest = String(Date.now() / 1000 - days * 86400);
  const channels = channelIds.split(",").map((c) => c.trim()).filter(Boolean);

  const lines: string[] = [];
  const out = (line: string) => { lines.push(line); };

  for (const channelId of channels) {
    const channelName = await getChannelName(channelId);
    const messages = await fetchMessages(channelId, oldest);

    // Filter: real user messages only (no bot, no system subtypes)
    const userMessages = messages.filter(
      (m) => m.user && !m.bot_id && !m.subtype
    );

    if (userMessages.length === 0) {
      out(`\n## #${channelName}\n메시지 없음 (최근 ${days}일)\n`);
      continue;
    }

    // Pre-resolve all user IDs in parallel
    const uniqueUsers = [...new Set(userMessages.map((m) => m.user!))];
    await Promise.all(uniqueUsers.map(resolveUser));

    // Sort chronologically
    userMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    // Group by date (KST)
    const byDate = new Map<string, Array<{ time: string; name: string; text: string }>>();

    for (const msg of userMessages) {
      const kst = toKST(msg.ts);
      const dateKey = formatDate(kst);
      const time = formatTime(kst);
      const name = userCache.get(msg.user!) || msg.user!;
      const text = replaceMentions(msg.text || "").replace(/\n/g, " ").trim();

      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push({ time, name, text });
    }

    // Output
    out(`\n## #${channelName}`);

    for (const [date, msgs] of byDate) {
      out(`\n### ${date}`);
      for (const { time, name, text } of msgs) {
        out(`[${time}] ${name}: ${text}`);
      }
    }
  }

  // Write to file and print path so agent can Read it
  const content = lines.join("\n");
  const outPath = path.resolve(process.cwd(), ".claude", "slack-messages.md");
  writeFileSync(outPath, content, "utf-8");
  console.log(`Slack messages saved to: ${outPath}`);
  console.log(`Total: ${lines.length} lines, ${channels.length} channel(s), ${days} days`);
}

main().catch((err) => {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
});
