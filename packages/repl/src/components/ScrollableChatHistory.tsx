import React, { useState, useEffect } from 'react';
import { Box, useInput, useStdout, Text } from 'ink';
import { ChatMessage } from './ChatMessage.js';
import { Message } from './ChatHistory.js';

interface ScrollableChatHistoryProps {
  messages: Message[];
  maxHeight: number;
}

export const ScrollableChatHistory: React.FC<ScrollableChatHistoryProps> = ({ 
  messages, 
  maxHeight 
}) => {
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isScrollMode, setIsScrollMode] = useState(false);

  useEffect(() => {
    if (!isScrollMode && messages.length > 0) {
      setScrollOffset(Math.max(0, messages.length - maxHeight));
    }
  }, [messages.length, maxHeight, isScrollMode]);

  useInput((input, key) => {
    if (key.upArrow) {
      setIsScrollMode(true);
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      const maxOffset = Math.max(0, messages.length - maxHeight);
      const newOffset = Math.min(maxOffset, scrollOffset + 1);
      setScrollOffset(newOffset);
      
      if (newOffset === maxOffset) {
        setIsScrollMode(false);
      }
    } else if (key.escape) {
      setIsScrollMode(false);
      setScrollOffset(Math.max(0, messages.length - maxHeight));
    }
  });

  const visibleMessages = messages.slice(scrollOffset, scrollOffset + maxHeight);
  const hasMore = scrollOffset < messages.length - maxHeight;
  const hasLess = scrollOffset > 0;

  return (
    <Box flexDirection="column" paddingX={1}>
      {hasLess && (
        <Box justifyContent="center" marginBottom={1}>
          <Text dimColor>↑ Scroll up for more (↑/↓ arrows, ESC to bottom)</Text>
        </Box>
      )}
      
      {visibleMessages.length === 0 ? (
        <Box>
          <ChatMessage 
            role="system" 
            content="Welcome to Claude Agent REPL! Type your message below." 
          />
        </Box>
      ) : (
        visibleMessages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))
      )}
      
      {hasMore && (
        <Box justifyContent="center" marginTop={1}>
          <Text dimColor>↓ More messages below (↓ to scroll)</Text>
        </Box>
      )}
    </Box>
  );
};
