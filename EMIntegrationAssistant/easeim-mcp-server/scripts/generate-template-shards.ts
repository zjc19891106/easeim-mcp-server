#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/templates');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');
const SHARDS_DIR = path.join(DATA_DIR, 'shards');

if (!fs.existsSync(SHARDS_DIR)) {
  fs.mkdirSync(SHARDS_DIR, { recursive: true });
}

interface TemplateVariable {
  name: string;
  type: string;
  required: boolean;
  default?: string;
}

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  platform: string;
  domain: string;
  variables: TemplateVariable[];
  template: string;
  usage: string[];
  extends?: string;
}

interface TemplateIndex {
  version: string;
  lastUpdated: string;
  platforms: string[];
  templates: TemplateItem[];
}

interface TemplateShard {
  schemaVersion: string;
  platform: string;
  templates: TemplateItem[];
}

interface ShardInfo {
  path: string;
  platform: string;
  templateCount: number;
  sizeBytes: number;
  keywords: string[];
}

interface Manifest {
  schemaVersion: string;
  version: string;
  lastUpdated: string;
  description: string;
  platforms: string[];
  shards: Record<string, ShardInfo>;
}

function getPlatformKeywords(platform: string): string[] {
  const keywordMap: Record<string, string[]> = {
    common: ['common', 'shared', 'base'],
    ios: ['ios', 'swift', 'uikit', 'xcode', 'cocoapods'],
    android: ['android', 'kotlin', 'java', 'gradle'],
    flutter: ['flutter', 'dart'],
    web: ['web', 'javascript', 'typescript', 'react'],
    unity: ['unity', 'c#']
  };
  return keywordMap[platform] || [platform];
}

function main() {
  console.log('📦 开始生成模板分片...\n');

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ 索引文件不存在: ${INDEX_PATH}`);
    process.exit(1);
  }

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  const index: TemplateIndex = JSON.parse(indexContent);

  console.log(`📖 读取索引文件: ${INDEX_PATH}`);
  console.log(`   - 版本: ${index.version}`);
  console.log(`   - 平台: ${index.platforms.join(', ')}`);
  console.log(`   - 模板数量: ${index.templates.length}`);
  console.log('');

  const now = new Date().toISOString();
  const shards: Record<string, ShardInfo> = {};

  for (const platform of index.platforms) {
    console.log(`🔧 处理平台: ${platform}`);

    const platformTemplates = index.templates.filter(t => t.platform === platform);

    const platformShard: TemplateShard = {
      schemaVersion: '1.0',
      platform,
      templates: platformTemplates
    };

    const shardPath = `shards/${platform}.json`;
    const shardFullPath = path.join(DATA_DIR, shardPath);
    const shardContent = JSON.stringify(platformShard, null, 2);
    fs.writeFileSync(shardFullPath, shardContent);

    const sizeBytes = Buffer.byteLength(shardContent, 'utf-8');

    shards[platform] = {
      path: shardPath,
      platform,
      templateCount: platformTemplates.length,
      sizeBytes,
      keywords: getPlatformKeywords(platform)
    };

    console.log(`   ✅ 生成分片: ${shardPath}`);
    console.log(`      - 模板: ${platformTemplates.length}`);
    console.log(`      - 大小: ${(sizeBytes / 1024).toFixed(2)} KB`);
  }

  const manifest: Manifest = {
    schemaVersion: '1.0',
    version: index.version,
    lastUpdated: now,
    description: '模板分片清单',
    platforms: index.platforms,
    shards
  };

  const manifestContent = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(MANIFEST_PATH, manifestContent);

  const manifestSizeBytes = Buffer.byteLength(manifestContent, 'utf-8');
  const originalSizeBytes = Buffer.byteLength(indexContent, 'utf-8');
  const totalShardsSizeBytes = Object.values(shards).reduce((sum, s) => sum + s.sizeBytes, 0);

  console.log(`\n📋 生成清单: manifest.json`);
  console.log(`   - 大小: ${(manifestSizeBytes / 1024).toFixed(2)} KB`);

  console.log('\n📊 分片统计:');
  console.log(`   原始索引大小: ${(originalSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   清单文件大小: ${(manifestSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   分片总大小: ${(totalShardsSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   启动时内存节省: ${((originalSizeBytes - manifestSizeBytes) / 1024).toFixed(2)} KB (${((1 - manifestSizeBytes / originalSizeBytes) * 100).toFixed(1)}%)`);

  console.log('\n✨ 模板分片生成完成!');
}

main();
