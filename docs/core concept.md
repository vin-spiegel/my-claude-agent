# PRD - Local Agent Dashboard (Village)

## Overview
맥미니 로컬 서버에서 실행되는 AI 에이전트 오케스트레이션 시스템.  
스타듀밸리 감성의 픽셀아트 UI로 멀티 프로젝트 에이전트 작업을 시각화.

---

## Core Concept

| 게임 요소 | 실제 기능 |
|---|---|
| 마을 맵 | 프로젝트 (프로젝트명이 seed → 랜덤 고유 맵) |
| 이장 NPC | 오케스트레이터 에이전트 |
| 건물 NPC | 툴 에이전트 (Slack, GitHub, Gmail, Vercel) |
| 심부름꾼 | 툴 호출 시각화 유닛 |
| 마을 게시판 | 세션 목록 + 알림 히스토리 |
| 전령 NPC | 타 마을(프로젝트) 실시간 알림 |
| 월드맵 | 프로젝트 간 이동 |

---

## Architecture

### Backend (Mac Mini Local Server)
```
Agent Server (TypeScript)
├── Orchestrator (Claude API via OpenRouter)
│   ├── Tool: Slack API
│   ├── Tool: GitHub API
│   ├── Tool: Vercel API
│   └── Tool: Gmail API (OAuth2)
├── Scheduler (cron) - 주간 자동 보고
├── WebSocket Server - 실시간 상태 푸시
└── SQLite - 세션/메시지 영속화
```

### Frontend
```
Phaser.js (픽셀 게임 렌더링)
├── Tiled (타일맵)
├── Perlin Noise (랜덤 맵 생성)
└── WebSocket Client (실시간 연동)
```

---

## Features

### 1. 프로젝트 = 마을
- 프로젝트(Git repo 기준)마다 고유 마을 맵 생성
- 프로젝트명을 seed로 Perlin Noise 지형 생성 → 항상 동일한 맵
- 브랜치가 달라도 같은 repo면 같은 마을
- 월드맵에서 마을 간 이동

### 2. 오케스트레이터 (이장)
- 텐트/본부 건물에 고정 배치
- 유일하게 말 걸 수 있는 NPC
- 텍스트 채팅으로 명령 입력
- 멀티턴 대화 컨텍스트 유지

### 3. 툴 에이전트 (건물 NPC)
- Slack, GitHub, Gmail, Vercel 각각 건물로 표현
- 클릭 시 플레이버 텍스트만 출력 ("바쁜 중이에요...")
- 이장 명령 시에만 활성화

### 4. 심부름꾼 유닛
- 이장이 툴 호출 시 해당 건물로 이동
- 건물 도착 후 루프 대기 애니메이션 (ETA 불확실하므로)
- 완료 시 이장 텐트로 복귀
- 병렬 툴 호출 시 여러 심부름꾼 동시 출발

### 5. 세션 관리
- 세션 = 이장과의 대화 컨텍스트
- 대화 길어지면 오래된 메시지 요약 압축
- 스키마: `{ id, projectId, messages[], summary, createdAt, status }`

### 6. 마을 게시판
- 현재 마을의 세션 목록 표시
- 타 마을(프로젝트)에서 온 알림 누적
- 읽지 않은 알림 뱃지 표시
- 전령이 쪽지 꽂고 감 → 확인 전까지 게시판에 유지

### 7. 전령 NPC (실시간 알림)
- 타 마을 작업 완료/상태 변경 시 전령이 현재 맵으로 등장
- 게시판에 쪽지 꽂은 후 입구에서 대기
- 말 걸면 알림 내용 확인 → 전령 퇴장
- 미확인 시 입구에 계속 대기

### 8. 자동 주간 보고
- 매주 지정 시간 cron 트리거
- Slack, GitHub, Gmail, Vercel 데이터 수집
- Claude가 보고서 정리 후 Slack 발송
- 인게임: 심부름꾼들이 자동으로 각 건물 방문하는 연출

---

## UX Flow

```
1. 앱 실행 → 마지막 방문 마을 로드
2. 이장 텐트 접근 → 채팅창 오픈
3. 명령 입력 → 심부름꾼 출발
4. 심부름꾼 건물 도착 → 루프 대기
5. 툴 응답 → 심부름꾼 복귀
6. 이장 대화창에 결과 출력
7. 타 마을 알림 → 전령 등장 → 게시판 쪽지
```

---

## Tech Stack

| 영역 | 기술 |
|---|---|
| Runtime | Mac Mini (로컬 서버) |
| Backend | TypeScript, Node.js |
| LLM | Claude API via OpenRouter |
| 게임 렌더링 | Phaser.js |
| 맵 에디터 | Tiled |
| 지형 생성 | Perlin Noise |
| 실시간 통신 | WebSocket |
| DB | SQLite |
| 스케줄러 | node-cron |
| 픽셀 에셋 | itch.io 무료 에셋 |

---

## Out of Scope (현재)
- 모바일 지원
- 멀티유저
- 클라우드 배포