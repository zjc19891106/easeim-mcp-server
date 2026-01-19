import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type LexiconShard = {
  platform: string;
  synonyms: Record<string, string[]>;
  abbreviations: Record<string, string[]>;
  stopWords: string[];
  dictionary: { coreTerms: string[]; uikitTerms: string[]; codeTerms: string[]; pinyinTerms: string[] };
  highFrequency: Record<string, number>;
  popularTerms: Record<string, number>;
  categoryKeywords: Record<string, string[]>;
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

export class LexiconRegistry {
  private dataDir: string;
  private manifest: Manifest | null = null;
  private shardCache: Map<string, LexiconShard> = new Map();
  private defaultPlatform: string;

  constructor(defaultPlatform: string = 'common', dataDir?: string) {
    this.defaultPlatform = defaultPlatform;
    this.dataDir = dataDir || path.join(__dirname, '../../data/lexicon');
  }

  load(platform?: string): LexiconShard {
    const targetPlatform = platform || this.defaultPlatform;
    const manifest = this.loadManifest();

    const baseShard = this.loadShard('common', false);
    const platformShard = targetPlatform && targetPlatform !== 'common'
      ? this.loadShard(targetPlatform, false)
      : null;

    if (!platformShard) {
      return baseShard;
    }

    return {
      platform: targetPlatform,
      synonyms: { ...baseShard.synonyms, ...platformShard.synonyms },
      abbreviations: { ...baseShard.abbreviations, ...platformShard.abbreviations },
      stopWords: [...new Set([...baseShard.stopWords, ...platformShard.stopWords])],
      dictionary: {
        coreTerms: [...new Set([...baseShard.dictionary.coreTerms, ...platformShard.dictionary.coreTerms])],
        uikitTerms: [...new Set([...baseShard.dictionary.uikitTerms, ...platformShard.dictionary.uikitTerms])],
        codeTerms: [...new Set([...baseShard.dictionary.codeTerms, ...platformShard.dictionary.codeTerms])],
        pinyinTerms: [...new Set([...baseShard.dictionary.pinyinTerms, ...platformShard.dictionary.pinyinTerms])]
      },
      highFrequency: { ...baseShard.highFrequency, ...platformShard.highFrequency },
      popularTerms: { ...baseShard.popularTerms, ...platformShard.popularTerms },
      categoryKeywords: { ...baseShard.categoryKeywords, ...platformShard.categoryKeywords }
    };
  }

  private loadManifest(): Manifest {
    if (this.manifest) return this.manifest;

    const manifestPath = path.join(this.dataDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}. Run 'npm run generate-lexicon-shards' first.`);
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (!manifest.platforms || !Array.isArray(manifest.platforms)) {
      throw new Error('Invalid lexicon manifest: missing platforms');
    }
    if (!manifest.shards || typeof manifest.shards !== 'object') {
      throw new Error('Invalid lexicon manifest: missing shards');
    }

    this.manifest = manifest;
    return manifest;
  }

  private loadShard(platform: string, required: boolean): LexiconShard {
    if (this.shardCache.has(platform)) {
      return this.shardCache.get(platform)!;
    }

    const manifest = this.loadManifest();
    const shardInfo = manifest.shards[platform];
    if (!shardInfo) {
      if (required) {
        throw new Error(`Lexicon shard not found: ${platform}`);
      }
      return {
        platform,
        synonyms: {},
        abbreviations: {},
        stopWords: [],
        dictionary: { coreTerms: [], uikitTerms: [], codeTerms: [], pinyinTerms: [] },
        highFrequency: {},
        popularTerms: {},
        categoryKeywords: {}
      };
    }

    const shardPath = path.join(this.dataDir, shardInfo.path);
    const shard: LexiconShard = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
    this.shardCache.set(platform, shard);
    return shard;
  }
}
