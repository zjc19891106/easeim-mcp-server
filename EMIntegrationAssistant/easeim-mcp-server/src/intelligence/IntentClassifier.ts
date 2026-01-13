/**
 * 意图分类器
 * 理解用户自然语言查询的真实意图
 */

import { SimilarityMatcher, Vectorizable } from './SimilarityMatcher.js';

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

  // 意图识别规则 - 优先级从高到低
  private intentPatterns: Array<{
    intent: UserIntent;
    patterns: RegExp[];
    weight: number;
  }> = [
    // 自定义消息类型 - 最高优先级
    {
      intent: UserIntent.CUSTOMIZE_MESSAGE,
      patterns: [
        /自定义.*(消息|message)/i,
        /新增.*(消息类型|消息样式)/i,
        /(订单|商品|位置|名片|卡片|红包).*(消息|message)/i,
        /custom.*message/i,
        /发送.*(订单|商品|位置|名片|卡片)/i,
        /展示.*(订单|商品|位置|名片).*(消息|样式)/i,
      ],
      weight: 100,
    },
    // 添加菜单项
    {
      intent: UserIntent.ADD_MENU_ITEM,
      patterns: [
        /添加.*(菜单|menu|按钮)/i,
        /增加.*(菜单|附件|选项)/i,
        /(菜单|附件).*(增加|添加|新增)/i,
        /inputExtendActions/i,
        /attachment.*menu/i,
      ],
      weight: 90,
    },
    // 修复错误
    {
      intent: UserIntent.FIX_ERROR,
      patterns: [
        /错误码?\s*[:：]?\s*\d+/i,
        /error\s*code?\s*[:：]?\s*\d+/i,
        /(失败|报错|异常|崩溃|闪退)/,
        /failed|error|crash|exception/i,
        /为什么.*(失败|不行|不能|无法)/,
        /怎么解决.*(错误|问题|异常)/,
      ],
      weight: 95,
    },
    // 定制 UI (包含用户信息更新)
    {
      intent: UserIntent.CUSTOMIZE_UI,
      patterns: [
        /自定义.*(样式|颜色|UI|界面|气泡|头像|主题)/i,
        /修改.*(样式|外观|主题|颜色|背景|头像|昵称)/i,
        /更换.*(图标|图片|颜色|背景|头像)/i,
        /设置.*(头像|昵称|用户信息)/i,
        /更新.*(头像|昵称|用户资料)/i,
        /customize|custom.*style|theme/i,
        /(气泡|bubble).*(颜色|样式|圆角)/i,
        /Appearance/i,
        /userCache/i,
        /userProfileProvider/i,
      ],
      weight: 85,
    },
    // 理解类/组件
    {
      intent: UserIntent.UNDERSTAND_CLASS,
      patterns: [
        /(\w+Cell|\w+View|\w+Controller)\s*(是什么|怎么用|作用)/i,
        /(MessageCell|CustomMessageCell|MessageEntity)\b/i,
        /继承.*(类|class)/i,
        /(\w+).*怎么(继承|重写|扩展)/i,
      ],
      weight: 75,
    },
    // 实现功能
    {
      intent: UserIntent.IMPLEMENT_FEATURE,
      patterns: [
        /如何(实现|发送|接收|创建|添加|显示)/i,
        /怎么(实现|发送|接收|创建|添加|显示)/i,
        /how to (send|receive|create|add|show|implement)/i,
        /实现.*(消息|群组|聊天室|推送|音视频)/i,
      ],
      weight: 60,
    },
    // 集成 SDK
    {
      intent: UserIntent.INTEGRATE_SDK,
      patterns: [
        /集成|接入|初始化|配置.*SDK/i,
        /integrate|setup|initialize|configure/i,
        /快速开始|入门|getting started/i,
        /安装|install|pod|cocoapods|spm/i,
      ],
      weight: 55,
    },
  ];

  /**
   * 分类用户意图 - 多信号融合策略
   * 1. 规则匹配（快速路径）
   * 2. 实体识别增强（高置信度信号）
   * 3. 语义匹配兜底
   */
  classify(query: string): IntentResult {
    // 先提取实体，用于增强意图识别
    const entities = this.extractEntities(query);

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
  private extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {
      errorCode: null,
      componentName: null,
      featureName: null,
      className: null,
      messageName: null,
      configProperty: null,
    };

    // 1. 错误码提取 - 支持多种格式
    const errorPatterns = [
      /错误码?\s*[:：]?\s*(\d+)/i,
      /error\s*code?\s*[:：]?\s*(\d+)/i,
      /code\s*[:：]?\s*(\d+)/i,
      /(\d{3})\s*(错误|error)/i,
      /\b(5\d{2}|4\d{2}|1\d{2})\b/,  // 常见错误码范围
    ];
    for (const pattern of errorPatterns) {
      const match = query.match(pattern);
      if (match) {
        const code = parseInt(match[1]);
        // 验证是否为有效的环信错误码范围 (1-999)
        if (code >= 1 && code <= 999) {
          entities.errorCode = code;
          break;
        }
      }
    }

    // 2. 组件名提取 - UIKit 组件
    const componentPatterns = [
      /\b(EaseChatUIKit|ChatUIKit)\b/i,
      /\b(EaseCallUIKit|CallUIKit|CallKit)\b/i,
      /\b(EaseChatroomUIKit|ChatroomUIKit)\b/i,
      /\b(EaseIMKit|IMKit)\b/i,
    ];
    const componentMapping: Record<string, string> = {
      'easechatuikit': 'EaseChatUIKit',
      'chatuikit': 'EaseChatUIKit',
      'easecalluikit': 'EaseCallUIKit',
      'calluikit': 'EaseCallUIKit',
      'callkit': 'EaseCallUIKit',
      'easechatroomunikit': 'EaseChatroomUIKit',
      'chatroomunikit': 'EaseChatroomUIKit',
      'easeimkit': 'EaseIMKit',
      'imkit': 'EaseIMKit',
    };
    for (const pattern of componentPatterns) {
      const match = query.match(pattern);
      if (match) {
        const normalized = match[1].toLowerCase();
        entities.componentName = componentMapping[normalized] || match[1];
        break;
      }
    }

    // 3. 类名提取 - PascalCase 命名的类
    const classPatterns = [
      // 明确的类名模式
      /\b([A-Z][a-z]+(?:[A-Z][a-z0-9]+)+(?:Cell|View|Controller|Manager|Entity|Provider|Protocol|Delegate))\b/,
      // 通用 PascalCase (至少两个单词)
      /\b([A-Z][a-z]+(?:[A-Z][a-z]+){1,})\b/,
      // 中文描述中的类名
      /(?:类|class)\s*[:：]?\s*([A-Z][a-zA-Z0-9]+)/i,
      /([A-Z][a-zA-Z0-9]+)\s*(?:类|class)/i,
    ];
    for (const pattern of classPatterns) {
      const match = query.match(pattern);
      if (match && match[1].length > 3) {
        // 排除常见非类名词汇
        const excluded = ['UIKit', 'SDK', 'API', 'iOS', 'Swift', 'Xcode'];
        if (!excluded.includes(match[1])) {
          entities.className = match[1];
          break;
        }
      }
    }

    // 4. 消息类型提取 - 自定义消息名称
    const messageTypePatterns = [
      /(订单|商品|位置|名片|卡片|红包|礼物|优惠券|投票|问卷|预约|打卡)\s*消息/,
      /(order|product|location|contact|card|gift|coupon|vote|survey)\s*message/i,
      /自定义\s*([\u4e00-\u9fa5]+)\s*消息/,
      /custom\s+(\w+)\s+message/i,
    ];
    for (const pattern of messageTypePatterns) {
      const match = query.match(pattern);
      if (match) {
        entities.messageName = match[1];
        break;
      }
    }

    // 5. 配置属性提取 - Appearance 属性
    const configPatterns = [
      /\b(primaryHue|secondaryHue|errorHue|neutralHue|neutralSpecialHue)\b/i,
      /\b(avatarRadius|avatarPlaceHolder)\b/i,
      /\b(bubbleStyle|contentStyle|imageMessageCorner)\b/i,
      /\b(inputExtendActions|messageLongPressedActions)\b/i,
      /\b(alertStyle|actionSheetRowHeight)\b/i,
      /Appearance\s*\.\s*(\w+)/i,
    ];
    for (const pattern of configPatterns) {
      const match = query.match(pattern);
      if (match) {
        entities.configProperty = match[1];
        break;
      }
    }

    // 6. 功能名称提取
    const featurePatterns = [
      /(消息|群组|聊天室|好友|联系人|会话|推送|音视频|通话)/,
      /(message|group|chatroom|contact|conversation|push|call)/i,
      /实现\s*([\u4e00-\u9fa5]+)\s*功能/,
    ];
    for (const pattern of featurePatterns) {
      const match = query.match(pattern);
      if (match && !entities.featureName) {
        entities.featureName = match[1];
        break;
      }
    }

    return entities;
  }

  private matchSemanticScenario(query: string) {
    const scenarioTargets: Vectorizable[] = [
      { id: 'custom_message', text: '自定义 消息 类型 实现 样式 发送 展示 逻辑 注册 Cell' },
      { id: 'user_profile_update', text: '更新 头像 修改 昵称 用户 信息 缓存 userCache Provider 设置 头像 个人 资料 刷新' }
    ];
    return SimilarityMatcher.findBestMatch(query, scenarioTargets, 0.15);
  }

  private mapScenarioToIntent(scenarioId: string): UserIntent {
    switch (scenarioId) {
      case 'user_profile_update': return UserIntent.CUSTOMIZE_UI;
      default: return UserIntent.CUSTOMIZE_MESSAGE;
    }
  }

  getIntentDescription(intent: UserIntent): string {
    const descriptions: Record<UserIntent, string> = {
      [UserIntent.IMPLEMENT_FEATURE]: '实现功能',
      [UserIntent.CUSTOMIZE_UI]: '定制 UI 样式',
      [UserIntent.CUSTOMIZE_MESSAGE]: '自定义消息类型',
      [UserIntent.ADD_MENU_ITEM]: '添加菜单项',
      [UserIntent.FIX_ERROR]: '修复错误',
      [UserIntent.UNDERSTAND_API]: '理解 API',
      [UserIntent.UNDERSTAND_CLASS]: '理解类/组件',
      [UserIntent.INTEGRATE_SDK]: '集成 SDK',
      [UserIntent.CONFIGURE_APPEARANCE]: '配置外观',
      [UserIntent.UNKNOWN]: '未知意图',
    };
    return descriptions[intent];
  }
}