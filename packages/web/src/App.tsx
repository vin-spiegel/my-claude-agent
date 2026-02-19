import { useEffect, useRef } from 'react';
import { createGameConfig } from './game/config';
import { EventBus } from './game/EventBus';
import { ChatPanel } from './components/ChatPanel';
import { NpcTooltip } from './components/NpcTooltip';

const API_URL = 'http://localhost:3030';

export function App() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current) return;

    const config = createGameConfig('game-container');
    gameRef.current = new Phaser.Game(config);

    // Fetch agents & skills from API, pass to Phaser scene
    (async () => {
      try {
        const [agentsRes, skillsRes] = await Promise.all([
          fetch(`${API_URL}/api/agents`),
          fetch(`${API_URL}/api/skills`),
        ]);
        const { agents } = await agentsRes.json();
        const { skills } = await skillsRes.json();
        EventBus.emit('village-data', { agents, skills });
      } catch {
        // API not available — scene uses defaults
      }
    })();

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
