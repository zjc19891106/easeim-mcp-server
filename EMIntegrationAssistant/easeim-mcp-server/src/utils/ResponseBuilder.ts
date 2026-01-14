/**
 * MCP 响应构建器
 * 提供统一的响应格式，支持智能交互引导
 */

import { InteractionHint, InteractionOption, MCPToolResponse } from '../types/index.js';

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
    this.interaction = {
      needsClarification: true,
      clarificationType: 'no_results',
      question: `未找到与 "${options.query}" 相关的结果，您可以尝试：`,
      examples: options.suggestions || [
        '使用更通用的关键词',
        '检查拼写是否正确',
        '尝试中文或英文关键词'
      ],
      suggestedTools: options.alternativeTools
    };
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
    this.interaction = {
      needsClarification: true,
      clarificationType: 'too_broad',
      question: options.question || `搜索结果过多（${options.resultCount} 个），请选择一个范围来缩小结果：`,
      options: options.filterOptions
    };
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
    this.interaction = {
      needsClarification: true,
      clarificationType: 'ambiguous_query',
      question: options.question,
      options: options.options,
      missingInfo: options.missingInfo
    };
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
    this.interaction = {
      needsClarification: true,
      clarificationType: 'missing_info',
      question: options.question,
      missingInfo: options.missingFields,
      examples: options.examples
    };
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
    this.interaction = {
      needsClarification: true,
      clarificationType: 'multiple_options',
      question: options.question,
      options: options.options
    };
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
    const platformOptions: InteractionOption[] = [
      { label: 'iOS', value: 'ios', description: 'iPhone/iPad 应用开发 (Swift/ObjC)' },
      { label: 'Android', value: 'android', description: 'Android 应用开发 (Kotlin/Java)' },
      { label: 'Web', value: 'web', description: '网页端开发 (JavaScript/TypeScript)' },
      { label: 'Flutter', value: 'flutter', description: '跨平台开发 (Dart, 无 CallKit 文档/源码)' },
      { label: 'React Native', value: 'react-native', description: '跨平台开发 (JS, 无 CallKit 文档/源码)' },
      { label: 'Unity', value: 'unity', description: '游戏开发 (C#, 仅支持 IMSDK)' },
      { label: 'Windows', value: 'windows', description: 'Windows 桌面开发 (C++/C#, 仅支持 IMSDK)' }
    ];

    if (options?.includeAll) {
      platformOptions.push({ label: '全部平台', value: 'all', description: '查看所有平台的实现' });
    }

    this.interaction = {
      needsClarification: true,
      clarificationType: 'missing_info',
      question: options?.question || '请选择您的目标开发平台：',
      options: platformOptions,
      missingInfo: ['目标平台']
    };
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
    const questions: string[] = [];
    const missingFields: string[] = [];

    if (options.askPlatform) {
      questions.push('您的目标平台是什么？');
      missingFields.push('目标平台 (iOS/Android/Web/Flutter/RN/Windows/Unity)');
    }

    if (options.askDetails) {
      questions.push('请提供更多实现细节');
      missingFields.push('具体实现需求');
    }

    const platformOptions: InteractionOption[] = [
      { label: 'iOS', value: 'ios', description: 'Swift/Objective-C' },
      { label: 'Android', value: 'android', description: 'Kotlin/Java' },
      { label: 'Web', value: 'web', description: 'JavaScript/TypeScript' },
      { label: 'Flutter', value: 'flutter', description: 'Dart 跨平台 (无 CallKit)' },
      { label: 'React Native', value: 'react-native', description: 'JavaScript 跨平台 (无 CallKit)' },
      { label: 'Unity', value: 'unity', description: 'C# 游戏开发 (仅 IMSDK)' },
      { label: 'Windows', value: 'windows', description: 'C++/C# 桌面开发 (仅 IMSDK)' }
    ];

    // 合并平台选项和自定义选项
    const allOptions = options.detailOptions
      ? [...platformOptions, ...options.detailOptions]
      : platformOptions;

    this.interaction = {
      needsClarification: true,
      clarificationType: 'missing_info',
      question: options.featureName
        ? `您想在哪个平台实现「${options.featureName}」功能？`
        : questions.join(' '),
      options: allOptions,
      missingInfo: missingFields
    };
    return this;
  }

  // ==================== 构建方法 ====================

  /**
   * 构建最终的 MCP 响应
   */
  build(): { content: Array<{ type: string; text: string }> } {
    let finalText = this.text;

    // 如果有交互信息，附加到文本末尾（供 AI 客户端解析）
    if (this.interaction && this.interaction.needsClarification) {
      finalText += this.buildInteractionSection();
    }

    // 添加元数据部分（JSON 格式，供程序解析）
    if (Object.keys(this.metadata).length > 0 || this.interaction) {
      const metaBlock = {
        ...this.metadata,
        interaction: this.interaction
      };
      finalText += `\n\n<!-- MCP_METADATA\n${JSON.stringify(metaBlock, null, 2)}\nMCP_METADATA -->`;
    }

    return {
      content: [
        {
          type: 'text',
          text: finalText
        }
      ]
    };
  }

  /**
   * 构建交互引导部分的 Markdown
   */
  private buildInteractionSection(): string {
    if (!this.interaction) return '';

    let section = '\n---\n\n## 🤔 需要更多信息\n\n';

    if (this.interaction.question) {
      section += `**${this.interaction.question}**\n\n`;
    }

    // 显示选项
    if (this.interaction.options && this.interaction.options.length > 0) {
      section += '可选项：\n\n';
      for (const option of this.interaction.options) {
        section += `- **${option.label}**`;
        if (option.description) {
          section += ` - ${option.description}`;
        }
        section += '\n';
      }
      section += '\n';
    }

    // 显示示例
    if (this.interaction.examples && this.interaction.examples.length > 0) {
      section += '示例：\n\n';
      for (const example of this.interaction.examples) {
        section += `- \`${example}\`\n`;
      }
      section += '\n';
    }

    // 显示推荐工具
    if (this.interaction.suggestedTools && this.interaction.suggestedTools.length > 0) {
      section += '推荐尝试：\n\n';
      for (const tool of this.interaction.suggestedTools) {
        section += `- **${tool.tool}**: ${tool.reason}`;
        if (tool.exampleArgs) {
          section += `\n  示例: \`${tool.tool} ${JSON.stringify(tool.exampleArgs)}\``;
        }
        section += '\n';
      }
      section += '\n';
    }

    // 显示缺失信息
    if (this.interaction.missingInfo && this.interaction.missingInfo.length > 0) {
      section += '请提供以下信息：\n\n';
      for (const info of this.interaction.missingInfo) {
        section += `- ❓ ${info}\n`;
      }
      section += '\n';
    }

    return section;
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
