# Claude Local Agent with OpenRouter

TypeScript 기반 로컬 에이전트 프로젝트. Claude Agent SDK와 OpenRouter를 사용하여 구축했습니다.

## 구조

```
agent/
├── .env                    # API 키 및 설정 (git에 포함 안 됨)
├── .env.example           # 환경변수 템플릿
├── .claude/
│   └── skills/            # Skill 정의 (MD 파일)
│       ├── researcher/    # 리서치 전문 Skill
│       ├── coder/         # 코딩 전문 Skill
│       └── reviewer/      # 코드 리뷰 전문 Skill
├── packages/
│   ├── core/              # Agent SDK 래퍼 (비즈니스 로직)
│   │   ├── src/
│   │   │   ├── agent.ts   # Agent 클래스
│   │   │   ├── types.ts   # 타입 정의
│   │   │   └── index.ts   # Export
│   │   └── package.json
│   └── repl/              # TUI/REPL (프레젠테이션)
│       ├── src/index.ts   # REPL 진입점
│       └── package.json
└── pnpm-workspace.yaml
```

## 설치

```bash
pnpm install
```

> 이 프로젝트는 pnpm을 사용합니다. 설치: `npm install -g pnpm`

## 설정

1. `.env` 파일에 OpenRouter API 키 입력:

```env
ANTHROPIC_API_KEY=your-openrouter-api-key
ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1
DEFAULT_MODEL=anthropic/claude-sonnet-4
```

2. OpenRouter API 키는 https://openrouter.ai 에서 발급

## 실행

```bash
# REPL 모드 (대화형)
pnpm dev

# REPL에서 사용 가능한 명령어:
# /skills   - 사용 가능한 Skill 목록
# /help     - 도움말
# /exit     - 종료

# 빌드
pnpm build
```

## Skills 사용법

Skills는 Claude가 자동으로 선택하여 사용하는 전문 능력입니다.

### 기본 제공 Skills

- **researcher**: 코드베이스 리서치 및 분석
- **coder**: 클린 코드 작성
- **reviewer**: 코드 리뷰 및 개선 제안

### 커스텀 Skill 만들기

`.claude/skills/your-skill-name/SKILL.md` 생성:

```yaml
---
description: When to use this skill (Claude uses this to decide)
---

Your skill instructions here...
```

## 모델 설정

`.env`에서 모델 변경 가능:

```env
# Sonnet 4 (밸런스)
DEFAULT_MODEL=anthropic/claude-sonnet-4

# Opus (고성능)
DEFAULT_MODEL=anthropic/claude-opus-4

# Haiku (빠르고 저렴)
DEFAULT_MODEL=anthropic/claude-haiku-4
```

## 예시

```bash
# REPL 시작
$ pnpm dev

🤖 > /skills
Available Skills:
  researcher - Deep research and code analysis specialist
  coder - Expert developer who writes clean code
  reviewer - Code review specialist

🤖 > Analyze the project structure

# (Agent가 researcher skill을 사용하여 분석)

🤖 > /exit
```

## 참고

- [Claude Agent SDK 문서](https://docs.claude.com/en/docs/agent-sdk/overview)
- [OpenRouter 문서](https://openrouter.ai/docs)
- [Skills 작성 가이드](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
