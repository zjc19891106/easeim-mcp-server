#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/lexicon');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');
const SHARDS_DIR = path.join(DATA_DIR, 'shards');

if (!fs.existsSync(SHARDS_DIR)) {
  fs.mkdirSync(SHARDS_DIR, { recursive: true });
}

type LexiconIndex = {
  version: string;
  lastUpdated: string;
  platforms: string[];
  synonyms: Record<string, Record<string, string[]>>;
  abbreviations: Record<string, Record<string, string[]>>;
  stopWords: Record<string, string[]>;
  dictionary: Record<string, { coreTerms?: string[]; uikitTerms?: string[]; codeTerms?: string[]; pinyinTerms?: string[] }>;
  highFrequency: Record<string, Record<string, number>>;
  popularTerms: Record<string, Record<string, number>>;
  categoryKeywords: Record<string, Record<string, string[]>>;
};

type LexiconShard = {
  schemaVersion: string;
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
  sizeBytes: number;
  synonymCount: number;
  abbreviationCount: number;
  stopWordCount: number;
};

type Manifest = {
  schemaVersion: string;
  version: string;
  lastUpdated: string;
  description: string;
  platforms: string[];
  shards: Record<string, ShardInfo>;
};

function main() {
  console.log('📦 开始生成词库分片...\n');

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ 索引文件不存在: ${INDEX_PATH}`);
    process.exit(1);
  }

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  const index: LexiconIndex = JSON.parse(indexContent);

  console.log(`📖 读取索引文件: ${INDEX_PATH}`);
  console.log(`   - 版本: ${index.version}`);
  console.log(`   - 平台: ${index.platforms.join(', ')}`);
  console.log('');

  const now = new Date().toISOString();
  const shards: Record<string, ShardInfo> = {};

  for (const platform of index.platforms) {
    console.log(`🔧 处理平台: ${platform}`);

    const shard: LexiconShard = {
      schemaVersion: '1.0',
      platform,
      synonyms: index.synonyms[platform] || {},
      abbreviations: index.abbreviations[platform] || {},
      stopWords: index.stopWords[platform] || [],
      dictionary: {
        coreTerms: index.dictionary[platform]?.coreTerms || [],
        uikitTerms: index.dictionary[platform]?.uikitTerms || [],
        codeTerms: index.dictionary[platform]?.codeTerms || [],
        pinyinTerms: index.dictionary[platform]?.pinyinTerms || []
      },
      highFrequency: index.highFrequency[platform] || {},
      popularTerms: index.popularTerms[platform] || {},
      categoryKeywords: index.categoryKeywords[platform] || {}
    };

    const shardPath = `shards/${platform}.json`;
    const shardFullPath = path.join(DATA_DIR, shardPath);
    const shardContent = JSON.stringify(shard, null, 2);
    fs.writeFileSync(shardFullPath, shardContent);

    shards[platform] = {
      path: shardPath,
      platform,
      sizeBytes: Buffer.byteLength(shardContent, 'utf-8'),
      synonymCount: Object.keys(shard.synonyms).length,
      abbreviationCount: Object.keys(shard.abbreviations).length,
      stopWordCount: shard.stopWords.length
    };

    console.log(`   ✅ 生成分片: ${shardPath}`);
    console.log(`      - 同义词: ${shards[platform].synonymCount}`);
    console.log(`      - 缩写: ${shards[platform].abbreviationCount}`);
    console.log(`      - 停用词: ${shards[platform].stopWordCount}`);
    console.log(`      - 大小: ${(shards[platform].sizeBytes / 1024).toFixed(2)} KB`);
  }

  const manifest: Manifest = {
    schemaVersion: '1.0',
    version: index.version,
    lastUpdated: now,
    description: '搜索词库分片清单',
    platforms: index.platforms,
    shards
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('\n✨ 词库分片生成完成!');
}

main();
