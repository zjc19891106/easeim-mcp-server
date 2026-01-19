import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type TemplateVariable = {
  name: string;
  type?: string;
  required: boolean;
  description?: string;
  default?: string;
  defaultValue?: string;
};

export type TemplateItem = {
  id: string;
  name: string;
  description: string;
  platform: string;
  domain: string;
  variables: TemplateVariable[];
  template: string;
  usage?: string[];
  extends?: string;
};

type TemplateIndex = {
  version: string;
  lastUpdated: string;
  platforms: string[];
  templates: TemplateItem[];
};

type TemplateShard = {
  schemaVersion?: string;
  platform: string;
  templates: TemplateItem[];
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

export class TemplateRegistry {
  private dataDir: string;
  private manifest: Manifest | null = null;
  private shardCache: Map<string, TemplateShard> = new Map();
  private defaultPlatform: string;

  constructor(defaultPlatform: string = 'ios', dataDir?: string) {
    this.defaultPlatform = defaultPlatform;
    this.dataDir = dataDir || path.join(__dirname, '../../data/templates');
  }

  load(platform?: string): TemplateItem[] {
    const targetPlatform = platform || this.defaultPlatform;
    const manifest = this.loadManifest();
    const platforms = manifest.platforms;

    const baseTemplates = this.loadShard('common', false).templates;
    const platformTemplates = targetPlatform && targetPlatform !== 'common'
      ? this.loadShard(targetPlatform, false).templates
      : [];

    const merged = this.mergeTemplates(baseTemplates, platformTemplates, platforms);
    return merged;
  }

  getTemplate(id: string, platform?: string): TemplateItem | null {
    const templates = this.load(platform);
    const map = new Map(templates.map(t => [t.id, t] as const));
    return map.get(id) || null;
  }

  findByName(name: string, platform?: string): TemplateItem | null {
    const templates = this.load(platform);
    const direct = templates.find(t => t.id.endsWith(`:${name}`) || t.id.endsWith(`:${name}_full`));
    if (direct) return direct;
    return templates.find(t => t.id.includes(`:${name}:`) || t.id.includes(`:${name}`)) || null;
  }

  private loadManifest(): Manifest {
    if (this.manifest) return this.manifest;

    const manifestPath = path.join(this.dataDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}. Run 'npm run generate-template-shards' first.`);
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (!manifest.platforms || !Array.isArray(manifest.platforms)) {
      throw new Error('Invalid template manifest: missing platforms');
    }
    if (!manifest.shards || typeof manifest.shards !== 'object') {
      throw new Error('Invalid template manifest: missing shards');
    }

    this.manifest = manifest;
    return manifest;
  }

  private loadShard(platform: string, required: boolean): TemplateShard {
    if (this.shardCache.has(platform)) {
      return this.shardCache.get(platform)!;
    }

    const manifest = this.loadManifest();
    const shardInfo = manifest.shards[platform];
    if (!shardInfo) {
      if (required) {
        throw new Error(`Template shard not found: ${platform}`);
      }
      return { platform, templates: [] };
    }

    const shardPath = path.join(this.dataDir, shardInfo.path);
    const shard: TemplateShard = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
    this.validateShard(shard, manifest.platforms);
    this.shardCache.set(platform, shard);
    return shard;
  }

  private validateShard(shard: TemplateShard, platforms: string[]) {
    if (!shard || !Array.isArray(shard.templates)) {
      throw new Error('Invalid template shard: missing templates');
    }
    if (shard.platform && !platforms.includes(shard.platform)) {
      throw new Error(`Invalid template shard platform: ${shard.platform}`);
    }

    for (const item of shard.templates) {
      this.validateTemplate(item, platforms, shard.platform);
    }
  }

  private validateTemplate(item: TemplateItem, platforms: string[], shardPlatform?: string) {
    if (!item.id || typeof item.id !== 'string') {
      throw new Error('Template id is required');
    }
    if (!/^[a-z0-9_-]+:[a-z0-9_-]+:[a-z0-9_-]+$/i.test(item.id)) {
      throw new Error(`Invalid template id: ${item.id}`);
    }
    if (!item.platform || !platforms.includes(item.platform)) {
      throw new Error(`Invalid template platform: ${item.platform}`);
    }
    if (shardPlatform && item.platform !== shardPlatform) {
      throw new Error(`Template platform mismatch: ${item.id}`);
    }
    if (!item.template || typeof item.template !== 'string') {
      throw new Error(`Template content missing: ${item.id}`);
    }
    if (!Array.isArray(item.variables)) {
      throw new Error(`Template variables missing: ${item.id}`);
    }
  }

  private mergeTemplates(base: TemplateItem[], overrides: TemplateItem[], platforms: string[]): TemplateItem[] {
    const map = new Map<string, TemplateItem>();
    for (const item of base) {
      map.set(item.id, item);
    }
    for (const item of overrides) {
      map.set(item.id, item);
    }

    const resolved = new Map<string, TemplateItem>();
    const resolve = (item: TemplateItem, stack: Set<string>): TemplateItem => {
      if (resolved.has(item.id)) {
        return resolved.get(item.id)!;
      }
      if (item.extends) {
        if (stack.has(item.id)) {
          throw new Error(`Template extends cycle: ${item.id}`);
        }
        const baseItem = map.get(item.extends);
        if (!baseItem) {
          throw new Error(`Template extends missing: ${item.extends}`);
        }
        stack.add(item.id);
        const resolvedBase = resolve(baseItem, stack);
        stack.delete(item.id);
        const merged: TemplateItem = {
          ...resolvedBase,
          ...item,
          variables: item.variables ?? resolvedBase.variables,
          usage: item.usage ?? resolvedBase.usage
        };
        resolved.set(item.id, merged);
        return merged;
      }

      resolved.set(item.id, item);
      return item;
    };

    for (const item of map.values()) {
      this.validateTemplate(item, platforms);
      resolve(item, new Set());
    }

    return Array.from(resolved.values());
  }
}
