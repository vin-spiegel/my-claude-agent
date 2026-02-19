import { EventBus } from './EventBus';

// Tool name → edge direction for runner animation
const TOOL_EDGE_MAP: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
  Read: 'right',
  Write: 'right',
  Edit: 'right',
  Grep: 'right',
  Glob: 'right',
  Bash: 'bottom',
  Skill: 'top',
  Task: 'left',
};

/**
 * Village Scene — 메인 게임 맵
 * 
 * 이장 텐트, 건물 NPC (Slack, GitHub, Gmail, Vercel),
 * 심부름꾼 유닛, 마을 게시판을 배치.
 */
// Colors for dynamic NPCs
const NPC_COLORS = [0x5865f2, 0xe67e22, 0x2ecc71, 0x9b59b6, 0xe91e63, 0x00bcd4, 0xff5722, 0x607d8b];

export class VillageScene extends Phaser.Scene {
  private tentPos = { x: 0, y: 0 };
  private buildingPositions = new Map<string, { x: number; y: number }>();
  private runners: Phaser.GameObjects.GameObject[] = [];
  private activeGlows = new Map<string, Phaser.GameObjects.Arc>();
  private agentNpcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private dynamicNpcs: Array<{ name: string; type: 'agent' | 'skill' }> = [];
  private availableSkills: Array<{ name: string }> = [];
  private loadedSkills = new Set<string>();

  constructor() {
    super({ key: 'VillageScene' });
  }

  preload(): void {
    this.load.spritesheet('character', '/assets/character.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('grass-objects', '/assets/grass-objects.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image('grass', '/assets/grass.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2d5a27');

    // Create idle animation
    if (!this.anims.exists('idle-down')) {
      this.anims.create({
        key: 'idle-down',
        frames: this.anims.generateFrameNumbers('character', { start: 0, end: 1 }),
        frameRate: 3,
        repeat: -1,
      });
    }

    this.layoutScene();

    this.scale.on('resize', () => this.layoutScene());

    // Load dynamic NPCs from API — agents shown immediately, skills hidden until loaded
    const handleVillageData = (data: { agents: Array<{ name: string }>; skills: Array<{ name: string }> }) => {
      this.dynamicNpcs = data.agents.map(a => ({ name: a.name, type: 'agent' as const }));
      this.availableSkills = data.skills;
      this.layoutScene();
    };

    const handleSkillLoaded = (data: { name: string }) => {
      if (this.loadedSkills.has(data.name)) return;
      this.loadedSkills.add(data.name);
      this.spawnSkillNpc(data.name);
    };

    EventBus.on('village-data', handleVillageData);
    EventBus.on('skill-loaded', handleSkillLoaded);
    this.events.on('destroy', () => {
      EventBus.off('village-data', handleVillageData);
      EventBus.off('skill-loaded', handleSkillLoaded);
    });

    // Listen for tool events from React
    const handleToolStart = (data: { tool: string }) => {
      this.dispatchRunner(data.tool);
    };

    const handleSubagentStart = (data: { name: string }) => this.highlightAgent(data.name);
    const handleSubagentEnd = () => this.clearAllHighlights();

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

    // Grass background
    const bg = this.add.tileSprite(w / 2, h / 2, w, h, 'grass');
    bg.setScale(3);

    // Scatter some decorations
    const seed = 42;
    for (let i = 0; i < 20; i++) {
      const dx = ((seed * (i + 1) * 7 + 13) % 100) / 100 * w;
      const dy = ((seed * (i + 1) * 11 + 37) % 100) / 100 * h;
      const frame = [0, 1, 6, 7, 12, 13][i % 6]; // various grass-objects frames
      const deco = this.add.sprite(dx, dy, 'grass-objects', frame);
      deco.setScale(2);
      deco.setAlpha(0.7);
    }

    const cx = w / 2;
    const cy = h / 2;

    const font = { fontFamily: 'Arial, sans-serif' };

    this.tentPos = { x: cx, y: cy };

    // 이장 NPC (중앙) — 클릭 가능
    const chief = this.add.sprite(cx, cy, 'character', 0);
    chief.setScale(1.5);
    chief.play('idle-down');
    chief.setInteractive({ useHandCursor: true });
    
    chief.on('pointerover', () => {
      chief.setScale(1.6);
    });
    chief.on('pointerout', () => {
      chief.setScale(1.5);
    });
    chief.on('pointerdown', () => {
      EventBus.emit('open-chat', undefined);
    });

    this.add.text(cx, cy + 44, '이장', {
      fontSize: '14px',
      color: '#ffffff',
      ...font,
    }).setOrigin(0.5);

    // 마을 게시판 (상단 중앙)
    const boardY = h * 0.08;
    const board = this.add.rectangle(cx, boardY, 80, 40, 0x8b6914);
    board.setStrokeStyle(1, 0xdaa520);
    this.add.text(cx, boardY, '게시판', {
      fontSize: '13px',
      color: '#ffffff',
      ...font,
    }).setOrigin(0.5);

    // 동적 NPC (에이전트만) — 이장 아래 가로 배치
    if (this.dynamicNpcs.length > 0) {
      const count = this.dynamicNpcs.length;
      const spacing = 60;
      const totalW = (count - 1) * spacing;
      const startX = cx - totalW / 2;
      const ny = cy + 80;

      this.dynamicNpcs.forEach((npc, i) => {
        const nx = startX + i * spacing;
        const tint = NPC_COLORS[i % NPC_COLORS.length];

        const sprite = this.add.sprite(nx, ny, 'character', 0);
        sprite.setScale(1);
        sprite.setTint(tint);
        sprite.play('idle-down');
        sprite.setInteractive({ useHandCursor: true });

        sprite.on('pointerover', () => sprite.setScale(1.15));
        sprite.on('pointerout', () => sprite.setScale(1));
        sprite.on('pointerdown', () => {
          EventBus.emit('npc-click', { name: npc.name, x: nx, y: ny });
        });

        this.buildingPositions.set(npc.name, { x: nx, y: ny });
        this.agentNpcSprites.set(npc.name, sprite);

        this.add.text(nx, ny + 30, npc.name, {
          fontSize: '9px',
          color: '#ffcc66',
          ...font,
        }).setOrigin(0.5);
      });
    }

    // 이미 로드된 스킬 재배치 (리사이즈 대응)
    for (const skillName of this.loadedSkills) {
      this.placeSkillNpc(skillName, false);
    }
  }

  /** Calculate skill NPC position — above tent, horizontal row */
  private getSkillPosition(name: string): { x: number; y: number } {
    const w = this.scale.width;
    const cx = w / 2;
    const ny = this.tentPos.y - 80;

    const allSkills = [...this.loadedSkills];
    const idx = allSkills.indexOf(name);
    const count = allSkills.length;
    const spacing = 60;
    const totalW = (count - 1) * spacing;
    const startX = cx - totalW / 2;

    return { x: startX + idx * spacing, y: ny };
  }

  /** Place a skill NPC (no animation) — used for resize relayout */
  private placeSkillNpc(name: string, _animate: boolean): void {
    const pos = this.getSkillPosition(name);
    const font = { fontFamily: 'Arial, sans-serif' };

    const rect = this.add.rectangle(pos.x, pos.y, 32, 32, 0x00aa55);
    rect.setStrokeStyle(1, 0x00ff88);
    rect.setInteractive({ useHandCursor: true });

    rect.on('pointerover', () => rect.setScale(1.1));
    rect.on('pointerout', () => rect.setScale(1));
    rect.on('pointerdown', () => {
      EventBus.emit('npc-click', { name, x: pos.x, y: pos.y });
    });

    this.buildingPositions.set(name, pos);

    this.add.text(pos.x, pos.y + 24, `⚡ ${name}`, {
      fontSize: '10px',
      color: '#88ffaa',
      ...font,
    }).setOrigin(0.5);
  }

  /** Spawn a skill NPC with entrance animation */
  private spawnSkillNpc(name: string): void {
    const pos = this.getSkillPosition(name);
    const font = { fontFamily: 'Arial, sans-serif' };

    const container = this.add.container(pos.x, pos.y + 30);

    const rect = this.add.rectangle(0, 0, 32, 32, 0x00aa55);
    rect.setStrokeStyle(1, 0x00ff88);

    const label = this.add.text(0, 24, `⚡ ${name}`, {
      fontSize: '10px',
      color: '#88ffaa',
      ...font,
    }).setOrigin(0.5);

    container.add([rect, label]);
    container.setAlpha(0);
    container.setScale(0.3);

    // Pop-in animation
    this.tweens.add({
      targets: container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: pos.y,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Flash effect
    const flash = this.add.circle(pos.x, pos.y, 40, 0x00ff88, 0.4);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 600,
      onComplete: () => flash.destroy(),
    });

    // Make interactive after animation
    this.time.delayedCall(500, () => {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => container.setScale(1.1));
      rect.on('pointerout', () => container.setScale(1));
      rect.on('pointerdown', () => {
        EventBus.emit('npc-click', { name, x: pos.x, y: pos.y });
      });
    });

    this.buildingPositions.set(name, pos);
  }

  /** Highlight an agent NPC with glow ring + pulse */
  private highlightAgent(name: string): void {
    const pos = this.buildingPositions.get(name);
    const npcSprite = this.agentNpcSprites.get(name);
    if (!pos) return;

    // Glow ring
    const glow = this.add.circle(pos.x, pos.y, 30, 0xffaa00, 0);
    glow.setStrokeStyle(2, 0xffaa00);
    this.activeGlows.set(name, glow);

    // Glow pulse animation
    this.tweens.add({
      targets: glow,
      alpha: 0.6,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // NPC pulse
    if (npcSprite) {
      this.tweens.add({
        targets: npcSprite,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** Clear all agent highlights */
  private clearAllHighlights(): void {
    for (const [name, glow] of this.activeGlows) {
      this.tweens.killTweensOf(glow);
      this.tweens.add({
        targets: glow,
        alpha: 0,
        duration: 300,
        onComplete: () => glow.destroy(),
      });

    const rect = this.agentNpcSprites.get(name);
      if (rect) {
        this.tweens.killTweensOf(rect);
        this.tweens.add({
          targets: rect,
          scaleX: 1,
          scaleY: 1,
          duration: 300,
        });
      }
    }
    this.activeGlows.clear();
  }

  /** Dispatch a runner from tent to edge of map (or to a known NPC), then back */
  private dispatchRunner(toolName: string): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // If the tool maps to a known building/NPC, go there
    const knownTarget = this.buildingPositions.get(toolName);

    let target: { x: number; y: number };
    if (knownTarget) {
      target = knownTarget;
    } else {
      // Otherwise go to map edge based on tool type
      const edge = TOOL_EDGE_MAP[toolName] || 'right';
      switch (edge) {
        case 'top':    target = { x: this.tentPos.x, y: 20 }; break;
        case 'bottom': target = { x: this.tentPos.x, y: h - 20 }; break;
        case 'left':   target = { x: 20, y: this.tentPos.y }; break;
        case 'right':  target = { x: w - 20, y: this.tentPos.y }; break;
      }
    }

    const runner = this.add.sprite(this.tentPos.x, this.tentPos.y, 'character', 8);
    runner.setScale(0.6);
    runner.setTint(0x00ff88);
    this.runners.push(runner);

    this.tweens.add({
      targets: runner,
      x: target.x,
      y: target.y,
      duration: 600,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        this.tweens.add({
          targets: runner,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 300,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            this.tweens.add({
              targets: runner,
              x: this.tentPos.x,
              y: this.tentPos.y,
              duration: 600,
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
