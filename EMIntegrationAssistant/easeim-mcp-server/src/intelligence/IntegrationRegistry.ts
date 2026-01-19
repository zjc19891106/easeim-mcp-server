import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type PlatformRequirement = {
  component: string;
  minVersion: string;
  xcodeVersion?: string;
  cocoapodsVersion?: string;
  notes?: string[];
  platform: string;
};

export type IntegrationSolution = {
  description: string;
  codeExample?: string;
  fileToModify?: string;
  settingPath?: string;
};

export type IntegrationProblem = {
  id: string;
  keywords: string[];
  errorPatterns: string[];
  symptom: string;
  cause: string;
  solutions: IntegrationSolution[];
  relatedComponents?: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  platform: string;
};

type IntegrationIndex = {
  version: string;
  lastUpdated: string;
  platforms: string[];
  requirements: PlatformRequirement[];
  problems: IntegrationProblem[];
  podfileTemplates: Record<string, string>;
};

type IntegrationShard = {
  schemaVersion?: string;
  platform: string;
  requirements: PlatformRequirement[];
  problems: IntegrationProblem[];
  podfileTemplates: Record<string, string>;
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

export class IntegrationRegistry {
  private dataDir: string;
  private manifest: Manifest | null = null;
  private shardCache: Map<string, IntegrationShard> = new Map();
  private defaultPlatform: string;

  constructor(defaultPlatform: string = 'ios', dataDir?: string) {
    this.defaultPlatform = defaultPlatform;
    this.dataDir = dataDir || path.join(__dirname, '../../data/integration');
  }

  getRequirement(component: string, platform?: string): PlatformRequirement | null {
    const requirements = this.load(platform);
    return requirements.find(r => r.component === component) || null;
  }

  getAllRequirements(platform?: string): PlatformRequirement[] {
    return this.load(platform);
  }

  getProblems(platform?: string): IntegrationProblem[] {
    return this.loadProblems(platform);
  }

  getPodfileTemplate(component: string, platform?: string): string | null {
    const shard = this.loadShard(platform || this.defaultPlatform, false);
    return shard.podfileTemplates[component] || null;
  }

  private load(platform?: string): PlatformRequirement[] {
    const targetPlatform = platform || this.defaultPlatform;
    const manifest = this.loadManifest();

    const baseRequirements = this.loadShard('common', false).requirements;
    const platformRequirements = targetPlatform && targetPlatform !== 'common'
      ? this.loadShard(targetPlatform, false).requirements
      : [];

    return this.mergeRequirements(baseRequirements, platformRequirements, manifest.platforms);
  }

  private loadProblems(platform?: string): IntegrationProblem[] {
    const targetPlatform = platform || this.defaultPlatform;
    const manifest = this.loadManifest();

    const baseProblems = this.loadShard('common', false).problems;
    const platformProblems = targetPlatform && targetPlatform !== 'common'
      ? this.loadShard(targetPlatform, false).problems
      : [];

    return this.mergeProblems(baseProblems, platformProblems, manifest.platforms);
  }

  private loadManifest(): Manifest {
    if (this.manifest) return this.manifest;

    const manifestPath = path.join(this.dataDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}. Run 'npm run generate-integration-shards' first.`);
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (!manifest.platforms || !Array.isArray(manifest.platforms)) {
      throw new Error('Invalid integration manifest: missing platforms');
    }
    if (!manifest.shards || typeof manifest.shards !== 'object') {
      throw new Error('Invalid integration manifest: missing shards');
    }

    this.manifest = manifest;
    return manifest;
  }

  private loadShard(platform: string, required: boolean): IntegrationShard {
    if (this.shardCache.has(platform)) {
      return this.shardCache.get(platform)!;
    }

    const manifest = this.loadManifest();
    const shardInfo = manifest.shards[platform];
    if (!shardInfo) {
      if (required) {
        throw new Error(`Integration shard not found: ${platform}`);
      }
      return { platform, requirements: [], problems: [], podfileTemplates: {} };
    }

    const shardPath = path.join(this.dataDir, shardInfo.path);
    const shard: IntegrationShard = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
    this.validateShard(shard, manifest.platforms);
    this.shardCache.set(platform, shard);
    return shard;
  }

  private validateShard(shard: IntegrationShard, platforms: string[]) {
    if (!shard || !Array.isArray(shard.requirements) || !Array.isArray(shard.problems)) {
      throw new Error('Invalid integration shard: missing requirements or problems');
    }
    if (shard.platform && !platforms.includes(shard.platform)) {
      throw new Error(`Invalid integration shard platform: ${shard.platform}`);
    }
  }

  private mergeRequirements(base: PlatformRequirement[], overrides: PlatformRequirement[], platforms: string[]): PlatformRequirement[] {
    const map = new Map<string, PlatformRequirement>();
    for (const item of base) {
      map.set(item.component, item);
    }
    for (const item of overrides) {
      map.set(item.component, item);
    }

    const resolved = new Map<string, PlatformRequirement>();
    for (const item of map.values()) {
      if (!platforms.includes(item.platform)) {
        continue;
      }
      resolved.set(item.component, item);
    }

    return Array.from(resolved.values());
  }

  private mergeProblems(base: IntegrationProblem[], overrides: IntegrationProblem[], platforms: string[]): IntegrationProblem[] {
    const map = new Map<string, IntegrationProblem>();
    for (const item of base) {
      map.set(item.id, item);
    }
    for (const item of overrides) {
      map.set(item.id, item);
    }

    const resolved = new Map<string, IntegrationProblem>();
    for (const item of map.values()) {
      if (!platforms.includes(item.platform)) {
        continue;
      }
      resolved.set(item.id, item);
    }

    return Array.from(resolved.values());
  }
}
