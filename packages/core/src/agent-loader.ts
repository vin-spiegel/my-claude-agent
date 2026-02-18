import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import { AgentConfig } from './types.js';

export interface AgentDefinition {
  name: string;
  type?: string;
  color?: string;
  description: string;
  capabilities?: string[];
  model?: string;
  maxBudget?: number;
  skills?: string[];
  instructions: string;
  filePath: string;
}

export class AgentLoader {
  private agentsDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.agentsDir = path.join(baseDir, '.claude', 'agents');
  }

  async loadAll(): Promise<AgentDefinition[]> {
    try {
      const entries = await fs.readdir(this.agentsDir, { withFileTypes: true });
      const definitions: AgentDefinition[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const def = await this.loadAgentFile(path.join(this.agentsDir, entry.name));
            definitions.push(def);
          } catch (error) {
            console.warn(`Failed to load agent ${entry.name}:`, error);
          }
        }
      }

      return definitions;
    } catch (error) {
      return [];
    }
  }

  async load(name: string): Promise<AgentDefinition | null> {
    const filePath = path.join(this.agentsDir, `${name}.md`);
    
    try {
      return await this.loadAgentFile(filePath);
    } catch {
      return null;
    }
  }

  toAgentConfig(definition: AgentDefinition): AgentConfig {
    return {
      model: definition.model,
      maxBudget: definition.maxBudget,
      skills: definition.skills,
    };
  }

  private async loadAgentFile(filePath: string): Promise<AgentDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, instructions } = this.parseFrontmatter(content);

    if (!frontmatter.name) {
      throw new Error('Agent definition missing "name" field');
    }

    if (!frontmatter.description) {
      throw new Error('Agent definition missing "description" field');
    }

    return {
      name: frontmatter.name,
      type: frontmatter.type,
      color: frontmatter.color,
      description: frontmatter.description,
      capabilities: frontmatter.capabilities,
      model: frontmatter.model,
      maxBudget: frontmatter.maxBudget,
      skills: frontmatter.skills,
      instructions,
      filePath,
    };
  }

  private parseFrontmatter(content: string): { frontmatter: any; instructions: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!match) {
      return {
        frontmatter: {},
        instructions: content,
      };
    }

    const [, frontmatterText, instructions] = match;
    const frontmatter = yaml.parse(frontmatterText);

    return {
      frontmatter,
      instructions: instructions.trim(),
    };
  }
}

export function createAgentLoader(baseDir?: string): AgentLoader {
  return new AgentLoader(baseDir);
}
