/**
 * 倒排索引 (Inverted Index)
 * 优化文档搜索性能，从 O(n) 全表扫描降到 O(k) 词项查找
 *
 * 特性：
 * - TF-IDF 加权评分
 * - 支持中英文混合分词
 * - 字段级权重配置
 * - 预计算 IDF 缓存
 */

export interface IndexedDocument {
  id: string;
  fields: Record<string, string>;  // 字段名 → 文本内容
  metadata?: Record<string, any>;  // 额外元数据
}

export interface IndexEntry {
  docId: string;
  field: string;
  tf: number;           // 词频 (Term Frequency)
  positions: number[];  // 词在文档中的位置
}

export interface SearchResult {
  docId: string;
  score: number;
  matchedTerms: string[];
  metadata?: Record<string, any>;
}

export interface IndexConfig {
  fieldWeights?: Record<string, number>;  // 字段权重
  enablePositions?: boolean;               // 是否记录位置
  minTermLength?: number;                  // 最小词长度
}

export class InvertedIndex {
  private index: Map<string, IndexEntry[]> = new Map();
  private documents: Map<string, IndexedDocument> = new Map();
  private idfCache: Map<string, number> = new Map();
  private docCount: number = 0;
  private avgDocLength: number = 0;
  private docLengths: Map<string, number> = new Map();

  private config: Required<IndexConfig> = {
    fieldWeights: {
      'name': 3.0,
      'title': 3.0,
      'id': 2.0,
      'keywords': 2.0,
      'description': 1.0,
      'content': 1.0,
    },
    enablePositions: false,
    minTermLength: 1,
  };

  // 停用词
  private stopWords: Set<string> = new Set([
    '的', '是', '在', '了', '和', '与', '或', '一个', '这个',
    'the', 'a', 'an', 'is', 'are', 'to', 'for', 'of', 'in', 'on',
  ]);

  constructor(config?: IndexConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 批量构建索引
   */
  build(documents: IndexedDocument[]): void {
    this.clear();
    this.docCount = documents.length;

    let totalLength = 0;

    for (const doc of documents) {
      this.documents.set(doc.id, doc);
      let docLength = 0;

      for (const [field, text] of Object.entries(doc.fields)) {
        if (!text) continue;

        const tokens = this.tokenize(text);
        docLength += tokens.length;

        // 统计词频
        const termFreq: Map<string, { count: number; positions: number[] }> = new Map();
        tokens.forEach((token, position) => {
          if (!termFreq.has(token)) {
            termFreq.set(token, { count: 0, positions: [] });
          }
          const entry = termFreq.get(token)!;
          entry.count++;
          if (this.config.enablePositions) {
            entry.positions.push(position);
          }
        });

        // 添加到倒排索引
        for (const [term, { count, positions }] of termFreq) {
          if (!this.index.has(term)) {
            this.index.set(term, []);
          }
          this.index.get(term)!.push({
            docId: doc.id,
            field,
            tf: count,
            positions,
          });
        }
      }

      this.docLengths.set(doc.id, docLength);
      totalLength += docLength;
    }

    this.avgDocLength = totalLength / Math.max(this.docCount, 1);

    // 预计算 IDF
    this.precomputeIDF();
  }

  /**
   * 添加单个文档到索引
   */
  addDocument(doc: IndexedDocument): void {
    if (this.documents.has(doc.id)) {
      this.removeDocument(doc.id);
    }

    this.documents.set(doc.id, doc);
    this.docCount++;
    let docLength = 0;

    for (const [field, text] of Object.entries(doc.fields)) {
      if (!text) continue;

      const tokens = this.tokenize(text);
      docLength += tokens.length;

      const termFreq: Map<string, { count: number; positions: number[] }> = new Map();
      tokens.forEach((token, position) => {
        if (!termFreq.has(token)) {
          termFreq.set(token, { count: 0, positions: [] });
        }
        const entry = termFreq.get(token)!;
        entry.count++;
        if (this.config.enablePositions) {
          entry.positions.push(position);
        }
      });

      for (const [term, { count, positions }] of termFreq) {
        if (!this.index.has(term)) {
          this.index.set(term, []);
        }
        this.index.get(term)!.push({
          docId: doc.id,
          field,
          tf: count,
          positions,
        });
      }
    }

    this.docLengths.set(doc.id, docLength);

    // 重新计算 IDF（增量更新时可优化）
    this.precomputeIDF();
  }

  /**
   * 从索引中移除文档
   */
  removeDocument(docId: string): boolean {
    if (!this.documents.has(docId)) {
      return false;
    }

    this.documents.delete(docId);
    this.docLengths.delete(docId);
    this.docCount--;

    // 从倒排索引中移除
    for (const [term, entries] of this.index) {
      const filtered = entries.filter(e => e.docId !== docId);
      if (filtered.length === 0) {
        this.index.delete(term);
      } else {
        this.index.set(term, filtered);
      }
    }

    return true;
  }

  /**
   * 搜索 - 使用 BM25 评分
   */
  search(query: string, limit: number = 10): SearchResult[] {
    const queryTerms = this.tokenize(query);
    const scores: Map<string, { score: number; matchedTerms: Set<string> }> = new Map();

    // BM25 参数
    const k1 = 1.2;
    const b = 0.75;

    for (const term of queryTerms) {
      const entries = this.index.get(term);
      if (!entries) continue;

      const idf = this.idfCache.get(term) || 0;

      for (const entry of entries) {
        const docLength = this.docLengths.get(entry.docId) || this.avgDocLength;
        const fieldWeight = this.config.fieldWeights[entry.field] || 1.0;

        // BM25 评分公式
        const tfNorm = (entry.tf * (k1 + 1)) /
          (entry.tf + k1 * (1 - b + b * (docLength / this.avgDocLength)));
        const termScore = idf * tfNorm * fieldWeight;

        if (!scores.has(entry.docId)) {
          scores.set(entry.docId, { score: 0, matchedTerms: new Set() });
        }
        const docScore = scores.get(entry.docId)!;
        docScore.score += termScore;
        docScore.matchedTerms.add(term);
      }
    }

    // 排序并返回
    const results: SearchResult[] = Array.from(scores.entries())
      .map(([docId, { score, matchedTerms }]) => ({
        docId,
        score,
        matchedTerms: Array.from(matchedTerms),
        metadata: this.documents.get(docId)?.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  /**
   * 精确匹配搜索（用于 ID/名称精确查找）
   */
  exactMatch(term: string, field?: string): string[] {
    const lowerTerm = term.toLowerCase();
    const results: string[] = [];

    for (const [docId, doc] of this.documents) {
      for (const [f, text] of Object.entries(doc.fields)) {
        if (field && f !== field) continue;
        if (text.toLowerCase() === lowerTerm) {
          results.push(docId);
          break;
        }
      }
    }

    return results;
  }

  /**
   * 前缀搜索
   */
  prefixSearch(prefix: string, limit: number = 10): SearchResult[] {
    const lowerPrefix = prefix.toLowerCase();
    const matchedDocs: Map<string, number> = new Map();

    for (const [term, entries] of this.index) {
      if (term.startsWith(lowerPrefix)) {
        for (const entry of entries) {
          const current = matchedDocs.get(entry.docId) || 0;
          matchedDocs.set(entry.docId, current + entry.tf);
        }
      }
    }

    return Array.from(matchedDocs.entries())
      .map(([docId, score]) => ({
        docId,
        score,
        matchedTerms: [prefix],
        metadata: this.documents.get(docId)?.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * 获取索引统计信息
   */
  getStats(): {
    documentCount: number;
    termCount: number;
    avgDocLength: number;
    indexSize: number;
  } {
    let indexSize = 0;
    for (const entries of this.index.values()) {
      indexSize += entries.length;
    }

    return {
      documentCount: this.docCount,
      termCount: this.index.size,
      avgDocLength: this.avgDocLength,
      indexSize,
    };
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.index.clear();
    this.documents.clear();
    this.idfCache.clear();
    this.docLengths.clear();
    this.docCount = 0;
    this.avgDocLength = 0;
  }

  /**
   * 分词器 - 支持中英文混合
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    const normalized = text.toLowerCase();

    // 英文单词
    const englishWords = normalized.match(/[a-z][a-z0-9_]*/g) || [];
    for (const word of englishWords) {
      if (word.length >= this.config.minTermLength && !this.stopWords.has(word)) {
        tokens.push(word);
      }
    }

    // 中文处理
    const chineseSegments = normalized.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseSegments) {
      // 单字
      for (const char of segment) {
        if (!this.stopWords.has(char)) {
          tokens.push(char);
        }
      }

      // Bigram (二元组)
      if (segment.length >= 2) {
        for (let i = 0; i < segment.length - 1; i++) {
          const bigram = segment.substring(i, i + 2);
          tokens.push(bigram);
        }
      }

      // Trigram (三元组，用于"聊天室"等三字词)
      if (segment.length >= 3) {
        for (let i = 0; i < segment.length - 2; i++) {
          const trigram = segment.substring(i, i + 3);
          tokens.push(trigram);
        }
      }
    }

    return tokens;
  }

  /**
   * 预计算 IDF (Inverse Document Frequency)
   */
  private precomputeIDF(): void {
    this.idfCache.clear();

    for (const [term, entries] of this.index) {
      // 计算文档频率 (包含该词的文档数)
      const docIds = new Set(entries.map(e => e.docId));
      const df = docIds.size;

      // IDF 公式: log((N - df + 0.5) / (df + 0.5) + 1)
      // 这是 BM25 使用的 IDF 变体
      const idf = Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1);
      this.idfCache.set(term, idf);
    }
  }

  /**
   * 获取词项的 IDF 值
   */
  getIDF(term: string): number {
    return this.idfCache.get(term.toLowerCase()) || 0;
  }

  /**
   * 获取词项的文档频率
   */
  getDocumentFrequency(term: string): number {
    const entries = this.index.get(term.toLowerCase());
    if (!entries) return 0;
    return new Set(entries.map(e => e.docId)).size;
  }

  /**
   * 导出索引（用于持久化）
   */
  export(): {
    documents: Array<IndexedDocument>;
    config: IndexConfig;
  } {
    return {
      documents: Array.from(this.documents.values()),
      config: this.config,
    };
  }

  /**
   * 从导出数据恢复索引
   */
  import(data: { documents: IndexedDocument[]; config?: IndexConfig }): void {
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
    this.build(data.documents);
  }
}
