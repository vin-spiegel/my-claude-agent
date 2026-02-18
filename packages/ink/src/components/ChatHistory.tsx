import React from 'react';
import { Box } from 'ink';
import { ChatMessage } from './ChatMessage.js';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatHistoryProps {
  messages: Message[];
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {messages.length === 0 ? (
        <Box>
          <ChatMessage 
            role="system" 
            content="Welcome to Claude Agent REPL! Type your message below." 
          />
        </Box>
      ) : (
        messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))
      )}
    </Box>
  );
};
