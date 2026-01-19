import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ClassInfo = {
  name: string;
  description: string;
  superclass: string | null;
  protocols: string[];
  isOpen: boolean;
  file: string;
  keyMethods: string[];
  keyProperties: string[];
  usageScenarios: string[];
  platform: string;
};

type InheritanceItem = {
  superclass: string;
  subclasses: string[];
  platform: string;
};

type ClassIndex = {
  version: string;
  lastUpdated: string;
  platforms: string[];
  classes: ClassInfo[];
  inheritance: InheritanceItem[];
};

type ClassShard = {
  schemaVersion?: string;
  platform: string;
  classes: ClassInfo[];
  inheritance: InheritanceItem[];
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

export class ClassRegistry {
  private dataDir: string;
  private manifest: Manifest | null = null;
  private shardCache: Map<string, ClassShard> = new Map();
  private defaultPlatform: string;

  constructor(defaultPlatform: string = 'ios', dataDir?: string) {
    this.defaultPlatform = defaultPlatform;
    this.dataDir = dataDir || path.join(__dirname, '../../data/classes');
  }

  load(platform?: string): ClassInfo[] {
    const targetPlatform = platform || this.defaultPlatform;
    const manifest = this.loadManifest();

    const baseClasses = this.loadShard('common', false).classes;
    const platformClasses = targetPlatform && targetPlatform !== 'common'
      ? this.loadShard(targetPlatform, false).classes
      : [];

    return this.mergeClasses(baseClasses, platformClasses, manifest.platforms);
  }

  getClassInfo(name: string, platform?: string): ClassInfo | null {
    const classes = this.load(platform);
    return classes.find(c => c.name === name) || null;
  }

  getInheritanceChain(className: string, platform?: string): string[] {
    const map = this.getInheritanceMap(platform);
    const chain: string[] = [className];
    const classInfo = this.getClassInfo(className, platform);
    if (classInfo?.superclass) {
      chain.push(...this.getInheritanceChain(classInfo.superclass, platform));
    }
    return chain;
  }

  getSubclasses(className: string, platform?: string): string[] {
    const map = this.getInheritanceMap(platform);
    return map.get(className) || [];
  }

  private getInheritanceMap(platform?: string): Map<string, string[]> {
    const targetPlatform = platform || this.defaultPlatform;
    const manifest = this.loadManifest();

    const baseItems = this.loadShard('common', false).inheritance;
    const platformItems = targetPlatform && targetPlatform !== 'common'
      ? this.loadShard(targetPlatform, false).inheritance
      : [];

    const items = [...baseItems, ...platformItems].filter(i => manifest.platforms.includes(i.platform));
    const map = new Map<string, string[]>();

    for (const item of items) {
      const existing = map.get(item.superclass) || [];
      map.set(item.superclass, [...new Set([...existing, ...item.subclasses])]);
    }

    return map;
  }

  private loadManifest(): Manifest {
    if (this.manifest) return this.manifest;

    const manifestPath = path.join(this.dataDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}. Run 'npm run generate-class-shards' first.`);
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (!manifest.platforms || !Array.isArray(manifest.platforms)) {
      throw new Error('Invalid class manifest: missing platforms');
    }
    if (!manifest.shards || typeof manifest.shards !== 'object') {
      throw new Error('Invalid class manifest: missing shards');
    }

    this.manifest = manifest;
    return manifest;
  }

  private loadShard(platform: string, required: boolean): ClassShard {
    if (this.shardCache.has(platform)) {
      return this.shardCache.get(platform)!;
    }

    const manifest = this.loadManifest();
    const shardInfo = manifest.shards[platform];
    if (!shardInfo) {
      if (required) {
        throw new Error(`Class shard not found: ${platform}`);
      }
      return { platform, classes: [], inheritance: [] };
    }

    const shardPath = path.join(this.dataDir, shardInfo.path);
    const shard: ClassShard = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
    this.validateShard(shard, manifest.platforms);
    this.shardCache.set(platform, shard);
    return shard;
  }

  private validateShard(shard: ClassShard, platforms: string[]) {
    if (!shard || !Array.isArray(shard.classes) || !Array.isArray(shard.inheritance)) {
      throw new Error('Invalid class shard: missing classes or inheritance');
    }
    if (shard.platform && !platforms.includes(shard.platform)) {
      throw new Error(`Invalid class shard platform: ${shard.platform}`);
    }

    for (const item of shard.classes) {
      this.validateClassInfo(item, platforms, shard.platform);
    }
  }

  private validateClassInfo(item: ClassInfo, platforms: string[], shardPlatform?: string) {
    if (!item.name || typeof item.name !== 'string') {
      throw new Error('Class name is required');
    }
    if (!item.platform || !platforms.includes(item.platform)) {
      throw new Error(`Invalid class platform: ${item.name}`);
    }
    if (shardPlatform && item.platform !== shardPlatform) {
      throw new Error(`Class platform mismatch: ${item.name}`);
    }
    if (!item.file || typeof item.file !== 'string') {
      throw new Error(`Class file missing: ${item.name}`);
    }
  }

  private mergeClasses(base: ClassInfo[], overrides: ClassInfo[], platforms: string[]): ClassInfo[] {
    const map = new Map<string, ClassInfo>();
    for (const item of base) {
      map.set(item.name, item);
    }
    for (const item of overrides) {
      map.set(item.name, item);
    }

    const resolved = new Map<string, ClassInfo>();
    for (const item of map.values()) {
      this.validateClassInfo(item, platforms);
      resolved.set(item.name, item);
    }

    return Array.from(resolved.values());
  }
}
