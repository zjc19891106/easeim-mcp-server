/**
 * 代码模板生成器
 * 根据场景和参数生成完整可用的 Swift 代码
 */

import { TemplateRenderer } from './TemplateRenderer.js';

/**
 * 代码模板
 */
export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  variables: TemplateVariable[];
  template: string;
  usage?: string;
}

/**
 * 模板变量
 */
export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

/**
 * 生成选项
 */
export interface GenerateOptions {
  messageName?: string;
  eventIdentifier?: string;
  cellHeight?: number;
  includeComments?: boolean;
  includeDataModel?: boolean;
}

/**
 * 代码生成结果
 */
export interface GenerateResult {
  success: boolean;
  code?: string;
  templateId?: string;
  description?: string;
  usage?: string;
  relatedFiles?: string[];
  error?: string;
}

export class CodeGenerator {
  private templates: Map<string, CodeTemplate> = new Map();
  private renderer: TemplateRenderer;

  constructor(renderer?: TemplateRenderer) {
    this.renderer = renderer || new TemplateRenderer();
    this.loadTemplates();
  }


  registerTemplate(template: CodeTemplate) {
    this.templates.set(template.id, template);
  }

  hasTemplate(templateId: string): boolean {
    return this.templates.has(templateId);
  }

  /**
   * 加载所有代码模板
   */
  private loadTemplates() {}

  /**
   * 生成代码
   */
  generate(templateId: string, options: GenerateOptions = {}): GenerateResult {
    const template = this.templates.get(templateId);
    if (!template) {
      return { success: false, error: `模板不存在: ${templateId}` };
    }

    try {
      const name = options.messageName || 'Custom';
      const variables: Record<string, string | number | boolean> = {
        messageName: name,
        eventIdentifier: options.eventIdentifier || `${name.toUpperCase()}_MESSAGE`,
        cellHeight: options.cellHeight || 120
      };

      const { code } = this.renderer.render(template.template, name, variables);

      const usageMap: Record<string, string> = {
        'custom_message_full': `在 AppDelegate 中调用 setup${name}Message() 完成初始化`,
        'user_profile_customization': '在需要更新资料处调用 updateUserInfoManually()',
        'chat_background_config': '在应用初始化时调用 setupChatBackground()',
        'text_style_customization': '在应用初始化时调用 setupCustomTextStyle()'
      };

      const usage = usageMap[templateId] || template.usage || '请参考代码注释进行集成';

      return {
        success: true,
        code,
        templateId,
        description: template.description,
        usage,
        relatedFiles: ['ComponentsRegister.swift', 'MessageListController.swift']
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  getTemplate(templateId: string): CodeTemplate | null {
    return this.templates.get(templateId) || null;
  }

  listTemplates(): Array<{ id: string; name: string; description: string }> {
    return Array.from(this.templates.values()).map(t => ({ id: t.id, name: t.name, description: t.description }));
  }

  recommendTemplate(scenario: string): string | null {
    const map: Record<string, string> = {
      'custom_message': 'custom_message_full',
      'user_profile_update': 'user_profile_customization',
      'chat_background_customization': 'chat_background_config',
      'custom_text_style': 'text_style_customization'
    };
    return map[scenario] || null;
  }
}
