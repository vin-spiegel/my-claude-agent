/**
 * EventBus — Phaser ↔ React 통신
 * 
 * 이벤트:
 * - open-chat: 채팅 패널 열기
 * - close-chat: 채팅 패널 닫기
 * - chat-message: 사용자 메시지 전송
 * - tool-start: 도구 실행 시작
 * - tool-complete: 도구 실행 완료
 * - npc-click: NPC 클릭 (건물)
 */

export type EventBusEvents = {
  'open-chat': undefined;
  'close-chat': undefined;
  'chat-message': { message: string };
  'tool-start': { tool: string };
  'tool-complete': { tool: string; result: unknown };
  'npc-click': { name: string; x: number; y: number };
};

type EventCallback<T> = (data: T) => void;

class EventBusImpl {
  private listeners = new Map<keyof EventBusEvents, Set<EventCallback<any>>>();

  on<K extends keyof EventBusEvents>(
    event: K,
    callback: EventCallback<EventBusEvents[K]>
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off<K extends keyof EventBusEvents>(
    event: K,
    callback: EventCallback<EventBusEvents[K]>
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

export const EventBus = new EventBusImpl();
