/**
 * 搜索模块导出
 */

export { DocSearch } from './DocSearch.js';
export { SourceSearch } from './SourceSearch.js';
export { ShardedSourceSearch } from './ShardedSourceSearch.js';
export { ConfigSearch } from './ConfigSearch.js';
export { AmbiguityDetector } from './AmbiguityDetector.js';
export { InvertedIndex } from './InvertedIndex.js';
export type {
  IndexedDocument,
  IndexEntry,
  SearchResult as InvertedIndexSearchResult,
  IndexConfig
} from './InvertedIndex.js';
