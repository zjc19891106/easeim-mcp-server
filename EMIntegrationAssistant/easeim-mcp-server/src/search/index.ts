/**
 * 搜索模块导出
 *
 * 提供两种搜索引擎实现：
 * 1. 传统全量加载：DocSearch, ConfigSearch, SourceSearch
 * 2. 分片按需加载：ShardedDocSearch, ShardedConfigSearch, ShardedSourceSearch
 *
 * 推荐使用分片版本以获得更好的启动性能和内存占用
 */

// 传统全量加载版本（保留向后兼容）
export { DocSearch } from './DocSearch.js';
export { SourceSearch } from './SourceSearch.js';
export { ConfigSearch } from './ConfigSearch.js';

// 分片按需加载版本（推荐使用）
export { ShardedDocSearch } from './ShardedDocSearch.js';
export { ShardedSourceSearch } from './ShardedSourceSearch.js';
export { ShardedConfigSearch } from './ShardedConfigSearch.js';

// 工具类
export { AmbiguityDetector } from './AmbiguityDetector.js';
export { InvertedIndex } from './InvertedIndex.js';

// 类型导出
export type {
  IndexedDocument,
  IndexEntry,
  SearchResult as InvertedIndexSearchResult,
  IndexConfig
} from './InvertedIndex.js';
