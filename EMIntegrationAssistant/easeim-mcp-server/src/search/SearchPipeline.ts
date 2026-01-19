import { QueryExpander, ExpandedQuery } from '../intelligence/QueryExpander.js';
import { SpellCorrector, QueryCorrectionResult } from '../intelligence/SpellCorrector.js';
import { SearchSuggester, SearchSuggestion } from '../intelligence/SearchSuggester.js';

export type QueryPreparation = {
  originalQuery: string;
  processedQuery: string;
  correctedQuery: string;
  expandedQuery: ExpandedQuery;
  expandedQueryStr: string;
  spellCorrection?: QueryCorrectionResult;
};

export type SuggestionContext = {
  correctedQuery?: string;
  expandedTerms?: string[];
};

export class SearchPipeline {
  constructor(
    private readonly queryExpander: QueryExpander,
    private readonly options?: {
      spellCorrector?: SpellCorrector;
      searchSuggester?: SearchSuggester;
      preprocess?: (query: string) => string;
    }
  ) {}

  prepareQuery(query: string): QueryPreparation {
    const processedQuery = this.options?.preprocess ? this.options.preprocess(query) : query;
    const spellCorrection = this.options?.spellCorrector?.correctQuery(processedQuery);
    const correctedQuery = spellCorrection?.correctedQuery || processedQuery;
    const expandedQuery = this.queryExpander.expand(correctedQuery);

    return {
      originalQuery: query,
      processedQuery,
      correctedQuery,
      expandedQuery,
      expandedQueryStr: expandedQuery.expanded.join(' '),
      spellCorrection: spellCorrection?.hasCorrected ? spellCorrection : undefined
    };
  }

  buildSuggestion(
    query: string,
    results: Array<{ name?: string; description?: string }>,
    context: SuggestionContext
  ): SearchSuggestion | undefined {
    if (!this.options?.searchSuggester) return undefined;
    return this.options.searchSuggester.generateSuggestions(query, results, context);
  }
}
