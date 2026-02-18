import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface InputFieldProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({ onSubmit, disabled = false }) => {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSubmit(input);
      setInput('');
    }
  };

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1} width="100%">
      {disabled ? (
        <>
          <Text dimColor>{input}</Text>
          <Text color="gray"> (processing...)</Text>
        </>
      ) : (
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a message..."
          showCursor={true}
          focus={true}
        />
      )}
    </Box>
  );
};
