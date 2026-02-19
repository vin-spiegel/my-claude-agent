import { useEffect, useRef } from 'react';
import { createGameConfig } from './game/config';
import { ChatPanel } from './components/ChatPanel';
import { NpcTooltip } from './components/NpcTooltip';

export function App() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current) return;

    const config = createGameConfig('game-container');
    gameRef.current = new Phaser.Game(config);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      {/* Phaser canvas */}
      <div id="game-container" style={{ width: '100%', height: '100%' }} />

      {/* React overlays */}
      <ChatPanel />
      <NpcTooltip />
    </div>
  );
}
