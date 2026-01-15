#!/usr/bin/env npx tsx
/**
 * 配置索引分片生成器
 *
 * 功能：
 * - 将完整的 configs/index.json 拆分为按平台的分片
 * - 生成 manifest.json 记录分片元数据
 *
 * 优势：
 * - 启动时只加载 manifest 而非完整索引
 * - 按需加载平台分片，减少内存占用
 * - 支持 LRU 缓存自动淘汰不常用分片
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路径配置
const DATA_DIR = path.join(__dirname, '../data/configs');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');
const SHARDS_DIR = path.join(DATA_DIR, 'shards');

// 确保 shards 目录存在
if (!fs.existsSync(SHARDS_DIR)) {
  fs.mkdirSync(SHARDS_DIR, { recursive: true });
}

// 类型定义
interface ConfigProperty {
  name: string;
  type: string;
  defaultValue: string;
  description: string;
  file: string;
  line: number;
}

interface ExtensionPoint {
  name: string;
  type: 'protocol' | 'class';
  description?: string;
  file: string;
  line: number;
  methods?: string[];
}

interface ComponentConfig {
  name: string;
  description: string;
  configProperties: ConfigProperty[];
  extensionPoints: ExtensionPoint[];
}

interface ConfigIndex {
  version: string;
  lastUpdated: string;
  components: Record<string, ComponentConfig>;
}

interface PlatformShard {
  version: string;
  platform: string;
  lastUpdated: string;
  components: Record<string, ComponentConfig>;
  stats: {
    componentCount: number;
    configPropertyCount: number;
    extensionPointCount: number;
  };
}

interface ShardInfo {
  path: string;
  platform: string;
  componentCount: number;
  configPropertyCount: number;
  extensionPointCount: number;
  sizeBytes: number;
  components: string[];
}

interface Manifest {
  version: string;
  lastUpdated: string;
  description: string;
  platforms: string[];
  shards: Record<string, ShardInfo>;
  stats: {
    totalComponents: number;
    totalConfigProperties: number;
    totalExtensionPoints: number;
  };
}

/**
 * 从组件文件路径中提取平台
 */
function extractPlatformFromPath(filePath: string): string {
  // 从路径中提取平台，例如 "ios/EaseChatUIKit/..." -> "ios"
  const parts = filePath.split('/');
  if (parts.length > 0) {
    const platform = parts[0].toLowerCase();
    if (['ios', 'android', 'flutter', 'web', 'unity'].includes(platform)) {
      return platform;
    }
  }
  return 'ios'; // 默认平台
}

/**
 * 从组件名称推断平台
 */
function inferPlatformFromComponent(componentName: string, component: ComponentConfig): string {
  // 优先从配置属性的文件路径推断
  if (component.configProperties.length > 0) {
    return extractPlatformFromPath(component.configProperties[0].file);
  }

  // 从扩展点的文件路径推断
  if (component.extensionPoints.length > 0) {
    return extractPlatformFromPath(component.extensionPoints[0].file);
  }

  // 默认平台
  return 'ios';
}

function main() {
  console.log('📦 开始生成配置索引分片...\n');

  // 读取完整索引
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ 索引文件不存在: ${INDEX_PATH}`);
    process.exit(1);
  }

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  const index: ConfigIndex = JSON.parse(indexContent);

  const componentCount = Object.keys(index.components).length;
  const configPropertyCount = Object.values(index.components)
    .reduce((sum, c) => sum + c.configProperties.length, 0);
  const extensionPointCount = Object.values(index.components)
    .reduce((sum, c) => sum + c.extensionPoints.length, 0);

  console.log(`📖 读取索引文件: ${INDEX_PATH}`);
  console.log(`   - 版本: ${index.version}`);
  console.log(`   - 组件数量: ${componentCount}`);
  console.log(`   - 配置属性数量: ${configPropertyCount}`);
  console.log(`   - 扩展点数量: ${extensionPointCount}`);
  console.log('');

  const now = new Date().toISOString();

  // 按平台分组组件
  const platformComponents: Record<string, Record<string, ComponentConfig>> = {};

  for (const [componentName, component] of Object.entries(index.components)) {
    const platform = inferPlatformFromComponent(componentName, component);

    if (!platformComponents[platform]) {
      platformComponents[platform] = {};
    }

    platformComponents[platform][componentName] = component;
  }

  const platforms = Object.keys(platformComponents);
  const shards: Record<string, ShardInfo> = {};

  // 生成各平台分片
  for (const platform of platforms) {
    console.log(`🔧 处理平台: ${platform}`);

    const components = platformComponents[platform];
    const componentNames = Object.keys(components);

    const platformConfigPropertyCount = Object.values(components)
      .reduce((sum, c) => sum + c.configProperties.length, 0);
    const platformExtensionPointCount = Object.values(components)
      .reduce((sum, c) => sum + c.extensionPoints.length, 0);

    // 创建平台分片
    const platformShard: PlatformShard = {
      version: index.version,
      platform,
      lastUpdated: now,
      components,
      stats: {
        componentCount: componentNames.length,
        configPropertyCount: platformConfigPropertyCount,
        extensionPointCount: platformExtensionPointCount
      }
    };

    // 写入分片文件
    const shardPath = `shards/${platform}.json`;
    const shardFullPath = path.join(DATA_DIR, shardPath);
    const shardContent = JSON.stringify(platformShard, null, 2);
    fs.writeFileSync(shardFullPath, shardContent);

    const sizeBytes = Buffer.byteLength(shardContent, 'utf-8');

    shards[platform] = {
      path: shardPath,
      platform,
      componentCount: componentNames.length,
      configPropertyCount: platformConfigPropertyCount,
      extensionPointCount: platformExtensionPointCount,
      sizeBytes,
      components: componentNames
    };

    console.log(`   ✅ 生成分片: ${shardPath}`);
    console.log(`      - 组件: ${componentNames.length}`);
    console.log(`      - 配置属性: ${platformConfigPropertyCount}`);
    console.log(`      - 扩展点: ${platformExtensionPointCount}`);
    console.log(`      - 大小: ${(sizeBytes / 1024).toFixed(2)} KB`);
  }

  // 生成 manifest
  console.log('\n📋 生成清单文件...');

  const manifest: Manifest = {
    version: index.version,
    lastUpdated: now,
    description: '配置索引清单 - 支持按平台分片加载',
    platforms,
    shards,
    stats: {
      totalComponents: componentCount,
      totalConfigProperties: configPropertyCount,
      totalExtensionPoints: extensionPointCount
    }
  };

  const manifestContent = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(MANIFEST_PATH, manifestContent);

  const manifestSizeBytes = Buffer.byteLength(manifestContent, 'utf-8');
  const originalSizeBytes = Buffer.byteLength(indexContent, 'utf-8');
  const totalShardsSizeBytes = Object.values(shards).reduce((sum, s) => sum + s.sizeBytes, 0);

  console.log(`   ✅ 生成清单: manifest.json`);
  console.log(`      - 大小: ${(manifestSizeBytes / 1024).toFixed(2)} KB`);

  // 输出统计信息
  console.log('\n📊 分片统计:');
  console.log(`   原始索引大小: ${(originalSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   清单文件大小: ${(manifestSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   分片总大小: ${(totalShardsSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   启动时内存节省: ${((originalSizeBytes - manifestSizeBytes) / 1024).toFixed(2)} KB (${((1 - manifestSizeBytes / originalSizeBytes) * 100).toFixed(1)}%)`);

  console.log('\n✨ 配置索引分片生成完成!');
}

main();
