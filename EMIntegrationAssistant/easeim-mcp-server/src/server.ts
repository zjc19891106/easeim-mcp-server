/**
 * 环信 IM SDK MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

import { DocSearch } from './search/DocSearch.js';
import { ShardedSourceSearch } from './search/ShardedSourceSearch.js';
import { ConfigSearch } from './search/ConfigSearch.js';
import { TOOLS } from './tools/index.js';
import { IntentClassifier } from './intelligence/IntentClassifier.js';
import { KnowledgeGraph } from './intelligence/KnowledgeGraph.js';
import { CodeGenerator } from './intelligence/CodeGenerator.js';
import { KnowledgeRegistry } from './intelligence/KnowledgeRegistry.js';
import { TemplateRegistry } from './intelligence/TemplateRegistry.js';
import { PlatformOrchestrator } from './intelligence/PlatformOrchestrator.js';
import { IntegrationGuide } from './intelligence/IntegrationGuide.js';
import { ContextManager } from './intelligence/ContextManager.js';
import { ResponseBuilder, analyzeQueryAmbiguity } from './utils/ResponseBuilder.js';
import { SmartAssistResponse } from './assist/SmartAssistResponse.js';
import { SmartAssistService } from './assist/SmartAssistService.js';
import { SmartAssistContext } from './assist/SmartAssistContext.js';

export class EaseIMServer {
  private server: Server;
  private docSearch: DocSearch;
  private sourceSearch: ShardedSourceSearch;
  private configSearch: ConfigSearch;
  // 智能化模块
  private intentClassifier: IntentClassifier;
  private knowledgeGraph: KnowledgeGraph;
  private codeGenerator: CodeGenerator;
  private knowledgeRegistry: KnowledgeRegistry;
  private templateRegistry: TemplateRegistry;
  private platformOrchestrator: PlatformOrchestrator;
  // 集成诊断模块
  private integrationGuide: IntegrationGuide;
  // 上下文管理器
  private contextManager: ContextManager;
  private smartAssistResponse: SmartAssistResponse;
  private smartAssistService?: SmartAssistService;

  constructor() {
    this.server = new Server(
      {
        name: 'easeim-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.docSearch = new DocSearch();
    this.sourceSearch = new ShardedSourceSearch();
    this.configSearch = new ConfigSearch();
    // 初始化智能化模块
    this.intentClassifier = new IntentClassifier();
    this.knowledgeGraph = new KnowledgeGraph();
    this.codeGenerator = new CodeGenerator();
    this.knowledgeRegistry = new KnowledgeRegistry();
    this.templateRegistry = new TemplateRegistry();
    this.platformOrchestrator = new PlatformOrchestrator(this.knowledgeRegistry, this.templateRegistry, this.codeGenerator);
    this.registerTemplateRegistry();
    // 初始化集成诊断模块
    this.integrationGuide = new IntegrationGuide();
    // 初始化上下文管理器
    this.contextManager = new ContextManager();
    this.smartAssistResponse = new SmartAssistResponse();

    this.setupHandlers();
  }

  private registerTemplateRegistry() {
    const templates = this.templateRegistry.load();
    for (const template of templates) {
      if (this.codeGenerator.hasTemplate(template.id)) {
        continue;
      }
      this.codeGenerator.registerTemplate({
        id: template.id,
        name: template.name,
        description: template.description,
        variables: template.variables.map(v => ({
          name: v.name,
          description: v.description || v.name,
          required: v.required,
          defaultValue: v.defaultValue ?? v.default
        })),
        template: template.template,
        usage: template.usage ? template.usage.join('\n') : undefined
      });
    }
  }

  /**
   * 设置请求处理器
   */
  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS as unknown as Tool[] };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        this.validateToolArgs(name, args);

        const platformCheck = this.enforcePlatformRequirement(name, args);
        if (platformCheck) {
          return platformCheck;
        }

        switch (name) {

          case 'lookup_error':
            return await this.handleLookupError(args);

          case 'search_api':
            return await this.handleSearchApi(args);

          case 'search_source':
            return await this.handleSearchSource(args);

          case 'get_guide':
            return await this.handleGetGuide(args);

          case 'diagnose':
            return await this.handleDiagnose(args);

          case 'read_doc':
            return await this.handleReadDoc(args);

          case 'read_source':
            return await this.handleReadSource(args);

          case 'list_config_options':
            return await this.handleListConfigOptions(args);

          case 'get_extension_points':
            return await this.handleGetExtensionPoints(args);

          case 'get_config_usage':
            return await this.handleGetConfigUsage(args);

          // ============================================================
          // 智能化工具 (P0)
          // ============================================================
          case 'smart_assist':
            return await this.handleSmartAssist(args);

          case 'generate_code':
            return await this.handleGenerateCode(args);

          case 'explain_class':
            return await this.handleExplainClass(args);

          case 'list_scenarios':
            return await this.handleListScenarios(args);

          // ============================================================
          // 集成诊断工具 (Integration)
          // ============================================================
          case 'check_integration':
            return await this.handleCheckIntegration(args);

          case 'diagnose_build_error':
            return await this.handleDiagnoseBuildError(args);

          case 'get_podfile_template':
            return await this.handleGetPodfileTemplate(args);

          case 'get_integration_checklist':
            return await this.handleGetIntegrationChecklist(args);

          case 'get_platform_requirements':
            return await this.handleGetPlatformRequirements(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    });
  }

  /**
   * 工具参数校验（基于 inputSchema，避免参数名猜测）
   */
  private validateToolArgs(toolName: string, args: any) {
    const tool = TOOLS.find(t => t.name === toolName);
    if (!tool || !tool.inputSchema || tool.inputSchema.type !== 'object') {
      return;
    }

    const schema = tool.inputSchema as unknown as {
      type: 'object';
      properties?: Record<string, { type?: string; enum?: ReadonlyArray<string | number | boolean> }>;
      required?: ReadonlyArray<string>;
      additionalProperties?: boolean;
    };

    const normalizedArgs = args ?? {};
    if (typeof normalizedArgs !== 'object' || Array.isArray(normalizedArgs)) {
      throw new Error('参数必须是对象');
    }

    const properties = schema.properties || {};
    const required = schema.required || [];
    const allowedKeys = new Set(Object.keys(properties));

    for (const key of required) {
      if (!(key in normalizedArgs)) {
        throw new Error(`缺少必填参数: ${key}`);
      }
    }

    if (schema.additionalProperties === false) {
      const extraKeys = Object.keys(normalizedArgs).filter(key => !allowedKeys.has(key));
      if (extraKeys.length > 0) {
        throw new Error(`存在未定义参数: ${extraKeys.join(', ')}。允许参数: ${[...allowedKeys].join(', ') || '无'}`);
      }
    }

    for (const [key, value] of Object.entries(normalizedArgs)) {
      const property = properties[key];
      if (!property) continue;

      if (property.type === 'string' && typeof value !== 'string') {
        throw new Error(`参数 ${key} 类型错误，应为 string`);
      }
      if (property.type === 'number' && typeof value !== 'number') {
        throw new Error(`参数 ${key} 类型错误，应为 number`);
      }
      if (property.type === 'boolean' && typeof value !== 'boolean') {
        throw new Error(`参数 ${key} 类型错误，应为 boolean`);
      }
      if (property.enum && !property.enum.includes(value as any)) {
        throw new Error(`参数 ${key} 取值不在允许范围内：${property.enum.join(', ')}`);
      }
    }
  }

  private enforcePlatformRequirement(toolName: string, args: any) {
    const normalizedArgs = args ?? {};
    const platform = normalizedArgs.platform;

    const excludedTools = new Set([
      'get_podfile_template',
      'get_platform_requirements',
      'get_integration_checklist'
    ]);

    if (excludedTools.has(toolName)) {
      if (!platform || platform !== 'ios') {
        const builder = ResponseBuilder.create();
        builder.addTitle('需要目标平台');
        builder.addParagraph('该工具仅适用于 iOS，请先指定平台为 ios。');
        builder.setPlatformSelectionInteraction({ includeAll: false });
        return builder.build();
      }
      return null;
    }

    if (!platform || typeof platform !== 'string') {
      const builder = ResponseBuilder.create();
      builder.addTitle('需要目标平台');
      builder.addParagraph('请先指定开发平台，以确保检索结果准确。');
      builder.setPlatformSelectionInteraction({ includeAll: false });
      return builder.build();
    }

    return null;
  }

  /**
   * 处理 lookup_error
   */
  private async handleLookupError(args: any) {
    const { code } = args;

    if (typeof code !== 'number') {
      throw new Error('code 参数必须是数字');
    }

    const error = this.docSearch.lookupError(code);

    if (!error) {
      return {
        content: [
          {
            type: 'text',
            text: `未找到错误码 ${code} 的信息。\n\n可能的原因：\n1. 错误码不存在\n2. 该错误码未被记录在文档中\n\n建议检查错误码是否正确，或查看环信官方文档。`
          }
        ]
      };
    }

    const result = `# 错误码 ${error.code} - ${error.name}

**模块**: ${error.module}
**简述**: ${error.brief}

## 详细描述

${error.description}

## 可能原因

${error.causes.map((c: any, i: number) => `${i + 1}. ${c}`).join('\n')}

## 解决方案

${error.solutions.map((s: any, i: number) => `${i + 1}. ${s}`).join('\n')}
`;

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  /**
   * 处理 search_api
   * 支持智能交互引导
   */
  private async handleSearchApi(args: any) {
    const { query, platform, layer, component, limit = 10 } = args;

    if (typeof query !== 'string' || !query.trim()) {
      throw new Error('query 参数必须是非空字符串');
    }

    // === 查询模糊度分析 ===
    const ambiguityAnalysis = analyzeQueryAmbiguity(query);
    if (ambiguityAnalysis.isAmbiguous) {
      const builder = ResponseBuilder.create();
      builder.addTitle('🔍 API 搜索');
      builder.addParagraph(`查询 "${query}" 过于模糊，请提供更具体的关键词。`);
      builder.setMissingInfoInteraction({
        question: '请描述您要搜索的 API 功能：',
        missingFields: ['API 名称或功能关键词'],
        examples: [
          'sendMessage - 发送消息相关',
          'login - 登录相关',
          'group - 群组相关',
          'chatroom - 聊天室相关'
        ]
      });
      builder.addSuggestedTool('get_guide', '获取功能模块完整指南', { topic: 'message' });
      builder.addSuggestedTool('smart_assist', '使用智能助手描述需求');
      return builder.build();
    }

    // 构造搜索上下文
    const context = {
      platform: platform as any,
      layer: layer as any,
      component: component as any
    };

    const { results, ambiguity } = this.docSearch.searchApi(query, context, limit);

    // === 无结果时的交互引导 ===
    if (results.length === 0) {
      const builder = ResponseBuilder.create();
      builder.addTitle('🔍 API 搜索结果');
      builder.addParagraph(`未找到与 "${query}" 相关的 API。`);
      builder.setNoResultsInteraction({
        query,
        suggestions: [
          '尝试使用更通用的关键词',
          '使用中文或英文关键词',
          '检查拼写是否正确'
        ],
        alternativeTools: [
          { tool: 'get_guide', reason: '获取功能模块的完整文档', exampleArgs: { topic: 'message' } },
          { tool: 'search_source', reason: '搜索 UIKit 源码', exampleArgs: { query } },
          { tool: 'smart_assist', reason: '用自然语言描述需求', exampleArgs: { query: `如何使用 ${query}` } }
        ]
      });

      // 提供常用搜索建议
      builder.addParagraph('\n**常用 API 搜索关键词：**');
      builder.addListItem('message / 消息 - 消息发送接收');
      builder.addListItem('conversation / 会话 - 会话管理');
      builder.addListItem('group / 群组 - 群组操作');
      builder.addListItem('contact / 好友 - 好友关系');
      builder.addListItem('push / 推送 - 消息推送');

      return builder.build();
    }

    // 构建结果文本
    let resultText = '';

    // 如果存在歧义，先显示歧义提示
    if (ambiguity.hasAmbiguity) {
      resultText += `⚠️ **检测到可能的歧义**\n\n${ambiguity.question}\n\n`;
      if (ambiguity.options) {
        resultText += '可用选项：\n';
        for (const option of ambiguity.options) {
          resultText += `- **${option.description}** (${option.count} 个结果)\n`;
        }
        resultText += '\n您可以通过指定 `platform`、`layer` 或 `component` 参数来过滤结果。\n\n---\n\n';
      }
    }

    resultText += `# API 搜索结果：${query}

找到 ${results.length} 个相关 API：

${results.map((r, i) => `
## ${i + 1}. ${r.name}

**模块**: ${r.moduleName} (${r.module})
**平台**: ${r.platform}
**层级**: ${r.layer}${r.component ? `\n**组件**: ${r.component}` : ''}
**描述**: ${r.description}
**文档**: ${r.docPath}
**相关性**: ${r.score.toFixed(0)} 分
`).join('\n')}

---

💡 提示：使用 \`read_doc\` 工具可以查看完整的 API 文档内容。
`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 处理 search_source
   * 支持智能交互引导
   */
  private async handleSearchSource(args: any) {
    const { query, component = 'all', limit = 10 } = args;


    if (typeof query !== 'string' || !query.trim()) {
      throw new Error('query 参数必须是非空字符串');
    }

    // === 查询模糊度分析 ===
    const ambiguityAnalysis = analyzeQueryAmbiguity(query);
    if (ambiguityAnalysis.isAmbiguous) {
      const builder = ResponseBuilder.create();
      builder.addTitle('📦 源码搜索');
      builder.addParagraph(`查询 "${query}" 过于模糊，请提供更具体的关键词。`);
      builder.setMissingInfoInteraction({
        question: '请描述您要搜索的源码内容：',
        missingFields: ['类名、方法名或功能关键词'],
        examples: [
          'MessageCell - 消息单元格',
          'bubbleColor - 气泡颜色',
          'Appearance - 外观配置',
          'InputBar - 输入框'
        ]
      });
      builder.setAmbiguousInteraction({
        question: '或者选择一个组件范围：',
        options: [
          { label: 'EaseChatUIKit', value: 'EaseChatUIKit', description: '聊天界面 UI 组件' },
          { label: 'EaseCallUIKit', value: 'EaseCallUIKit', description: '音视频通话 UI' },
          { label: 'EaseChatroomUIKit', value: 'EaseChatroomUIKit', description: '聊天室 UI' },
          { label: '全部组件', value: 'all', description: '搜索所有组件' }
        ]
      });
      return builder.build();
    }

    const { results, ambiguity } = this.sourceSearch.search(query, component, limit);

    // === 无结果时的交互引导 ===
    if (results.length === 0) {
      const builder = ResponseBuilder.create();
      builder.addTitle('📦 源码搜索结果');
      builder.addParagraph(`未找到与 "${query}" 相关的源码。`);
      builder.setNoResultsInteraction({
        query,
        suggestions: [
          '尝试使用更通用的关键词',
          '检查拼写是否正确',
          '尝试搜索相关的类名或方法名'
        ],
        alternativeTools: [
          { tool: 'list_config_options', reason: '查看可配置的 Appearance 属性', exampleArgs: { component: 'EaseChatUIKit' } },
          { tool: 'get_extension_points', reason: '查看可扩展的协议和类', exampleArgs: { component: 'EaseChatUIKit' } },
          { tool: 'explain_class', reason: '了解特定类的用法', exampleArgs: { className: 'MessageCell' } }
        ]
      });

      // 提供常用源码搜索建议
      builder.addParagraph('\n**常用源码搜索关键词：**');
      builder.addListItem('MessageCell / 消息 - 消息展示相关');
      builder.addListItem('Appearance - 外观配置类');
      builder.addListItem('bubble / 气泡 - 消息气泡样式');
      builder.addListItem('avatar / 头像 - 用户头像');
      builder.addListItem('InputBar / 输入 - 输入框组件');

      return builder.build();
    }

    // 构建结果文本
    let resultText = '';

    // 如果存在歧义，先显示歧义提示
    if (ambiguity.hasAmbiguity) {
      resultText += `⚠️ **检测到可能的歧义**\n\n${ambiguity.question}\n\n`;
      if (ambiguity.options) {
        resultText += '可用选项：\n';
        for (const option of ambiguity.options) {
          resultText += `- **${option.description}** (${option.count} 个结果)\n`;
        }
        resultText += '\n您可以通过指定 `component` 参数来过滤结果。\n\n---\n\n';
      }
    }

    resultText += `# 源码搜索结果：${query}

找到 ${results.length} 个相关文件：

${results.map((r, i) => `
## ${i + 1}. ${r.path}

**组件**: ${r.component}
**描述**: ${r.description}
**包含的类**: ${r.classes.join(', ') || '无'}
**标签**: ${r.tags.join(', ') || '无'}
**相关性**: ${r.score.toFixed(0)} 分

${r.matchedSymbols && r.matchedSymbols.length > 0 ? `
### 匹配的符号：

${r.matchedSymbols.map(s => {
  const startLine = s.startLine || s.line;
  const endLine = s.endLine || s.line;
  const lineText = startLine === endLine ? `第 ${startLine} 行` : `第 ${startLine}-${endLine} 行`;
  return `- **${s.name}** (${s.type}) - ${lineText}${s.signature ? `\n  \`${s.signature}\`` : ''}${s.description ? `\n  ${s.description}` : ''}`;
}).join('\n')}
` : ''}
`).join('\n')}

---

💡 提示：使用 \`read_source\` 工具可以查看完整的源码内容；参数名请以签名中的字段为准。
`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 处理 get_guide
   */
  private async handleGetGuide(args: any) {
    const { topic } = args;

    const guidePath = this.docSearch.getGuidePath(topic);

    if (!guidePath) {
      throw new Error(`未找到主题 "${topic}" 的指南`);
    }

    const content = this.docSearch.readDoc(guidePath);

    if (!content) {
      throw new Error(`无法读取指南文档: ${guidePath}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `# ${topic} 指南\n\n${content}`
        }
      ]
    };
  }

  /**
   * 处理 diagnose
   * 支持智能交互引导
   */
  private async handleDiagnose(args: any) {
    const { symptom } = args;

    if (typeof symptom !== 'string' || !symptom.trim()) {
      throw new Error('symptom 参数必须是非空字符串');
    }

    // === 症状模糊度分析 ===
    const ambiguityAnalysis = analyzeQueryAmbiguity(symptom);
    if (ambiguityAnalysis.isAmbiguous) {
      const builder = ResponseBuilder.create();
      builder.addTitle('🔧 问题诊断');
      builder.addParagraph(`症状描述 "${symptom}" 不够具体，请提供更详细的信息。`);
      builder.setMissingInfoInteraction({
        question: '请详细描述您遇到的问题：',
        missingFields: ['错误信息', '出现问题的操作', '期望的结果'],
        examples: [
          '发送消息失败，返回错误码 508',
          '登录时提示 token 过期',
          '收不到推送消息',
          '群组创建失败'
        ]
      });
      builder.setAmbiguousInteraction({
        question: '或者选择一个问题类型：',
        options: [
          { label: '消息相关', value: 'message', description: '发送/接收消息失败' },
          { label: '登录问题', value: 'login', description: '登录失败、token 问题' },
          { label: '推送问题', value: 'push', description: '收不到推送、推送延迟' },
          { label: '群组问题', value: 'group', description: '群组操作失败' }
        ]
      });
      builder.addSuggestedTool('lookup_error', '如果有错误码，可以直接查询', { code: 508 });
      return builder.build();
    }

    const errors = this.docSearch.diagnose(symptom);

    // === 无诊断结果时的交互引导 ===
    if (errors.length === 0) {
      const builder = ResponseBuilder.create();
      builder.addTitle('🔧 问题诊断结果');
      builder.addParagraph(`未能诊断出与 "${symptom}" 相关的已知错误。`);
      builder.setNoResultsInteraction({
        query: symptom,
        suggestions: [
          '提供更详细的症状描述',
          '包含具体的错误信息或错误码',
          '描述操作步骤和期望结果'
        ],
        alternativeTools: [
          { tool: 'lookup_error', reason: '如果有错误码，直接查询错误码', exampleArgs: { code: 508 } },
          { tool: 'search_api', reason: '搜索相关功能的 API 文档', exampleArgs: { query: symptom } },
          { tool: 'diagnose_build_error', reason: '如果是编译错误，使用构建错误诊断', exampleArgs: { errorMessage: symptom } }
        ]
      });

      // 提供常见问题类别
      builder.addParagraph('\n**常见问题类别：**');
      builder.addListItem('**消息问题**：发送失败、消息丢失、消息延迟');
      builder.addListItem('**登录问题**：登录失败、token 过期、被踢下线');
      builder.addListItem('**推送问题**：收不到推送、推送延迟、推送内容异常');
      builder.addListItem('**群组问题**：创建失败、加入失败、权限问题');
      builder.addListItem('**网络问题**：连接失败、超时、断线重连');

      builder.addParagraph('\n请描述具体症状，例如："发送消息后对方收不到，但是没有报错"');

      return builder.build();
    }

    const resultText = `# 问题诊断：${symptom}

根据症状，可能是以下错误：

${errors.map((e, i) => `
## ${i + 1}. 错误码 ${e.code} - ${e.name}

**模块**: ${e.module}
**描述**: ${e.brief}

### 可能原因
${e.causes.map((c: any, j: number) => `${j + 1}. ${c}`).join('\n')}

### 解决方案
${e.solutions.map((s: any, j: number) => `${j + 1}. ${s}`).join('\n')}
`).join('\n---\n')}

💡 提示：使用 \`lookup_error <错误码>\` 可以查看更详细的错误信息。
`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 处理 read_doc
   */
  private async handleReadDoc(args: any) {
    const { path } = args;

    if (typeof path !== 'string' || !path.trim()) {
      throw new Error('path 参数必须是非空字符串');
    }

    const content = this.docSearch.readDoc(path);

    if (!content) {
      throw new Error(`无法读取文档: ${path}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: content
        }
      ]
    };
  }

  /**
   * 处理 read_source
   */
  private async handleReadSource(args: any) {
    const { path, startLine, endLine } = args;

    if (typeof path !== 'string' || !path.trim()) {
      throw new Error('path 参数必须是非空字符串');
    }

    let content: string | null;

    if (startLine !== undefined && endLine !== undefined) {
      content = this.sourceSearch.getFileLines(path, startLine, endLine);
    } else {
      content = this.sourceSearch.readSource(path);
    }

    if (!content) {
      throw new Error(`无法读取源码文件: ${path}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `\`\`\`swift\n${content}\n\`\`\``
        }
      ]
    };
  }

  /**
   * 处理 list_config_options
   */
  private async handleListConfigOptions(args: any) {
    const { component = 'all' } = args;

    const configs = this.configSearch.listConfigOptions(component);

    if (Object.keys(configs).length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `未找到 ${component} 的配置项。\n\n请检查组件名称是否正确。`
          }
        ]
      };
    }

    let resultText = `# UIKit 配置项\n\n`;

    if (component === 'all') {
      resultText += `以下是所有 UIKit 组件的配置项（Appearance 属性）：\n\n`;
    } else {
      resultText += `以下是 ${component} 组件的配置项（Appearance 属性）：\n\n`;
    }

    for (const [compName, properties] of Object.entries(configs)) {
      resultText += `## ${compName}\n\n`;
      resultText += `共 ${properties.length} 个配置项：\n\n`;

      for (const prop of properties) {
        resultText += `### ${prop.name}\n\n`;
        resultText += `- **类型**: \`${prop.type}\`\n`;
        if (prop.defaultValue) {
          resultText += `- **默认值**: \`${prop.defaultValue}\`\n`;
        }
        if (prop.description) {
          resultText += `- **说明**: ${prop.description}\n`;
        }
        resultText += `- **位置**: ${prop.file}:${prop.line}\n\n`;
      }

      resultText += '\n';
    }

    resultText += `---\n\n💡 提示：\n`;
    resultText += `1. 在初始化 UIKit 前，通过修改 \`Appearance.default\` 的属性来自定义 UI\n`;
    resultText += `2. 使用 \`read_source\` 工具查看配置项的详细实现\n`;
    resultText += `3. 使用 \`get_extension_points\` 查看可以实现的协议和可继承的类\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 处理 get_extension_points
   */
  private async handleGetExtensionPoints(args: any) {
    const { component = 'all', type = 'all' } = args;

    const extensionPoints = this.configSearch.getExtensionPoints(component, type);

    if (Object.keys(extensionPoints).length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `未找到 ${component} 的扩展点。\n\n请检查组件名称或类型是否正确。`
          }
        ]
      };
    }

    let resultText = `# UIKit 扩展点\n\n`;

    if (component === 'all') {
      resultText += `以下是所有 UIKit 组件的扩展点：\n\n`;
    } else {
      resultText += `以下是 ${component} 组件的扩展点：\n\n`;
    }

    for (const [compName, points] of Object.entries(extensionPoints)) {
      const protocols = points.filter(p => p.type === 'protocol');
      const classes = points.filter(p => p.type === 'class');

      resultText += `## ${compName}\n\n`;

      if (protocols.length > 0 && (type === 'all' || type === 'protocol')) {
        resultText += `### 协议 (Protocol) - ${protocols.length} 个\n\n`;
        resultText += `实现以下协议来自定义行为：\n\n`;

        for (const proto of protocols) {
          resultText += `#### ${proto.name}\n\n`;
          if (proto.description) {
            resultText += `**说明**: ${proto.description}\n\n`;
          }
          resultText += `**位置**: ${proto.file}:${proto.line}\n`;

          if (proto.methods && proto.methods.length > 0) {
            resultText += `\n**方法**:\n`;
            proto.methods.slice(0, 5).forEach(method => {
              resultText += `- \`${method}\`\n`;
            });
            if (proto.methods.length > 5) {
              resultText += `- ... 以及 ${proto.methods.length - 5} 个其他方法\n`;
            }
          }

          resultText += '\n';
        }

        resultText += '\n';
      }

      if (classes.length > 0 && (type === 'all' || type === 'class')) {
        resultText += `### 可继承类 (Open Class) - ${classes.length} 个\n\n`;
        resultText += `继承以下类来自定义 UI：\n\n`;

        for (const cls of classes) {
          resultText += `#### ${cls.name}\n\n`;
          if (cls.description) {
            resultText += `**说明**: ${cls.description}\n\n`;
          }
          resultText += `**位置**: ${cls.file}:${cls.line}\n\n`;
        }
      }

      resultText += '\n';
    }

    resultText += `---\n\n💡 提示：\n`;
    resultText += `1. **协议 (Protocol)**: 实现协议方法来自定义事件处理、数据源等行为\n`;
    resultText += `2. **可继承类 (Open Class)**: 继承这些类来完全自定义 UI 组件\n`;
    resultText += `3. 使用 \`read_source\` 工具查看类或协议的完整源码\n`;
    resultText += `4. 使用 \`search_source\` 搜索相关的实现示例\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 处理 get_config_usage
   */
  private async handleGetConfigUsage(args: any) {
    const { propertyName, component = 'all' } = args;

    if (typeof propertyName !== 'string' || !propertyName.trim()) {
      throw new Error('propertyName 参数必须是非空字符串');
    }

    const usage = this.configSearch.getConfigUsage(propertyName, component);

    if (!usage) {
      return {
        content: [
          {
            type: 'text',
            text: `未找到配置项 "${propertyName}" 的使用信息。\n\n可能的原因：\n1. 配置项名称拼写错误\n2. 该配置项不存在\n3. 尚未生成影响分析数据\n\n建议使用 \`list_config_options\` 查看所有可用的配置项。`
          }
        ]
      };
    }

    const prop = usage.property;
    let resultText = `# 配置项使用详情：${propertyName}\n\n`;

    // 基本信息
    resultText += `## 📋 基本信息\n\n`;
    resultText += `- **名称**: \`${prop.name}\`\n`;
    resultText += `- **类型**: \`${prop.type}\`\n`;
    if (prop.defaultValue) {
      resultText += `- **默认值**: \`${prop.defaultValue}\`\n`;
    }
    resultText += `- **类别**: ${usage.category}\n`;
    resultText += `- **定义位置**: ${prop.file}:${prop.line}\n`;
    if (prop.description) {
      resultText += `\n**说明**: ${prop.description}\n`;
    }

    // 影响概述
    resultText += `\n## 🎯 影响概述\n\n`;
    resultText += `${usage.summary}\n\n`;
    resultText += `- **使用次数**: ${usage.usageCount} 处\n`;
    resultText += `- **影响组件数**: ${usage.affectedComponents.length} 个\n`;

    // 影响的组件列表
    if (usage.affectedComponents.length > 0) {
      resultText += `\n## 🎨 影响的 UI 组件\n\n`;

      // 按组件类型分组
      const componentsByType: Record<string, string[]> = {
        'Cell': [],
        'View': [],
        'Controller': [],
        'Bar': [],
        'Button': [],
        'Other': []
      };

      for (const comp of usage.affectedComponents) {
        let added = false;
        for (const type of Object.keys(componentsByType)) {
          if (comp.includes(type)) {
            componentsByType[type].push(comp);
            added = true;
            break;
          }
        }
        if (!added) {
          componentsByType['Other'].push(comp);
        }
      }

      for (const [type, components] of Object.entries(componentsByType)) {
        if (components.length > 0) {
          resultText += `\n### ${type === 'Other' ? '其他组件' : type + ' 组件'}\n\n`;
          for (const comp of components) {
            resultText += `- ✅ **${comp}**\n`;
          }
        }
      }
    }

    // 使用位置示例
    if (usage.usages.length > 0) {
      resultText += `\n## 📍 使用位置示例\n\n`;
      resultText += `以下是该配置项在源码中的使用示例（最多显示 5 个）：\n\n`;

      const displayUsages = usage.usages.slice(0, 5);
      for (let i = 0; i < displayUsages.length; i++) {
        const u = displayUsages[i];
        resultText += `### 示例 ${i + 1}\n\n`;
        resultText += `**文件**: \`${u.file}:${u.line}\`\n`;
        if (u.component !== 'Unknown') {
          resultText += `**组件**: ${u.component}\n`;
        }
        resultText += `\n**代码上下文**:\n\`\`\`swift\n${u.context}\n\`\`\`\n\n`;
      }

      if (usage.usages.length > 5) {
        resultText += `*... 以及其他 ${usage.usages.length - 5} 处使用*\n\n`;
      }
    }

    // 使用建议
    resultText += `---\n\n## 💡 使用建议\n\n`;

    switch (usage.category) {
      case 'Color':
        resultText += `这是一个颜色配置项，修改后会影响整个主题的色调：\n\n`;
        resultText += `\`\`\`swift\n// 修改为自定义色调\n`;
        resultText += `Appearance.${propertyName} = 120/360.0  // 绿色\n`;
        resultText += `\`\`\`\n\n`;
        resultText += `建议在应用启动时、UIKit 初始化之前设置。\n`;
        break;

      case 'Corner':
        resultText += `这是一个圆角配置项，可以调整 UI 组件的圆角风格：\n\n`;
        resultText += `\`\`\`swift\n// 可选值：.none, .extraSmall, .small, .medium, .large\n`;
        resultText += `Appearance.${propertyName} = .medium\n`;
        resultText += `\`\`\`\n\n`;
        resultText += `- \`.none\` - 无圆角（方形）\n`;
        resultText += `- \`.extraSmall\` - 极小圆角\n`;
        resultText += `- \`.small\` - 小圆角\n`;
        resultText += `- \`.medium\` - 中等圆角\n`;
        resultText += `- \`.large\` - 大圆角（接近圆形）\n`;
        break;

      case 'Size':
        resultText += `这是一个尺寸配置项，可以调整 UI 组件的大小：\n\n`;
        resultText += `\`\`\`swift\n// 设置自定义尺寸\n`;
        resultText += `Appearance.${propertyName} = 100.0  // CGFloat 值\n`;
        resultText += `\`\`\`\n\n`;
        resultText += `建议根据设计稿和屏幕尺寸进行调整。\n`;
        break;

      case 'Image':
        resultText += `这是一个图片资源配置项，可以替换为自定义图片：\n\n`;
        resultText += `\`\`\`swift\n// 使用自定义图片\n`;
        resultText += `Appearance.${propertyName} = UIImage(named: "my_custom_image")\n`;
        resultText += `\`\`\`\n\n`;
        resultText += `建议使用与原图相同尺寸的图片，以保持视觉一致性。\n`;
        break;

      case 'Style':
        resultText += `这是一个样式配置项，可以切换不同的显示风格：\n\n`;
        resultText += `\`\`\`swift\n// 查看源码了解可用的样式选项\n`;
        resultText += `Appearance.${propertyName} = .yourStyleOption\n`;
        resultText += `\`\`\`\n\n`;
        break;

      default:
        resultText += `根据配置项的类型和用途进行合理设置。\n\n`;
        resultText += `\`\`\`swift\n`;
        resultText += `Appearance.${propertyName} = yourValue\n`;
        resultText += `\`\`\`\n\n`;
    }

    resultText += `\n---\n\n💡 **提示**:\n`;
    resultText += `- 使用 \`read_source\` 工具可以查看具体使用位置的完整源码\n`;
    resultText += `- 使用 \`list_config_options\` 查看所有可配置项\n`;
    resultText += `- 配置应该在 UIKit 初始化之前设置才能生效\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  // ============================================================
  // 智能化工具处理器 (P0)
  // ============================================================

  /**
   * 处理 smart_assist - 智能助手
   * 理解用户自然语言意图，自动调用合适的工具
   * 集成上下文感知搜索
   * 支持智能交互引导
   */
  private async handleSmartAssist(args: any) {
    if (!this.smartAssistService) {
      this.smartAssistService = new SmartAssistService(
        this.intentClassifier,
        new SmartAssistContext(this.contextManager),
        this.smartAssistResponse,
        this.docSearch,
        this.knowledgeRegistry,
        this.templateRegistry,
        this.platformOrchestrator,
        this.configSearch,
        this.knowledgeGraph,
        this.sourceSearch
      );
    }

    return this.smartAssistService.handle(args);
  }

  /**
   * 处理 generate_code - 代码生成器
   */
  private async handleGenerateCode(args: any) {
    const { scenario, name, cellHeight = 120 } = args;

    if (typeof scenario !== 'string' || !scenario.trim()) {
      throw new Error('scenario 参数必须是非空字符串');
    }

    // 映射场景到模板
    const templateMap: Record<string, string> = {
      'custom_message': 'custom_message_full',
      'attachment_menu': 'attachment_menu',
      'bubble_style': 'bubble_style',
      'theme_config': 'theme_config',
      'avatar_config': 'avatar_config',
      'long_press_menu': 'long_press_menu',
      'text_style_customization': 'text_style_customization',
      'chat_background_customization': 'chat_background_config',
      'user_profile_customization': 'user_profile_customization'
    };

    const templateId = templateMap[scenario];
    if (!templateId) {
      return {
        content: [
          {
            type: 'text',
            text: `## ❌ 未知场景: ${scenario}\n\n可用场景:\n${Object.keys(templateMap).map(k => `- ${k}`).join('\n')}\n\n使用 \`list_scenarios\` 查看详细说明。`
          }
        ]
      };
    }

    const generated = this.platformOrchestrator.generateCode(templateId, 'ios', name || 'Custom');
    const result = generated
      ? this.codeGenerator.generate(generated.templateId || templateId, {
        messageName: name || 'Custom',
        cellHeight
      })
      : this.codeGenerator.generate(templateId, {
        messageName: name || 'Custom',
        cellHeight
      });

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `## ❌ 代码生成失败\n\n${result.error}`
          }
        ]
      };
    }

    let resultText = `# 📝 代码生成结果\n\n`;
    resultText += `**场景**: ${scenario}\n`;
    if (name) resultText += `**名称**: ${name}\n`;
    resultText += `**模板**: ${result.templateId}\n\n`;

    if (result.description) {
      resultText += `## 说明\n\n${result.description}\n\n`;
    }

    resultText += `## 生成的代码\n\n`;
    resultText += `\`\`\`swift\n${result.code}\n\`\`\`\n\n`;

    if (result.usage) {
      resultText += `## 使用方法\n\n${result.usage}\n\n`;
    }

    if (result.relatedFiles && result.relatedFiles.length > 0) {
      resultText += `## 相关文件\n\n`;
      resultText += result.relatedFiles.map(f => `- ${f}`).join('\n');
      resultText += '\n';
    }

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 处理 explain_class - 类解释器
   */
  private async handleExplainClass(args: any) {
    const { className } = args;

    if (typeof className !== 'string' || !className.trim()) {
      throw new Error('className 参数必须是非空字符串');
    }

    if (!this.smartAssistService) {
      this.smartAssistService = new SmartAssistService(
        this.intentClassifier,
        new SmartAssistContext(this.contextManager),
        this.smartAssistResponse,
        this.docSearch,
        this.knowledgeRegistry,
        this.templateRegistry,
        this.platformOrchestrator,
        this.configSearch,
        this.knowledgeGraph,
        this.sourceSearch
      );
    }

    const explanation = await this.smartAssistService.explainClass(className);

    return {
      content: [
        {
          type: 'text',
          text: explanation
        }
      ]
    };
  }

  /**
   * 处理 list_scenarios - 场景列表
   */
  private async handleListScenarios(args: any) {
    const { keyword } = args;

    const scenarios = this.platformOrchestrator.buildScenarioViews('ios', keyword);

    let resultText = `# 📋 开发场景列表\n\n`;

    if (keyword) {
      resultText += `筛选关键词: **${keyword}**\n\n`;
    }

    if (scenarios.length === 0) {
      resultText += `未找到匹配的场景。\n\n`;
      resultText += `尝试使用其他关键词，如：消息、菜单、主题、头像、气泡\n`;
    } else {
      resultText += `共找到 ${scenarios.length} 个场景：\n\n`;

      for (const scenario of scenarios) {
        resultText += `## ${scenario.icon || '📌'} ${scenario.name}\n\n`;
        resultText += `**ID**: \`${scenario.id}\`\n`;
        resultText += `**描述**: ${scenario.description}\n\n`;

        if (scenario.steps && scenario.steps.length > 0) {
          resultText += `**实现步骤**:\n`;
          scenario.steps.forEach((step, i) => {
            resultText += `${i + 1}. ${step}\n`;
          });
          resultText += '\n';
        }

        if (scenario.relatedClasses && scenario.relatedClasses.length > 0) {
          resultText += `**相关类**: ${scenario.relatedClasses.join(', ')}\n\n`;
        }

        resultText += `---\n\n`;
      }
    }

    resultText += `## 💡 使用提示\n\n`;
    resultText += `1. 使用 \`smart_assist\` 工具，用自然语言描述需求\n`;
    resultText += `2. 使用 \`generate_code scenario="场景ID"\` 生成代码\n`;
    resultText += `3. 使用 \`explain_class className="类名"\` 了解类的用法\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  // ============================================================
  // 集成诊断工具处理器 (Integration)
  // ============================================================

  /**
   * 处理 check_integration - 集成配置检查
   */
  private async handleCheckIntegration(args: any) {
    const { component, podfileContent } = args;

    if (typeof component !== 'string' || !component.trim()) {
      throw new Error('component 参数必须是非空字符串');
    }

    const requirement = this.integrationGuide.getRequirements(component);

    if (!requirement) {
      return {
        content: [
          {
            type: 'text',
            text: `## ❌ 未知组件: ${component}\n\n支持的组件: EaseChatUIKit, EaseCallUIKit, EaseChatroomUIKit, EaseIMKit`
          }
        ]
      };
    }

    let resultText = `# 🔍 ${component} 集成配置检查\n\n`;

    // 平台要求
    resultText += `## 📋 平台要求\n\n`;
    resultText += `| 项目 | 要求 |\n`;
    resultText += `|------|------|\n`;
    resultText += `| iOS 最低版本 | ${requirement.minVersion}+ |\n`;
    if (requirement.xcodeVersion) {
      resultText += `| Xcode 版本 | ${requirement.xcodeVersion}+ |\n`;
    }
    if (requirement.cocoapodsVersion) {
      resultText += `| CocoaPods 版本 | ${requirement.cocoapodsVersion}+ |\n`;
    }
    resultText += `\n`;

    // 注意事项
    if (requirement.notes && requirement.notes.length > 0) {
      resultText += `## ⚠️ 注意事项\n\n`;
      requirement.notes.forEach((note, i) => {
        resultText += `${i + 1}. ${note}\n`;
      });
      resultText += `\n`;
    }

    // 如果提供了 Podfile 内容，进行检查
    if (podfileContent) {
      const check = this.integrationGuide.checkPodfileConfig(podfileContent, component);

      resultText += `## 🔎 Podfile 配置检查\n\n`;

      if (check.valid) {
        resultText += `✅ **配置正确** - Podfile 符合 ${component} 的要求\n\n`;
      } else {
        resultText += `❌ **发现问题** - 以下配置需要修改：\n\n`;
        check.issues.forEach((issue, i) => {
          resultText += `### 问题 ${i + 1}: ${issue.message}\n\n`;
          resultText += `**修复方法**: ${issue.fix}\n\n`;
        });
      }

      if (check.suggestions.length > 0) {
        resultText += `## 💡 优化建议\n\n`;
        check.suggestions.forEach((suggestion, i) => {
          resultText += `${i + 1}. ${suggestion}\n`;
        });
        resultText += `\n`;
      }
    } else {
      resultText += `## 💡 提示\n\n`;
      resultText += `提供 \`podfileContent\` 参数可以检查具体的 Podfile 配置问题。\n\n`;
    }

    // 推荐的 Podfile 模板
    const template = this.integrationGuide.getPodfileTemplate(component);
    if (template) {
      resultText += `## 📄 推荐 Podfile 模板\n\n`;
      resultText += `\`\`\`ruby\n${template}\n\`\`\`\n\n`;
    }

    resultText += `---\n\n`;
    resultText += `使用 \`get_integration_checklist component="${component}"\` 获取完整的集成检查清单。\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 处理 diagnose_build_error - 构建错误诊断
   */
  private async handleDiagnoseBuildError(args: any) {
    const { errorMessage } = args;

    if (typeof errorMessage !== 'string' || !errorMessage.trim()) {
      throw new Error('errorMessage 参数必须是非空字符串');
    }

    const problems = this.integrationGuide.diagnoseError(errorMessage);

    if (problems.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `## 🤔 未识别的错误\n\n未能从以下错误信息中识别出已知问题：\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\n**建议**:\n1. 检查错误信息是否完整\n2. 使用 \`diagnose\` 工具描述问题症状\n3. 搜索环信官方文档或社区`
          }
        ]
      };
    }

    let resultText = `# 🛠️ 构建错误诊断\n\n`;
    resultText += `**错误信息**: \`${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}\`\n\n`;
    resultText += `找到 ${problems.length} 个可能的问题：\n\n`;

    problems.forEach((problem, i) => {
      resultText += `## ${i + 1}. ${problem.symptom}\n\n`;
      resultText += `**优先级**: ${this.getPriorityEmoji(problem.priority)} ${problem.priority}\n`;
      resultText += `**原因**: ${problem.cause}\n\n`;

      resultText += `### 解决方案\n\n`;
      problem.solutions.forEach((solution, j) => {
        resultText += `#### 方案 ${j + 1}: ${solution.description}\n\n`;

        if (solution.settingPath) {
          resultText += `**设置路径**: ${solution.settingPath}\n\n`;
        }

        if (solution.fileToModify) {
          resultText += `**需要修改的文件**: ${solution.fileToModify}\n\n`;
        }

        if (solution.codeExample) {
          resultText += `**代码/配置示例**:\n\`\`\`\n${solution.codeExample}\n\`\`\`\n\n`;
        }
      });

      if (problem.relatedComponents && problem.relatedComponents.length > 0) {
        resultText += `**相关组件**: ${problem.relatedComponents.join(', ')}\n\n`;
      }

      resultText += `---\n\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 获取优先级 emoji
   */
  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * 处理 get_podfile_template - 获取 Podfile 模板
   */
  private async handleGetPodfileTemplate(args: any) {
    const { component } = args;

    if (typeof component !== 'string' || !component.trim()) {
      throw new Error('component 参数必须是非空字符串');
    }

    const template = this.integrationGuide.getPodfileTemplate(component);

    if (!template) {
      return {
        content: [
          {
            type: 'text',
            text: `## ❌ 未找到模板\n\n组件 "${component}" 没有可用的 Podfile 模板。\n\n支持的组件: EaseChatUIKit, EaseCallUIKit, EaseChatroomUIKit`
          }
        ]
      };
    }

    const requirement = this.integrationGuide.getRequirements(component);

    let resultText = `# 📄 ${component} Podfile 模板\n\n`;

    if (requirement) {
      resultText += `## 环境要求\n\n`;
      resultText += `- iOS ${requirement.minVersion}+\n`;
      if (requirement.xcodeVersion) resultText += `- Xcode ${requirement.xcodeVersion}+\n`;
      if (requirement.cocoapodsVersion) resultText += `- CocoaPods ${requirement.cocoapodsVersion}+\n`;
      resultText += `\n`;
    }

    resultText += `## Podfile 配置\n\n`;
    resultText += `\`\`\`ruby\n${template}\n\`\`\`\n\n`;

    resultText += `## 使用步骤\n\n`;
    resultText += `1. 将上述内容保存为 \`Podfile\`（替换 \`YourTarget\` 为你的目标名称）\n`;
    resultText += `2. 在终端执行 \`pod install --repo-update\`\n`;
    resultText += `3. 使用 \`.xcworkspace\` 文件打开项目\n\n`;

    resultText += `## ⚠️ 常见问题\n\n`;
    resultText += `- **rsync 报错**: 确保 \`ENABLE_USER_SCRIPT_SANDBOXING = 'NO'\` 已设置\n`;
    resultText += `- **架构问题**: Apple Silicon Mac 可能需要使用 Rosetta 模式的模拟器\n`;
    resultText += `- **CocoaPods 报错**: 确保 CocoaPods 版本 >= 1.14.3\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }

  /**
   * 处理 get_integration_checklist - 获取集成检查清单
   */
  private async handleGetIntegrationChecklist(args: any) {
    const { component } = args;

    if (typeof component !== 'string' || !component.trim()) {
      throw new Error('component 参数必须是非空字符串');
    }

    const checklist = this.integrationGuide.generateChecklist(component);

    return {
      content: [
        {
          type: 'text',
          text: checklist
        }
      ]
    };
  }

  /**
   * 处理 get_platform_requirements - 获取平台要求
   */
  private async handleGetPlatformRequirements(args: any) {
    const { component = 'all' } = args;

    let resultText = `# 📋 UIKit 平台要求\n\n`;

    if (component === 'all') {
      const allRequirements = this.integrationGuide.getAllRequirements();

      resultText += `| 组件 | iOS 版本 | Xcode 版本 | CocoaPods 版本 |\n`;
      resultText += `|------|----------|------------|----------------|\n`;

      for (const req of allRequirements) {
        resultText += `| ${req.component} | ${req.minVersion}+ | ${req.xcodeVersion || '-'}+ | ${req.cocoapodsVersion || '-'}+ |\n`;
      }

      resultText += `\n## 详细说明\n\n`;

      for (const req of allRequirements) {
        resultText += `### ${req.component}\n\n`;
        resultText += `- **iOS 最低版本**: ${req.minVersion}\n`;
        if (req.xcodeVersion) resultText += `- **Xcode 版本**: ${req.xcodeVersion}+\n`;
        if (req.cocoapodsVersion) resultText += `- **CocoaPods 版本**: ${req.cocoapodsVersion}+\n`;

        if (req.notes && req.notes.length > 0) {
          resultText += `- **注意事项**:\n`;
          req.notes.forEach(note => {
            resultText += `  - ${note}\n`;
          });
        }
        resultText += `\n`;
      }
    } else {
      const requirement = this.integrationGuide.getRequirements(component);

      if (!requirement) {
        return {
          content: [
            {
              type: 'text',
              text: `## ❌ 未知组件: ${component}\n\n支持的组件: EaseChatUIKit, EaseCallUIKit, EaseChatroomUIKit, EaseIMKit`
            }
          ]
        };
      }

      resultText += `## ${component}\n\n`;
      resultText += `| 项目 | 要求 |\n`;
      resultText += `|------|------|\n`;
      resultText += `| iOS 最低版本 | ${requirement.minVersion}+ |\n`;
      if (requirement.xcodeVersion) {
        resultText += `| Xcode 版本 | ${requirement.xcodeVersion}+ |\n`;
      }
      if (requirement.cocoapodsVersion) {
        resultText += `| CocoaPods 版本 | ${requirement.cocoapodsVersion}+ |\n`;
      }
      resultText += `\n`;

      if (requirement.notes && requirement.notes.length > 0) {
        resultText += `## ⚠️ 注意事项\n\n`;
        requirement.notes.forEach((note, i) => {
          resultText += `${i + 1}. ${note}\n`;
        });
      }
    }

    resultText += `\n---\n\n`;
    resultText += `使用 \`check_integration\` 检查具体的配置问题。\n`;
    resultText += `使用 \`get_podfile_template\` 获取推荐的 Podfile 模板。\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultText
        }
      ]
    };
  }


  /**
   * 启动服务器
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('🚀 环信 IM SDK MCP Server 已启动');
    console.error('📚 文档索引已加载');
    console.error('📦 源码分片索引已加载 (ShardedSourceSearch)');
    console.error('⚙️  配置索引已加载');
    console.error('🧠 智能助手已就绪');
    console.error('🔧 集成诊断已就绪');
    console.error('✨ 准备就绪，等待请求...\n');
    console.error('💡 提示: 使用 smart_assist 工具可用自然语言描述需求');
    console.error('💡 提示: 使用 diagnose_build_error 诊断构建错误\n');
  }
}
