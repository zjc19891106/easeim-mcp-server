import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ScenarioItem = {
  id: string;
  scenario: string;
  description?: string;
  platform: string;
  keywords: string[];
  steps: string[];
  relatedClasses: string[];
  relatedApis: string[];
  relatedConfigs: string[];
  codeTemplate?: string;
  difficulty?: 'low' | 'medium' | 'high';
  extends?: string;
};

type KnowledgeIndex = {
  version: string;
  lastUpdated: string;
  platforms: string[];
  scenarios: ScenarioItem[];
};

type KnowledgeShard = {
  schemaVersion?: string;
  platform: string;
  scenarios: ScenarioItem[];
};

type ShardInfo = {
  path: string;
  platform: string;
};

type Manifest = {
  schemaVersion?: string;
  version: string;
  lastUpdated: string;
  platforms: string[];
  shards: Record<string, ShardInfo>;
};

type ScenarioListItem = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  steps: string[];
  relatedClasses: string[];
};

const DEFAULT_ICON_MAP: Record<string, string> = {
  custom_message: '📝',
  add_attachment_menu: '➕',
  custom_bubble_style: '💬',
  theme_customization: '🎨',
  avatar_customization: '👤',
  message_long_press_menu: '📋',
  chat_background_customization: '🖼️',
  user_profile_update: '👤',
  text_style_customization: '✍️'
};

export class KnowledgeRegistry {
  private dataDir: string;
  private manifest: Manifest | null = null;
  private shardCache: Map<string, KnowledgeShard> = new Map();
  private defaultPlatform: string;

  constructor(defaultPlatform: string = 'ios', dataDir?: string) {
    this.defaultPlatform = defaultPlatform;
    this.dataDir = dataDir || path.join(__dirname, '../../data/knowledge');
  }

  load(platform?: string): ScenarioItem[] {
    const targetPlatform = platform || this.defaultPlatform;
    const manifest = this.loadManifest();
    const platforms = manifest.platforms;

    const baseScenarios = this.loadShard('common', false).scenarios;
    const platformScenarios = targetPlatform && targetPlatform !== 'common'
      ? this.loadShard(targetPlatform, false).scenarios
      : [];

    return this.mergeScenarios(baseScenarios, platformScenarios, platforms);
  }

  listScenarios(keyword?: string, platform?: string): ScenarioListItem[] {
    let scenarios = this.load(platform);
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      scenarios = scenarios.filter(s =>
        s.scenario.toLowerCase().includes(lowerKeyword) ||
        s.keywords.some(k => k.toLowerCase().includes(lowerKeyword))
      );
    }

    return scenarios.map(s => ({
      id: s.id,
      name: s.scenario,
      description: s.description || s.scenario,
      icon: DEFAULT_ICON_MAP[s.id] || DEFAULT_ICON_MAP[s.scenario] || '📌',
      steps: s.steps,
      relatedClasses: s.relatedClasses
    }));
  }

  getScenario(id: string, platform?: string): ScenarioItem | null {
    const scenarios = this.load(platform);
    const map = new Map(scenarios.map(s => [s.id, s] as const));
    return map.get(id) || null;
  }

  getScenarioByName(name: string, platform?: string): ScenarioItem | null {
    const scenarios = this.load(platform);
    const direct = scenarios.find(s => s.id.endsWith(`:${name}`));
    if (direct) return direct;
    return scenarios.find(s => s.scenario === name) || null;
  }

  findScenario(query: string, platform?: string): ScenarioItem | null {
    const lowerQuery = query.toLowerCase();
    let bestMatch: ScenarioItem | null = null;
    let bestScore = 0;

    for (const scenario of this.load(platform)) {
      let score = 0;
      for (const keyword of scenario.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          score += keyword.length * 2;
        }
      }
      if (lowerQuery.includes(scenario.scenario.toLowerCase())) {
        score += 50;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = scenario;
      }
    }

    return bestScore > 10 ? bestMatch : null;
  }

  private loadManifest(): Manifest {
    if (this.manifest) return this.manifest;

    const manifestPath = path.join(this.dataDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}. Run 'npm run generate-knowledge-shards' first.`);
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (!manifest.platforms || !Array.isArray(manifest.platforms)) {
      throw new Error('Invalid knowledge manifest: missing platforms');
    }
    if (!manifest.shards || typeof manifest.shards !== 'object') {
      throw new Error('Invalid knowledge manifest: missing shards');
    }

    this.manifest = manifest;
    return manifest;
  }

  private loadShard(platform: string, required: boolean): KnowledgeShard {
    if (this.shardCache.has(platform)) {
      return this.shardCache.get(platform)!;
    }

    const manifest = this.loadManifest();
    const shardInfo = manifest.shards[platform];
    if (!shardInfo) {
      if (required) {
        throw new Error(`Knowledge shard not found: ${platform}`);
      }
      return { platform, scenarios: [] };
    }

    const shardPath = path.join(this.dataDir, shardInfo.path);
    const shard: KnowledgeShard = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
    this.validateShard(shard, manifest.platforms);
    this.shardCache.set(platform, shard);
    return shard;
  }

  private validateShard(shard: KnowledgeShard, platforms: string[]) {
    if (!shard || !Array.isArray(shard.scenarios)) {
      throw new Error('Invalid knowledge shard: missing scenarios');
    }
    if (shard.platform && !platforms.includes(shard.platform)) {
      throw new Error(`Invalid knowledge shard platform: ${shard.platform}`);
    }

    for (const item of shard.scenarios) {
      this.validateScenario(item, platforms, shard.platform);
    }
  }

  private validateScenario(item: ScenarioItem, platforms: string[], shardPlatform?: string) {
    if (!item.id || typeof item.id !== 'string') {
      throw new Error('Scenario id is required');
    }
    if (!/^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(item.id)) {
      throw new Error(`Invalid scenario id: ${item.id}`);
    }
    if (!item.platform || !platforms.includes(item.platform)) {
      throw new Error(`Invalid scenario platform: ${item.platform}`);
    }
    if (shardPlatform && item.platform !== shardPlatform) {
      throw new Error(`Scenario platform mismatch: ${item.id}`);
    }
    if (!item.scenario || typeof item.scenario !== 'string') {
      throw new Error(`Scenario name missing: ${item.id}`);
    }
    if (!Array.isArray(item.keywords)) {
      throw new Error(`Scenario keywords missing: ${item.id}`);
    }
  }

  private mergeScenarios(base: ScenarioItem[], overrides: ScenarioItem[], platforms: string[]): ScenarioItem[] {
    const map = new Map<string, ScenarioItem>();
    for (const item of base) {
      map.set(item.id, item);
    }
    for (const item of overrides) {
      map.set(item.id, item);
    }

    const resolved = new Map<string, ScenarioItem>();
    const resolve = (item: ScenarioItem, stack: Set<string>): ScenarioItem => {
      if (resolved.has(item.id)) {
        return resolved.get(item.id)!;
      }
      if (item.extends) {
        if (stack.has(item.id)) {
          throw new Error(`Scenario extends cycle: ${item.id}`);
        }
        const baseItem = map.get(item.extends);
        if (!baseItem) {
          throw new Error(`Scenario extends missing: ${item.extends}`);
        }
        stack.add(item.id);
        const resolvedBase = resolve(baseItem, stack);
        stack.delete(item.id);
        const merged: ScenarioItem = {
          ...resolvedBase,
          ...item,
          keywords: item.keywords ?? resolvedBase.keywords,
          steps: item.steps ?? resolvedBase.steps,
          relatedClasses: item.relatedClasses ?? resolvedBase.relatedClasses,
          relatedApis: item.relatedApis ?? resolvedBase.relatedApis,
          relatedConfigs: item.relatedConfigs ?? resolvedBase.relatedConfigs
        };
        resolved.set(item.id, merged);
        return merged;
      }

      resolved.set(item.id, item);
      return item;
    };

    for (const item of map.values()) {
      this.validateScenario(item, platforms);
      resolve(item, new Set());
    }

    return Array.from(resolved.values());
  }
}
