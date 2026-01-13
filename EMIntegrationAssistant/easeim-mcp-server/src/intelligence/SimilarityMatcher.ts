/**
 * 语义相似度匹配器
 * 利用余弦相似度算法优化模糊 Prompt 的匹配精度
 *
 * v2.0 优化：
 * - 支持 TF-IDF 加权
 * - 停用词过滤
 * - 实例化使用支持语料库预训练
 */

export interface Vectorizable {
  id: string;
  text: string;
}

export interface MatchResult<T> {
  target: T;
  score: number;
  matchedTerms?: string[];
}

export class SimilarityMatcher {
  // === 实例属性（支持 TF-IDF）===
  private idfWeights: Map<string, number> = new Map();
  private documentCount: number = 0;
  private isTrainedWithIDF: boolean = false;

  // 停用词
  private static stopWords: Set<string> = new Set([
    '的', '是', '在', '了', '和', '与', '或', '一个', '这个', '那个',
    '如何', '怎么', '怎样', '什么', '为什么', '哪个', '哪些', '可以', '能够',
    'the', 'a', 'an', 'is', 'are', 'to', 'for', 'of', 'in', 'on',
    'how', 'what', 'why', 'which', 'when', 'where', 'can', 'could',
    'would', 'should', 'do', 'does', 'did', 'be', 'been', 'being',
  ]);

  /**
   * 从语料库训练 IDF 权重
   * @param corpus 语料库文档数组
   */
  trainIDF(corpus: string[]): void {
    this.documentCount = corpus.length;
    const df: Map<string, number> = new Map();

    // 统计文档频率
    for (const doc of corpus) {
      const terms = new Set(this.tokenize(doc));
      for (const term of terms) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }

    // 计算 IDF
    for (const [term, freq] of df) {
      // IDF = log(N / (df + 1)) + 1
      this.idfWeights.set(term, Math.log(this.documentCount / (freq + 1)) + 1);
    }

    this.isTrainedWithIDF = true;
  }

  /**
   * 使用 TF-IDF 加权计算相似度
   */
  calculateTFIDFSimilarity(str1: string, str2: string): number {
    const vec1 = this.getTFIDFVector(str1);
    const vec2 = this.getTFIDFVector(str2);
    return this.cosineSimilarityInstance(vec1, vec2);
  }

  /**
   * 获取 TF-IDF 向量
   */
  private getTFIDFVector(str: string): Map<string, number> {
    const tokens = this.tokenize(str);
    const tf: Map<string, number> = new Map();

    // 计算词频
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // 计算 TF-IDF
    const vector: Map<string, number> = new Map();
    for (const [term, count] of tf) {
      const idf = this.idfWeights.get(term) || 1.0;  // 未知词 IDF=1
      vector.set(term, count * idf);
    }

    return vector;
  }

  /**
   * 实例方法：查找最佳匹配（支持 TF-IDF）
   */
  findBestMatchWithTFIDF<T extends Vectorizable>(
    query: string,
    targets: T[],
    threshold = 0.2
  ): MatchResult<T> | null {
    let bestMatch: T | null = null;
    let maxScore = -1;
    let matchedTerms: string[] = [];

    const queryTokens = new Set(this.tokenize(query));

    for (const target of targets) {
      const score = this.isTrainedWithIDF
        ? this.calculateTFIDFSimilarity(query, target.text)
        : SimilarityMatcher.calculateCosineSimilarity(query, target.text);

      if (score > maxScore) {
        maxScore = score;
        bestMatch = target;

        // 记录匹配的词
        const targetTokens = new Set(this.tokenize(target.text));
        matchedTerms = [...queryTokens].filter(t => targetTokens.has(t));
      }
    }

    return (maxScore >= threshold && bestMatch)
      ? { target: bestMatch, score: maxScore, matchedTerms }
      : null;
  }

  /**
   * 批量匹配，返回 Top-K 结果
   */
  findTopMatches<T extends Vectorizable>(
    query: string,
    targets: T[],
    k: number = 5,
    threshold = 0.1
  ): MatchResult<T>[] {
    const results: MatchResult<T>[] = [];
    const queryTokens = new Set(this.tokenize(query));

    for (const target of targets) {
      const score = this.isTrainedWithIDF
        ? this.calculateTFIDFSimilarity(query, target.text)
        : SimilarityMatcher.calculateCosineSimilarity(query, target.text);

      if (score >= threshold) {
        const targetTokens = new Set(this.tokenize(target.text));
        const matchedTerms = [...queryTokens].filter(t => targetTokens.has(t));
        results.push({ target, score, matchedTerms });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * 实例分词方法
   */
  private tokenize(str: string): string[] {
    const tokens: string[] = [];
    const normalized = str.toLowerCase();

    // 英文单词
    const englishWords = normalized.match(/[a-z][a-z0-9]*/g) || [];
    for (const word of englishWords) {
      if (!SimilarityMatcher.stopWords.has(word)) {
        tokens.push(word);
      }
    }

    // 中文处理
    const chineseSegments = normalized.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseSegments) {
      // 单字（过滤停用词）
      for (const char of segment) {
        if (!SimilarityMatcher.stopWords.has(char)) {
          tokens.push(char);
        }
      }
      // Bigram
      if (segment.length >= 2) {
        for (let i = 0; i < segment.length - 1; i++) {
          tokens.push(segment.substring(i, i + 2));
        }
      }
    }

    return tokens;
  }

  /**
   * 实例余弦相似度
   */
  private cosineSimilarityInstance(vec1: Map<string, number>, vec2: Map<string, number>): number {
    const allTerms = new Set([...vec1.keys(), ...vec2.keys()]);
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (const term of allTerms) {
      const v1 = vec1.get(term) || 0;
      const v2 = vec2.get(term) || 0;
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // === 静态方法（保持向后兼容）===

  /**
   * 计算两个字符串的余弦相似度（静态方法，不使用 IDF）
   */
  public static calculateCosineSimilarity(str1: string, str2: string): number {
    const vec1 = this.getTermFrequencyVector(str1);
    const vec2 = this.getTermFrequencyVector(str2);
    return this.cosineSimilarity(vec1, vec2);
  }

  /**
   * 将字符串转换为词频向量（增强对中文的支持）
   */
  private static getTermFrequencyVector(str: string): Record<string, number> {
    const words = str.toLowerCase().split(/[\s,，。！!、?？]+/).filter(w => w.length > 0);
    const vector: Record<string, number> = {};

    for (const word of words) {
      // 跳过停用词
      if (this.stopWords.has(word)) continue;

      if (/^[a-z0-9]+$/i.test(word)) {
        vector[word] = (vector[word] || 0) + 1;
      } else {
        // 中文单字拆分
        for (const char of word) {
          if (!this.stopWords.has(char)) {
            vector[char] = (vector[char] || 0) + 1;
          }
        }
        // Bigram
        if (word.length >= 2) {
          for (let i = 0; i < word.length - 1; i++) {
            const bigram = word.substring(i, i + 2);
            vector[bigram] = (vector[bigram] || 0) + 1;
          }
        }
      }
    }
    return vector;
  }

  /**
   * 余弦相似度公式实现
   */
  private static cosineSimilarity(vec1: Record<string, number>, vec2: Record<string, number>): number {
    const commonWords = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (const word of commonWords) {
      const v1 = vec1[word] || 0;
      const v2 = vec2[word] || 0;
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * 从一组目标中找到最匹配的一项（静态方法）
   */
  public static findBestMatch<T extends Vectorizable>(
    query: string,
    targets: T[],
    threshold = 0.2
  ): { target: T; score: number } | null {
    let bestMatch: T | null = null;
    let maxScore = -1;

    for (const target of targets) {
      const score = this.calculateCosineSimilarity(query, target.text);
      if (score > maxScore) {
        maxScore = score;
        bestMatch = target;
      }
    }

    return (maxScore >= threshold && bestMatch) ? { target: bestMatch, score: maxScore } : null;
  }
}
