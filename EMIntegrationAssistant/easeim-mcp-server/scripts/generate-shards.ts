#!/usr/bin/env npx tsx
/**
 * 源码索引分片生成器
 * 将单一大索引拆分为按组件划分的分片索引
 *
 * 输出结构:
 * data/sources/
 * ├── manifest.json          # 元数据清单
 * └── shards/
 *     ├── EaseChatUIKit.json
 *     ├── EaseCallUIKit.json
 *     ├── EaseChatroomUIKit.json
 *     └── EaseChatDemo.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SourceFile {
  path: string;
  platform: string;
  component: string;
  classes: string[];
  lines?: number;
  keywords?: string[];
  description?: string;
  tags?: string[];
}

interface CodeSymbol {
  name: string;
  type: string;
  file: string;
  line: number;
  signature: string;
  description?: string;
  tags?: string[];
}

interface SourceIndex {
  version: string;
  lastUpdated: string;
  platforms: string[];
  files: SourceFile[];
  symbols: CodeSymbol[];
  components?: Record<string, any>;
}

interface ShardManifest {
  version: string;
  lastUpdated: string;
  platforms: string[];
  shards: {
    [component: string]: {
      path: string;
      fileCount: number;
      symbolCount: number;
      sizeBytes: number;
      classes: string[];
    };
  };
  totalFiles: number;
  totalSymbols: number;
}

interface ComponentShard {
  component: string;
  version: string;
  lastUpdated: string;
  platform: string;
  files: SourceFile[];
  symbols: CodeSymbol[];
  stats: {
    fileCount: number;
    symbolCount: number;
    classCount: number;
    topClasses: string[];
  };
}

function generateShards() {
  const sourcesDir = path.join(__dirname, '../data/sources');
  const indexPath = path.join(sourcesDir, 'index.json');
  const shardsDir = path.join(sourcesDir, 'shards');

  console.log('📦 源码索引分片生成器');
  console.log('='.repeat(50));

  // 1. 读取原始索引
  console.log('\n[1/4] 读取原始索引...');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ 索引文件不存在:', indexPath);
    process.exit(1);
  }

  const rawIndex: SourceIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  console.log(`   文件数: ${rawIndex.files.length}`);
  console.log(`   符号数: ${rawIndex.symbols.length}`);

  // 2. 按组件分组
  console.log('\n[2/4] 按组件分组...');
  const componentGroups = new Map<string, { files: SourceFile[]; symbols: CodeSymbol[] }>();

  // 分组文件
  for (const file of rawIndex.files) {
    const component = file.component;
    if (!componentGroups.has(component)) {
      componentGroups.set(component, { files: [], symbols: [] });
    }
    componentGroups.get(component)!.files.push(file);
  }

  // 分组符号（根据文件路径关联到组件）
  const fileToComponent = new Map<string, string>();
  for (const file of rawIndex.files) {
    fileToComponent.set(file.path, file.component);
  }

  for (const symbol of rawIndex.symbols) {
    const component = fileToComponent.get(symbol.file);
    if (component && componentGroups.has(component)) {
      componentGroups.get(component)!.symbols.push(symbol);
    }
  }

  // 打印分组统计
  for (const [component, data] of componentGroups) {
    console.log(`   ${component}: ${data.files.length} 文件, ${data.symbols.length} 符号`);
  }

  // 3. 生成分片文件
  console.log('\n[3/4] 生成分片文件...');

  // 确保 shards 目录存在
  if (!fs.existsSync(shardsDir)) {
    fs.mkdirSync(shardsDir, { recursive: true });
  }

  const manifest: ShardManifest = {
    version: rawIndex.version,
    lastUpdated: new Date().toISOString(),
    platforms: rawIndex.platforms,
    shards: {},
    totalFiles: rawIndex.files.length,
    totalSymbols: rawIndex.symbols.length,
  };

  for (const [component, data] of componentGroups) {
    // 收集所有类名
    const allClasses = new Set<string>();
    for (const file of data.files) {
      for (const cls of file.classes) {
        allClasses.add(cls);
      }
    }

    // 找出最常见的类（按符号数量排序）
    const classSymbolCount = new Map<string, number>();
    for (const symbol of data.symbols) {
      const className = symbol.name.split('.')[0];
      classSymbolCount.set(className, (classSymbolCount.get(className) || 0) + 1);
    }
    const topClasses = Array.from(classSymbolCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    // 构建分片
    const shard: ComponentShard = {
      component,
      version: rawIndex.version,
      lastUpdated: new Date().toISOString(),
      platform: data.files[0]?.platform || 'ios',
      files: data.files,
      symbols: data.symbols,
      stats: {
        fileCount: data.files.length,
        symbolCount: data.symbols.length,
        classCount: allClasses.size,
        topClasses,
      },
    };

    // 写入分片文件
    const shardPath = path.join(shardsDir, `${component}.json`);
    const shardContent = JSON.stringify(shard, null, 2);
    fs.writeFileSync(shardPath, shardContent);

    const sizeBytes = Buffer.byteLength(shardContent, 'utf-8');
    console.log(`   ✓ ${component}.json (${(sizeBytes / 1024).toFixed(1)} KB)`);

    // 更新清单
    manifest.shards[component] = {
      path: `shards/${component}.json`,
      fileCount: data.files.length,
      symbolCount: data.symbols.length,
      sizeBytes,
      classes: Array.from(allClasses).slice(0, 50), // 只保存前50个类名用于快速过滤
    };
  }

  // 4. 写入清单文件
  console.log('\n[4/4] 生成清单文件...');
  const manifestPath = path.join(sourcesDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✓ manifest.json`);

  // 统计
  console.log('\n' + '='.repeat(50));
  console.log('✅ 分片生成完成！');
  console.log(`   分片数量: ${componentGroups.size}`);
  console.log(`   清单路径: ${manifestPath}`);
  console.log(`   分片目录: ${shardsDir}`);

  // 对比大小
  const originalSize = fs.statSync(indexPath).size;
  const manifestSize = fs.statSync(manifestPath).size;
  console.log(`\n📊 大小对比:`);
  console.log(`   原始索引: ${(originalSize / 1024).toFixed(1)} KB`);
  console.log(`   清单文件: ${(manifestSize / 1024).toFixed(1)} KB`);
  console.log(`   节省首次加载: ${((1 - manifestSize / originalSize) * 100).toFixed(1)}%`);
}

generateShards();
