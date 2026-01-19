#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/classes');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');
const SHARDS_DIR = path.join(DATA_DIR, 'shards');

if (!fs.existsSync(SHARDS_DIR)) {
  fs.mkdirSync(SHARDS_DIR, { recursive: true });
}

type ClassInfo = {
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
  schemaVersion: string;
  platform: string;
  classes: ClassInfo[];
  inheritance: InheritanceItem[];
};

type ShardInfo = {
  path: string;
  platform: string;
  classCount: number;
  inheritanceCount: number;
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
  console.log('📦 开始生成类信息分片...\n');

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ 索引文件不存在: ${INDEX_PATH}`);
    process.exit(1);
  }

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  const index: ClassIndex = JSON.parse(indexContent);

  console.log(`📖 读取索引文件: ${INDEX_PATH}`);
  console.log(`   - 版本: ${index.version}`);
  console.log(`   - 平台: ${index.platforms.join(', ')}`);
  console.log(`   - 类数量: ${index.classes.length}`);
  console.log(`   - 继承关系数量: ${index.inheritance.length}`);
  console.log('');

  const now = new Date().toISOString();
  const shards: Record<string, ShardInfo> = {};

  for (const platform of index.platforms) {
    console.log(`🔧 处理平台: ${platform}`);

    const platformClasses = index.classes.filter(c => c.platform === platform);
    const platformInheritance = index.inheritance.filter(i => i.platform === platform);

    const platformShard: ClassShard = {
      schemaVersion: '1.0',
      platform,
      classes: platformClasses,
      inheritance: platformInheritance
    };

    const shardPath = `shards/${platform}.json`;
    const shardFullPath = path.join(DATA_DIR, shardPath);
    const shardContent = JSON.stringify(platformShard, null, 2);
    fs.writeFileSync(shardFullPath, shardContent);

    shards[platform] = {
      path: shardPath,
      platform,
      classCount: platformClasses.length,
      inheritanceCount: platformInheritance.length,
      sizeBytes: Buffer.byteLength(shardContent, 'utf-8')
    };

    console.log(`   ✅ 生成分片: ${shardPath}`);
    console.log(`      - 类: ${platformClasses.length}`);
    console.log(`      - 继承关系: ${platformInheritance.length}`);
    console.log(`      - 大小: ${(shards[platform].sizeBytes / 1024).toFixed(2)} KB`);
  }

  const manifest: Manifest = {
    schemaVersion: '1.0',
    version: index.version,
    lastUpdated: now,
    description: '类信息分片清单',
    platforms: index.platforms,
    shards
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('\n✨ 类信息分片生成完成!');
}

main();
