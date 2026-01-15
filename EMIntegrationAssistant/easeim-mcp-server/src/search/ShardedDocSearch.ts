/**
 * 分片文档搜索引擎
 *
 * 性能优化:
 * - 首次只加载 manifest (~1KB) 而非完整索引 (~120KB)
 * - 按平台按需加载分片
 * - LRU 缓存自动淘汰不常用分片
 * - 倒排索引加速搜索
 *
 * 架构特点:
 * - 错误码索引独立分片，跨平台共享
 * - 平台分片包含该平台的指南和 API 模块
 * - 支持意图识别自动选择平台
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ApiSearchResult, SearchContext, AmbiguityDetection } from '../types/index.js';
import { AmbiguityDetector } from './AmbiguityDetector.js';
import { QueryExpander } from '../intelligence/QueryExpander.js';
import { InvertedIndex, IndexedDocument } from './InvertedIndex.js';
import { SpellCorrector, QueryCorrectionResult } from '../intelligence/SpellCorrector.js';
import { SearchSuggester, SearchSuggestion } from '../intelligence/SearchSuggester.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== 类型定义 ====================

interface ShardInfo {
  path: string;
  platform: string;
  guideCount: number;
  apiModuleCount: number;
  errorCodeCount: number;
  sizeBytes: number;
  keywords: string[];
}

interface DocsManifest {
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

interface ErrorCode {
  code: number;
  name: string;
  brief: string;
  description: string;
  causes: string[];
  solutions: string[];
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

interface CachedShard {
  shard: PlatformShard;
  index: InvertedIndex;
  lastAccess: number;
}

// ==================== LRU 缓存 ====================

class LRUCache<K, V> {
  private cache: Map<K, { value: V; lastAccess: number }> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 4) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    // 淘汰最久未使用的条目
    if (this.cache.size >= this.maxSize) {
      let oldestKey: K | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache) {
        if (v.lastAccess < oldestTime) {
          oldestTime = v.lastAccess;
          oldestKey = k;
        }
      }

      if (oldestKey !== null) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { value, lastAccess: Date.now() });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }
}

// ==================== 分片文档搜索引擎 ====================

export class ShardedDocSearch {
  private docsDir: string;
  private manifest: DocsManifest | null = null;
  private shardCache: LRUCache<string, CachedShard>;
  private errorCodeShard: ErrorCodeShard | null = null;
  private queryExpander: QueryExpander;
  private ambiguityDetector: AmbiguityDetector;
  private spellCorrector: SpellCorrector;
  private searchSuggester: SearchSuggester;

  constructor(maxCachedShards: number = 4) {
    this.docsDir = path.join(__dirname, '../../data/docs');
    this.shardCache = new LRUCache(maxCachedShards);
    this.queryExpander = new QueryExpander();
    this.ambiguityDetector = new AmbiguityDetector();
    this.spellCorrector = new SpellCorrector();
    this.searchSuggester = new SearchSuggester();
  }

  /**
   * 加载清单文件（首次调用时）
   */
  private loadManifest(): DocsManifest {
    if (this.manifest) return this.manifest;

    const manifestPath = path.join(this.docsDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}. Run 'npx tsx scripts/generate-doc-shards.ts' first.`);
    }

    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return this.manifest!;
  }

  /**
   * 加载指定平台的分片（带缓存）
   */
  private loadPlatformShard(platform: string): CachedShard {
    // 检查缓存
    const cached = this.shardCache.get(platform);
    if (cached) {
      return cached;
    }

    const manifest = this.loadManifest();
    const shardInfo = manifest.shards[platform];
    if (!shardInfo) {
      throw new Error(`Platform shard not found: ${platform}`);
    }

    // 加载分片文件
    const shardPath = path.join(this.docsDir, shardInfo.path);
    const shard: PlatformShard = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));

    // 构建倒排索引
    const index = new InvertedIndex({
      fieldWeights: {
        'name': 4.0,
        'title': 4.0,
        'id': 2.5,
        'keywords': 3.0,
        'description': 1.5,
      }
    });

    const documents: IndexedDocument[] = [];

    // 索引 API 模块
    for (const mod of shard.apiModules) {
      documents.push({
        id: mod.id,
        fields: {
          name: mod.name || '',
          id: mod.id || '',
          description: mod.description || '',
          keywords: (mod.keywords || []).join(' '),
        },
        metadata: {
          type: 'api',
          platform: mod.platform,
          docPath: mod.docPath,
          product: mod.product,
        }
      });

      // 收集关键词用于拼写纠错词典
      if (mod.keywords) this.spellCorrector.addWords(mod.keywords);
      if (mod.name) this.spellCorrector.addCamelCaseWords(mod.name);
    }

    // 索引指南文档
    for (const guide of shard.guides) {
      documents.push({
        id: guide.id,
        fields: {
          title: guide.title || '',
          id: guide.id || '',
          description: guide.description || '',
          keywords: (guide.keywords || []).join(' '),
        },
        metadata: {
          type: 'guide',
          platform: guide.platform,
          path: guide.path,
          product: guide.product,
        }
      });

      // 收集关键词
      if (guide.keywords) this.spellCorrector.addWords(guide.keywords);
    }

    index.build(documents);

    const cachedShard: CachedShard = {
      shard,
      index,
      lastAccess: Date.now(),
    };

    this.shardCache.set(platform, cachedShard);
    return cachedShard;
  }

  /**
   * 加载错误码分片
   */
  private loadErrorCodeShard(): ErrorCodeShard {
    if (this.errorCodeShard) return this.errorCodeShard;

    const manifest = this.loadManifest();
    const shardPath = path.join(this.docsDir, manifest.shared.errorCodes.path);
    this.errorCodeShard = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
    return this.errorCodeShard!;
  }

  /**
   * 根据查询自动检测目标平台
   */
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

    // 如果未检测到平台，返回所有平台
    return platforms.length > 0 ? platforms : manifest.platforms;
  }

  /**
   * 获取所有可用平台
   */
  getPlatforms(): string[] {
    const manifest = this.loadManifest();
    return manifest.platforms;
  }

  /**
   * 获取平台统计信息
   */
  getPlatformStats(platform: string): ShardInfo | null {
    const manifest = this.loadManifest();
    return manifest.shards[platform] || null;
  }

  /**
   * 查询错误码
   */
  lookupError(code: number): ErrorCode | null {
    const errorCodeShard = this.loadErrorCodeShard();
    return errorCodeShard.errorCodes[code.toString()] || null;
  }

  /**
   * 搜索 API - 支持按需加载和并行搜索
   */
  searchApi(
    query: string,
    context?: SearchContext,
    limit: number = 10
  ): {
    results: ApiSearchResult[];
    ambiguity: AmbiguityDetection;
    expandedTerms?: string[];
    spellCorrection?: QueryCorrectionResult;
    suggestion?: SearchSuggestion;
    loadedPlatforms: string[];
  } {
    // === 步骤 1: 拼写纠错 ===
    const spellCorrection = this.spellCorrector.correctQuery(query);
    const correctedQuery = spellCorrection.correctedQuery;

    // === 步骤 2: 查询扩展 ===
    const expandedQuery = this.queryExpander.expand(correctedQuery);
    const expandedQueryStr = expandedQuery.expanded.join(' ');

    // === 步骤 3: 确定目标平台 ===
    let targetPlatforms: string[];
    if (context?.platform) {
      targetPlatforms = [context.platform];
    } else {
      targetPlatforms = this.detectPlatform(query);
    }

    // === 步骤 4: 搜索各平台分片 ===
    const allResults: Array<ApiSearchResult & { _score: number }> = [];
    const loadedPlatforms: string[] = [];

    for (const platform of targetPlatforms) {
      try {
        const cached = this.loadPlatformShard(platform);
        loadedPlatforms.push(platform);

        // 使用倒排索引搜索
        const indexResults = cached.index.search(expandedQueryStr, limit * 2);

        // 转换结果
        for (const result of indexResults) {
          if (result.metadata?.type !== 'api') continue;

          // 在分片中查找完整的模块信息
          const mod = cached.shard.apiModules.find(m => m.id === result.docId);
          if (!mod) continue;

          allResults.push({
            name: mod.name,
            module: mod.id,
            moduleName: mod.name,
            description: mod.description || '',
            docPath: mod.docPath,
            score: result.score,
            platform: mod.platform as 'ios' | 'android' | 'web' | 'flutter' | 'unity' | 'all',
            layer: 'sdk',
            _score: result.score,
          });
        }
      } catch (error) {
        // 平台分片加载失败，跳过
        console.warn(`Failed to load platform shard: ${platform}`, error);
      }
    }

    // 排序并限制结果
    const sortedResults = allResults
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...rest }) => rest);

    // 检测歧义
    const ambiguity = this.ambiguityDetector.detectApiAmbiguity(query, sortedResults, context);

    // 生成搜索建议
    const suggestion = this.searchSuggester.generateSuggestions(
      query,
      sortedResults,
      {
        correctedQuery: spellCorrection.hasCorrected ? spellCorrection.correctedQuery : undefined,
        expandedTerms: expandedQuery.expanded
      }
    );

    return {
      results: sortedResults,
      ambiguity,
      expandedTerms: expandedQuery.synonymsUsed.length > 0 ? expandedQuery.expanded : undefined,
      spellCorrection: spellCorrection.hasCorrected ? spellCorrection : undefined,
      suggestion,
      loadedPlatforms,
    };
  }

  /**
   * 搜索指南文档
   */
  searchGuide(
    query: string,
    platform?: string,
    limit: number = 5
  ): {
    results: {
      id: string;
      title: string;
      description: string;
      path: string;
      score: number;
      platform?: string;
    }[];
    spellCorrection?: QueryCorrectionResult;
    loadedPlatforms: string[];
  } {
    // 拼写纠错
    const spellCorrection = this.spellCorrector.correctQuery(query);
    const correctedQuery = spellCorrection.correctedQuery;

    // 查询扩展
    const expandedQuery = this.queryExpander.expand(correctedQuery);
    const expandedQueryStr = expandedQuery.expanded.join(' ');

    // 确定目标平台
    let targetPlatforms: string[];
    if (platform) {
      targetPlatforms = [platform];
    } else {
      targetPlatforms = this.detectPlatform(query);
    }

    const allResults: Array<{
      id: string;
      title: string;
      description: string;
      path: string;
      score: number;
      platform?: string;
    }> = [];
    const loadedPlatforms: string[] = [];

    for (const plat of targetPlatforms) {
      try {
        const cached = this.loadPlatformShard(plat);
        loadedPlatforms.push(plat);

        // 使用倒排索引搜索
        const indexResults = cached.index.search(expandedQueryStr, limit * 2);

        // 过滤出指南类型的结果
        for (const result of indexResults) {
          if (result.metadata?.type !== 'guide') continue;

          const guide = cached.shard.guides.find(g => g.id === result.docId);
          if (!guide) continue;

          allResults.push({
            id: guide.id,
            title: guide.title,
            description: guide.description,
            path: guide.path,
            score: result.score,
            platform: guide.platform
          });
        }
      } catch (error) {
        console.warn(`Failed to load platform shard: ${plat}`, error);
      }
    }

    // 排序并限制结果
    const sortedResults = allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      results: sortedResults,
      spellCorrection: spellCorrection.hasCorrected ? spellCorrection : undefined,
      loadedPlatforms,
    };
  }

  /**
   * 获取指南路径
   */
  getGuidePath(topic: string, platform?: string): string | null {
    const targetPlatforms = platform ? [platform] : this.getPlatforms();

    for (const plat of targetPlatforms) {
      try {
        const cached = this.loadPlatformShard(plat);
        const guide = cached.shard.guides.find(
          g => g.id.includes(topic) || g.title.includes(topic)
        );
        if (guide) return guide.path;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * 读取文档内容
   */
  readDoc(docPath: string): string | null {
    try {
      const fullPath = path.join(this.docsDir, docPath);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * 根据症状诊断可能的错误码
   */
  diagnose(symptom: string): ErrorCode[] {
    const errorCodeShard = this.loadErrorCodeShard();
    const errorCodeIndex = errorCodeShard.errorCodes;

    if (Object.keys(errorCodeIndex).length === 0) {
      return [];
    }

    // 查询扩展
    const expandedQuery = this.queryExpander.expand(symptom);
    const queryTerms = expandedQuery.expanded.map(t => t.toLowerCase());
    const originalTerms = symptom.toLowerCase().split(/\s+/);

    // 症状-错误码映射表
    const symptomMap: Record<string, number[]> = {
      '消息发送失败': [500, 501, 502, 503, 504, 505, 506, 507, 508],
      '发送失败': [500, 501, 502, 503, 504, 505, 506, 507, 508],
      '消息被拦截': [508],
      '被拉黑': [508, 221],
      '敏感词': [507],
      '禁言': [506],
      '不在群里': [505],
      '群已解散': [504],
      '登录失败': [200, 201, 202, 203, 204, 205, 206, 207],
      '登录超时': [200, 201],
      'token无效': [204, 206],
      'token过期': [206],
      '密码错误': [204],
      '用户不存在': [204],
      '账号被封禁': [207, 305],
      '连接失败': [300, 301, 302, 303],
      '网络断开': [300, 301],
      '网络超时': [300],
      '服务器错误': [302, 303],
      '加群失败': [600, 601, 602, 603],
      '群满了': [602],
      '群不存在': [600],
      '权限不足': [403],
      '参数错误': [400],
      '服务未开通': [1000],
    };

    const matchedErrors: Array<{ error: ErrorCode; score: number }> = [];

    // 1. 先尝试直接症状映射
    for (const [symptomKey, codes] of Object.entries(symptomMap)) {
      if (symptom.includes(symptomKey) || symptomKey.includes(symptom)) {
        for (const code of codes) {
          const error = errorCodeIndex[code.toString()];
          if (error && !matchedErrors.find(m => m.error.code === error.code)) {
            matchedErrors.push({ error, score: 100 });
          }
        }
      }
    }

    // 2. 遍历所有错误码进行关键词匹配
    for (const [codeStr, error] of Object.entries(errorCodeIndex)) {
      if (matchedErrors.find(m => m.error.code === error.code)) {
        continue;
      }

      let score = 0;
      const searchableText = [
        error.brief || '',
        error.description || '',
        ...(error.causes || []),
        ...(error.solutions || []),
        error.name || '',
      ].join(' ').toLowerCase();

      // 原始词匹配
      for (const term of originalTerms) {
        if (term.length >= 2 && searchableText.includes(term)) {
          score += 20;
        }
      }

      // 扩展词匹配
      for (const term of queryTerms) {
        if (term.length >= 2 && searchableText.includes(term)) {
          score += 10;
        }
      }

      // 错误名称匹配
      const errorNameLower = (error.name || '').toLowerCase();
      for (const term of originalTerms) {
        if (term.length >= 2 && errorNameLower.includes(term)) {
          score += 30;
        }
      }

      if (score > 0) {
        matchedErrors.push({ error, score });
      }
    }

    // 按分数排序，返回前 5 个
    return matchedErrors
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(m => m.error);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    cachedPlatforms: string[];
    cacheSize: number;
    maxSize: number;
    errorCodeShardLoaded: boolean;
  } {
    return {
      cachedPlatforms: this.shardCache.keys(),
      cacheSize: this.shardCache.size,
      maxSize: 4,
      errorCodeShardLoaded: this.errorCodeShard !== null,
    };
  }

  /**
   * 预加载指定平台
   */
  preload(platforms: string[]): void {
    for (const platform of platforms) {
      this.loadPlatformShard(platform);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.shardCache.clear();
    this.errorCodeShard = null;
  }
}
