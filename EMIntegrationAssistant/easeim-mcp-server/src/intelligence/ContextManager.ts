/**
 * 上下文管理器 - 实现上下文感知搜索
 *
 * 功能：
 * 1. 搜索历史记录和分析
 * 2. 意图连续性识别（"继续"、"更多细节"等）
 * 3. 相关主题推荐
 * 4. 会话上下文维护
 */

import { UserIntent, ExtractedEntities, IntentResult } from './IntentClassifier.js';

// ==================== 类型定义 ====================

/**
 * 搜索历史条目
 */
export interface SearchHistoryEntry {
  id: string;
  query: string;
  intent: UserIntent;
  entities: ExtractedEntities;
  timestamp: number;
  results?: {
    type: 'error' | 'api' | 'source' | 'guide';
    count: number;
    topItems?: string[];
  };
}

/**
 * 会话上下文
 */
export interface SessionContext {
  sessionId: string;
  startTime: number;
  lastActivityTime: number;
  currentTopic: string | null;
  currentIntent: UserIntent | null;
  focusedEntity: {
    type: 'errorCode' | 'className' | 'component' | 'feature' | null;
    value: string | null;
  };
  history: SearchHistoryEntry[];
}

/**
 * 连续性检测结果
 */
export interface ContinuityResult {
  isContinuation: boolean;
  type: 'more_detail' | 'follow_up' | 'related' | 'new_topic';
  referenceQuery?: string;
  referenceIntent?: UserIntent;
  suggestedContext?: string;
}

/**
 * 相关推荐
 */
export interface RelatedRecommendation {
  type: 'topic' | 'api' | 'class' | 'guide';
  title: string;
  description: string;
  query: string;
  relevance: number;
}

// ==================== 主题关联图 ====================

/**
 * 主题关联定义 - 用于推荐相关内容
 */
const TOPIC_RELATIONS: Record<string, {
  relatedTopics: string[];
  relatedClasses: string[];
  relatedApis: string[];
  keywords: string[];
}> = {
  'message': {
    relatedTopics: ['conversation', 'chat', 'attachment', 'recall', 'quote'],
    relatedClasses: ['MessageCell', 'MessageEntity', 'ChatMessage', 'MessageBubble'],
    relatedApis: ['sendMessage', 'receiveMessage', 'recallMessage', 'forwardMessage'],
    keywords: ['消息', '发送', '接收', '撤回', '转发', '引用'],
  },
  'custom_message': {
    relatedTopics: ['message', 'cell', 'register', 'appearance'],
    relatedClasses: ['CustomMessageCell', 'ComponentsRegister', 'MessageEntity'],
    relatedApis: ['registerCustomCell', 'createCustomMessage'],
    keywords: ['自定义消息', '订单', '卡片', '红包', 'Cell'],
  },
  'conversation': {
    relatedTopics: ['message', 'unread', 'pin', 'delete'],
    relatedClasses: ['ConversationListController', 'ConversationCell', 'ConversationEntity'],
    relatedApis: ['getConversationList', 'deleteConversation', 'pinConversation'],
    keywords: ['会话', '列表', '未读', '置顶', '删除'],
  },
  'group': {
    relatedTopics: ['member', 'admin', 'mute', 'announcement'],
    relatedClasses: ['GroupDetailController', 'GroupMemberCell'],
    relatedApis: ['createGroup', 'joinGroup', 'leaveGroup', 'muteGroupMember'],
    keywords: ['群组', '群聊', '成员', '管理员', '禁言', '公告'],
  },
  'chatroom': {
    relatedTopics: ['member', 'gift', 'barrage'],
    relatedClasses: ['ChatroomView', 'GiftBarrageCell', 'ChatBarrageCell'],
    relatedApis: ['joinChatroom', 'leaveChatroom', 'sendGift'],
    keywords: ['聊天室', '直播', '礼物', '弹幕'],
  },
  'ui_customization': {
    relatedTopics: ['appearance', 'theme', 'bubble', 'avatar'],
    relatedClasses: ['Appearance', 'Theme', 'MessageBubble', 'AvatarView'],
    relatedApis: ['setAppearance', 'switchTheme'],
    keywords: ['样式', '主题', '颜色', '气泡', '头像', '外观'],
  },
  'error': {
    relatedTopics: ['login', 'connection', 'permission'],
    relatedClasses: ['EMError', 'ChatError'],
    relatedApis: ['lookupError', 'diagnose'],
    keywords: ['错误', '失败', '异常', '解决', '修复'],
  },
  'login': {
    relatedTopics: ['token', 'connection', 'logout'],
    relatedClasses: ['ChatClient', 'ChatOptions'],
    relatedApis: ['login', 'logout', 'renewToken'],
    keywords: ['登录', '注销', 'token', '连接', '认证'],
  },
};

// ==================== 连续性模式 ====================

/**
 * 连续性识别模式
 */
const CONTINUITY_PATTERNS: Array<{
  patterns: RegExp[];
  type: ContinuityResult['type'];
  description: string;
}> = [
  {
    patterns: [
      /^(更多|详细|具体|展开|深入)(一点|说明|解释|细节|信息)?$/,
      /^(继续|接着|然后|接下来)(说|讲|解释)?$/,
      /^(再|还有|另外)(说|讲|介绍)(一下)?$/,
      /^详细说(一下|说)?$/,
      /^more\s*(details?|info)?$/i,
      /^continue$/i,
      /^go\s*on$/i,
    ],
    type: 'more_detail',
    description: '请求更多细节',
  },
  {
    patterns: [
      /^(那|那么|所以)(怎么|如何|怎样)/,
      /^(接下来|下一步)(怎么|该|应该)/,
      /^(然后|之后)(呢|怎么办)/,
      /^(这个|这种情况)(怎么|如何)(处理|解决)/,
      /^what('s)?\s*next/i,
      /^then\s*(what|how)/i,
    ],
    type: 'follow_up',
    description: '后续问题',
  },
  {
    patterns: [
      /^(类似|相关|关联|相似)(的|问题|功能|API)/,
      /^(还有|有没有)(其他|别的|类似)/,
      /^(除了这个|除此之外)/,
      /^similar|related/i,
    ],
    type: 'related',
    description: '相关内容',
  },
];

// ==================== ContextManager 类 ====================

export class ContextManager {
  private sessions: Map<string, SessionContext> = new Map();
  private defaultSessionId = 'default';
  private maxHistorySize = 20;
  private sessionTimeout = 30 * 60 * 1000; // 30 分钟

  constructor() {
    // 创建默认会话
    this.createSession(this.defaultSessionId);
  }

  /**
   * 创建新会话
   */
  createSession(sessionId: string): SessionContext {
    const session: SessionContext = {
      sessionId,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      currentTopic: null,
      currentIntent: null,
      focusedEntity: { type: null, value: null },
      history: [],
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取会话（如果过期则重新创建）
   */
  getSession(sessionId: string = this.defaultSessionId): SessionContext {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = this.createSession(sessionId);
    } else if (Date.now() - session.lastActivityTime > this.sessionTimeout) {
      // 会话过期，创建新会话
      session = this.createSession(sessionId);
    }

    return session;
  }

  /**
   * 记录搜索历史
   */
  recordSearch(
    query: string,
    intentResult: IntentResult,
    results?: SearchHistoryEntry['results'],
    sessionId: string = this.defaultSessionId
  ): void {
    const session = this.getSession(sessionId);

    const entry: SearchHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query,
      intent: intentResult.intent,
      entities: intentResult.entities,
      timestamp: Date.now(),
      results,
    };

    session.history.push(entry);
    session.lastActivityTime = Date.now();

    // 更新当前焦点
    this.updateFocus(session, intentResult);

    // 限制历史大小
    if (session.history.length > this.maxHistorySize) {
      session.history = session.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * 更新会话焦点
   */
  private updateFocus(session: SessionContext, intentResult: IntentResult): void {
    const { intent, entities } = intentResult;

    session.currentIntent = intent;

    // 根据实体更新焦点
    if (entities.errorCode !== null) {
      session.focusedEntity = { type: 'errorCode', value: entities.errorCode.toString() };
      session.currentTopic = 'error';
    } else if (entities.className !== null) {
      session.focusedEntity = { type: 'className', value: entities.className };
      session.currentTopic = this.inferTopicFromClass(entities.className);
    } else if (entities.componentName !== null) {
      session.focusedEntity = { type: 'component', value: entities.componentName };
      session.currentTopic = 'ui_customization';
    } else if (entities.featureName !== null) {
      session.focusedEntity = { type: 'feature', value: entities.featureName };
      session.currentTopic = this.inferTopicFromFeature(entities.featureName);
    } else if (entities.messageName !== null) {
      session.focusedEntity = { type: 'feature', value: entities.messageName };
      session.currentTopic = 'custom_message';
    }
  }

  /**
   * 从类名推断主题
   */
  private inferTopicFromClass(className: string): string {
    const lowerName = className.toLowerCase();

    if (lowerName.includes('message') || lowerName.includes('bubble')) {
      return lowerName.includes('custom') ? 'custom_message' : 'message';
    }
    if (lowerName.includes('conversation')) return 'conversation';
    if (lowerName.includes('group')) return 'group';
    if (lowerName.includes('chatroom') || lowerName.includes('barrage')) return 'chatroom';
    if (lowerName.includes('appearance') || lowerName.includes('theme')) return 'ui_customization';

    return 'general';
  }

  /**
   * 从功能名推断主题
   */
  private inferTopicFromFeature(featureName: string): string {
    const lowerName = featureName.toLowerCase();

    if (/消息|message/.test(lowerName)) return 'message';
    if (/会话|conversation/.test(lowerName)) return 'conversation';
    if (/群|group/.test(lowerName)) return 'group';
    if (/聊天室|chatroom|直播/.test(lowerName)) return 'chatroom';
    if (/登录|login|token/.test(lowerName)) return 'login';

    return 'general';
  }

  /**
   * 检测意图连续性
   */
  detectContinuity(
    query: string,
    sessionId: string = this.defaultSessionId
  ): ContinuityResult {
    const session = this.getSession(sessionId);
    const lastEntry = session.history[session.history.length - 1];

    // 检查连续性模式
    for (const { patterns, type, description } of CONTINUITY_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(query.trim())) {
          return {
            isContinuation: true,
            type,
            referenceQuery: lastEntry?.query,
            referenceIntent: lastEntry?.intent,
            suggestedContext: this.buildContextSuggestion(session, type),
          };
        }
      }
    }

    // 检查是否引用上一个查询的内容
    if (lastEntry && this.isRelatedToLastQuery(query, lastEntry)) {
      return {
        isContinuation: true,
        type: 'follow_up',
        referenceQuery: lastEntry.query,
        referenceIntent: lastEntry.intent,
        suggestedContext: this.buildContextSuggestion(session, 'follow_up'),
      };
    }

    return {
      isContinuation: false,
      type: 'new_topic',
    };
  }

  /**
   * 检查是否与上一个查询相关
   */
  private isRelatedToLastQuery(query: string, lastEntry: SearchHistoryEntry): boolean {
    const queryLower = query.toLowerCase();
    const lastQueryLower = lastEntry.query.toLowerCase();

    // 检查是否包含上一个查询的实体
    if (lastEntry.entities.errorCode !== null) {
      if (queryLower.includes(lastEntry.entities.errorCode.toString())) return true;
    }
    if (lastEntry.entities.className !== null) {
      if (queryLower.includes(lastEntry.entities.className.toLowerCase())) return true;
    }
    if (lastEntry.entities.componentName !== null) {
      if (queryLower.includes(lastEntry.entities.componentName.toLowerCase())) return true;
    }

    // 检查关键词重叠
    const lastWords = new Set(lastQueryLower.split(/\s+/).filter(w => w.length > 2));
    const currentWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const overlap = currentWords.filter(w => lastWords.has(w)).length;

    return overlap >= 2;
  }

  /**
   * 构建上下文建议
   */
  private buildContextSuggestion(session: SessionContext, type: ContinuityResult['type']): string {
    const { currentTopic, focusedEntity, currentIntent } = session;
    let suggestion = '';

    if (focusedEntity.value) {
      switch (focusedEntity.type) {
        case 'errorCode':
          suggestion = `继续讨论错误码 ${focusedEntity.value} 相关问题`;
          break;
        case 'className':
          suggestion = `继续讨论 ${focusedEntity.value} 类的使用`;
          break;
        case 'component':
          suggestion = `继续讨论 ${focusedEntity.value} 组件`;
          break;
        case 'feature':
          suggestion = `继续讨论 ${focusedEntity.value} 功能`;
          break;
      }
    } else if (currentTopic) {
      suggestion = `继续讨论 ${this.getTopicDisplayName(currentTopic)} 相关内容`;
    }

    return suggestion;
  }

  /**
   * 获取主题显示名称
   */
  private getTopicDisplayName(topic: string): string {
    const names: Record<string, string> = {
      'message': '消息',
      'custom_message': '自定义消息',
      'conversation': '会话',
      'group': '群组',
      'chatroom': '聊天室',
      'ui_customization': 'UI 定制',
      'error': '错误处理',
      'login': '登录认证',
      'general': '通用功能',
    };
    return names[topic] || topic;
  }

  /**
   * 获取相关推荐
   */
  getRecommendations(
    sessionId: string = this.defaultSessionId,
    limit: number = 5
  ): RelatedRecommendation[] {
    const session = this.getSession(sessionId);
    const recommendations: RelatedRecommendation[] = [];
    const { currentTopic, focusedEntity, history } = session;

    // 基于当前主题推荐
    if (currentTopic && TOPIC_RELATIONS[currentTopic]) {
      const topicData = TOPIC_RELATIONS[currentTopic];

      // 推荐相关主题
      for (const relatedTopic of topicData.relatedTopics.slice(0, 2)) {
        const topicInfo = TOPIC_RELATIONS[relatedTopic];
        if (topicInfo) {
          recommendations.push({
            type: 'topic',
            title: this.getTopicDisplayName(relatedTopic),
            description: `了解 ${this.getTopicDisplayName(relatedTopic)} 相关功能`,
            query: topicInfo.keywords[0] || relatedTopic,
            relevance: 0.8,
          });
        }
      }

      // 推荐相关类
      for (const className of topicData.relatedClasses.slice(0, 2)) {
        recommendations.push({
          type: 'class',
          title: className,
          description: `了解 ${className} 类的用法`,
          query: `${className} 怎么用`,
          relevance: 0.7,
        });
      }

      // 推荐相关 API
      for (const api of topicData.relatedApis.slice(0, 1)) {
        recommendations.push({
          type: 'api',
          title: api,
          description: `查看 ${api} API 文档`,
          query: `search_api query="${api}"`,
          relevance: 0.6,
        });
      }
    }

    // 基于历史记录推荐（避免重复）
    const recentQueries = new Set(history.slice(-5).map(h => h.query.toLowerCase()));

    // 如果用户在处理错误，推荐诊断工具
    if (focusedEntity.type === 'errorCode') {
      recommendations.push({
        type: 'guide',
        title: '错误诊断',
        description: '使用 diagnose 工具分析类似问题',
        query: `diagnose symptom="消息发送失败"`,
        relevance: 0.9,
      });
    }

    // 去重并排序
    const seen = new Set<string>();
    return recommendations
      .filter(r => {
        const key = `${r.type}:${r.title}`;
        if (seen.has(key) || recentQueries.has(r.query.toLowerCase())) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * 获取上下文摘要
   */
  getContextSummary(sessionId: string = this.defaultSessionId): {
    currentTopic: string | null;
    currentFocus: string | null;
    recentQueries: string[];
    sessionDuration: number;
  } {
    const session = this.getSession(sessionId);

    return {
      currentTopic: session.currentTopic ? this.getTopicDisplayName(session.currentTopic) : null,
      currentFocus: session.focusedEntity.value,
      recentQueries: session.history.slice(-3).map(h => h.query),
      sessionDuration: Math.round((Date.now() - session.startTime) / 1000 / 60), // 分钟
    };
  }

  /**
   * 增强查询 - 添加上下文信息
   */
  enhanceQuery(
    query: string,
    sessionId: string = this.defaultSessionId
  ): {
    enhancedQuery: string;
    contextAdded: boolean;
    continuity: ContinuityResult;
  } {
    const continuity = this.detectContinuity(query, sessionId);

    if (!continuity.isContinuation) {
      return {
        enhancedQuery: query,
        contextAdded: false,
        continuity,
      };
    }

    const session = this.getSession(sessionId);
    let enhancedQuery = query;

    // 对于连续性查询，添加上下文
    if (continuity.type === 'more_detail' || continuity.type === 'follow_up') {
      if (session.focusedEntity.value) {
        switch (session.focusedEntity.type) {
          case 'errorCode':
            enhancedQuery = `${query} (关于错误码 ${session.focusedEntity.value})`;
            break;
          case 'className':
            enhancedQuery = `${query} (关于 ${session.focusedEntity.value} 类)`;
            break;
          case 'component':
            enhancedQuery = `${query} (关于 ${session.focusedEntity.value})`;
            break;
        }
      } else if (session.currentTopic) {
        enhancedQuery = `${query} (${this.getTopicDisplayName(session.currentTopic)} 相关)`;
      }
    }

    return {
      enhancedQuery,
      contextAdded: enhancedQuery !== query,
      continuity,
    };
  }

  /**
   * 获取热门查询（用于分析）
   */
  getPopularQueries(sessionId: string = this.defaultSessionId): Array<{
    query: string;
    count: number;
    lastUsed: number;
  }> {
    const session = this.getSession(sessionId);
    const queryCount = new Map<string, { count: number; lastUsed: number }>();

    for (const entry of session.history) {
      const normalized = entry.query.toLowerCase().trim();
      const existing = queryCount.get(normalized);

      if (existing) {
        existing.count++;
        existing.lastUsed = Math.max(existing.lastUsed, entry.timestamp);
      } else {
        queryCount.set(normalized, { count: 1, lastUsed: entry.timestamp });
      }
    }

    return Array.from(queryCount.entries())
      .map(([query, data]) => ({ query, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * 清除会话
   */
  clearSession(sessionId: string = this.defaultSessionId): void {
    this.sessions.delete(sessionId);
  }

  /**
   * 获取所有活跃会话 ID
   */
  getActiveSessions(): string[] {
    const now = Date.now();
    return Array.from(this.sessions.entries())
      .filter(([_, session]) => now - session.lastActivityTime < this.sessionTimeout)
      .map(([id]) => id);
  }
}
