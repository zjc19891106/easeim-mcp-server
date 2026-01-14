/**
 * 文档搜索引擎 (v2 - 适配平台优先架构)
 * 提供 API 文档、指南和错误码的搜索功能
 *
 * v2.1 优化：集成 QueryExpander 提升召回率
 * v2.2 优化：集成 InvertedIndex 提升搜索性能 (BM25 评分)
 * v2.3 优化：集成 SpellCorrector 提升搜索容错能力
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { DocsIndex, ErrorCode, ApiSearchResult, SearchContext, AmbiguityDetection } from '../types/index.js';
import { AmbiguityDetector } from './AmbiguityDetector.js';
import { QueryExpander } from '../intelligence/QueryExpander.js';
import { InvertedIndex, IndexedDocument } from './InvertedIndex.js';
import { SpellCorrector, QueryCorrectionResult } from '../intelligence/SpellCorrector.js';
import { SearchSuggester, SearchSuggestion } from '../intelligence/SearchSuggester.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DocSearch {
  private index: any = null;
  private indexPath: string;
  private ambiguityDetector: AmbiguityDetector;
  private queryExpander: QueryExpander;
  private spellCorrector: SpellCorrector;
  private searchSuggester: SearchSuggester;

  // 倒排索引实例
  private invertedIndex: InvertedIndex;
  private isIndexBuilt: boolean = false;

  constructor() {
    this.indexPath = path.join(__dirname, '../../data/docs/index.json');
    this.ambiguityDetector = new AmbiguityDetector();
    this.queryExpander = new QueryExpander();
    this.spellCorrector = new SpellCorrector();
    this.searchSuggester = new SearchSuggester();
    this.invertedIndex = new InvertedIndex({
      fieldWeights: {
        'name': 4.0,      // 名称权重最高
        'title': 4.0,
        'id': 2.5,
        'keywords': 3.0,
        'description': 1.5,
      }
    });
  }

  private loadIndex(): any {
    if (this.index) return this.index;
    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      this.index = JSON.parse(content);

      // 构建倒排索引
      this.buildInvertedIndex();

      return this.index;
    } catch (error) {
      throw new Error(`Failed to load docs index: ${error}`);
    }
  }

  /**
   * 构建倒排索引 - 首次加载时执行
   */
  private buildInvertedIndex(): void {
    if (this.isIndexBuilt || !this.index) return;

    const documents: IndexedDocument[] = [];
    const allKeywords: string[] = [];

    // 索引 API 模块
    const modules = this.index.apiModules || [];
    for (const mod of modules) {
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
      if (mod.keywords) allKeywords.push(...mod.keywords);
      if (mod.name) this.spellCorrector.addCamelCaseWords(mod.name);
    }

    // 索引指南文档
    const guides = this.index.guides || [];
    for (const guide of guides) {
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
      if (guide.keywords) allKeywords.push(...guide.keywords);
    }

    // 将索引关键词添加到拼写纠错词典
    this.spellCorrector.addWords(allKeywords);

    this.invertedIndex.build(documents);
    this.isIndexBuilt = true;
  }

  lookupError(code: number): any | null {
    const index = this.loadIndex();
    return index.errorCodeIndex[code.toString()] || null;
  }

  searchApi(query: string, context?: SearchContext, limit: number = 10): {
    results: ApiSearchResult[];
    ambiguity: AmbiguityDetection;
    expandedTerms?: string[];
    spellCorrection?: QueryCorrectionResult;
    suggestion?: SearchSuggestion;
  } {
    const index = this.loadIndex();

    // === 步骤 1: 拼写纠错 ===
    const spellCorrection = this.spellCorrector.correctQuery(query);
    const correctedQuery = spellCorrection.correctedQuery;

    // === 步骤 2: 查询扩展（基于纠错后的查询）===
    const expandedQuery = this.queryExpander.expand(correctedQuery);
    const expandedQueryStr = expandedQuery.expanded.join(' ');

    // === 步骤 3: 使用倒排索引进行 BM25 搜索（O(k) 复杂度）===
    const indexResults = this.invertedIndex.search(expandedQueryStr, limit * 2);

    // === 转换结果并应用平台过滤 ===
    const results: ApiSearchResult[] = [];
    const modules = index.apiModules || [];

    // 构建 ID → Module 映射表
    type PlatformType = 'ios' | 'android' | 'web' | 'flutter' | 'unity' | 'all';
    interface ApiModule {
      id: string;
      name: string;
      description?: string;
      docPath: string;
      platform: PlatformType;
      keywords?: string[];
    }
    const moduleMap = new Map<string, ApiModule>(
      modules.map((m: ApiModule) => [m.id, m])
    );

    for (const indexResult of indexResults) {
      // 只处理 API 类型的结果
      if (indexResult.metadata?.type !== 'api') continue;

      // 平台过滤
      if (context?.platform && indexResult.metadata?.platform !== context.platform) continue;

      const mod = moduleMap.get(indexResult.docId);
      if (!mod) continue;

      results.push({
        name: mod.name,
        module: mod.id,
        moduleName: mod.name,
        description: mod.description || '',
        docPath: mod.docPath,
        score: indexResult.score,
        platform: mod.platform,
        layer: 'sdk'
      });
    }

    // 限制结果数量
    const limitedResults = results.slice(0, limit);
    const ambiguity = this.ambiguityDetector.detectApiAmbiguity(query, limitedResults, context);

    // 生成搜索建议
    const suggestion = this.searchSuggester.generateSuggestions(
      query,
      limitedResults,
      {
        correctedQuery: spellCorrection.hasCorrected ? spellCorrection.correctedQuery : undefined,
        expandedTerms: expandedQuery.expanded
      }
    );

    return {
      results: limitedResults,
      ambiguity,
      expandedTerms: expandedQuery.synonymsUsed.length > 0 ? expandedQuery.expanded : undefined,
      spellCorrection: spellCorrection.hasCorrected ? spellCorrection : undefined,
      suggestion
    };
  }

  /**
   * 搜索指南文档（使用倒排索引）
   */
  searchGuide(query: string, limit: number = 5): {
    results: {
      id: string;
      title: string;
      description: string;
      path: string;
      score: number;
      platform?: string;
    }[];
    spellCorrection?: QueryCorrectionResult;
  } {
    this.loadIndex();

    // 拼写纠错
    const spellCorrection = this.spellCorrector.correctQuery(query);
    const correctedQuery = spellCorrection.correctedQuery;

    // 查询扩展
    const expandedQuery = this.queryExpander.expand(correctedQuery);
    const expandedQueryStr = expandedQuery.expanded.join(' ');

    // 使用倒排索引搜索
    const indexResults = this.invertedIndex.search(expandedQueryStr, limit * 2);

    // 过滤出指南类型的结果
    const results = indexResults
      .filter(r => r.metadata?.type === 'guide')
      .slice(0, limit)
      .map(r => ({
        id: r.docId,
        title: r.metadata?.title || r.docId,
        description: r.metadata?.description || '',
        path: r.metadata?.path || '',
        score: r.score,
        platform: r.metadata?.platform
      }));

    return {
      results,
      spellCorrection: spellCorrection.hasCorrected ? spellCorrection : undefined
    };
  }

  getGuidePath(topic: string): string | null {
    const index = this.loadIndex();
    const guides = index.guides || [];
    // 模糊匹配 topic
    const guide = guides.find((g: any) => g.id.includes(topic) || g.title.includes(topic));
    return guide ? guide.path : null;
  }

  readDoc(docPath: string): string | null {
    try {
      const fullPath = path.join(__dirname, '../../data/docs', docPath);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  /**
   * 根据症状诊断可能的错误码
   * 使用关键词匹配和查询扩展提高召回率
   */
  diagnose(symptom: string): any[] {
    const index = this.loadIndex();
    const errorCodeIndex = index.errorCodeIndex || {};

    if (Object.keys(errorCodeIndex).length === 0) {
      return [];
    }

    // 查询扩展
    const expandedQuery = this.queryExpander.expand(symptom);
    const queryTerms = expandedQuery.expanded.map(t => t.toLowerCase());
    const originalTerms = symptom.toLowerCase().split(/\s+/);

    // 症状-错误码映射表（常见症状直接映射）
    const symptomMap: Record<string, number[]> = {
      // 消息相关
      '消息发送失败': [500, 501, 502, 503, 504, 505, 506, 507, 508],
      '发送失败': [500, 501, 502, 503, 504, 505, 506, 507, 508],
      '消息被拦截': [508],
      '被拉黑': [508, 221],
      '敏感词': [507],
      '禁言': [506],
      '不在群里': [505],
      '群已解散': [504],
      // 登录相关
      '登录失败': [200, 201, 202, 203, 204, 205, 206, 207],
      '登录超时': [200, 201],
      'token无效': [204, 206],
      'token过期': [206],
      '密码错误': [204],
      '用户不存在': [204],
      '账号被封禁': [207, 305],
      // 连接相关
      '连接失败': [300, 301, 302, 303],
      '网络断开': [300, 301],
      '网络超时': [300],
      '服务器错误': [302, 303],
      // 群组相关
      '加群失败': [600, 601, 602, 603],
      '群满了': [602],
      '群不存在': [600],
      // 通用
      '权限不足': [403],
      '参数错误': [400],
      '服务未开通': [1000],
    };

    const matchedErrors: Array<{ error: any; score: number }> = [];

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
    for (const [codeStr, error] of Object.entries(errorCodeIndex) as [string, any][]) {
      // 跳过已匹配的
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

      // 原始词匹配（权重更高）
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

      // 错误名称匹配（权重最高）
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
}