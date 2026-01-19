/**
 * 智能化模块导出
 */

export { IntentClassifier, UserIntent } from './IntentClassifier.js';
export type { ExtractedEntities, IntentResult } from './IntentClassifier.js';

export { KnowledgeGraph } from './KnowledgeGraph.js';
export type { ScenarioSolution, ClassInfo, RelatedItems } from './KnowledgeGraph.js';

export { ClassRegistry } from './ClassRegistry.js';
export type { ClassInfo as RegistryClassInfo } from './ClassRegistry.js';

export { CodeGenerator } from './CodeGenerator.js';
export type { CodeTemplate, TemplateVariable, GenerateOptions, GenerateResult } from './CodeGenerator.js';

export { TemplateRegistry } from './TemplateRegistry.js';
export type { TemplateItem } from './TemplateRegistry.js';

export { KnowledgeRegistry } from './KnowledgeRegistry.js';
export type { ScenarioItem } from './KnowledgeRegistry.js';

export { PlatformOrchestrator } from './PlatformOrchestrator.js';
export type { PlatformAdapter, PlatformProfile, ScenarioView } from './PlatformAdapters.js';

export { IntentRegistry } from './IntentRegistry.js';

export { QueryExpander } from './QueryExpander.js';
export type { ExpandedQuery } from './QueryExpander.js';

export { SimilarityMatcher } from './SimilarityMatcher.js';
export type { Vectorizable, MatchResult } from './SimilarityMatcher.js';

export { IntegrationGuide } from './IntegrationGuide.js';
export type { PodfileCheck, PodfileIssue } from './IntegrationGuide.js';

export { IntegrationRegistry } from './IntegrationRegistry.js';
export type { PlatformRequirement, IntegrationProblem, IntegrationSolution } from './IntegrationRegistry.js';

export { LexiconRegistry } from './LexiconRegistry.js';

export { ContextManager } from './ContextManager.js';
export type { SearchHistoryEntry, SessionContext, ContinuityResult, RelatedRecommendation } from './ContextManager.js';
