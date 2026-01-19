/**
 * 查询扩展器
 * 通过同义词库和领域术语映射提升检索召回率
 */

import { LexiconRegistry } from './LexiconRegistry.js';

export interface ExpandedQuery {
  original: string;
  expanded: string[];
  synonymsUsed: Array<{ term: string; synonyms: string[] }>;
}


export class QueryExpander {
  private synonyms: Map<string, string[]> = new Map();
  private abbreviations: Map<string, string[]> = new Map();
  private stopWords: Set<string> = new Set();

  constructor(registry?: LexiconRegistry, platform: string = 'common') {
    const lexicon = (registry || new LexiconRegistry()).load(platform);
    this.synonyms = new Map(Object.entries(lexicon.synonyms));
    this.abbreviations = new Map(Object.entries(lexicon.abbreviations));
    this.stopWords = new Set(lexicon.stopWords);
  }

  /**
   * 扩展查询 - 返回原始查询 + 同义词扩展
   */
  expand(query: string): ExpandedQuery {
    const tokens = this.tokenize(query);
    const expandedSet: Set<string> = new Set(tokens);
    const synonymsUsed: Array<{ term: string; synonyms: string[] }> = [];

    for (const token of tokens) {
      // 跳过停用词
      if (this.stopWords.has(token.toLowerCase())) {
        continue;
      }

      // 查找同义词
      const syns = this.findSynonyms(token);
      if (syns.length > 0) {
        syns.forEach(s => expandedSet.add(s));
        synonymsUsed.push({ term: token, synonyms: syns });
      }

      // 展开缩写
      const abbrevExpanded = this.expandAbbreviation(token);
      if (abbrevExpanded.length > 0) {
        abbrevExpanded.forEach(s => expandedSet.add(s));
      }
    }

    return {
      original: query,
      expanded: Array.from(expandedSet),
      synonymsUsed,
    };
  }

  /**
   * 获取用于搜索的扩展查询字符串
   */
  getExpandedSearchTerms(query: string): string[] {
    const result = this.expand(query);
    return result.expanded;
  }

  /**
   * 检查两个查询是否语义等价
   */
  areEquivalent(query1: string, query2: string): boolean {
    const expanded1 = new Set(this.expand(query1).expanded.map(t => t.toLowerCase()));
    const expanded2 = new Set(this.expand(query2).expanded.map(t => t.toLowerCase()));

    // 计算 Jaccard 相似度
    const intersection = new Set([...expanded1].filter(x => expanded2.has(x)));
    const union = new Set([...expanded1, ...expanded2]);

    return intersection.size / union.size > 0.5;
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    const normalized = text.toLowerCase();

    // 英文单词
    const englishWords = normalized.match(/[a-z][a-z0-9]*/g) || [];
    tokens.push(...englishWords);

    // 中文词汇 - 简单按标点/空格分割
    const chineseSegments = normalized.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseSegments) {
      tokens.push(segment);
      // 拆分为单字以增加匹配机会
      if (segment.length > 1) {
        for (const char of segment) {
          tokens.push(char);
        }
      }
    }

    return [...new Set(tokens)];
  }

  /**
   * 查找同义词
   */
  private findSynonyms(term: string): string[] {
    const lowerTerm = term.toLowerCase();

    // 直接查找
    if (this.synonyms.has(lowerTerm)) {
      return this.synonyms.get(lowerTerm)!;
    }

    // 中文字符逐字匹配
    if (/[\u4e00-\u9fa5]/.test(term)) {
      const synonyms: string[] = [];
      for (const [key, values] of this.synonyms) {
        if (key.includes(term) || term.includes(key)) {
          synonyms.push(...values);
        }
      }
      return [...new Set(synonyms)];
    }

    return [];
  }

  /**
   * 展开缩写
   */
  private expandAbbreviation(term: string): string[] {
    const lowerTerm = term.toLowerCase();
    return this.abbreviations.get(lowerTerm) || [];
  }

  /**
   * 添加自定义同义词（运行时扩展）
   */
  addSynonym(term: string, synonyms: string[]): void {
    const existing = this.synonyms.get(term.toLowerCase()) || [];
    this.synonyms.set(term.toLowerCase(), [...new Set([...existing, ...synonyms])]);
  }

  /**
   * 获取某个词的所有同义词
   */
  getSynonyms(term: string): string[] {
    return this.findSynonyms(term);
  }
}
