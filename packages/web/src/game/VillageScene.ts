import { EventBus } from './EventBus';

// Tool name → building label mapping
const TOOL_BUILDING_MAP: Record<string, string> = {
  Bash: 'Vercel',
  Read: 'GitHub',
  Write: 'GitHub',
  Edit: 'GitHub',
  Grep: 'GitHub',
  Glob: 'GitHub',
  Skill: 'Slack',
  Task: 'Slack',
};

/**
 * Village Scene — 메인 게임 맵
 * 
 * 이장 텐트, 건물 NPC (Slack, GitHub, Gmail, Vercel),
 * 심부름꾼 유닛, 마을 게시판을 배치.
 */
export class VillageScene extends Phaser.Scene {
  private tentPos = { x: 0, y: 0 };
  private buildingPositions = new Map<string, { x: number; y: number }>();
  private runners: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super({ key: 'VillageScene' });
  }

  preload(): void {
    // TODO: 픽셀 에셋 로드
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2d5a27');
    this.layoutScene();

    this.scale.on('resize', () => this.layoutScene());

    // Listen for tool events from React
    const handleToolStart = (data: { tool: string }) => {
      const buildingName = TOOL_BUILDING_MAP[data.tool] || 'Vercel';
      this.dispatchRunner(buildingName);
    };

    EventBus.on('tool-start', handleToolStart);
    this.events.on('destroy', () => {
      EventBus.off('tool-start', handleToolStart);
    });
  }

  private layoutScene(): void {
    this.children.removeAll(true);

    const w = this.scale.width;
    const h = this.scale.height;

    // 그리드
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x3d7a37, 0.3);
    for (let x = 0; x < w; x += 32) {
      graphics.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y < h; y += 32) {
      graphics.lineBetween(0, y, w, y);
    }

    const cx = w / 2;
    const cy = h / 2;
    const margin = 0.2;

    const font = { fontFamily: 'Arial, sans-serif' };

    this.tentPos = { x: cx, y: cy };

    // 이장 텐트 (중앙) — 클릭 가능
    const tent = this.add.rectangle(cx, cy, 64, 64, 0x8b4513);
    tent.setStrokeStyle(2, 0xffd700);
    tent.setInteractive({ useHandCursor: true });
    
    tent.on('pointerover', () => {
      tent.setScale(1.05);
    });
    tent.on('pointerout', () => {
      tent.setScale(1);
    });
    tent.on('pointerdown', () => {
      EventBus.emit('open-chat', undefined);
    });

    this.add.text(cx, cy + 40, '이장', {
      fontSize: '14px',
      color: '#ffffff',
      ...font,
    }).setOrigin(0.5);

    // 건물 NPC들 (상대 좌표) — 클릭 가능
    const buildings = [
      { rx: margin, ry: margin, color: 0x4a154b, label: 'Slack' },
      { rx: 1 - margin, ry: margin, color: 0x24292e, label: 'GitHub' },
      { rx: margin, ry: 1 - margin, color: 0xea4335, label: 'Gmail' },
      { rx: 1 - margin, ry: 1 - margin, color: 0x000000, label: 'Vercel' },
    ];

    for (const b of buildings) {
      const bx = w * b.rx;
      const by = h * b.ry;
      const rect = this.add.rectangle(bx, by, 48, 48, b.color);
      rect.setStrokeStyle(1, 0xffffff);
      rect.setInteractive({ useHandCursor: true });

      rect.on('pointerover', () => {
        rect.setScale(1.1);
      });
      rect.on('pointerout', () => {
        rect.setScale(1);
      });
      rect.on('pointerdown', () => {
        EventBus.emit('npc-click', { name: b.label, x: bx, y: by });
      });

      this.buildingPositions.set(b.label, { x: bx, y: by });

      this.add.text(bx, by + 32, b.label, {
        fontSize: '13px',
        color: '#cccccc',
        ...font,
      }).setOrigin(0.5);
    }

    // 마을 게시판 (상단 중앙)
    const boardY = h * 0.08;
    const board = this.add.rectangle(cx, boardY, 80, 40, 0x8b6914);
    board.setStrokeStyle(1, 0xdaa520);
    this.add.text(cx, boardY, '게시판', {
      fontSize: '13px',
      color: '#ffffff',
      ...font,
    }).setOrigin(0.5);
  }

  /** Dispatch a runner circle from tent to building, then back */
  private dispatchRunner(buildingName: string): void {
    const target = this.buildingPositions.get(buildingName);
    if (!target) return;

    const runner = this.add.circle(this.tentPos.x, this.tentPos.y, 6, 0x00ff88);
    runner.setStrokeStyle(1, 0xffffff);
    this.runners.push(runner);

    // Move to building
    this.tweens.add({
      targets: runner,
      x: target.x,
      y: target.y,
      duration: 800,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        // Pulse at building (waiting)
        this.tweens.add({
          targets: runner,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 400,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            // Return to tent
            this.tweens.add({
              targets: runner,
              x: this.tentPos.x,
              y: this.tentPos.y,
              duration: 800,
              ease: 'Quad.easeInOut',
              onComplete: () => {
                runner.destroy();
                this.runners = this.runners.filter(r => r !== runner);
              },
            });
          },
        });
      },
    });
  }
}
