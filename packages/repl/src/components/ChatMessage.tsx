import React from 'react';
import { Box, Text } from 'ink';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  const getColor = () => {
    switch (role) {
      case 'user':
        return 'cyan';
      case 'assistant':
        return 'green';
      case 'system':
        return 'gray';
      default:
        return 'white';
    }
  };

  const getPrefix = () => {
    switch (role) {
      case 'user':
        return '👤';
      case 'assistant':
        return '🤖';
      case 'system':
        return 'ℹ️ ';
      default:
        return '';
    }
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={getColor()}>
        {getPrefix()} {role.toUpperCase()}
      </Text>
      <Text>{content}</Text>
    </Box>
  );
};
