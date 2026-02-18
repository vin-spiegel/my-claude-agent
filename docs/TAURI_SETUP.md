# Tauri 데스크톱 앱 구조

## 왜 Tauri?

### Tauri의 장점
✅ **경량**: Electron 대비 1/10 크기 (3-5MB vs 50-200MB)  
✅ **빠른 성능**: Rust 백엔드, 네이티브 WebView  
✅ **보안**: 샌드박스, 권한 시스템  
✅ **파일 시스템 접근**: .claude/skills/ 직접 관리  
✅ **시스템 트레이**: 백그라운드 실행 가능  
✅ **크로스 플랫폼**: macOS, Windows, Linux 자동 빌드  
✅ **오프라인**: 인터넷 없이 로컬에서 실행

### vs Electron
- **번들 크기**: Tauri 3-5MB vs Electron 50-200MB
- **메모리**: Tauri가 훨씬 적게 사용
- **보안**: Tauri가 기본적으로 더 안전
- **속도**: Rust 백엔드가 Node.js보다 빠름

## 프로젝트 구조

```
agent/
├── packages/
│   ├── core/                    # Agent SDK (TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts        # CLI 진입점
│   │   │   └── api.ts          # Tauri에서 호출할 API
│   │   └── package.json
│   │
│   └── desktop/                 # Tauri 앱
│       ├── src/                 # Frontend (Vite + React)
│       │   ├── components/
│       │   │   ├── ui/         # shadcn/ui 컴포넌트
│       │   │   ├── Chat.tsx    # 메인 채팅 UI
│       │   │   ├── SkillList.tsx
│       │   │   └── Settings.tsx
│       │   ├── lib/
│       │   │   └── tauri.ts    # Tauri API 호출
│       │   ├── App.tsx
│       │   └── main.tsx
│       │
│       ├── src-tauri/           # Rust 백엔드
│       │   ├── src/
│       │   │   ├── main.rs     # Tauri 진입점
│       │   │   └── commands.rs # Rust 커맨드 (Agent SDK 호출)
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       │
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
│
├── .claude/
│   └── skills/
├── pnpm-workspace.yaml
└── package.json
```

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│            Tauri Desktop App                    │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │   Frontend (Vite + React + shadcn/ui)    │  │
│  │   - Chat UI                              │  │
│  │   - Skill Management                     │  │
│  │   - Settings                             │  │
│  └──────────────────────────────────────────┘  │
│                    ↕ IPC                        │
│  ┌──────────────────────────────────────────┐  │
│  │   Rust Backend (Tauri Core)              │  │
│  │   - invoke("chat", message)              │  │
│  │   - invoke("list_skills")                │  │
│  │   - invoke("save_skill", skill)          │  │
│  └──────────────────────────────────────────┘  │
│                    ↕                            │
│  ┌──────────────────────────────────────────┐  │
│  │   @agent/core (TypeScript)               │  │
│  │   - Claude Agent SDK                     │  │
│  │   - Skill 로드/실행                       │  │
│  │   - OpenRouter 통신                       │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## 기술 스택

### Frontend
- **Vite**: 빌드 도구
- **React 18**: UI 프레임워크
- **TypeScript**: 타입 안전
- **shadcn/ui**: UI 컴포넌트
- **Tailwind CSS**: 스타일링
- **Zustand**: 상태 관리
- **react-markdown**: Markdown 렌더링
- **@tauri-apps/api**: Tauri API

### Backend (Rust)
- **Tauri 2.x**: 데스크톱 프레임워크
- **serde**: JSON 직렬화
- **tokio**: 비동기 런타임

### Integration
- **@agent/core**: TypeScript로 작성된 Agent SDK 래퍼
- Rust에서 Node.js 프로세스로 core 호출

## Tauri Commands (주요 기능)

### 1. 채팅
```rust
#[tauri::command]
async fn chat(message: String) -> Result<String, String> {
    // @agent/core의 query() 호출
    // 스트리밍 응답 반환
}
```

### 2. Skill 관리
```rust
#[tauri::command]
async fn list_skills() -> Result<Vec<Skill>, String> {
    // .claude/skills/ 디렉토리 읽기
}

#[tauri::command]
async fn save_skill(name: String, content: String) -> Result<(), String> {
    // .claude/skills/{name}/SKILL.md 저장
}
```

### 3. 설정
```rust
#[tauri::command]
async fn get_config() -> Result<Config, String> {
    // .env 읽기
}

#[tauri::command]
async fn save_config(config: Config) -> Result<(), String> {
    // .env 저장
}
```

## 주요 기능

### 필수 기능
- [x] 실시간 채팅 인터페이스
- [x] 에이전트 응답 스트리밍
- [x] Skill 목록 및 상태 표시
- [x] 대화 히스토리 저장
- [x] 코드 블록 하이라이팅
- [x] Markdown 렌더링

### 고급 기능
- [ ] Skill 추가/편집 (GUI)
- [ ] 모델 선택 (Sonnet/Opus/Haiku)
- [ ] 설정 편집 (GUI)
- [ ] 시스템 트레이 지원
- [ ] 단축키 (글로벌)
- [ ] 테마 (라이트/다크)
- [ ] 비용 트래킹
- [ ] 대화 내보내기

## 설치 및 실행

### 사전 요구사항
```bash
# Rust 설치
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Tauri CLI 설치
cargo install tauri-cli
```

### 개발 모드
```bash
# 의존성 설치
pnpm install

# Tauri 앱 실행
pnpm dev:desktop

# 또는 개별 실행
cd packages/desktop
pnpm tauri dev
```

### 빌드
```bash
# 프로덕션 빌드
pnpm build:desktop

# 플랫폼별 빌드
pnpm tauri build --target x86_64-apple-darwin  # macOS Intel
pnpm tauri build --target aarch64-apple-darwin # macOS Apple Silicon
pnpm tauri build --target x86_64-pc-windows-msvc # Windows
pnpm tauri build --target x86_64-unknown-linux-gnu # Linux
```

## 장점 정리

1. **사용자 경험**
   - 네이티브 앱처럼 동작
   - 시스템 트레이에서 빠른 접근
   - 오프라인 실행 가능

2. **개발자 경험**
   - 파일 시스템 직접 접근 (.claude/skills/)
   - 보안 권한 세밀하게 제어
   - Hot reload 지원

3. **배포**
   - 자동 업데이트 지원
   - 크로스 플랫폼 빌드 자동화
   - 작은 번들 크기 (3-5MB)

4. **통합**
   - 기존 @agent/core 재사용
   - 웹 기술 (React) 사용
   - Rust 성능 + TypeScript 생산성

## 다음 단계

1. Tauri 프로젝트 초기화
2. Frontend 기본 구조 생성
3. Rust 커맨드 구현
4. @agent/core 통합
5. UI 컴포넌트 구현
