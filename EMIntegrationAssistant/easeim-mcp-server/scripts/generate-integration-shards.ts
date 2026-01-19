#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/integration');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');
const SHARDS_DIR = path.join(DATA_DIR, 'shards');

if (!fs.existsSync(SHARDS_DIR)) {
  fs.mkdirSync(SHARDS_DIR, { recursive: true });
}

type PlatformRequirement = {
  component: string;
  minVersion: string;
  xcodeVersion?: string;
  cocoapodsVersion?: string;
  notes?: string[];
  platform: string;
};

type IntegrationSolution = {
  description: string;
  codeExample?: string;
  fileToModify?: string;
  settingPath?: string;
};

type IntegrationProblem = {
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
  schemaVersion: string;
  platform: string;
  requirements: PlatformRequirement[];
  problems: IntegrationProblem[];
  podfileTemplates: Record<string, string>;
};

type ShardInfo = {
  path: string;
  platform: string;
  requirementCount: number;
  problemCount: number;
  templateCount: number;
  sizeBytes: number;
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
  console.log('📦 开始生成集成诊断分片...\n');

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ 索引文件不存在: ${INDEX_PATH}`);
    process.exit(1);
  }

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  const index: IntegrationIndex = JSON.parse(indexContent);

  console.log(`📖 读取索引文件: ${INDEX_PATH}`);
  console.log(`   - 版本: ${index.version}`);
  console.log(`   - 平台: ${index.platforms.join(', ')}`);
  console.log(`   - 要求数量: ${index.requirements.length}`);
  console.log(`   - 问题数量: ${index.problems.length}`);
  console.log(`   - 模板数量: ${Object.keys(index.podfileTemplates).length}`);
  console.log('');

  const now = new Date().toISOString();
  const shards: Record<string, ShardInfo> = {};

  for (const platform of index.platforms) {
    console.log(`🔧 处理平台: ${platform}`);

    const requirements = index.requirements.filter(r => r.platform === platform);
    const problems = index.problems.filter(p => p.platform === platform);
    const podfileTemplates = platform === 'ios' ? index.podfileTemplates : {};

    const shard: IntegrationShard = {
      schemaVersion: '1.0',
      platform,
      requirements,
      problems,
      podfileTemplates
    };

    const shardPath = `shards/${platform}.json`;
    const shardFullPath = path.join(DATA_DIR, shardPath);
    const shardContent = JSON.stringify(shard, null, 2);
    fs.writeFileSync(shardFullPath, shardContent);

    shards[platform] = {
      path: shardPath,
      platform,
      requirementCount: requirements.length,
      problemCount: problems.length,
      templateCount: Object.keys(podfileTemplates).length,
      sizeBytes: Buffer.byteLength(shardContent, 'utf-8')
    };

    console.log(`   ✅ 生成分片: ${shardPath}`);
    console.log(`      - 要求: ${requirements.length}`);
    console.log(`      - 问题: ${problems.length}`);
    console.log(`      - 模板: ${Object.keys(podfileTemplates).length}`);
    console.log(`      - 大小: ${(shards[platform].sizeBytes / 1024).toFixed(2)} KB`);
  }

  const manifest: Manifest = {
    schemaVersion: '1.0',
    version: index.version,
    lastUpdated: now,
    description: '集成诊断分片清单',
    platforms: index.platforms,
    shards
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('\n✨ 集成诊断分片生成完成!');
}

main();
