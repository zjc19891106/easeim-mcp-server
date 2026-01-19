/**
 * 意图分类器
 * 理解用户自然语言查询的真实意图
 */

import { SimilarityMatcher, Vectorizable } from './SimilarityMatcher.js';
import { IntentRegistry } from './IntentRegistry.js';

/**
 * 用户意图类型
 */
export enum UserIntent {
  IMPLEMENT_FEATURE = 'implement_feature',      // 实现功能
  CUSTOMIZE_UI = 'customize_ui',                // 定制 UI
  CUSTOMIZE_MESSAGE = 'customize_message',      // 自定义消息类型
  ADD_MENU_ITEM = 'add_menu_item',              // 添加菜单项
  FIX_ERROR = 'fix_error',                      // 修复错误
  UNDERSTAND_API = 'understand_api',            // 理解 API
  UNDERSTAND_CLASS = 'understand_class',        // 理解类/组件
  INTEGRATE_SDK = 'integrate_sdk',              // 集成 SDK
  CONFIGURE_APPEARANCE = 'configure_appearance', // 配置外观
  UNKNOWN = 'unknown',                          // 未知意图
}

/**
 * 提取的实体信息
 */
export interface ExtractedEntities {
  errorCode: number | null;
  componentName: string | null;
  featureName: string | null;
  className: string | null;
  messageName: string | null;
  configProperty: string | null;
}

/**
 * 意图分类结果
 */
export interface IntentResult {
  intent: UserIntent;
  confidence: number;
  entities: ExtractedEntities;
  subIntent?: string;
}

export class IntentClassifier {
  private registry: IntentRegistry;
  private intentPatterns: Array<{ intent: UserIntent; patterns: RegExp[]; weight: number }>;

  constructor(registry?: IntentRegistry) {
    this.registry = registry || new IntentRegistry();
    this.intentPatterns = this.registry.getPatterns();
  }


  /**
   * 分类用户意图 - 多信号融合策略
   * 1. 规则匹配（快速路径）
   * 2. 实体识别增强（高置信度信号）
   * 3. 语义匹配兜底
   */
  classify(query: string, platform?: string): IntentResult {
    if (!platform) {
      return {
        intent: UserIntent.UNKNOWN,
        confidence: 0,
        entities: {
          errorCode: null,
          componentName: null,
          featureName: null,
          className: null,
          messageName: null,
          configProperty: null
        },
        subIntent: 'missing_platform'
      };
    }

    const entities = this.extractEntities(query, platform);

    let bestIntent = UserIntent.UNKNOWN;
    let bestScore = 0;

    // === 信号1: 实体识别增强（最高优先级） ===
    const entityBoost = this.getEntityBasedIntent(entities);
    if (entityBoost.intent !== UserIntent.UNKNOWN) {
      bestIntent = entityBoost.intent;
      bestScore = entityBoost.confidence;
    }

    // === 信号2: 规则模式匹配 ===
    for (const { intent, patterns, weight } of this.intentPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          let matchScore = this.calculateMatchScore(query, pattern, weight);

          // 如果实体与规则意图一致，加分
          if (this.entityMatchesIntent(entities, intent)) {
            matchScore += 15;
          }

          if (matchScore > bestScore) {
            bestScore = matchScore;
            bestIntent = intent;
          }
        }
      }
    }

    // === 信号3: 语义匹配兜底 ===
    let semanticScenarioId: string | undefined;
    if (bestScore < 60) {
      const bestSemanticMatch = this.matchSemanticScenario(query);
      if (bestSemanticMatch && bestSemanticMatch.score > 0.15) {
        const semanticScore = bestSemanticMatch.score * 100;
        if (semanticScore > bestScore) {
          bestIntent = this.mapScenarioToIntent(bestSemanticMatch.target.id);
          bestScore = semanticScore;
          semanticScenarioId = bestSemanticMatch.target.id;
        }
      }
    }

    // 根据实体情况微调最终置信度
    const finalConfidence = this.adjustConfidenceByEntities(bestScore, entities, bestIntent);

    return {
      intent: bestIntent,
      confidence: Math.min(finalConfidence, 100),
      entities,
      subIntent: semanticScenarioId,
    };
  }

  /**
   * 基于实体的意图推断 - 某些实体直接决定意图
   */
  private getEntityBasedIntent(entities: ExtractedEntities): { intent: UserIntent; confidence: number } {
    // 有错误码 → 修复错误意图
    if (entities.errorCode !== null) {
      return { intent: UserIntent.FIX_ERROR, confidence: 95 };
    }

    // 有消息类型名 → 自定义消息意图
    if (entities.messageName !== null) {
      return { intent: UserIntent.CUSTOMIZE_MESSAGE, confidence: 90 };
    }

    // 有配置属性 → 配置外观意图
    if (entities.configProperty !== null) {
      return { intent: UserIntent.CONFIGURE_APPEARANCE, confidence: 85 };
    }

    // 有类名 → 理解类意图（较低置信度，需配合其他信号）
    if (entities.className !== null) {
      return { intent: UserIntent.UNDERSTAND_CLASS, confidence: 60 };
    }

    return { intent: UserIntent.UNKNOWN, confidence: 0 };
  }

  /**
   * 检查实体是否与意图匹配
   */
  private entityMatchesIntent(entities: ExtractedEntities, intent: UserIntent): boolean {
    switch (intent) {
      case UserIntent.FIX_ERROR:
        return entities.errorCode !== null;
      case UserIntent.CUSTOMIZE_MESSAGE:
        return entities.messageName !== null || entities.className?.includes('Message') || false;
      case UserIntent.CUSTOMIZE_UI:
      case UserIntent.CONFIGURE_APPEARANCE:
        return entities.configProperty !== null;
      case UserIntent.UNDERSTAND_CLASS:
        return entities.className !== null;
      default:
        return false;
    }
  }

  /**
   * 根据实体丰富度调整置信度
   */
  private adjustConfidenceByEntities(
    baseScore: number,
    entities: ExtractedEntities,
    intent: UserIntent
  ): number {
    let adjustment = 0;

    // 提取到的实体越多，置信度越高
    const entityCount = Object.values(entities).filter(v => v !== null).length;
    adjustment += entityCount * 3;

    // 特定意图+实体组合加分
    if (intent === UserIntent.FIX_ERROR && entities.errorCode) {
      adjustment += 10;
    }
    if (intent === UserIntent.CUSTOMIZE_MESSAGE && entities.messageName) {
      adjustment += 8;
    }
    if (intent === UserIntent.UNDERSTAND_CLASS && entities.className) {
      adjustment += 5;
    }

    return baseScore + adjustment;
  }

  private calculateMatchScore(query: string, pattern: RegExp, baseWeight: number): number {
    const match = query.match(pattern);
    if (!match) return 0;
    return baseWeight + (match[0].length / query.length) * 20;
  }

  /**
   * 实体抽取 - 从查询中提取关键实体信息
   * 支持：错误码、组件名、类名、消息类型、配置属性
   */
  private extractEntities(query: string, platform: string): ExtractedEntities {
    const entities: ExtractedEntities = {
      errorCode: null,
      componentName: null,
      featureName: null,
      className: null,
      messageName: null,
      configProperty: null,
    };

    const normalizedPlatform = this.normalizePlatform(platform);
    const rules = this.registry.getEntityRules(normalizedPlatform);

    const errorRules = rules.errorCode;
    if (errorRules) {
      for (const pattern of errorRules.patterns) {
        const match = query.match(new RegExp(pattern, 'i'));
        if (match) {
          const code = parseInt(match[1]);
          const min = errorRules.range?.min ?? 1;
          const max = errorRules.range?.max ?? 999;
          if (code >= min && code <= max) {
            entities.errorCode = code;
            break;
          }
        }
      }
    }

    const componentRules = rules.component;
    if (componentRules) {
      for (const pattern of componentRules.patterns) {
        const match = query.match(new RegExp(pattern, 'i'));
        if (match) {
          const normalized = match[1].toLowerCase();
          entities.componentName = componentRules.mapping?.[normalized] || match[1];
          break;
        }
      }
    }

    const classRules = rules.className;
    if (classRules) {
      for (const pattern of classRules.patterns) {
        const match = query.match(new RegExp(pattern));
        if (match && match[1].length > 3) {
          const excluded = classRules.exclude || [];
          if (!excluded.includes(match[1])) {
            entities.className = match[1];
            break;
          }
        }
      }
    }

    const messageRules = rules.messageName;
    if (messageRules) {
      for (const pattern of messageRules.patterns) {
        const match = query.match(new RegExp(pattern, 'i'));
        if (match) {
          entities.messageName = match[1];
          break;
        }
      }
    }

    const configRules = rules.configProperty;
    if (configRules) {
      for (const pattern of configRules.patterns) {
        const match = query.match(new RegExp(pattern, 'i'));
        if (match) {
          entities.configProperty = match[1];
          break;
        }
      }
    }

    const featureRules = rules.featureName;
    if (featureRules) {
      for (const pattern of featureRules.patterns) {
        const match = query.match(new RegExp(pattern, 'i'));
        if (match && !entities.featureName) {
          entities.featureName = match[1];
          break;
        }
      }
    }

    return entities;
  }

  private normalizePlatform(platform: string): string {
    const normalized = platform.toLowerCase();
    if (normalized === 'react-native' || normalized === 'reactnative') return 'rn';
    return normalized;
  }

  private matchSemanticScenario(query: string) {
    const scenarioTargets: Vectorizable[] = this.registry.getScenarioTargets();
    return SimilarityMatcher.findBestMatch(query, scenarioTargets, 0.20);
  }

  private mapScenarioToIntent(scenarioId: string): UserIntent {
    const map = this.registry.getScenarioIntentMap();
    return map[scenarioId] || UserIntent.CUSTOMIZE_MESSAGE;
  }

  getIntentDescription(intent: UserIntent): string {
    const descriptions = this.registry.getIntentDescriptions();
    return descriptions[intent];
  }
}
