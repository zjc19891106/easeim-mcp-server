#!/usr/bin/env npx tsx
/**
 * 文档索引分片生成器
 *
 * 功能：
 * - 将完整的 docs/index.json 拆分为按平台的分片
 * - 生成 manifest.json 记录分片元数据
 * - 提取共享数据（如错误码）到单独分片
 *
 * 优势：
 * - 启动时只加载 manifest (~2KB) 而非完整索引
 * - 按需加载平台分片，减少内存占用
 * - 支持 LRU 缓存自动淘汰不常用分片
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路径配置
const DATA_DIR = path.join(__dirname, '../data/docs');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');
const SHARDS_DIR = path.join(DATA_DIR, 'shards');

// 确保 shards 目录存在
if (!fs.existsSync(SHARDS_DIR)) {
  fs.mkdirSync(SHARDS_DIR, { recursive: true });
}

// 类型定义
interface Guide {
  id: string;
  title: string;
  path: string;
  platform: string;
  product: string;
  keywords: string[];
  description: string;
}

interface ApiModule {
  id: string;
  name: string;
  description: string;
  docPath: string;
  platform: string;
  product: string;
  keywords?: string[];
}

interface ErrorCode {
  code: number;
  name: string;
  brief: string;
  description: string;
  causes: string[];
  solutions: string[];
}

interface DocsIndex {
  version: string;
  lastUpdated: string;
  platforms: string[];
  guides: Guide[];
  apiModules: ApiModule[];
  errorCodeIndex: Record<string, ErrorCode>;
}

interface PlatformShard {
  version: string;
  platform: string;
  lastUpdated: string;
  guides: Guide[];
  apiModules: ApiModule[];
  stats: {
    guideCount: number;
    apiModuleCount: number;
    products: string[];
  };
}

interface ErrorCodeShard {
  version: string;
  lastUpdated: string;
  errorCodes: Record<string, ErrorCode>;
  stats: {
    count: number;
    categories: string[];
  };
}

interface ShardInfo {
  path: string;
  platform: string;
  guideCount: number;
  apiModuleCount: number;
  errorCodeCount: number;
  sizeBytes: number;
  keywords: string[];
}

interface Manifest {
  version: string;
  lastUpdated: string;
  description: string;
  platforms: string[];
  shards: Record<string, ShardInfo>;
  shared: {
    errorCodes: {
      path: string;
      description: string;
      count: number;
      sizeBytes: number;
    };
  };
  stats: {
    totalGuides: number;
    totalApiModules: number;
    totalErrorCodes: number;
  };
}

function main() {
  console.log('📦 开始生成文档索引分片...\n');

  // 读取完整索引
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ 索引文件不存在: ${INDEX_PATH}`);
    process.exit(1);
  }

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  const index: DocsIndex = JSON.parse(indexContent);

  console.log(`📖 读取索引文件: ${INDEX_PATH}`);
  console.log(`   - 版本: ${index.version}`);
  console.log(`   - 平台: ${index.platforms.join(', ')}`);
  console.log(`   - 指南数量: ${index.guides.length}`);
  console.log(`   - API 模块数量: ${index.apiModules.length}`);
  console.log(`   - 错误码数量: ${Object.keys(index.errorCodeIndex).length}`);
  console.log('');

  const now = new Date().toISOString();
  const shards: Record<string, ShardInfo> = {};

  // 按平台分组数据
  for (const platform of index.platforms) {
    console.log(`🔧 处理平台: ${platform}`);

    // 过滤该平台的指南
    const platformGuides = index.guides.filter(g => g.platform === platform);

    // 过滤该平台的 API 模块
    const platformApiModules = index.apiModules.filter(m => m.platform === platform);

    // 提取该平台的产品列表
    const products = [...new Set([
      ...platformGuides.map(g => g.product),
      ...platformApiModules.map(m => m.product)
    ])].filter(Boolean);

    // 提取关键词
    const platformKeywords = getPlatformKeywords(platform);

    // 创建平台分片
    const platformShard: PlatformShard = {
      version: index.version,
      platform,
      lastUpdated: now,
      guides: platformGuides,
      apiModules: platformApiModules,
      stats: {
        guideCount: platformGuides.length,
        apiModuleCount: platformApiModules.length,
        products
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
      guideCount: platformGuides.length,
      apiModuleCount: platformApiModules.length,
      errorCodeCount: 0, // 错误码在共享分片中
      sizeBytes,
      keywords: platformKeywords
    };

    console.log(`   ✅ 生成分片: ${shardPath}`);
    console.log(`      - 指南: ${platformGuides.length}`);
    console.log(`      - API 模块: ${platformApiModules.length}`);
    console.log(`      - 产品: ${products.join(', ')}`);
    console.log(`      - 大小: ${(sizeBytes / 1024).toFixed(2)} KB`);
  }

  // 生成错误码共享分片
  console.log('\n🔧 处理错误码分片...');

  const errorCodeCategories = extractErrorCodeCategories(index.errorCodeIndex);

  const errorCodeShard: ErrorCodeShard = {
    version: index.version,
    lastUpdated: now,
    errorCodes: index.errorCodeIndex,
    stats: {
      count: Object.keys(index.errorCodeIndex).length,
      categories: errorCodeCategories
    }
  };

  const errorCodesShardPath = 'shards/error-codes.json';
  const errorCodesShardFullPath = path.join(DATA_DIR, errorCodesShardPath);
  const errorCodesShardContent = JSON.stringify(errorCodeShard, null, 2);
  fs.writeFileSync(errorCodesShardFullPath, errorCodesShardContent);

  const errorCodesSizeBytes = Buffer.byteLength(errorCodesShardContent, 'utf-8');

  console.log(`   ✅ 生成分片: ${errorCodesShardPath}`);
  console.log(`      - 错误码数量: ${Object.keys(index.errorCodeIndex).length}`);
  console.log(`      - 类别: ${errorCodeCategories.join(', ')}`);
  console.log(`      - 大小: ${(errorCodesSizeBytes / 1024).toFixed(2)} KB`);

  // 生成 manifest
  console.log('\n📋 生成清单文件...');

  const manifest: Manifest = {
    version: index.version,
    lastUpdated: now,
    description: '文档索引清单 - 支持按平台分片加载',
    platforms: index.platforms,
    shards,
    shared: {
      errorCodes: {
        path: errorCodesShardPath,
        description: '跨平台共享的错误码索引',
        count: Object.keys(index.errorCodeIndex).length,
        sizeBytes: errorCodesSizeBytes
      }
    },
    stats: {
      totalGuides: index.guides.length,
      totalApiModules: index.apiModules.length,
      totalErrorCodes: Object.keys(index.errorCodeIndex).length
    }
  };

  const manifestContent = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(MANIFEST_PATH, manifestContent);

  const manifestSizeBytes = Buffer.byteLength(manifestContent, 'utf-8');
  const originalSizeBytes = Buffer.byteLength(indexContent, 'utf-8');
  const totalShardsSizeBytes = Object.values(shards).reduce((sum, s) => sum + s.sizeBytes, 0) + errorCodesSizeBytes;

  console.log(`   ✅ 生成清单: manifest.json`);
  console.log(`      - 大小: ${(manifestSizeBytes / 1024).toFixed(2)} KB`);

  // 输出统计信息
  console.log('\n📊 分片统计:');
  console.log(`   原始索引大小: ${(originalSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   清单文件大小: ${(manifestSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   分片总大小: ${(totalShardsSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`   启动时内存节省: ${((originalSizeBytes - manifestSizeBytes) / 1024).toFixed(2)} KB (${((1 - manifestSizeBytes / originalSizeBytes) * 100).toFixed(1)}%)`);

  console.log('\n✨ 文档索引分片生成完成!');
}

/**
 * 获取平台相关的关键词
 */
function getPlatformKeywords(platform: string): string[] {
  const keywordMap: Record<string, string[]> = {
    ios: ['ios', 'swift', 'objective-c', 'xcode', 'cocoapods', 'spm', 'apple', 'iphone', 'ipad'],
    android: ['android', 'kotlin', 'java', 'gradle', 'maven', 'google', 'apk'],
    flutter: ['flutter', 'dart', 'cross-platform'],
    web: ['web', 'javascript', 'typescript', 'react', 'vue', 'angular'],
    unity: ['unity', 'c#', 'game']
  };
  return keywordMap[platform] || [platform];
}

/**
 * 提取错误码类别
 */
function extractErrorCodeCategories(errorCodeIndex: Record<string, ErrorCode>): string[] {
  const categories = new Set<string>();

  for (const [code, error] of Object.entries(errorCodeIndex)) {
    const codeNum = parseInt(code);

    // 根据错误码范围分类
    if (codeNum < 100) {
      categories.add('通用错误');
    } else if (codeNum < 200) {
      categories.add('参数错误');
    } else if (codeNum < 300) {
      categories.add('用户错误');
    } else if (codeNum < 400) {
      categories.add('服务器错误');
    } else if (codeNum < 500) {
      categories.add('文件错误');
    } else if (codeNum < 600) {
      categories.add('消息错误');
    } else if (codeNum < 700) {
      categories.add('群组错误');
    } else if (codeNum < 800) {
      categories.add('聊天室错误');
    } else if (codeNum < 1000) {
      categories.add('用户属性错误');
    } else if (codeNum < 1100) {
      categories.add('联系人错误');
    } else if (codeNum < 1200) {
      categories.add('在线状态错误');
    } else if (codeNum < 1300) {
      categories.add('翻译错误');
    } else if (codeNum < 1400) {
      categories.add('Reaction错误');
    } else {
      categories.add('子区错误');
    }
  }

  return Array.from(categories);
}

main();
