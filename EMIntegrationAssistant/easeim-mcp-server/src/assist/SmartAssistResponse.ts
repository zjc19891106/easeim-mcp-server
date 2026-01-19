import { ResponseBuilder } from '../utils/ResponseBuilder.js';
import { UserIntent } from '../intelligence/IntentClassifier.js';

export type AmbiguityAnalysis = {
  isAmbiguous: boolean;
  ambiguityType?: string;
  suggestions?: string[];
};

export class SmartAssistResponse {
  buildAmbiguousQueryResponse(
    query: string,
    ambiguityAnalysis: AmbiguityAnalysis
  ) {
    const builder = ResponseBuilder.create();

    builder.addTitle('🤔 需要更多信息');
    builder.addParagraph(`您的查询 "${query}" 比较模糊，我需要更多信息来帮助您。`);

    switch (ambiguityAnalysis.ambiguityType) {
      case 'too_short':
        builder.setMissingInfoInteraction({
          question: '请提供更具体的描述',
          missingFields: ['具体功能名称', '问题描述', '错误信息'],
          examples: [
            '如何发送图片消息',
            '错误码 508 怎么解决',
            '修改消息气泡颜色',
            'MessageCell 类怎么用'
          ]
        });
        break;

      case 'too_generic':
        builder.setAmbiguousInteraction({
          question: '请选择您想了解的方向：',
          options: [
            { label: '消息相关', value: 'message', description: '发送/接收/自定义消息' },
            { label: 'UI 定制', value: 'ui', description: '修改界面样式、颜色、布局' },
            { label: '错误处理', value: 'error', description: '错误码查询、问题诊断' },
            { label: 'SDK 集成', value: 'integration', description: '安装配置、初始化' },
            { label: '群组/聊天室', value: 'group', description: '群组和聊天室功能' }
          ]
        });
        break;

      case 'missing_context':
        builder.setMissingInfoInteraction({
          question: '请说明具体要操作的对象：',
          missingFields: ['操作对象（如：消息气泡、头像、输入框）', '具体属性（如：颜色、大小、样式）'],
          examples: [
            '修改消息气泡的背景颜色',
            '设置头像为圆形',
            '配置输入框的占位符文字'
          ]
        });
        break;

      default:
        builder.setMissingInfoInteraction({
          question: '请提供更详细的描述',
          missingFields: ['具体需求'],
          examples: [
            '我想自定义一个订单消息',
            '如何添加发送位置的菜单',
            '登录失败错误码 200'
          ]
        });
    }

    builder.addSuggestedTool('list_scenarios', '查看所有支持的开发场景');
    builder.addSuggestedTool('search_api', '搜索 API 文档', { query: '消息' });
    builder.addSuggestedTool('list_config_options', '查看所有可配置项', { component: 'EaseChatUIKit' });

    return builder.build();
  }

  buildLowConfidenceResponse(
    query: string,
    intentResult: { intent: UserIntent; confidence: number; entities: any },
    possibleIntents: Array<{ intent: string; label: string; description: string }>
  ) {
    const builder = ResponseBuilder.create();

    builder.addTitle('🤔 让我确认一下您的需求');
    builder.addParagraph(`您说的是 "${query}"，我有几种理解方式：`);

    builder.setMultipleOptionsInteraction({
      question: '请选择最符合您需求的选项：',
      options: possibleIntents.map(pi => ({
        label: pi.label,
        value: pi.intent,
        description: pi.description
      }))
    });

    builder.addParagraph('\n**或者您可以这样描述：**');
    builder.addListItem('"我想自定义一个订单消息" - 自定义消息类型');
    builder.addListItem('"错误码 508 怎么解决" - 错误处理');
    builder.addListItem('"修改消息气泡颜色为蓝色" - UI 定制');
    builder.addListItem('"如何集成 EaseChatUIKit" - SDK 集成');

    return builder.build();
  }

  buildPlatformSelectionResponse(
    query: string,
    featureName: string | undefined,
    intentResult: { intent: UserIntent; confidence: number; entities: any }
  ) {
    const builder = ResponseBuilder.create();

    builder.addTitle('📱 请选择目标平台');

    if (featureName) {
      builder.addParagraph(`您想实现「**${featureName}**」功能，请先告诉我您的目标开发平台：`);
    } else {
      builder.addParagraph(`您的需求是："${query}"\n\n为了提供准确的代码示例和集成指南，请选择您的目标平台：`);
    }

    builder.setFeatureImplementationInteraction({
      featureName: featureName,
      askPlatform: true
    });

    builder.addDivider();
    builder.addTitle('各平台 SDK 说明', 2);
    builder.addParagraph('');
    builder.addListItem('**iOS** - 使用 `EaseChatUIKit` (Swift)，支持 CocoaPods 集成');
    builder.addListItem('**Android** - 使用 `ease-chat-uikit` (Kotlin)，支持 Maven 集成');
    builder.addListItem('**Web** - 使用 `easemob-chat-uikit` (React)，支持 npm 集成');
    builder.addListItem('**Flutter** - 使用 `em_chat_uikit` (Dart)，支持 pub.dev 集成');
    builder.addListItem('**Unity** - 使用 `Agora Chat SDK`，支持 Unity Package 集成');

    builder.addParagraph('\n💡 **提示**: 您也可以在问题中直接说明平台，例如：');
    builder.addListItem(`"iOS 上${featureName ? '如何实现' + featureName : query}"`);
    builder.addListItem(`"Android ${featureName ? featureName + '怎么做' : query}"`);

    return builder.build();
  }
}
