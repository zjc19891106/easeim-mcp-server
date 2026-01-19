import { InteractionHint } from '../types/index.js';

export class ResponseComposer {
  static buildInteractionSection(interaction: InteractionHint | null): string {
    if (!interaction || !interaction.needsClarification) return '';

    let section = '\n---\n\n## 🤔 需要更多信息\n\n';

    if (interaction.question) {
      section += `**${interaction.question}**\n\n`;
    }

    if (interaction.options && interaction.options.length > 0) {
      section += '可选项：\n\n';
      for (const option of interaction.options) {
        section += `- **${option.label}**`;
        if (option.description) {
          section += ` - ${option.description}`;
        }
        section += '\n';
      }
      section += '\n';
    }

    if (interaction.examples && interaction.examples.length > 0) {
      section += '示例：\n\n';
      for (const example of interaction.examples) {
        section += `- \`${example}\`\n`;
      }
      section += '\n';
    }

    if (interaction.suggestedTools && interaction.suggestedTools.length > 0) {
      section += '推荐尝试：\n\n';
      for (const tool of interaction.suggestedTools) {
        section += `- **${tool.tool}**: ${tool.reason}`;
        if (tool.exampleArgs) {
          section += `\n  示例: \`${tool.tool} ${JSON.stringify(tool.exampleArgs)}\``;
        }
        section += '\n';
      }
      section += '\n';
    }

    if (interaction.missingInfo && interaction.missingInfo.length > 0) {
      section += '请提供以下信息：\n\n';
      for (const info of interaction.missingInfo) {
        section += `- ❓ ${info}\n`;
      }
      section += '\n';
    }

    return section;
  }

  static buildResponse(text: string, interaction: InteractionHint | null, metadata: Record<string, any>): { content: Array<{ type: string; text: string }> } {
    let finalText = text;

    if (interaction && interaction.needsClarification) {
      finalText += ResponseComposer.buildInteractionSection(interaction);
    }

    if (Object.keys(metadata).length > 0 || interaction) {
      const metaBlock = {
        ...metadata,
        interaction
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
}
