export type GenerateContext = {
  name?: string;
  platform?: string;
  variables?: Record<string, string | number | boolean>;
};

type TemplateValues = Record<string, string>;

const resolveTemplateValues = (name: string, variables?: Record<string, string | number | boolean>): TemplateValues => {
  const lowerName = name.charAt(0).toLowerCase() + name.slice(1);
  return {
    messageName: name,
    messageName_lower: lowerName,
    menuName: name,
    menuTag: name,
    actionName: name,
    actionTag: name,
    eventIdentifier: `${name.toUpperCase()}_MESSAGE`,
    cellHeight: '120',
    textColor: 'UIColor.systemPurple',
    fontSize: '16',
    imageName: 'chat_bg',
    ...(variables ? Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, String(v)])) : {})
  };
};

const applyTemplateValues = (template: string, values: TemplateValues): string => {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
};

export type ScenarioView = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  steps: string[];
  relatedClasses: string[];
  hints?: string[];
};

export type PlatformProfile = {
  platform: string;
  integrationStyle: 'inherit' | 'compose' | 'callback' | 'viewmodel' | 'hooks';
  overrideLimits: 'public_api_only' | 'hooks_only' | 'controller_protocol' | 'viewmodel_replace' | 'inherit';
  entryPoints: string[];
  notes?: string;
};

export type AdapterTemplate = {
  id: string;
  name: string;
  description: string;
  template: string;
  usage?: string[];
};

export interface PlatformAdapter {
  platform: string;
  buildCode(template: AdapterTemplate, context: GenerateContext): { code: string; usage?: string };
  formatScenario(name: string, description: string, steps: string[], relatedClasses: string[], profile?: PlatformProfile): ScenarioView;
}

export class DefaultPlatformAdapter implements PlatformAdapter {
  platform = 'common';

  buildCode(template: AdapterTemplate, context: GenerateContext): { code: string; usage?: string } {
    const name = context.name || 'Custom';
    const values = resolveTemplateValues(name, context.variables);
    const code = applyTemplateValues(template.template, values);
    return { code, usage: template.usage?.join('\n') };
  }

  formatScenario(name: string, description: string, steps: string[], relatedClasses: string[], profile?: PlatformProfile): ScenarioView {
    const hints = profile?.notes ? [profile.notes] : undefined;
    return { id: name, name, description, icon: '📌', steps, relatedClasses, hints };
  }
}

export class FlutterAdapter implements PlatformAdapter {
  platform = 'flutter';

  buildCode(template: AdapterTemplate, context: GenerateContext): { code: string; usage?: string } {
    const name = context.name || 'Custom';
    const values = resolveTemplateValues(name, context.variables);
    const code = applyTemplateValues(template.template, values);
    return { code, usage: template.usage?.join('\n') };
  }

  formatScenario(name: string, description: string, steps: string[], relatedClasses: string[], profile?: PlatformProfile): ScenarioView {
    const hints = profile?.notes ? [profile.notes] : ['Flutter 以回调/协议注入为主'];
    return { id: name, name, description, icon: '🦋', steps, relatedClasses, hints };
  }
}

export class WebAdapter implements PlatformAdapter {
  platform = 'web';

  buildCode(template: AdapterTemplate, context: GenerateContext): { code: string; usage?: string } {
    const name = context.name || 'Custom';
    const values = resolveTemplateValues(name, context.variables);
    const code = applyTemplateValues(template.template, values);
    return { code, usage: template.usage?.join('\n') };
  }

  formatScenario(name: string, description: string, steps: string[], relatedClasses: string[], profile?: PlatformProfile): ScenarioView {
    const hints = profile?.notes ? [profile?.notes || 'Web 侧主要通过组合与公开 API 扩展'] : ['Web 侧主要通过组合与公开 API 扩展'];
    return { id: name, name, description, icon: '🌐', steps, relatedClasses, hints };
  }
}

export class HarmonyAdapter implements PlatformAdapter {
  platform = 'harmony';

  buildCode(template: AdapterTemplate, context: GenerateContext): { code: string; usage?: string } {
    const name = context.name || 'Custom';
    const values = resolveTemplateValues(name, context.variables);
    const code = applyTemplateValues(template.template, values);
    return { code, usage: template.usage?.join('\n') };
  }

  formatScenario(name: string, description: string, steps: string[], relatedClasses: string[], profile?: PlatformProfile): ScenarioView {
    const hints = profile?.notes ? [profile.notes] : ['Harmony 侧通过 ViewModel 替换实现业务逻辑注入'];
    return { id: name, name, description, icon: '🧱', steps, relatedClasses, hints };
  }
}

export class ReactNativeAdapter implements PlatformAdapter {
  platform = 'rn';

  buildCode(template: AdapterTemplate, context: GenerateContext): { code: string; usage?: string } {
    const name = context.name || 'Custom';
    const values = resolveTemplateValues(name, context.variables);
    const code = applyTemplateValues(template.template, values);
    return { code, usage: template.usage?.join('\n') };
  }

  formatScenario(name: string, description: string, steps: string[], relatedClasses: string[], profile?: PlatformProfile): ScenarioView {
    const hints = profile?.notes ? [profile.notes] : ['RN 侧可组合 UI，但业务逻辑多依赖 hooks'];
    return { id: name, name, description, icon: '⚛️', steps, relatedClasses, hints };
  }
}
