---
name: collecting-slack-messages
description: Collects and formats Slack channel messages for a given time period. Resolves user IDs to real names, groups messages by channel and date (KST). Use when generating weekly reports, summarizing team communication, or collecting Slack conversation history.
---

# Collecting Slack Messages

Collects messages from configured Slack channels using the Bot API. Outputs clean, human-readable text grouped by channel and date.

## Prerequisites

Environment variables are loaded in this order (first found wins):

1. **Process env** — project `.env` or shell environment
2. **`~/.claude/.env`** — global fallback (works from any project)

Required variables:

- `SLACK_BOT_TOKEN` — Slack Bot User OAuth Token (`xoxb-...`)
- `SLACK_CHANNEL_IDS` — Comma-separated channel IDs (e.g., `C0A237STLBG,C0BBBBBBBBB`)

**Recommended**: Set these in `~/.claude/.env` once, and they'll work from any project directory.

If either variable is missing from all sources, the script exits gracefully with a warning.

## Usage

**IMPORTANT — Script Path**: The script lives inside THIS skill's directory, NOT the current project. When running from any project, use the **absolute path** derived from this skill's base directory:

```
$SKILL_DIR = <this skill's base directory (shown at top of this file)>
Script     = $SKILL_DIR/scripts/collect.ts
```

The skill loader provides the base directory at the top of this file. **Always resolve it to an absolute path before running.**

**Finding `tsx`**: `tsx` may not be globally installed. Find it in any project's node_modules:
```bash
# Try in order: global tsx → current project → known location
tsx --version 2>/dev/null || \
  npx tsx --version 2>/dev/null || \
  node_modules/.bin/tsx --version 2>/dev/null
```

**Step 1**: Run the collector script (use absolute path):

```bash
tsx $SKILL_DIR/scripts/collect.ts [days]
```

Examples with absolute path:
- Default: `tsx /c/Project/private/my-claude-agent/.claude/skills/collecting-slack-messages/scripts/collect.ts`
- Custom period: `tsx $SKILL_DIR/scripts/collect.ts 14`
- Since date: `tsx $SKILL_DIR/scripts/collect.ts --since 2026-02-04`
- Filter by user: `tsx $SKILL_DIR/scripts/collect.ts --since 2026-02-04 --user suho`

`--since` accepts any date string (YYYY-MM-DD). `--user` is case-insensitive partial match on real name.

**Step 2**: Read the output file with the Read tool:

```
Read .claude/slack-messages.md
```

The script saves full messages to `.claude/slack-messages.md` (relative to cwd) and prints the file path. **Always use Read to get the complete data** — stdout only shows a summary.

## Output Format (in slack-messages.md)

```
## #channel-name

### 2026-02-18 (화)
[09:30] Jinseok Lee: 오늘 외출할 일이 있어서요
[14:15] Suho Seok: 배포 완료했습니다

### 2026-02-19 (수)
[10:00] Dominic Ha: 스프린트 리뷰 시간 변경합니다
```

## Features

- Handles pagination (200+ messages per channel)
- Resolves `<@UXXXX>` mentions to real names
- Filters out bot messages and system subtypes
- Groups by date in KST timezone
- Truncates long messages (200 char limit per message)
- Graceful exit when credentials are missing
