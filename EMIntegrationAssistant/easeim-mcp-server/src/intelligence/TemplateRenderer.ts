export type TemplateVariables = Record<string, string | number | boolean>;

export type RenderResult = {
  code: string;
};

const buildDefaultVariables = (name: string): Record<string, string> => {
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
    imageName: 'chat_bg'
  };
};

export class TemplateRenderer {
  render(template: string, name: string, variables?: TemplateVariables): RenderResult {
    const defaults = buildDefaultVariables(name);
    const normalizedVariables: Record<string, string> = {
      ...defaults,
      ...(variables
        ? Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, String(value)]))
        : {})
    };

    let code = template;
    for (const [key, value] of Object.entries(normalizedVariables)) {
      code = code.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return { code };
  }
}
