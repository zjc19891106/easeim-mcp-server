/**
 * MCP 响应构建器
 * 提供统一的响应格式，支持智能交互引导
 */

import { InteractionHint, InteractionOption, MCPToolResponse } from '../types/index.js';
import { ResponseComposer } from './ResponseComposer.js';
import {
  buildAmbiguousInteraction,
  buildFeatureImplementationInteraction,
  buildMissingInfoInteraction,
  buildMultipleOptionsInteraction,
  buildNoResultsInteraction,
  buildPlatformSelectionInteraction,
  buildTooBroadInteraction
} from './InteractionStrategies.js';

/**
 * 响应构建器 - 封装 MCP 工具的统一响应格式
 */
export class ResponseBuilder {
  private text: string = '';
  private interaction: InteractionHint | null = null;
  private metadata: Record<string, any> = {};

  /**
   * 创建新的响应构建器
   */
  static create(): ResponseBuilder {
    return new ResponseBuilder();
  }

  /**
   * 添加文本内容
   */
  addText(text: string): this {
    this.text += text;
    return this;
  }

  /**
   * 添加标题
   */
  addTitle(title: string, level: number = 1): this {
    this.text += `${'#'.repeat(level)} ${title}\n\n`;
    return this;
  }

  /**
   * 添加段落
   */
  addParagraph(content: string): this {
    this.text += `${content}\n\n`;
    return this;
  }

  /**
   * 添加列表项
   */
  addListItem(item: string, indent: number = 0): this {
    this.text += `${'  '.repeat(indent)}- ${item}\n`;
    return this;
  }

  /**
   * 添加代码块
   */
  addCodeBlock(code: string, language: string = 'swift'): this {
    this.text += `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    return this;
  }

  /**
   * 添加分隔线
   */
  addDivider(): this {
    this.text += `\n---\n\n`;
    return this;
  }

  /**
   * 设置元数据
   */
  setMetadata(key: string, value: any): this {
    this.metadata[key] = value;
    return this;
  }

  // ==================== 交互引导方法 ====================

  /**
   * 设置需要澄清的交互信息（无结果时）
   */
  setNoResultsInteraction(options: {
    query: string;
    suggestions?: string[];
    alternativeTools?: Array<{ tool: string; reason: string; exampleArgs?: Record<string, any> }>;
  }): this {
    this.interaction = buildNoResultsInteraction(options);
    return this;
  }

  /**
   * 设置结果过多需要缩小范围的交互信息
   */
  setTooBroadInteraction(options: {
    resultCount: number;
    filterOptions: InteractionOption[];
    question?: string;
  }): this {
    this.interaction = buildTooBroadInteraction(options);
    return this;
  }

  /**
   * 设置存在歧义需要用户选择的交互信息
   */
  setAmbiguousInteraction(options: {
    question: string;
    options: InteractionOption[];
    missingInfo?: string[];
  }): this {
    this.interaction = buildAmbiguousInteraction(options);
    return this;
  }

  /**
   * 设置缺少关键信息的交互信息
   */
  setMissingInfoInteraction(options: {
    missingFields: string[];
    question: string;
    examples?: string[];
  }): this {
    this.interaction = buildMissingInfoInteraction(options);
    return this;
  }

  /**
   * 设置多选项需要用户确认的交互信息
   */
  setMultipleOptionsInteraction(options: {
    question: string;
    options: InteractionOption[];
    allowMultiple?: boolean;
  }): this {
    this.interaction = buildMultipleOptionsInteraction(options);
    return this;
  }

  /**
   * 添加推荐工具
   */
  addSuggestedTool(tool: string, reason: string, exampleArgs?: Record<string, any>): this {
    if (!this.interaction) {
      this.interaction = { needsClarification: false };
    }
    if (!this.interaction.suggestedTools) {
      this.interaction.suggestedTools = [];
    }
    this.interaction.suggestedTools.push({ tool, reason, exampleArgs });
    return this;
  }

  /**
   * 设置平台选择交互 - 询问用户目标平台
   */
  setPlatformSelectionInteraction(options?: {
    question?: string;
    includeAll?: boolean;
  }): this {
    this.interaction = buildPlatformSelectionInteraction(options);
    return this;
  }

  /**
   * 设置功能实现交互 - 同时询问平台和功能细节
   */
  setFeatureImplementationInteraction(options: {
    featureName?: string;
    askPlatform?: boolean;
    askDetails?: boolean;
    detailOptions?: InteractionOption[];
  }): this {
    this.interaction = buildFeatureImplementationInteraction(options);
    return this;
  }

  // ==================== 构建方法 ====================

  /**
   * 构建最终的 MCP 响应
   */
  build(): { content: Array<{ type: string; text: string }> } {
    return ResponseComposer.buildResponse(this.text, this.interaction, this.metadata);
  }
}

// ==================== 便捷函数 ====================

/**
 * 快速创建成功响应
 */
export function successResponse(text: string): { content: Array<{ type: string; text: string }> } {
  return ResponseBuilder.create().addText(text).build();
}

/**
 * 快速创建需要澄清的响应
 */
export function clarificationResponse(options: {
  message: string;
  question: string;
  options?: InteractionOption[];
  examples?: string[];
  suggestedTools?: Array<{ tool: string; reason: string; exampleArgs?: Record<string, any> }>;
}): { content: Array<{ type: string; text: string }> } {
  const builder = ResponseBuilder.create()
    .addText(options.message);

  if (options.options) {
    builder.setAmbiguousInteraction({
      question: options.question,
      options: options.options
    });
  } else if (options.examples) {
    builder.setMissingInfoInteraction({
      question: options.question,
      missingFields: [],
      examples: options.examples
    });
  }

  if (options.suggestedTools) {
    for (const tool of options.suggestedTools) {
      builder.addSuggestedTool(tool.tool, tool.reason, tool.exampleArgs);
    }
  }

  return builder.build();
}

/**
 * 分析查询的模糊程度
 */
export function analyzeQueryAmbiguity(query: string): {
  isAmbiguous: boolean;
  ambiguityType?: 'too_short' | 'too_generic' | 'missing_context';
  suggestions?: string[];
} {
  const trimmedQuery = query.trim();

  // 太短的查询
  if (trimmedQuery.length < 2) {
    return {
      isAmbiguous: true,
      ambiguityType: 'too_short',
      suggestions: ['请提供更具体的关键词，至少 2 个字符']
    };
  }

  // 过于通用的查询词
  const genericTerms = ['怎么', '如何', '什么', '为什么', '问题', '错误', '不行', '失败'];
  const isGeneric = genericTerms.some(term => trimmedQuery === term);

  if (isGeneric) {
    return {
      isAmbiguous: true,
      ambiguityType: 'too_generic',
      suggestions: [
        '请描述具体的功能或问题',
        '例如："发送消息失败" 或 "如何自定义消息气泡"'
      ]
    };
  }

  // 缺少上下文的查询
  const needsContextPatterns = [
    /^(修改|改|设置|配置)$/,
    /^(颜色|大小|样式)$/,
    /^(添加|删除|更新)$/
  ];

  const needsContext = needsContextPatterns.some(pattern => pattern.test(trimmedQuery));

  if (needsContext) {
    return {
      isAmbiguous: true,
      ambiguityType: 'missing_context',
      suggestions: [
        '请说明要修改/设置什么内容',
        '例如："修改消息气泡颜色" 或 "设置头像圆角"'
      ]
    };
  }

  return { isAmbiguous: false };
}

/**
 * 检测查询是否缺少平台信息
 */
export function detectMissingPlatform(query: string, providedPlatform?: string): {
  needsPlatform: boolean;
  detectedPlatform?: string;
  isImplementationQuery: boolean;
  featureName?: string;
} {
  const lowerQuery = query.toLowerCase();

  // 检测是否已经在查询中提到平台
  const platformPatterns: Array<{ pattern: RegExp; platform: string }> = [
    { pattern: /\b(ios|iphone|ipad|swift|objective-c|objc|xcode)\b/i, platform: 'ios' },
    { pattern: /\b(android|kotlin|java|安卓)\b/i, platform: 'android' },
    { pattern: /\b(web|javascript|typescript|js|ts|网页|h5|浏览器)\b/i, platform: 'web' },
    { pattern: /\b(flutter|dart)\b/i, platform: 'flutter' },
    { pattern: /\b(react-native|rn|reactnative)\b/i, platform: 'react-native' },
    { pattern: /\b(unity|c#|游戏)\b/i, platform: 'unity' },
    { pattern: /\b(windows|cpp|c\+\+|c-sharp|win32|pc)\b/i, platform: 'windows' }
  ];

  let detectedPlatform: string | undefined;
  for (const { pattern, platform } of platformPatterns) {
    if (pattern.test(query)) {
      detectedPlatform = platform;
      break;
    }
  }

  // 如果已提供平台参数或检测到平台，则不需要询问
  if (providedPlatform || detectedPlatform) {
    return {
      needsPlatform: false,
      detectedPlatform: detectedPlatform || providedPlatform,
      isImplementationQuery: false
    };
  }

  // 检测是否是功能实现类查询（需要平台信息）
  const implementationPatterns = [
    /如何(实现|做|开发|集成|接入|使用)/,
    /怎么(实现|做|开发|集成|接入|使用)/,
    /(实现|做|开发|集成|接入)(一个|个)?(.+)/,
    /我想(实现|做|开发|添加|创建)/,
    /帮我(实现|做|开发|添加|创建)/,
    /(发送|接收|创建|删除|修改|添加|自定义)(.+)(消息|群组|聊天室|好友)/,
    /自定义(消息|UI|界面|样式|组件)/,
    /(添加|增加|新增)(.+)(功能|菜单|按钮)/
  ];

  let isImplementationQuery = false;
  let featureName: string | undefined;

  for (const pattern of implementationPatterns) {
    const match = query.match(pattern);
    if (match) {
      isImplementationQuery = true;
      // 尝试提取功能名称
      if (match.length > 2) {
        featureName = match[match.length - 1] || match[2];
      }
      break;
    }
  }

  // 功能实现类查询需要平台信息
  return {
    needsPlatform: isImplementationQuery,
    detectedPlatform,
    isImplementationQuery,
    featureName
  };
}

/**
 * 支持的平台列表
 */
export const SUPPORTED_PLATFORMS = [
  { value: 'ios', label: 'iOS', description: 'iPhone/iPad (Swift/ObjC)' },
  { value: 'android', label: 'Android', description: 'Android (Kotlin/Java)' },
  { value: 'web', label: 'Web', description: '网页端 (JS/TS)' },
  { value: 'flutter', label: 'Flutter', description: '跨平台 (Dart, 无 CallKit)' },
  { value: 'react-native', label: 'React Native', description: '跨平台 (JS, 无 CallKit)' },
  { value: 'unity', label: 'Unity', description: '游戏 (C#, 仅支持 IMSDK)' },
  { value: 'windows', label: 'Windows', description: '桌面端 (C++/C#, 仅支持 IMSDK)' }
];
