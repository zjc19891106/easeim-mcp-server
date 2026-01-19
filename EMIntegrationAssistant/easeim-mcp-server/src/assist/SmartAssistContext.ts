import { ContextManager } from '../intelligence/ContextManager.js';

export class SmartAssistContext {
  constructor(private readonly contextManager: ContextManager) {}

  detectContinuity(query: string, sessionId: string) {
    return this.contextManager.detectContinuity(query, sessionId);
  }

  getContextSummary(sessionId: string) {
    return this.contextManager.getContextSummary(sessionId);
  }

  enhanceQuery(query: string, sessionId: string) {
    return this.contextManager.enhanceQuery(query, sessionId);
  }

  recordSearch(query: string, intentResult: any, sessionId: string) {
    this.contextManager.recordSearch(query, intentResult, undefined, sessionId);
  }

  getRecommendations(sessionId: string, limit: number) {
    return this.contextManager.getRecommendations(sessionId, limit);
  }
}
