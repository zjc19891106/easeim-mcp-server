/**
 * 搜索建议生成器
 * 当搜索结果不理想时，提供替代搜索建议
 */

import { SpellCorrector } from './SpellCorrector.js';

export type SuggestionType = 'related' | 'clarify' | 'popular' | 'category';

export interface SearchSuggestion {
  type: SuggestionType;
  message: string;
  alternatives: string[];
  categories?: Array<{ name: string; count: number }>;
}

export interface SuggesterOptions {
  minResultsForSuggestion?: number;  // 结果少于此数量时提供建议（默认 3）
  maxResultsForClarify?: number;     // 结果多于此数量时提示缩小范围（默认 20）
  maxSuggestions?: number;           // 最多返回几个建议（默认 5）
}

export class SearchSuggester {
  private spellCorrector: SpellCorrector;
  private options: Required<SuggesterOptions>;

  // 热门搜索词（基于使用频率）
  private popularTerms: Map<string, number> = new Map([
    // 核心概念
    ['message', 100],
    ['conversation', 95],
    ['chat', 90],
    ['group', 85],
    ['user', 80],
    ['avatar', 75],
    ['bubble', 70],
    ['cell', 70],
    ['controller', 65],
    ['view', 60],
    // 功能
    ['send', 55],
    ['receive', 50],
    ['callback', 50],
    ['delegate', 50],
    ['appearance', 45],
    ['custom', 45],
    ['style', 40],
    ['theme', 40],
  ]);

  // 类别关键词映射
  private categoryKeywords: Map<string, string[]> = new Map([
    ['消息相关', ['message', 'msg', 'text', 'bubble', 'send', 'receive']],
    ['会话相关', ['conversation', 'conv', 'chat', 'thread']],
    ['联系人相关', ['contact', 'user', 'friend', 'profile', 'avatar']],
    ['群组相关', ['group', 'member', 'owner', 'admin']],
    ['UI组件', ['cell', 'view', 'controller', 'button', 'label']],
    ['样式配置', ['appearance', 'style', 'theme', 'color', 'font']],
  ]);

  constructor(options: SuggesterOptions = {}) {
    this.spellCorrector = new SpellCorrector();
    this.options = {
      minResultsForSuggestion: options.minResultsForSuggestion ?? 3,
      maxResultsForClarify: options.maxResultsForClarify ?? 20,
      maxSuggestions: options.maxSuggestions ?? 5,
    };
  }

  /**
   * 生成搜索建议
   */
  generateSuggestions<T extends { name?: string; description?: string }>(
    query: string,
    results: T[],
    options?: {
      correctedQuery?: string;
      expandedTerms?: string[];
    }
  ): SearchSuggestion | undefined {
    // 结果为空 - 推荐热门搜索
    if (results.length === 0) {
      return this.suggestPopular(query);
    }

    // 结果太少 - 推荐相关搜索
    if (results.length <= this.options.minResultsForSuggestion) {
      return this.suggestRelated(query, results);
    }

    // 结果太多 - 提示分类缩小范围
    if (results.length >= this.options.maxResultsForClarify) {
      return this.suggestClarify(query, results);
    }

    return undefined;
  }

  /**
   * 建议热门搜索（结果为空时）
   */
  private suggestPopular(query: string): SearchSuggestion {
    const suggestions = this.findSimilarPopularTerms(query);

    return {
      type: 'popular',
      message: '未找到匹配结果，您可能想搜索：',
      alternatives: suggestions,
    };
  }

  /**
   * 建议相关搜索（结果太少时）
   */
  private suggestRelated<T extends { name?: string; description?: string }>(
    query: string,
    results: T[]
  ): SearchSuggestion {
    const related = new Set<string>();

    // 从现有结果中提取相关词
    for (const result of results) {
      const name = result.name || '';

      // 提取相关类/方法
      if (name.includes('Message')) {
        related.add('MessageCell');
        related.add('MessageEntity');
        related.add('CustomMessageCell');
      }
      if (name.includes('Conversation')) {
        related.add('ConversationList');
        related.add('ConversationCell');
        related.add('ConversationViewController');
      }
      if (name.includes('Contact')) {
        related.add('ContactList');
        related.add('ContactCell');
        related.add('UserProfile');
      }
      if (name.includes('Group')) {
        related.add('GroupList');
        related.add('GroupMember');
        related.add('GroupInfo');
      }
      if (name.includes('Chat')) {
        related.add('ChatView');
        related.add('ChatViewController');
        related.add('ChatManager');
      }

      // 如果是 Cell，推荐对应的 Controller
      if (name.includes('Cell')) {
        const baseName = name.replace('Cell', '');
        related.add(`${baseName}Controller`);
        related.add(`${baseName}View`);
      }
    }

    // 移除已经在结果中的
    for (const result of results) {
      related.delete(result.name || '');
    }

    // 如果还是太少，添加热门搜索
    if (related.size < 3) {
      const popular = this.findSimilarPopularTerms(query);
      popular.forEach(term => related.add(term));
    }

    const alternatives = Array.from(related).slice(0, this.options.maxSuggestions);

    return {
      type: 'related',
      message: `找到 ${results.length} 个结果，您可能还想搜索：`,
      alternatives,
    };
  }

  /**
   * 建议分类过滤（结果太多时）
   */
  private suggestClarify<T extends { name?: string; description?: string }>(
    query: string,
    results: T[]
  ): SearchSuggestion {
    // 统计各类别的结果数量
    const categoryCount = new Map<string, number>();
    const categoryExamples = new Map<string, Set<string>>();

    for (const result of results) {
      const name = result.name || '';
      const category = this.detectCategory(name);

      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);

      if (!categoryExamples.has(category)) {
        categoryExamples.set(category, new Set());
      }
      if (categoryExamples.get(category)!.size < 2) {
        categoryExamples.get(category)!.add(name);
      }
    }

    // 按数量排序
    const sortedCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.options.maxSuggestions);

    // 生成建议文本
    const alternatives = sortedCategories.map(([category, count]) => {
      const examples = Array.from(categoryExamples.get(category) || []);
      return `${category} (${count} 个，如: ${examples.join(', ')})`;
    });

    return {
      type: 'clarify',
      message: `找到 ${results.length}+ 个结果，建议按类别缩小范围：`,
      alternatives,
      categories: sortedCategories.map(([name, count]) => ({ name, count })),
    };
  }

  /**
   * 检测结果属于哪个类别
   */
  private detectCategory(name: string): string {
    const lowerName = name.toLowerCase();

    // 按关键词匹配类别
    for (const [category, keywords] of this.categoryKeywords) {
      for (const keyword of keywords) {
        if (lowerName.includes(keyword)) {
          return category;
        }
      }
    }

    return '其他';
  }

  /**
   * 查找相似的热门搜索词
   */
  private findSimilarPopularTerms(query: string): string[] {
    const queryLower = query.toLowerCase();
    const candidates: Array<{ term: string; score: number }> = [];

    for (const [term, frequency] of this.popularTerms) {
      // 计算相似度
      let score = 0;

      // 完全包含
      if (queryLower.includes(term) || term.includes(queryLower)) {
        score += 100;
      }

      // 首字母相同
      if (queryLower[0] === term[0]) {
        score += 20;
      }

      // 拼写相似度
      const corrected = this.spellCorrector.correct(queryLower);
      if (corrected.corrected === term) {
        score += 50;
      }

      // 频率加成
      score += frequency / 10;

      if (score > 0) {
        candidates.push({ term, score });
      }
    }

    // 排序并返回前 N 个
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, this.options.maxSuggestions)
      .map(c => c.term);
  }

  /**
   * 更新热门搜索词（可以根据实际使用情况动态调整）
   */
  updatePopularTerm(term: string, increment: number = 1): void {
    const current = this.popularTerms.get(term) || 0;
    this.popularTerms.set(term, current + increment);
  }

  /**
   * 获取当前热门搜索词（用于统计分析）
   */
  getTopSearches(limit: number = 10): Array<{ term: string; frequency: number }> {
    return Array.from(this.popularTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, frequency]) => ({ term, frequency }));
  }
}
