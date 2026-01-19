import { IntentClassifier, UserIntent } from '../intelligence/IntentClassifier.js';
import { ResponseBuilder, analyzeQueryAmbiguity, detectMissingPlatform } from '../utils/ResponseBuilder.js';
import { SmartAssistContext } from './SmartAssistContext.js';
import { SmartAssistResponse } from './SmartAssistResponse.js';
import { DocSearch } from '../search/DocSearch.js';
import { KnowledgeRegistry } from '../intelligence/KnowledgeRegistry.js';
import { PlatformOrchestrator } from '../intelligence/PlatformOrchestrator.js';
import { TemplateRegistry } from '../intelligence/TemplateRegistry.js';
import { ConfigSearch } from '../search/ConfigSearch.js';
import { KnowledgeGraph } from '../intelligence/KnowledgeGraph.js';
import { ShardedSourceSearch } from '../search/ShardedSourceSearch.js';
import { SimilarityMatcher, Vectorizable } from '../intelligence/SimilarityMatcher.js';

export class SmartAssistService {
  constructor(
    private readonly intentClassifier: IntentClassifier,
    private readonly context: SmartAssistContext,
    private readonly responses: SmartAssistResponse,
    private readonly docSearch: DocSearch,
    private readonly knowledgeRegistry: KnowledgeRegistry,
    private readonly templateRegistry: TemplateRegistry,
    private readonly platformOrchestrator: PlatformOrchestrator,
    private readonly configSearch: ConfigSearch,
    private readonly knowledgeGraph: KnowledgeGraph,
    private readonly sourceSearch: ShardedSourceSearch
  ) {}

  async handle(args: any) {
    const { query, session_id, platform } = args;

    if (typeof query !== 'string' || !query.trim()) {
      throw new Error('query 参数必须是非空字符串');
    }

    const sessionId = session_id || 'default';

    const ambiguityAnalysis = analyzeQueryAmbiguity(query);
    if (ambiguityAnalysis.isAmbiguous) {
      return this.responses.buildAmbiguousQueryResponse(query, ambiguityAnalysis);
    }

    const continuity = this.context.detectContinuity(query, sessionId);
    const contextSummary = this.context.getContextSummary(sessionId);
    const { enhancedQuery } = this.context.enhanceQuery(query, sessionId);

    const platformCheck = detectMissingPlatform(query, platform);
    if (platformCheck.needsPlatform && platformCheck.isImplementationQuery) {
      const missingPlatformResult = this.intentClassifier.classify(enhancedQuery);
      return this.responses.buildPlatformSelectionResponse(query, platformCheck.featureName, missingPlatformResult);
    }

    const effectivePlatform = platformCheck.detectedPlatform || platform;
    const intentResult = this.intentClassifier.classify(enhancedQuery, effectivePlatform);
    const { intent, confidence, entities } = intentResult;
    const platformForAnswer = effectivePlatform || platformCheck.detectedPlatform || platform || 'ios';
    const normalizedPlatform = platformForAnswer === 'react-native' ? 'rn' : platformForAnswer;

    const templateMatch = this.matchTemplateIntent(enhancedQuery, normalizedPlatform);
    if (templateMatch) {
      return this.buildTemplateMatchResponse(templateMatch, normalizedPlatform);
    }

    this.context.recordSearch(query, intentResult, sessionId);

    if (confidence < 50 && intent === UserIntent.UNKNOWN) {
      const possibleIntents = this.getPossibleIntents(query);
      return this.responses.buildLowConfidenceResponse(query, intentResult, possibleIntents);
    }

    const builder = ResponseBuilder.create();

    builder.addTitle('🧠 智能助手分析');
    builder.addParagraph(`**您的问题**: ${query}`);

    if (continuity.isContinuation && continuity.suggestedContext) {
      builder.addParagraph(`> 📎 **上下文**: ${continuity.suggestedContext}`);
    }

    builder.addParagraph(`**识别意图**: ${this.intentClassifier.getIntentDescription(intent)} (置信度: ${confidence.toFixed(0)}%)`);

    const extractedEntities: string[] = [];
    if (entities.errorCode) extractedEntities.push(`错误码: ${entities.errorCode}`);
    if (entities.componentName) extractedEntities.push(`组件: ${entities.componentName}`);
    if (entities.featureName) extractedEntities.push(`功能: ${entities.featureName}`);
    if (entities.className) extractedEntities.push(`类: ${entities.className}`);
    if (entities.messageName) extractedEntities.push(`消息类型: ${entities.messageName}`);
    if (entities.configProperty) extractedEntities.push(`配置项: ${entities.configProperty}`);

    if (extractedEntities.length > 0) {
      builder.addParagraph(`**提取的关键信息**: ${extractedEntities.join(' | ')}`);
    }

    builder.addDivider();

    let resultText = builder.build().content[0].text;

    switch (intent) {
      case UserIntent.FIX_ERROR:
        if (entities.errorCode) {
          resultText += await this.getErrorSolution(entities.errorCode, normalizedPlatform);
        } else {
          resultText += `## 💡 建议\n\n`;
          resultText += `检测到您在询问错误相关问题，但未提取到具体错误码。\n\n`;
          resultText += `请提供具体的错误码数字，例如：\n`;
          resultText += `- "错误码 508 怎么解决"\n`;
          resultText += `- "error code 200 是什么意思"\n\n`;
          resultText += `或者使用 \`diagnose\` 工具描述症状：\n`;
          resultText += `- "消息发送失败"\n`;
          resultText += `- "登录超时"\n`;
        }
        break;

      case UserIntent.CUSTOMIZE_MESSAGE:
        resultText += await this.getCustomMessageSolution(entities.messageName || 'Custom', normalizedPlatform);
        break;

      case UserIntent.ADD_MENU_ITEM:
        resultText += await this.getAddMenuSolution(normalizedPlatform);
        break;

      case UserIntent.CUSTOMIZE_UI:
      case UserIntent.CONFIGURE_APPEARANCE:
        resultText += await this.getUiCustomizationSolution(entities.configProperty, intentResult.subIntent, normalizedPlatform);
        break;

      case UserIntent.UNDERSTAND_CLASS:
        if (entities.className) {
          resultText += await this.explainClass(entities.className);
        } else {
          resultText += `## 💡 建议\n\n`;
          resultText += `请提供具体的类名，例如：\n`;
          resultText += `- "MessageCell 是什么"\n`;
          resultText += `- "CustomMessageCell 怎么用"\n`;
          resultText += `- "ComponentsRegister 的作用"\n`;
        }
        break;

      case UserIntent.INTEGRATE_SDK:
        resultText += `## 📚 SDK 集成指南\n\n`;
        resultText += `建议使用 \`get_guide\` 工具获取详细的集成指南：\n\n`;
        resultText += `\`\`\`\nget_guide topic="quickstart"\n\`\`\`\n\n`;
        resultText += `### 快速集成步骤\n\n`;
        resultText += `1. **CocoaPods 安装**\n`;
        resultText += `   \`\`\`ruby\n   pod 'EaseChatUIKit'\n   \`\`\`\n\n`;
        resultText += `2. **初始化 SDK**\n`;
        resultText += `   \`\`\`swift\n   import EaseChatUIKit\n   \n   // 在 AppDelegate 中初始化\n   let options = ChatOptions(appkey: "您的AppKey")\n   ChatUIKitClient.shared.setup(option: options)\n   \`\`\`\n\n`;
        resultText += `3. **登录**\n`;
        resultText += `   \`\`\`swift\n   ChatUIKitClient.shared.login(user: userId, token: token) { error in\n       if let error = error {\n           print("登录失败: \\(error.errorDescription)")\n       } else {\n           print("登录成功")\n       }\n   }\n   \`\`\`\n`;
        break;

      case UserIntent.IMPLEMENT_FEATURE:
        resultText += `## 📋 功能实现建议\n\n`;
        if (entities.featureName) {
          resultText += `您想实现的功能: **${entities.featureName}**\n\n`;
          resultText += `使用 \`search_api\` 工具搜索相关 API：\n`;
          resultText += `\`\`\`\nsearch_api query="${entities.featureName}"\n\`\`\`\n\n`;
        }
        resultText += `或者使用 \`list_scenarios\` 查看所有支持的场景。\n`;
        break;

      default:
        resultText += `## 💡 建议\n\n`;
        resultText += `我未能准确理解您的意图。您可以尝试：\n\n`;
        resultText += `1. **查看可用场景**: \`list_scenarios\`\n`;
        resultText += `2. **搜索 API**: \`search_api query="关键词"\`\n`;
        resultText += `3. **搜索源码**: \`search_source query="关键词"\`\n`;
        resultText += `4. **查询错误码**: \`lookup_error code=508\`\n`;
        resultText += `5. **获取指南**: \`get_guide topic="quickstart"\`\n\n`;
        resultText += `或者用更具体的语言描述您的需求：\n`;
        resultText += `- "我想自定义一个订单消息"\n`;
        resultText += `- "如何添加发送位置的菜单"\n`;
        resultText += `- "错误码 508 怎么解决"\n`;
    }

    const recommendations = this.context.getRecommendations(sessionId, 3);
    if (recommendations.length > 0) {
      resultText += `\n---\n\n## 📌 您可能还想了解\n\n`;
      for (const rec of recommendations) {
        const icon = rec.type === 'class' ? '🔷' : rec.type === 'api' ? '📗' : rec.type === 'guide' ? '📖' : '💡';
        resultText += `- ${icon} **${rec.title}**: ${rec.description}\n`;
      }
    }

    if (contextSummary.recentQueries.length > 1) {
      resultText += `\n---\n\n<details>\n<summary>📋 会话上下文</summary>\n\n`;
      resultText += `- 当前话题: ${contextSummary.currentTopic || '未确定'}\n`;
      resultText += `- 会话时长: ${contextSummary.sessionDuration} 分钟\n`;
      resultText += `- 最近查询: ${contextSummary.recentQueries.slice(-3).join(' → ')}\n`;
      resultText += `</details>\n`;
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

  private matchTemplateIntent(query: string, platform: string) {
    const templateItems = this.templateRegistry.load(platform);

    if (templateItems.length === 0) {
      return null;
    }

    const candidates: Vectorizable[] = templateItems.map((template) => ({
      id: template.id,
      text: `${template.name} ${template.description || ''} ${template.domain}`.trim()
    }));

    const matcher = new SimilarityMatcher();
    matcher.trainIDF(candidates.map(c => c.text));

    const match = matcher.findBestMatchWithTFIDF(query, candidates, 0.45);
    if (!match) return null;

    const templateName = match.target.id.split(':').slice(2).join(':');
    if (!templateName) {
      return null;
    }

    return {
      templateName,
      scenarioName: match.target.text,
      score: match.score
    };
  }

  private buildTemplateMatchResponse(
    match: { templateName: string; scenarioName: string; score: number },
    platform: string
  ) {
    const builder = ResponseBuilder.create();
    builder.addTitle('模板匹配');
    builder.addParagraph(`已根据您的描述匹配到模板：${match.scenarioName}`);
    builder.addParagraph(`匹配度: ${(match.score * 100).toFixed(0)}%`);

    const generated = this.platformOrchestrator.generateCode(match.templateName, platform, {
      platform,
      name: 'Custom'
    });

    if (!generated) {
      builder.addParagraph('未能生成模板代码，请检查平台或模板配置。');
      return builder.build();
    }

    builder.addParagraph('代码生成结果：');
    builder.addText(`\`\`\`swift\n${generated.code}\n\`\`\``);
    if (generated.usage) {
      builder.addParagraph(`集成步骤:\n${generated.usage}`);
    }

    return builder.build();
  }

  private getPossibleIntents(query: string): Array<{ intent: string; label: string; description: string }> {
    const intents = [
      { intent: 'customize_ui', label: '定制 UI 样式', description: '修改颜色、字体、布局等界面元素' },
      { intent: 'custom_message', label: '自定义消息类型', description: '创建订单、卡片等自定义消息' },
      { intent: 'fix_error', label: '解决错误/问题', description: '查询错误码、诊断问题' },
      { intent: 'integrate_sdk', label: 'SDK 集成配置', description: '安装、初始化、配置 SDK' },
      { intent: 'understand_api', label: '了解 API 用法', description: '查看接口文档和使用方法' }
    ];

    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('颜色') || lowerQuery.includes('样式') || lowerQuery.includes('ui')) {
      const uiIntent = intents.find(i => i.intent === 'customize_ui');
      if (uiIntent) {
        intents.splice(intents.indexOf(uiIntent), 1);
        intents.unshift(uiIntent);
      }
    }
    if (lowerQuery.includes('错误') || lowerQuery.includes('失败') || lowerQuery.includes('error')) {
      const errorIntent = intents.find(i => i.intent === 'fix_error');
      if (errorIntent) {
        intents.splice(intents.indexOf(errorIntent), 1);
        intents.unshift(errorIntent);
      }
    }
    if (lowerQuery.includes('消息') || lowerQuery.includes('message')) {
      const msgIntent = intents.find(i => i.intent === 'custom_message');
      if (msgIntent) {
        intents.splice(intents.indexOf(msgIntent), 1);
        intents.unshift(msgIntent);
      }
    }

    return intents.slice(0, 4);
  }

  private async getErrorSolution(errorCode: number, platform?: string): Promise<string> {
    const error = this.docSearch.lookupError(errorCode);

    if (!error) {
      return `## ❌ 未找到错误码 ${errorCode}\n\n该错误码可能不在已记录的范围内。建议查看环信官方文档。\n`;
    }

    return `## 🔧 错误码 ${errorCode} 解决方案

**错误名称**: ${error.name}
**所属模块**: ${error.module}
**描述**: ${error.brief}

### 可能原因

${error.causes.map((c: any, i: number) => `${i + 1}. ${c}`).join('\n')}

### 解决方案

${error.solutions.map((s: any, i: number) => `${i + 1}. ${s}`).join('\n')}

### 代码示例

\`\`\`swift
// 错误处理示例
EMClient.shared().chatManager?.send(message) { msg, error in
    if let error = error {
        switch error.code {
        case ${errorCode}:
            // ${error.brief}
            print("错误: ${error.name}")
            // 处理方式: ${error.solutions[0] || '参见解决方案'}
        default:
            print("其他错误: \\(error.errorDescription)")
        }
    }
}
\`\`\`
`;
  }

  private async getCustomMessageSolution(messageName: string, platform?: string): Promise<string> {
    const normalizedPlatform = platform === 'react-native' ? 'rn' : platform;
    const scenario = this.knowledgeRegistry.getScenario('custom_message', normalizedPlatform)
      || this.knowledgeRegistry.getScenario('common:custom_message')
      || this.knowledgeRegistry.getScenario('ios:custom_message')
      || this.knowledgeRegistry.getScenario('custom_message');

    let resultText = `## 📝 自定义 ${messageName} 消息实现方案\n\n`;

    if (scenario) {
      resultText += `### 实现步骤\n\n`;
      scenario.steps.forEach((step, i) => {
        resultText += `${i + 1}. ${step}\n`;
      });
      resultText += '\n';
    }

    const generated = this.platformOrchestrator.generateCode('custom_message_full', normalizedPlatform || 'ios', {
      platform: normalizedPlatform || 'ios',
      name: messageName,
      variables: {
        messageName,
        cellHeight: 120
      }
    });

    if (generated) {
      resultText += `### 完整代码\n\n`;
      resultText += `\`\`\`swift\n${generated.code}\n\`\`\`\n\n`;
      if (generated.usage) {
        resultText += `**集成步骤**:\n${generated.usage}\n\n`;
      }
    }

    resultText += `### 关键类说明\n\n`;
    resultText += `| 类名 | 作用 | 源文件 |\n`;
    resultText += `|------|------|--------|\n`;
    resultText += `| CustomMessageCell | 自定义消息 Cell 基类 | CustomMessageCell.swift |\n`;
    resultText += `| MessageEntity | 消息实体，包含高度计算 | MessageEntity.swift |\n`;
    resultText += `| ComponentsRegister | 注册自定义组件 | ComponentsRegister.swift |\n`;
    resultText += `| ChatCustomMessageBody | 自定义消息体 | SDK |\n\n`;

    resultText += `### 💡 提示\n\n`;
    resultText += `使用 \`generate_code scenario="custom_message" name="${messageName}"\` 可单独生成代码模板。\n`;

    return resultText;
  }

  private async getAddMenuSolution(platform?: string): Promise<string> {
    const normalizedPlatform = platform === 'react-native' ? 'rn' : platform;
    const scenario = this.knowledgeRegistry.getScenario('add_attachment_menu', normalizedPlatform)
      || this.knowledgeRegistry.getScenario('common:add_attachment_menu')
      || this.knowledgeRegistry.getScenario('ios:add_attachment_menu')
      || this.knowledgeRegistry.getScenario('add_attachment_menu');

    let resultText = `## ➕ 添加附件菜单项方案\n\n`;

    if (scenario) {
      resultText += `### 实现步骤\n\n`;
      scenario.steps.forEach((step, i) => {
        resultText += `${i + 1}. ${step}\n`;
      });
      resultText += '\n';
    }

    const generated = this.platformOrchestrator.generateCode('attachment_menu', normalizedPlatform || 'ios', {
      platform: normalizedPlatform || 'ios',
      name: 'SendOrder',
      variables: {
        menuName: '发送订单',
        menuTag: 'SendOrder',
        iconName: 'order_icon'
      }
    });

    resultText += `### 代码示例\n\n`;
    if (generated) {
      resultText += `\`\`\`swift\n${generated.code}\n\`\`\`\n\n`;
      if (generated.usage) {
        resultText += `**集成步骤**:\n${generated.usage}\n\n`;
      }
    }

    resultText += `### 💡 提示\n\n`;
    resultText += `- 使用 \`generate_code scenario="attachment_menu"\` 生成更多代码模板\n`;
    resultText += `- 菜单图标建议使用 24x24 或 32x32 的 PNG 图片\n`;

    return resultText;
  }

  private async getUiCustomizationSolution(configProperty: string | null, subIntent?: string, platform?: string): Promise<string> {
    const normalizedPlatform = platform === 'react-native' ? 'rn' : platform;
    let resultText = `## 🎨 UI 定制方案\n\n`;

    if (configProperty) {
      const usage = this.configSearch.getConfigUsage(configProperty, 'all');
      if (usage) {
        resultText += `### 配置项: ${configProperty}\n\n`;
        resultText += `**类型**: \`${usage.property.type}\`\n`;
        resultText += `**默认值**: \`${usage.property.defaultValue || '无'}\`\n`;
        resultText += `**影响组件**: ${usage.affectedComponents.slice(0, 5).join(', ')}\n\n`;
      }
    }

    switch (subIntent) {
      case 'bubble_style':
        resultText += `### 气泡样式定制\n\n`;
        resultText += `\`\`\`swift
// 设置气泡圆角
Appearance.chat.bubbleStyle = .withArrow  // 带箭头样式

// 设置气泡颜色（通过主题色调）
Appearance.primaryHue = 203/360.0  // 蓝色系

// 如需完全自定义，继承 MessageCell 重写
class MyBubbleCell: MessageCell {
    override func createContent() -> UIView {
        let bubble = super.createContent()
        bubble.backgroundColor = .systemBlue
        bubble.layer.cornerRadius = 16
        return bubble
    }
}
\`\`\`\n\n`;
        break;

      case 'avatar_style':
        resultText += `### 头像样式定制\n\n`;
        resultText += `\`\`\`swift
// 设置头像圆角
Appearance.avatarRadius = .large  // 圆形头像

// 设置占位图
Appearance.avatarPlaceHolder = UIImage(named: "default_avatar")

// 可选值: .extraSmall, .small, .medium, .large
\`\`\`\n\n`;
        break;

      case 'color_theme':
      case 'theme':
        resultText += `### 主题颜色定制\n\n`;
        resultText += `\`\`\`swift
// 设置主色调 (HSL 色相值 0-1)
Appearance.primaryHue = 203/360.0     // 蓝色
Appearance.secondaryHue = 155/360.0   // 绿色
Appearance.errorHue = 350/360.0       // 红色

// 常用色相参考:
// 红色: 0/360.0
// 橙色: 30/360.0
// 黄色: 60/360.0
// 绿色: 120/360.0
// 蓝色: 210/360.0
// 紫色: 270/360.0
\`\`\`\n\n`;
        break;

      case 'custom_text_style':
      case 'text_style_customization':
        resultText += `### 文本消息样式深度定制\n\n`;
        resultText += `由于文本消息的渲染涉及复杂的富文本计算，修改颜色和字体需要通过重载 \`MessageEntity\` 实现：\n\n`;

        const generated = this.platformOrchestrator.generateCode('text_style_customization', normalizedPlatform || 'ios', {
          platform: normalizedPlatform || 'ios',
          name: 'Custom',
          variables: {
            messageName: 'Custom'
          }
        });
        if (generated) {
          resultText += `\`\`\`swift\n${generated.code}\n\`\`\`\n\n`;
          if (generated.usage) {
            resultText += `**集成步骤**:\n${generated.usage}\n`;
          }
        }
        break;

      default:
        resultText += `### 常用配置项\n\n`;
        resultText += `| 配置项 | 作用 | 示例 |\n`;
        resultText += `|--------|------|------|\n`;
        resultText += `| primaryHue | 主色调 | 203/360.0 |\n`;
        resultText += `| avatarRadius | 头像圆角 | .large |\n`;
        resultText += `| bubbleStyle | 气泡样式 | .withArrow |\n`;
        resultText += `| inputPlaceHolder | 输入框占位符 | "请输入..." |\n\n`;

        resultText += `使用 \`list_config_options\` 查看所有可配置项。\n`;
    }

    return resultText;
  }

  async explainClass(className: string): Promise<string> {
    const classInfo = this.knowledgeGraph.getClassInfo(className);

    if (!classInfo) {
      const searchResult = this.sourceSearch.search(className, 'all', 3);
      if (searchResult.results.length > 0) {
        let resultText = `## 📖 ${className}\n\n`;
        resultText += `在以下文件中找到相关定义：\n\n`;
        for (const r of searchResult.results) {
          resultText += `- \`${r.path}\`\n`;
        }
        resultText += `\n使用 \`read_source path="${searchResult.results[0].path}"\` 查看具体实现。\n`;
        return resultText;
      }
      return `未找到类 ${className} 的定义。请检查类名是否正确。\n`;
    }

    let resultText = `## 📚 ${className}\n\n`;

    if (classInfo.description) {
      resultText += `${classInfo.description}\n\n`;
    }

    if (classInfo.superclass) {
      const inheritanceChain = this.knowledgeGraph.getInheritanceChain(className);
      resultText += `### 继承关系\n\n`;
      resultText += `\`${inheritanceChain.join(' → ')}\`\n\n`;
    }

    if (classInfo.keyMethods && classInfo.keyMethods.length > 0) {
      resultText += `### 关键方法\n\n`;
      for (const method of classInfo.keyMethods) {
        resultText += `- \`${method}\`\n`;
      }
      resultText += '\n';
    }

    if (classInfo.keyProperties && classInfo.keyProperties.length > 0) {
      resultText += `### 关键属性\n\n`;
      for (const prop of classInfo.keyProperties) {
        resultText += `- \`${prop}\`\n`;
      }
      resultText += '\n';
    }

    if (classInfo.usageScenarios && classInfo.usageScenarios.length > 0) {
      resultText += `### 使用场景\n\n`;
      for (const scenario of classInfo.usageScenarios) {
        const scenarioInfo = this.knowledgeRegistry.getScenario(`common:${scenario}`)
          || this.knowledgeRegistry.getScenario(`ios:${scenario}`)
          || this.knowledgeRegistry.getScenario(scenario);
        if (scenarioInfo) {
          resultText += `- **${scenarioInfo.scenario}**: ${scenarioInfo.description}\n`;
        } else {
          resultText += `- ${scenario}\n`;
        }
      }
      resultText += '\n';
    }

    resultText += `使用 \`read_source path="${classInfo.file}"\` 查看完整源码。\n`;

    return resultText;
  }
}
