/**
 * 环信 IM SDK MCP Server 类型定义
 */

// ==================== 平台和层级定义 ====================

/**
 * 支持的平台
 */
export type Platform = 'ios' | 'android' | 'web' | 'flutter' | 'unity' | 'all';

/**
 * 技术栈层级
 */
export type Layer = 'sdk' | 'uikit' | 'demo';

/**
 * UIKit 组件类型
 */
export type UIKitComponent = 'EaseChatUIKit' | 'EaseCallUIKit' | 'EaseChatroomUIKit' | 'EaseIMKit';

// ==================== 文档相关类型 ====================

/**
 * API 模块信息
 */
export interface ApiModule {
  /** 模块 ID */
  id: string;
  /** 模块名称 */
  name: string;
  /** 模块描述 */
  description: string;
  /** 搜索关键词 */
  keywords: string[];
  /** 文档文件路径（相对于 data/docs/） */
  docPath: string;
  /** 包含的 API 列表 */
  apis: string[];
  /** 相关错误码 */
  errorCodes: number[];
  /** 所属平台 */
  platform: Platform;
  /** 所属层级 */
  layer: Layer;
  /** 如果是 UIKit，指定组件 */
  component?: UIKitComponent;
}

/**
 * API 信息（索引用）
 */
export interface ApiInfo {
  /** API 名称 */
  name: string;
  /** 所属模块 */
  module: string;
  /** API 描述 */
  description: string;
  /** 搜索关键词 */
  keywords?: string[];
  /** 所属平台 */
  platform: Platform;
  /** 所属层级 */
  layer: Layer;
  /** 如果是 UIKit，指定组件 */
  component?: UIKitComponent;
}

/**
 * 错误码信息
 */
export interface ErrorCode {
  /** 错误码数字 */
  code: number;
  /** 错误名称（如 EMErrorMessageBlocked） */
  name: string;
  /** 所属模块 */
  module: string;
  /** 简短描述 */
  brief: string;
  /** 详细描述 */
  description: string;
  /** 可能原因 */
  causes: string[];
  /** 解决方案 */
  solutions: string[];
  /** 所属平台 */
  platform: Platform;
}

/**
 * 文档索引结构
 */
export interface DocsIndex {
  /** 版本号 */
  version: string;
  /** SDK 名称 */
  sdkName: string;
  /** 最后更新时间 */
  lastUpdated: string;
  /** 支持的平台列表 */
  platforms: Platform[];
  /** API 模块列表 */
  modules: ApiModule[];
  /** API 快速索引 */
  apiIndex: Record<string, ApiInfo>;
  /** 错误码快速索引 */
  errorCodeIndex: Record<string, ErrorCode>;
}

// ==================== 源码相关类型 ====================

/**
 * UIKit 组件信息
 */
export interface ComponentInfo {
  /** 组件名称 */
  name: string;
  /** GitHub 仓库 */
  repo: string;
  /** 版本号 */
  version: string;
  /** 描述 */
  description: string;
  /** 所属平台 */
  platform: Platform;
  /** 功能类别 */
  category: 'chat' | 'call' | 'chatroom' | 'im';
}

/**
 * 源码文件信息
 */
export interface SourceFile {
  /** 文件路径（相对于 sources/） */
  path: string;
  /** 所属平台 */
  platform: Platform;
  /** 所属组件 */
  component: string;
  /** 包含的类/结构体 */
  classes: string[];
  /** 搜索关键词 */
  keywords: string[];
  /** 文件描述 */
  description: string;
  /** 行数 */
  lines?: number;
  /** 功能标签（如 'bubble', 'input', 'avatar'） */
  tags: string[];
}

/**
 * 代码符号信息（类、方法、属性等）
 */
export interface CodeSymbol {
  /** 符号名称 */
  name: string;
  /** 符号类型 */
  type: 'class' | 'struct' | 'enum' | 'protocol' | 'property' | 'method' | 'function';
  /** 所在文件 */
  file: string;
  /** 行号 */
  line: number;
  /** 起始行号 */
  startLine?: number;
  /** 结束行号 */
  endLine?: number;
  /** 签名 */
  signature: string;
  /** 所属类型（类/结构体/协议等） */
  owner?: string;
  /** 参数列表 */
  params?: Array<{
    name: string;
    type?: string;
    label?: string;
  }>;
  /** 描述（从注释提取） */
  description?: string;
  /** 原始注释 */
  doc?: string;
  /** 功能标签 */
  tags?: string[];
}

/**
 * 源码索引结构
 */
export interface SourceIndex {
  /** 版本号 */
  version: string;
  /** 最后更新时间 */
  lastUpdated: string;
  /** 支持的平台列表 */
  platforms: Platform[];
  /** 组件信息 */
  components: Record<string, ComponentInfo>;
  /** 源码文件列表 */
  files: SourceFile[];
  /** 符号索引 */
  symbols: CodeSymbol[];
}

// ==================== 搜索相关类型 ====================

/**
 * 搜索上下文
 */
export interface SearchContext {
  /** 指定的平台 */
  platform?: Platform;
  /** 指定的层级 */
  layer?: Layer;
  /** 指定的 UIKit 组件 */
  component?: UIKitComponent;
}

/**
 * 搜索结果（通用）
 */
export interface SearchResult<T = any> {
  /** 相关性得分 */
  score: number;
  /** 结果数据 */
  item: T;
  /** 匹配的关键词 */
  matchedKeywords?: string[];
  /** 所属平台 */
  platform: Platform;
  /** 所属层级 */
  layer: Layer;
  /** 所属组件（UIKit） */
  component?: UIKitComponent;
}

/**
 * API 搜索结果
 */
export interface ApiSearchResult {
  /** API 名称 */
  name: string;
  /** 所属模块 */
  module: string;
  /** 模块名称 */
  moduleName: string;
  /** 描述 */
  description: string;
  /** 文档路径 */
  docPath: string;
  /** 匹配得分 */
  score: number;
  /** 所属平台 */
  platform: Platform;
  /** 所属层级 */
  layer: Layer;
  /** 所属组件（UIKit） */
  component?: UIKitComponent;
}

/**
 * 源码搜索结果
 */
export interface SourceSearchResult {
  /** 文件路径 */
  path: string;
  /** 所属组件 */
  component: string;
  /** 描述 */
  description: string;
  /** 包含的类 */
  classes: string[];
  /** 匹配的符号 */
  matchedSymbols?: CodeSymbol[];
  /** 匹配得分 */
  score: number;
  /** 功能标签 */
  tags: string[];
}

/**
 * 歧义检测结果
 */
export interface AmbiguityDetection {
  /** 是否存在歧义 */
  hasAmbiguity: boolean;
  /** 歧义类型 */
  type?: 'platform' | 'layer' | 'component';
  /** 可能的选项 */
  options?: Array<{
    value: string;
    description: string;
    count: number;
  }>;
  /** 建议的问题 */
  question?: string;
}

// ==================== 配置相关类型 ====================

/**
 * 配置属性
 */
export interface ConfigProperty {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
  file: string;
  line: number;
}

/**
 * 扩展点
 */
export interface ExtensionPoint {
  name: string;
  type: 'protocol' | 'class' | 'override-method';
  description?: string;
  file: string;
  line: number;
  methods?: string[];
}

/**
 * 组件配置
 */
export interface ComponentConfig {
  name: string;
  description: string;
  configProperties: ConfigProperty[];
  extensionPoints: ExtensionPoint[];
}

/**
 * 配置索引
 */
export interface ConfigIndex {
  version: string;
  lastUpdated: string;
  components: Record<string, ComponentConfig>;
}

// ==================== 智能交互相关类型 ====================

/**
 * 交互引导选项
 */
export interface InteractionOption {
  /** 选项标签 */
  label: string;
  /** 选项值（用于后续查询） */
  value: string;
  /** 选项描述 */
  description?: string;
}

/**
 * 交互引导信息
 * AI 客户端可根据此信息自动向用户追问
 */
export interface InteractionHint {
  /** 是否需要用户澄清 */
  needsClarification: boolean;
  /** 澄清类型 */
  clarificationType?: 'missing_info' | 'ambiguous_query' | 'too_broad' | 'no_results' | 'multiple_options';
  /** 建议 AI 客户端问用户的问题 */
  question?: string;
  /** 可选答案列表 */
  options?: InteractionOption[];
  /** 示例输入 */
  examples?: string[];
  /** 推荐使用的其他工具 */
  suggestedTools?: Array<{
    tool: string;
    reason: string;
    exampleArgs?: Record<string, any>;
  }>;
  /** 缺失的关键信息 */
  missingInfo?: string[];
}

/**
 * MCP 工具统一响应格式
 */
export interface MCPToolResponse {
  /** 是否成功获取到有效结果 */
  success: boolean;
  /** 结果数据 */
  data?: any;
  /** 结果数量（如果是搜索结果） */
  resultCount?: number;
  /** 交互引导信息 */
  interaction?: InteractionHint;
  /** 上下文信息（用于连续对话） */
  context?: {
    topic?: string;
    relatedQueries?: string[];
    sessionId?: string;
  };
}

// ==================== MCP 工具相关类型 ====================

/**
 * MCP 工具输入参数类型
 */
export interface ToolInputs {
  lookup_error: {
    code: number;
    platform?: Platform;
  };
  search_api: {
    query: string;
    platform?: Platform;
    layer?: Layer;
    component?: UIKitComponent;
  };
  search_source: {
    query: string;
    component?: UIKitComponent | 'all';
    limit?: number;
  };
  get_guide: {
    topic: 'quickstart' | 'login' | 'message' | 'group' | 'chatroom' | 'push' | 'migration';
    platform?: Platform;
  };
  diagnose: {
    symptom: string;
    platform?: Platform;
  };
  read_doc: {
    path: string;
  };
  read_source: {
    path: string;
    startLine?: number;
    endLine?: number;
  };
  list_config_options: {
    component: UIKitComponent | 'all';
  };
  get_extension_points: {
    component: UIKitComponent | 'all';
    type?: 'protocol' | 'class' | 'all';
  };
  get_config_usage: {
    propertyName: string;
    component?: UIKitComponent | 'all';
  };
}
