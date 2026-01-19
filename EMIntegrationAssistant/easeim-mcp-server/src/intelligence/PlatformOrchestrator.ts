import { KnowledgeRegistry } from './KnowledgeRegistry.js';
import { TemplateRegistry } from './TemplateRegistry.js';
import { CodeGenerator } from './CodeGenerator.js';
import {
  AdapterTemplate,
  DefaultPlatformAdapter,
  FlutterAdapter,
  HarmonyAdapter,
  PlatformAdapter,
  PlatformProfile,
  ReactNativeAdapter,
  ScenarioView,
  WebAdapter
} from './PlatformAdapters.js';

const DEFAULT_PROFILES: Record<string, PlatformProfile> = {
  ios: {
    platform: 'ios',
    integrationStyle: 'inherit',
    overrideLimits: 'inherit',
    entryPoints: ['Subclass', 'Override'],
    notes: 'iOS 以继承与重写为主'
  },
  android: {
    platform: 'android',
    integrationStyle: 'inherit',
    overrideLimits: 'inherit',
    entryPoints: ['Subclass', 'Override'],
    notes: 'Android 以继承与重写为主'
  },
  web: {
    platform: 'web',
    integrationStyle: 'compose',
    overrideLimits: 'public_api_only',
    entryPoints: ['Component', 'Props', 'Public API'],
    notes: 'Web 侧主要通过组合与公开 API 扩展'
  },
  flutter: {
    platform: 'flutter',
    integrationStyle: 'callback',
    overrideLimits: 'controller_protocol',
    entryPoints: ['Widget', 'Controller', 'Callback'],
    notes: 'Flutter 通过回调与 Controller 协议注入'
  },
  harmony: {
    platform: 'harmony',
    integrationStyle: 'viewmodel',
    overrideLimits: 'viewmodel_replace',
    entryPoints: ['ViewModel', 'Init Params'],
    notes: 'Harmony 通过 ViewModel 替换实现业务逻辑'
  },
  rn: {
    platform: 'rn',
    integrationStyle: 'hooks',
    overrideLimits: 'hooks_only',
    entryPoints: ['Component', 'Hooks'],
    notes: 'RN 侧逻辑主要通过 hooks 组织'
  },
  common: {
    platform: 'common',
    integrationStyle: 'compose',
    overrideLimits: 'public_api_only',
    entryPoints: ['Composition'],
    notes: '通用组合式扩展'
  }
};

export class PlatformOrchestrator {
  private knowledgeRegistry: KnowledgeRegistry;
  private templateRegistry: TemplateRegistry;
  private codeGenerator: CodeGenerator;
  private adapters: Map<string, PlatformAdapter>;
  private profiles: Record<string, PlatformProfile>;

  constructor(knowledgeRegistry: KnowledgeRegistry, templateRegistry: TemplateRegistry, codeGenerator: CodeGenerator) {
    this.knowledgeRegistry = knowledgeRegistry;
    this.templateRegistry = templateRegistry;
    this.codeGenerator = codeGenerator;
    this.adapters = new Map();
    this.profiles = { ...DEFAULT_PROFILES };
    this.registerDefaultAdapters();
  }

  registerAdapter(adapter: PlatformAdapter) {
    this.adapters.set(adapter.platform, adapter);
  }

  registerProfile(profile: PlatformProfile) {
    this.profiles[profile.platform] = profile;
  }

  getProfile(platform?: string): PlatformProfile {
    return this.profiles[platform || 'common'] || this.profiles.common;
  }

  buildScenarioViews(platform: string, keyword?: string): ScenarioView[] {
    const profile = this.getProfile(platform);
    const scenarios = this.knowledgeRegistry.listScenarios(keyword, platform);
    const adapter = this.getAdapter(platform);
    return scenarios.map(s => adapter.formatScenario(s.name, s.description, s.steps, s.relatedClasses, profile));
  }

  generateCode(templateName: string, platform: string, context?: { name?: string; platform?: string; variables?: Record<string, string | number | boolean> }): { code: string; usage?: string; templateId?: string } | null {
    const adapter = this.getAdapter(platform);
    const template = this.resolveTemplate(templateName, platform);
    if (!template) return null;

    const generated = adapter.buildCode(template, context ?? { platform, name: undefined });
    return { code: generated.code, usage: generated.usage, templateId: template.id };
  }

  private resolveTemplate(templateName: string, platform: string): AdapterTemplate | null {
    const registryTemplate = this.templateRegistry.findByName(templateName, platform);
    if (!registryTemplate) return null;

    if (!this.codeGenerator.hasTemplate(registryTemplate.id)) {
      this.codeGenerator.registerTemplate({
        id: registryTemplate.id,
        name: registryTemplate.name,
        description: registryTemplate.description,
        variables: registryTemplate.variables.map(v => ({
          name: v.name,
          description: v.description || v.name,
          required: v.required,
          defaultValue: v.defaultValue ?? v.default
        })),
        template: registryTemplate.template,
        usage: registryTemplate.usage ? registryTemplate.usage.join('\n') : undefined
      });
    }

    return {
      id: registryTemplate.id,
      name: registryTemplate.name,
      description: registryTemplate.description,
      template: registryTemplate.template,
      usage: registryTemplate.usage
    };
  }

  private registerDefaultAdapters() {
    this.registerAdapter(new DefaultPlatformAdapter());
    this.registerAdapter(new FlutterAdapter());
    this.registerAdapter(new WebAdapter());
    this.registerAdapter(new HarmonyAdapter());
    this.registerAdapter(new ReactNativeAdapter());
  }

  private getAdapter(platform: string): PlatformAdapter {
    return this.adapters.get(platform) || this.adapters.get('common')!;
  }
}
