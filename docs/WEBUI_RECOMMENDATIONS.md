# WebUI 추천 및 구조 제안

## 추천 스택

### 1. **Vite + React + shadcn/ui** (추천 ⭐)

**장점:**
- 빠른 개발 속도 (Vite HMR)
- shadcn/ui: 복사 가능한 컴포넌트, 커스터마이징 자유로움
- Tailwind CSS: 유틸리티 우선, 빠른 스타일링
- TypeScript 네이티브 지원
- 번들 크기 최적화

**스택:**
```
- Vite
- React 18
- TypeScript
- shadcn/ui (Radix UI 기반)
- Tailwind CSS
- React Router (라우팅)
- Zustand or Jotai (상태관리 - 가볍고 간단)
```

**적합한 경우:**
- 빠르게 프로토타입 제작
- 커스터마이징이 중요
- 현대적인 UI/UX

---

### 2. **Next.js 15 + shadcn/ui**

**장점:**
- SSR/SSG 가능 (SEO 필요시)
- App Router (서버 컴포넌트)
- API Routes (백엔드 통합 용이)
- Vercel 배포 최적화

**스택:**
```
- Next.js 15 (App Router)
- React 19
- TypeScript
- shadcn/ui
- Tailwind CSS
- Server Actions (API 대신)
```

**적합한 경우:**
- SEO가 중요
- 서버사이드 로직 필요
- Vercel 등 클라우드 배포

---

### 3. **Vite + Svelte 5 + DaisyUI** (경량화 우선)

**장점:**
- 가장 작은 번들 사이즈
- Svelte 5: 뛰어난 성능
- DaisyUI: Tailwind 기반 컴포넌트 라이브러리
- 러닝 커브 낮음

**스택:**
```
- Vite
- Svelte 5
- TypeScript
- DaisyUI
- Tailwind CSS
```

**적합한 경우:**
- 번들 크기 최소화
- 성능이 최우선
- 간단한 UI

---

## 에이전트 UI 특화 라이브러리

### 채팅/대화 UI

1. **@chatscope/chat-ui-kit-react**
   - 채팅 전용 컴포넌트
   - 메시지, 입력창, 타이핑 인디케이터
   
2. **react-chat-elements**
   - 다양한 메시지 타입
   - 커스터마이징 가능

3. **직접 구현 (shadcn/ui 기반) ⭐ 추천**
   - 완전한 커스터마이징
   - 에이전트 특성에 맞춤

### 스트리밍 텍스트

1. **react-markdown**
   - Markdown 렌더링
   - 코드 블록 하이라이팅

2. **react-syntax-highlighter**
   - 코드 하이라이팅 전문

### 실시간 업데이트

1. **TanStack Query (React Query)**
   - 서버 상태 관리
   - 자동 리페칭
   - 낙관적 업데이트

2. **Socket.io or SSE**
   - 실시간 스트리밍
   - 에이전트 응답 실시간 표시

---

## 최종 추천 구조

```
agent/
├── packages/
│   ├── core/              # Agent SDK 백엔드
│   │   ├── src/
│   │   │   ├── index.ts   # CLI 진입점
│   │   │   └── server.ts  # HTTP/WebSocket 서버 (WebUI용)
│   │   └── package.json
│   │
│   └── web/               # WebUI (Vite + React + shadcn/ui)
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/            # shadcn/ui 컴포넌트
│       │   │   ├── chat/          # 채팅 UI
│       │   │   ├── skill-list/    # Skill 관리
│       │   │   └── settings/      # 설정
│       │   ├── lib/
│       │   │   └── api.ts         # core와 통신
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
│
├── .claude/
│   └── skills/
├── pnpm-workspace.yaml
└── package.json
```

---

## WebUI 기능 제안

### 핵심 기능
- [ ] 실시간 채팅 인터페이스
- [ ] 에이전트 응답 스트리밍
- [ ] Skill 목록 및 활성화 상태
- [ ] 대화 히스토리
- [ ] 코드 블록 하이라이팅
- [ ] Markdown 렌더링

### 고급 기능
- [ ] Skill 추가/편집 (SKILL.md 관리)
- [ ] 모델 선택 (Sonnet/Opus/Haiku)
- [ ] 대화 저장/불러오기
- [ ] 설정 관리 (.env 편집)
- [ ] 비용 트래킹

---

## 시작 명령어 (WebUI 추가 후)

```bash
# 개발 모드
pnpm dev          # 백엔드만
pnpm dev:ui       # WebUI만
pnpm dev:all      # 둘 다 (Turborepo 사용 시)

# 빌드
pnpm build        # 전체 빌드
pnpm build:ui     # WebUI만 빌드
```

---

## 다음 단계

1. WebUI 스택 선택
2. `packages/web` 초기화
3. `packages/core/src/server.ts` 생성 (WebSocket/HTTP API)
4. UI 컴포넌트 구현
