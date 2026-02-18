import React from 'react';
import { Box, Text, useStdout } from 'ink';
import wrapAnsi from 'wrap-ansi';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;
  const contentWidth = terminalWidth - 4;

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

  const wrappedContent = wrapAnsi(content, contentWidth, { hard: true, trim: false });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={getColor()}>
        {getPrefix()} {role.toUpperCase()}
      </Text>
      <Box flexDirection="column" paddingLeft={1}>
        <Text>{wrappedContent}</Text>
      </Box>
    </Box>
  );
};
