import { EventBus } from './EventBus';

// Tool name → building label mapping
const TOOL_BUILDING_MAP: Record<string, string> = {
  // 코드/파일 관련 → GitHub
  Read: 'GitHub',
  Write: 'GitHub',
  Edit: 'GitHub',
  Grep: 'GitHub',
  Glob: 'GitHub',
  // 실행/배포 관련 → Vercel
  Bash: 'Vercel',
  // 커뮤니케이션/스킬 → Slack
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
  private deputies: Phaser.GameObjects.Container[] = [];

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

    const handleSubagentStart = () => this.spawnDeputy();
    const handleSubagentEnd = () => this.dismissDeputy();

    EventBus.on('tool-start', handleToolStart);
    EventBus.on('subagent-start', handleSubagentStart);
    EventBus.on('subagent-end', handleSubagentEnd);

    this.events.on('destroy', () => {
      EventBus.off('tool-start', handleToolStart);
      EventBus.off('subagent-start', handleSubagentStart);
      EventBus.off('subagent-end', handleSubagentEnd);
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

  /** Spawn a deputy NPC next to the tent */
  private spawnDeputy(): void {
    const offsetX = 50 + this.deputies.length * 30;
    const dx = this.tentPos.x + offsetX;
    const dy = this.tentPos.y - 10;

    const container = this.add.container(dx, dy + 40);

    // Body — smaller tent
    const body = this.add.rectangle(0, 0, 36, 36, 0x6b3410);
    body.setStrokeStyle(1, 0xffaa00);

    // Label
    const label = this.add.text(0, 24, '부이장', {
      fontSize: '10px',
      color: '#ffaa00',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    container.add([body, label]);
    container.setAlpha(0);

    // Fade in from above
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: dy,
      duration: 400,
      ease: 'Back.easeOut',
    });

    // Idle pulse
    this.tweens.add({
      targets: body,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.deputies.push(container);
  }

  /** Dismiss all deputy NPCs */
  private dismissDeputy(): void {
    for (const deputy of this.deputies) {
      this.tweens.add({
        targets: deputy,
        alpha: 0,
        y: deputy.y - 30,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => deputy.destroy(),
      });
    }
    this.deputies = [];
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
