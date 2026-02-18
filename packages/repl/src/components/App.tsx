import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import { ChatHistory, Message } from './ChatHistory.js';
import { InputField } from './InputField.js';
import { Agent } from '@agent/core';

interface AppProps {
  agent: Agent;
}

export const App: React.FC<AppProps> = ({ agent }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const handleResize = () => {
      forceUpdate({});
    };

    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout]);

  const handleSubmit = async (input: string) => {
    const trimmed = input.trim();

    // Handle exit command
    if (trimmed === '/exit' || trimmed === '/quit') {
      const goodbyeMessage: Message = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: '👋 Goodbye!',
      };
      setMessages((prev) => [...prev, goodbyeMessage]);
      setTimeout(() => exit(), 500);
      return;
    }

    // Handle help command
    if (trimmed === '/help') {
      const helpMessage: Message = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: 'Available commands:\n  /help     - Show this help\n  /skills   - List available skills\n  /exit     - Exit REPL',
      };
      setMessages((prev) => [...prev, helpMessage]);
      return;
    }

    // Handle skills command
    if (trimmed === '/skills') {
      setIsProcessing(true);
      try {
        const skills = await agent.listSkills();
        const skillsText = skills.length > 0
          ? 'Available Skills:\n' + skills.map(s => `  ${s.name} - ${s.description}`).join('\n')
          : 'No skills configured.';
        const skillsMessage: Message = {
          id: `system-${Date.now()}`,
          role: 'system',
          content: skillsText,
        };
        setMessages((prev) => [...prev, skillsMessage]);
      } catch (error: any) {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `❌ Error: ${error.message}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);
    setCurrentAssistantMessage('');

    try {
      // Stream assistant response
      let buffer = '';
      const assistantMessageId = `assistant-${Date.now()}`;

      for await (const chunk of agent.chatStream(input)) {
        if (chunk.type === 'chunk') {
          buffer += chunk.content;
          setCurrentAssistantMessage(buffer);
        } else if (chunk.type === 'complete') {
          // Add final message to history
          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: chunk.content,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setCurrentAssistantMessage('');

          // Add metadata if available
          if (chunk.metadata) {
            const metadataLines: string[] = [];
            if (chunk.metadata.duration_ms) {
              metadataLines.push(`⏱  ${(chunk.metadata.duration_ms / 1000).toFixed(2)}s`);
            }
            if (chunk.metadata.cost_usd) {
              metadataLines.push(`💵 $${chunk.metadata.cost_usd.toFixed(4)}`);
            }
            if (metadataLines.length > 0) {
              const metadataMessage: Message = {
                id: `metadata-${Date.now()}`,
                role: 'system',
                content: metadataLines.join(' | '),
              };
              setMessages((prev) => [...prev, metadataMessage]);
            }
          }
        }
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `❌ Error: ${error.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setCurrentAssistantMessage('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Combine messages with current streaming message
  const displayMessages = currentAssistantMessage
    ? [
        ...messages,
        {
          id: 'streaming',
          role: 'assistant' as const,
          content: currentAssistantMessage,
        },
      ]
    : messages;

  const terminalHeight = stdout?.rows || 24;
  const headerHeight = 3;
  const inputHeight = 3;
  const minTerminalHeight = headerHeight + inputHeight + 3;
  const actualHeight = Math.max(minTerminalHeight, terminalHeight);
  const chatHeight = actualHeight - headerHeight - inputHeight;

  return (
    <Box flexDirection="column" width="100%" height={actualHeight} overflow="hidden">
      {/* Header - Fixed */}
      <Box flexShrink={0} borderStyle="double" borderColor="magenta" paddingX={1} height={headerHeight}>
        <Text bold color="magenta">Claude Agent REPL v1.0.0</Text>
      </Box>

      {/* Chat History - Scrollable */}
      <Box height={chatHeight} flexDirection="column" justifyContent="flex-end" overflow="hidden">
        <ChatHistory messages={displayMessages} />
      </Box>

      {/* Input Field - Fixed */}
      <Box flexShrink={0} height={inputHeight} width="100%">
        <InputField onSubmit={handleSubmit} disabled={isProcessing} />
      </Box>
    </Box>
  );
};
