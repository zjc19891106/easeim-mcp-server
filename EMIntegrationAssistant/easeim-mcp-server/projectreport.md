# 项目开发报告

## 项目概述

**项目名称**: easeim-mcp-server
**项目描述**: 环信 IM SDK MCP Server，提供文档查询、源码搜索、智能助手和集成诊断能力
**技术栈**: TypeScript, Node.js, MCP Protocol

---

## 版本历史

### v3.0.0 - 平台分片优化 (2026-01-15)

#### 实现目标

解决多平台支持时的性能和内存问题：
- 原有架构：docs/index.json 和 configs/index.json 完整加载，随平台增加会膨胀到数十 MB
- 优化目标：支持 10+ 平台同时保持毫秒级启动和低内存占用

#### 实现方案

**核心思路**: 按平台维度拆分索引，启动时只加载清单文件，按需加载平台分片

```
优化前:
┌─────────────────────────────────────┐
│         docs/index.json             │
│         (~120KB, 全量加载)           │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ iOS │ │ And │ │ Web │ │ ... │   │
│  └─────┘ └─────┘ └─────┘ └─────┘   │
└─────────────────────────────────────┘

优化后:
┌─────────────────────────────────────┐
│      manifest.json (~1KB)           │  ← 启动时只加载这个
├─────────────────────────────────────┤
│     shards/                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ iOS │ │ And │ │ Web │ │ ... │   │  ← 按需加载
│  └─────┘ └─────┘ └─────┘ └─────┘   │
└─────────────────────────────────────┘
```

#### 创建的文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `scripts/generate-doc-shards.ts` | 脚本 | 文档索引分片生成器 |
| `scripts/generate-config-shards.ts` | 脚本 | 配置索引分片生成器 |
| `src/search/ShardedDocSearch.ts` | 引擎 | 分片文档搜索引擎 |
| `src/search/ShardedConfigSearch.ts` | 引擎 | 分片配置搜索引擎 |
| `data/docs/manifest.json` | 数据 | 文档分片清单 |
| `data/docs/shards/ios.json` | 数据 | iOS 平台文档分片 |
| `data/docs/shards/android.json` | 数据 | Android 平台文档分片 |
| `data/docs/shards/error-codes.json` | 数据 | 共享错误码分片 |
| `data/configs/manifest.json` | 数据 | 配置分片清单 |
| `data/configs/shards/ios.json` | 数据 | iOS 平台配置分片 |

#### 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/search/index.ts` | 添加分片搜索引擎导出 |
| `README.md` | 添加平台分片文档 |

#### 性能对比

| 指标 | 优化前 | 优化后 | 改进 |
|------|--------|--------|------|
| 文档索引启动加载 | 120.92 KB | 1.17 KB | **99.0% 减少** |
| 配置索引启动加载 | 66.11 KB | 0.61 KB | **99.1% 减少** |
| 支持平台数量 | 有限（内存受限） | 10+ 平台 | **无限扩展** |

#### 技术实现细节

**1. LRU 缓存策略**

```typescript
class LRUCache<K, V> {
  private cache: Map<K, { value: V; lastAccess: number }> = new Map();
  private maxSize: number;

  // 访问时更新时间戳
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.value;
    }
  }

  // 超过容量时淘汰最久未使用的条目
  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // 找到最久未使用的条目并删除
      let oldestKey = null, oldestTime = Infinity;
      for (const [k, v] of this.cache) {
        if (v.lastAccess < oldestTime) {
          oldestTime = v.lastAccess;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, lastAccess: Date.now() });
  }
}
```

**2. 智能平台检测**

```typescript
// 根据查询关键词自动识别目标平台
private detectPlatform(query: string): string[] {
  const manifest = this.loadManifest();
  const platforms: string[] = [];
  const queryLower = query.toLowerCase();

  for (const [platform, shardInfo] of Object.entries(manifest.shards)) {
    for (const keyword of shardInfo.keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        platforms.push(platform);
        break;
      }
    }
  }

  // 未检测到则返回所有平台
  return platforms.length > 0 ? platforms : manifest.platforms;
}
```

**3. 分片清单结构**

```json
{
  "version": "3.0.0",
  "platforms": ["android", "ios"],
  "shards": {
    "ios": {
      "path": "shards/ios.json",
      "guideCount": 20,
      "apiModuleCount": 60,
      "sizeBytes": 32661,
      "keywords": ["ios", "swift", "xcode", "cocoapods"]
    }
  },
  "shared": {
    "errorCodes": {
      "path": "shards/error-codes.json",
      "count": 99
    }
  }
}
```

#### 使用方式

```typescript
// 推荐使用分片版本
import { ShardedDocSearch, ShardedConfigSearch } from './search/index.js';

const docSearch = new ShardedDocSearch(4);  // 最多缓存4个平台
const configSearch = new ShardedConfigSearch(4);

// 搜索会自动检测平台并按需加载
const results = docSearch.searchApi('发送消息');

// 也可以指定平台
const iosResults = docSearch.searchApi('消息', { platform: 'ios' });

// 预加载常用平台
docSearch.preload(['ios', 'android']);

// 查看缓存状态
console.log(docSearch.getCacheStats());
// { cachedPlatforms: ['ios', 'android'], cacheSize: 2, maxSize: 4 }
```

---

### v2.0.0 - 智能化增强 (之前版本)

- 拼写纠错 (SpellCorrector)
- 搜索建议 (SearchSuggester)
- 上下文管理 (ContextManager)
- 源码分片搜索 (ShardedSourceSearch)

---

## 后续迭代计划

### 短期计划 (1-2 周)

#### 1. 工具层迁移
将现有 MCP Tools 从全量搜索引擎迁移到分片版本：

```typescript
// 当前 (tools/searchApi.ts)
import { DocSearch } from '../search/DocSearch.js';

// 迁移后
import { ShardedDocSearch } from '../search/ShardedDocSearch.js';
```

**涉及文件**:
- `src/tools/searchApi.ts`
- `src/tools/lookupError.ts`
- `src/tools/getGuide.ts`
- `src/tools/listConfigOptions.ts`
- `src/tools/getExtensionPoints.ts`

#### 2. 新平台数据添加
添加其他平台的文档和配置数据：

| 平台 | 状态 | 预计数据量 |
|------|------|------------|
| iOS | ✅ 已完成 | 20 guides, 60 APIs |
| Android | ✅ 已完成 | 32 guides, 72 APIs |
| Flutter | 📋 待添加 | ~25 guides, ~50 APIs |
| Web | 📋 待添加 | ~20 guides, ~40 APIs |
| Unity | 📋 待添加 | ~15 guides, ~30 APIs |
| React Native | 📋 待添加 | ~20 guides, ~45 APIs |

**添加步骤**:
```bash
# 1. 编辑文档索引，添加新平台数据
vim data/docs/index.json

# 2. 编辑配置索引（如有）
vim data/configs/index.json

# 3. 重新生成分片
npx tsx scripts/generate-doc-shards.ts
npx tsx scripts/generate-config-shards.ts
```

### 中期计划 (1-2 月)

#### 1. 性能监控
添加分片加载和搜索性能监控：

```typescript
interface ShardMetrics {
  loadCount: number;          // 分片加载次数
  cacheHitRate: number;       // 缓存命中率
  avgLoadTime: number;        // 平均加载时间
  avgSearchTime: number;      // 平均搜索时间
  memoryUsage: number;        // 内存占用
}
```

#### 2. 增量更新
支持分片的增量更新，无需重新生成全部分片：

```bash
# 只更新 iOS 平台分片
npx tsx scripts/generate-doc-shards.ts --platform ios
```

#### 3. 跨平台搜索优化
当用户未指定平台时，优化多平台并行搜索性能：

```typescript
// 并行加载多个平台分片
async searchAllPlatforms(query: string): Promise<Results[]> {
  const platforms = this.getPlatforms();
  return Promise.all(
    platforms.map(p => this.searchPlatform(query, p))
  );
}
```

### 长期计划 (3-6 月)

#### 1. 语义搜索
引入向量嵌入，支持语义相似度搜索：

```typescript
interface SemanticSearchConfig {
  embeddingModel: 'openai' | 'local';
  vectorStore: 'memory' | 'faiss';
  similarityThreshold: number;
}
```

#### 2. 多语言支持
支持中英文混合查询和结果展示：

```typescript
interface I18nConfig {
  defaultLanguage: 'zh' | 'en';
  supportedLanguages: string[];
  autoDetect: boolean;
}
```

#### 3. 自动数据同步
从环信官方文档仓库自动同步最新内容：

```bash
# 定时任务自动同步
0 0 * * * npx tsx scripts/sync-docs.ts
```

---

## 技术债务

| 项目 | 优先级 | 说明 |
|------|--------|------|
| 全量搜索引擎保留 | 低 | 保留向后兼容，但增加维护成本 |
| 缺少单元测试 | 中 | 分片搜索引擎需要添加测试用例 |
| 硬编码平台列表 | 低 | `generate-config-shards.ts` 中平台列表硬编码 |

---

## 贡献指南

### 添加新平台

1. **准备数据**: 整理新平台的 guides 和 apiModules 数据
2. **更新索引**: 编辑 `data/docs/index.json` 和 `data/configs/index.json`
3. **生成分片**: 运行分片生成脚本
4. **测试验证**: 确保新平台可被正确搜索
5. **更新文档**: 更新 README.md 中的平台列表

### 代码规范

- 使用 TypeScript 严格模式
- 新增搜索引擎需实现 LRU 缓存
- 保持向后兼容性
- 添加适当的注释和文档

---

## 联系方式

如有问题或建议，请提交 Issue 或 PR。
