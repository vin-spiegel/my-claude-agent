import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { EventBus } from '../game/EventBus';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    EventBus.on('open-chat', handleOpen);
    EventBus.on('close-chat', handleClose);

    return () => {
      EventBus.off('open-chat', handleOpen);
      EventBus.off('close-chat', handleClose);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const appendToLastAssistant = (text: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === 'assistant') {
        updated[updated.length - 1] = { role: 'assistant', content: last.content + text };
      }
      return updated;
    });
  };

  const streamFromSSE = async (userMessage: string) => {
    const res = await fetch('http://localhost:3030/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    });

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        let eventName = 'message';
        let data = '';

        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) eventName = line.slice(7);
          else if (line.startsWith('data: ')) data = line.slice(6);
        }

        if (!data) continue;

        try {
          const parsed = JSON.parse(data);

          switch (eventName) {
            case 'text':
              appendToLastAssistant(parsed.content);
              break;
            case 'tool-start':
              EventBus.emit('tool-start', { tool: parsed.tool });
              break;
            case 'tool-result':
              EventBus.emit('tool-complete', { tool: parsed.tool, result: parsed.result });
              break;
            case 'skill-loaded':
              EventBus.emit('skill-loaded', { name: parsed.name });
              appendToLastAssistant(`\n⚡ 스킬 "${parsed.name}" 로드됨\n`);
              break;
            case 'subagent-start':
              EventBus.emit('subagent-start', { name: parsed.name || '' });
              break;
            case 'subagent-end':
              EventBus.emit('subagent-end', undefined);
              break;
            case 'thinking':
            case 'progress':
              break;
            case 'done':
              EventBus.emit('subagent-end', undefined);
              break;
            case 'error':
              appendToLastAssistant(`\n❌ ${parsed.message}`);
              break;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  };

  const mockStream = async (userMessage: string) => {
    const mockResponse = `이장: "${userMessage}" 에 대해 알아보겠습니다...`;
    for (let i = 0; i < mockResponse.length; i++) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: mockResponse.slice(0, i + 1) };
        return updated;
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamFromSSE(userMessage);
    } catch {
      // Fallback to mock if server unavailable
      await mockStream(userMessage);
    }

    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 380,
        height: '100%',
        background: 'rgba(0, 0, 0, 0.92)',
        borderLeft: '1px solid #444',
        display: 'flex',
        flexDirection: 'column',
        color: '#eee',
        fontFamily: 'Arial, sans-serif',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffd700' }}>
          💬 이장과 대화
        </div>
        <button
          onClick={() => EventBus.emit('close-chat', undefined)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 8px',
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}
          >
            <div
              className="chat-bubble"
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: msg.role === 'user' ? '#1e3a8a' : '#1f2937',
                color: '#fff',
                fontSize: '14px',
                lineHeight: '1.5',
                wordBreak: 'break-word',
              }}
            >
              {msg.role === 'assistant' ? (
                <Markdown>{msg.content}</Markdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #444',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요..."
          disabled={isStreaming}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: '#1a1a1a',
            border: '1px solid #555',
            borderRadius: '6px',
            color: '#eee',
            fontSize: '14px',
            outline: 'none',
            fontFamily: 'Arial, sans-serif',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          style={{
            padding: '10px 16px',
            background: input.trim() && !isStreaming ? '#1e3a8a' : '#333',
            border: 'none',
            borderRadius: '6px',
            color: input.trim() && !isStreaming ? '#fff' : '#666',
            fontSize: '14px',
            cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
          }}
        >
          전송
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .chat-bubble p { margin: 0 0 8px 0; }
        .chat-bubble p:last-child { margin-bottom: 0; }
        .chat-bubble h1, .chat-bubble h2, .chat-bubble h3 {
          margin: 12px 0 6px 0;
          color: #ffd700;
        }
        .chat-bubble h1 { font-size: 16px; }
        .chat-bubble h2 { font-size: 15px; }
        .chat-bubble h3 { font-size: 14px; }
        .chat-bubble ul, .chat-bubble ol {
          margin: 4px 0;
          padding-left: 20px;
        }
        .chat-bubble li { margin: 2px 0; }
        .chat-bubble code {
          background: rgba(255,255,255,0.1);
          padding: 1px 4px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 13px;
        }
        .chat-bubble pre {
          background: rgba(0,0,0,0.4);
          padding: 8px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 6px 0;
        }
        .chat-bubble pre code {
          background: none;
          padding: 0;
        }
        .chat-bubble strong { color: #8bb4f0; }
        .chat-bubble table {
          border-collapse: collapse;
          margin: 6px 0;
          font-size: 13px;
        }
        .chat-bubble th, .chat-bubble td {
          border: 1px solid #444;
          padding: 4px 8px;
        }
        .chat-bubble th { background: rgba(255,255,255,0.05); }
        .chat-bubble hr {
          border: none;
          border-top: 1px solid #444;
          margin: 8px 0;
        }
      `}</style>
    </div>
  );
}
