# Core와 Tauri 통합 가이드

## 현재 상태

### 완료된 구조
```
agent/
├── packages/
│   ├── core/                    # ✅ Agent SDK (TypeScript)
│   │   ├── src/index.ts        # CLI 진입점
│   │   └── package.json
│   │
│   └── desktop/                 # ✅ Tauri 앱
│       ├── src/                 # React Frontend
│       │   ├── App.tsx         # 기본 UI (채팅, Skill, 설정)
│       │   └── main.tsx
│       ├── src-tauri/           # Rust Backend
│       │   ├── src/main.rs     # Tauri 커맨드
│       │   └── Cargo.toml
│       └── package.json
└── .claude/skills/              # ✅ Skill 정의
```

## 통합 단계

### 1. Core API 확장 (packages/core)

현재 `core`는 CLI 전용입니다. Tauri에서 호출할 수 있도록 API를 추가해야 합니다.

#### packages/core/src/api.ts (새로 만들기)

```typescript
import { query, ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export async function chatWithAgent(
  message: string,
  config: AgentConfig
): Promise<string> {
  const options: ClaudeAgentOptions = {
    settingSources: ["user", "project"],
    allowedTools: ["Skill", "Read", "Write", "Edit", "Bash", "Grep", "Glob"],
    cwd: process.cwd(),
    model: config.model,
    permissionMode: "acceptEdits",
  };

  let fullResponse = "";

  for await (const msg of query({ prompt: message, options })) {
    if (typeof msg === "string") {
      fullResponse += msg;
    } else if (msg.content) {
      fullResponse += JSON.stringify(msg.content);
    }
  }

  return fullResponse;
}

export async function listSkills(): Promise<string[]> {
  const fs = await import("fs/promises");
  const path = await import("path");
  
  const skillsDir = path.join(process.cwd(), ".claude/skills");
  
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export { query, ClaudeAgentOptions };
```

#### packages/core/package.json 수정

```json
{
  "name": "@agent/core",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./api": "./dist/api.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

### 2. Rust에서 Node.js 호출

Tauri의 Rust 백엔드에서 TypeScript `@agent/core`를 호출하는 방법:

#### 방법 A: 자식 프로세스로 실행 (권장)

**packages/desktop/src-tauri/src/main.rs** 수정:

```rust
use std::process::Command;

#[tauri::command]
async fn chat(message: String) -> Result<String, String> {
    // Node.js로 core API 호출
    let output = Command::new("node")
        .arg("-e")
        .arg(format!(
            r#"
            import {{ chatWithAgent }} from '@agent/core/api';
            const config = {{
                apiKey: process.env.ANTHROPIC_API_KEY,
                baseUrl: process.env.ANTHROPIC_BASE_URL,
                model: process.env.DEFAULT_MODEL
            }};
            chatWithAgent('{}', config).then(console.log);
            "#,
            message.replace("'", "\\'")
        ))
        .current_dir("../../")
        .output()
        .map_err(|e| format!("Failed to execute: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8: {}", e))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

#### 방법 B: HTTP Server (더 나은 성능)

**packages/core/src/server.ts** (새로 만들기):

```typescript
import express from "express";
import { chatWithAgent, listSkills } from "./api.js";
import { config } from "dotenv";

config();

const app = express();
app.use(express.json());

const agentConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseUrl: process.env.ANTHROPIC_BASE_URL!,
  model: process.env.DEFAULT_MODEL || "anthropic/claude-sonnet-4",
};

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const response = await chatWithAgent(message, agentConfig);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/skills", async (req, res) => {
  try {
    const skills = await listSkills();
    res.json({ skills });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

const PORT = 3030;
app.listen(PORT, () => {
  console.log(`Core API server running on http://localhost:${PORT}`);
});
```

그리고 Rust에서 HTTP 호출:

```rust
use reqwest;

#[tauri::command]
async fn chat(message: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("http://localhost:3030/api/chat")
        .json(&serde_json::json!({ "message": message }))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    let body: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(body["response"]
        .as_str()
        .unwrap_or("No response")
        .to_string())
}
```

### 3. 실행 흐름

#### 개발 모드
```bash
# Terminal 1: Core API 서버 실행 (방법 B 사용시)
cd packages/core
pnpm tsx src/server.ts

# Terminal 2: Tauri 앱 실행
cd packages/desktop
pnpm tauri dev
```

#### 자동화 (package.json)
```json
{
  "scripts": {
    "dev:desktop": "concurrently \"pnpm --filter @agent/core tsx src/server.ts\" \"pnpm --filter @agent/desktop tauri dev\""
  }
}
```

## 추천 방식

**단기 (빠른 프로토타입):**
- ✅ Rust에서 파일 시스템 직접 읽기 (현재 구현)
- ✅ 간단한 기능만 구현
- ❌ Agent SDK는 나중에 통합

**중기 (실용적):**
- ✅ Core에 HTTP 서버 추가 (방법 B)
- ✅ Rust에서 HTTP로 Core 호출
- ✅ Agent SDK 완전 통합

**장기 (최적화):**
- ✅ Rust Native Binding (napi-rs 사용)
- ✅ TypeScript Core를 Rust로 직접 호출
- ✅ 최고 성능

## 다음 단계

1. **지금 바로 테스트 가능:**
   ```bash
   cd packages/desktop
   pnpm install
   pnpm tauri dev
   ```
   - Skill 목록, 설정 읽기는 바로 동작합니다

2. **Agent SDK 통합 (방법 B 권장):**
   - `packages/core/src/api.ts` 생성
   - `packages/core/src/server.ts` 생성
   - Rust에서 HTTP 호출로 변경

3. **UI 개선:**
   - shadcn/ui 컴포넌트 추가
   - 채팅 인터페이스 개선
   - 스트리밍 응답 구현

## 환경 설정

Tauri는 루트의 `.env`를 읽습니다. 이미 설정되어 있으므로 추가 작업 불필요.

## 빌드

```bash
# 개발 빌드
pnpm dev:desktop

# 프로덕션 빌드
pnpm build:desktop

# 결과물
# macOS: packages/desktop/src-tauri/target/release/bundle/dmg/
# Windows: packages/desktop/src-tauri/target/release/bundle/msi/
# Linux: packages/desktop/src-tauri/target/release/bundle/deb/
```

## 트러블슈팅

### Rust 툴체인 미설치
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Tauri CLI 미설치
```bash
cargo install tauri-cli
```

### 아이콘 없음 오류
Tauri는 아이콘 파일을 요구합니다:
- `packages/desktop/src-tauri/icons/` 디렉토리 생성
- 임시로 빈 PNG 파일로 대체 가능

### pnpm workspace 의존성
루트에서 `pnpm install` 실행 필요
