import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

interface TooltipData {
  name: string;
  x: number;
  y: number;
}

const FLAVOR_TEXT: Record<string, string> = {
  // 동적 NPC — fallback으로 처리
};

export function NpcTooltip() {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    const handleNpcClick = (data: TooltipData) => {
      setTooltip(data);
      setTimeout(() => setTooltip(null), 2000);
    };

    EventBus.on('npc-click', handleNpcClick);

    return () => {
      EventBus.off('npc-click', handleNpcClick);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: tooltip.x,
        top: tooltip.y - 60,
        transform: 'translateX(-50%)',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.9)',
        border: '1px solid #ffd700',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '13px',
        fontFamily: 'Arial, sans-serif',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {FLAVOR_TEXT[tooltip.name] || `${tooltip.name}...`}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
