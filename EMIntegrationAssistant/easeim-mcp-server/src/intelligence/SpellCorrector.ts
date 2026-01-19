/**
 * 拼写纠错器
 * 基于 Levenshtein 距离实现模糊拼写纠错，提升搜索容错能力
 */

export interface CorrectionResult {
  original: string;
  corrected: string;
  isCorrected: boolean;
  confidence: number;  // 0-1，越高越确定
  suggestions?: string[];  // 其他可能的纠正建议
}

export interface QueryCorrectionResult {
  originalQuery: string;
  correctedQuery: string;
  hasCorrected: boolean;
  corrections: CorrectionResult[];
  suggestion?: string;  // 用户友好的提示
}

import { LexiconRegistry } from './LexiconRegistry.js';

export class SpellCorrector {
  private dictionary: Set<string> = new Set();
  private wordFrequency: Map<string, number> = new Map();
  private readonly MAX_EDIT_DISTANCE = 2;
  private readonly MIN_WORD_LENGTH = 3;

  constructor(registry?: LexiconRegistry, platform: string = 'common') {
    this.initDictionary(registry, platform);
  }

  private initDictionary(registry?: LexiconRegistry, platform: string = 'common'): void {
    const lexicon = (registry || new LexiconRegistry()).load(platform);
    const { coreTerms, uikitTerms, codeTerms, pinyinTerms } = lexicon.dictionary;

    const allTerms = [...coreTerms, ...uikitTerms, ...codeTerms, ...pinyinTerms];
    for (const term of allTerms) {
      this.dictionary.add(term.toLowerCase());
    }

    this.setHighFrequencyWords(lexicon.highFrequency);
  }

  private setHighFrequencyWords(highFrequency: Record<string, number>): void {
    for (const [word, freq] of Object.entries(highFrequency)) {
      this.wordFrequency.set(word, freq);
    }
  }


  /**
   * 动态添加词到词典（从索引加载时调用）
   */
  addWords(words: string[]): void {
    for (const word of words) {
      if (word && word.length >= this.MIN_WORD_LENGTH) {
        this.dictionary.add(word.toLowerCase());
      }
    }
  }

  getDistance(a: string, b: string): number {
    return this.levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  }

  /**
   * 从驼峰命名中提取词并添加到词典
   */
  addCamelCaseWords(identifier: string): void {
    const words = this.splitCamelCase(identifier);
    this.addWords(words);
  }

  /**
   * 拆分驼峰命名
   */
  private splitCamelCase(text: string): string[] {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= this.MIN_WORD_LENGTH);
  }

  /**
   * 纠正单个词
   */
  correct(term: string): CorrectionResult {
    const lowerTerm = term.toLowerCase();

    // 原词在词典中，无需纠正
    if (this.dictionary.has(lowerTerm)) {
      return {
        original: term,
        corrected: term,
        isCorrected: false,
        confidence: 1.0
      };
    }

    // 词太短，不纠正
    if (term.length < this.MIN_WORD_LENGTH) {
      return {
        original: term,
        corrected: term,
        isCorrected: false,
        confidence: 1.0
      };
    }

    // 查找最佳匹配
    const candidates: Array<{ word: string; distance: number; score: number }> = [];

    for (const dictWord of this.dictionary) {
      // 快速过滤：长度差距太大的跳过
      if (Math.abs(dictWord.length - lowerTerm.length) > this.MAX_EDIT_DISTANCE) {
        continue;
      }

      const distance = this.levenshteinDistance(lowerTerm, dictWord);

      if (distance <= this.MAX_EDIT_DISTANCE) {
        // 计算综合得分：距离越小、词频越高，得分越高
        const frequencyBonus = this.wordFrequency.get(dictWord) || 0;
        const lengthPenalty = Math.abs(dictWord.length - lowerTerm.length) * 0.1;
        const score = (this.MAX_EDIT_DISTANCE - distance) * 10 + frequencyBonus - lengthPenalty;

        candidates.push({ word: dictWord, distance, score });
      }
    }

    if (candidates.length === 0) {
      return {
        original: term,
        corrected: term,
        isCorrected: false,
        confidence: 0.5  // 未找到候选，置信度降低
      };
    }

    // 按得分排序
    candidates.sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const confidence = this.calculateConfidence(lowerTerm, best.word, best.distance);

    // 收集其他建议（最多 3 个）
    const suggestions = candidates
      .slice(1, 4)
      .map(c => c.word);

    return {
      original: term,
      corrected: best.word,
      isCorrected: true,
      confidence,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * 纠正整个查询
   */
  correctQuery(query: string): QueryCorrectionResult {
    const tokens = this.tokenize(query);
    const corrections: CorrectionResult[] = [];
    const correctedTokens: string[] = [];
    let hasCorrected = false;

    for (const token of tokens) {
      const result = this.correct(token);
      corrections.push(result);
      correctedTokens.push(result.corrected);

      if (result.isCorrected) {
        hasCorrected = true;
      }
    }

    const correctedQuery = correctedTokens.join(' ');

    // 生成用户友好的提示
    let suggestion: string | undefined;
    if (hasCorrected) {
      const correctedParts = corrections
        .filter(c => c.isCorrected)
        .map(c => `"${c.original}" → "${c.corrected}"`)
        .join(', ');
      suggestion = `已自动纠正: ${correctedParts}`;
    }

    return {
      originalQuery: query,
      correctedQuery,
      hasCorrected,
      corrections,
      suggestion
    };
  }

  /**
   * Levenshtein 编辑距离算法
   * 计算将字符串 a 转换为字符串 b 所需的最少编辑操作数
   */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // 创建距离矩阵
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // 初始化第一行和第一列
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // 填充矩阵
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // 删除
            dp[i][j - 1],     // 插入
            dp[i - 1][j - 1]  // 替换
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 计算纠正置信度
   */
  private calculateConfidence(original: string, corrected: string, distance: number): number {
    // 基础置信度：距离越小置信度越高
    const baseConfidence = 1 - (distance / Math.max(original.length, corrected.length));

    // 长度相似度加成
    const lengthRatio = Math.min(original.length, corrected.length) /
                        Math.max(original.length, corrected.length);

    // 首字母相同加成
    const firstCharBonus = original[0]?.toLowerCase() === corrected[0] ? 0.1 : 0;

    // 词频加成
    const freqBonus = this.wordFrequency.has(corrected) ? 0.05 : 0;

    return Math.min(baseConfidence * 0.6 + lengthRatio * 0.2 + firstCharBonus + freqBonus, 0.95);
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    // 按空格和常见分隔符分割
    return text
      .toLowerCase()
      .split(/[\s\-_.,;:!?]+/)
      .filter(t => t.length > 0);
  }

  /**
   * 检查词是否在词典中
   */
  isKnownWord(word: string): boolean {
    return this.dictionary.has(word.toLowerCase());
  }

  /**
   * 获取词典大小
   */
  getDictionarySize(): number {
    return this.dictionary.size;
  }

  /**
   * 获取相似词（用于调试/测试）
   */
  getSimilarWords(word: string, maxResults: number = 5): string[] {
    const lowerWord = word.toLowerCase();
    const candidates: Array<{ word: string; distance: number }> = [];

    for (const dictWord of this.dictionary) {
      const distance = this.levenshteinDistance(lowerWord, dictWord);
      if (distance <= this.MAX_EDIT_DISTANCE) {
        candidates.push({ word: dictWord, distance });
      }
    }

    return candidates
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults)
      .map(c => c.word);
  }
}
