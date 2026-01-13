/**
 * 智能化模块导出
 */

export { IntentClassifier, UserIntent } from './IntentClassifier.js';
export type { ExtractedEntities, IntentResult } from './IntentClassifier.js';

export { KnowledgeGraph } from './KnowledgeGraph.js';
export type { ScenarioSolution, ClassInfo, RelatedItems } from './KnowledgeGraph.js';

export { CodeGenerator } from './CodeGenerator.js';
export type { CodeTemplate, TemplateVariable, GenerateOptions, GenerateResult } from './CodeGenerator.js';

export { QueryExpander } from './QueryExpander.js';
export type { ExpandedQuery } from './QueryExpander.js';

export { SimilarityMatcher } from './SimilarityMatcher.js';
export type { Vectorizable, MatchResult } from './SimilarityMatcher.js';

export { IntegrationGuide, PLATFORM_REQUIREMENTS, INTEGRATION_PROBLEMS, PODFILE_TEMPLATES } from './IntegrationGuide.js';
export type { PlatformRequirement, IntegrationProblem, IntegrationSolution, PodfileCheck, PodfileIssue } from './IntegrationGuide.js';

export { ContextManager } from './ContextManager.js';
export type { SearchHistoryEntry, SessionContext, ContinuityResult, RelatedRecommendation } from './ContextManager.js';
