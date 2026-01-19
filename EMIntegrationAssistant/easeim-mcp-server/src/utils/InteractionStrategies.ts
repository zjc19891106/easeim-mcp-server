import { InteractionOption } from '../types/index.js';

export type NoResultsOptions = {
  query: string;
  suggestions?: string[];
  alternativeTools?: Array<{ tool: string; reason: string; exampleArgs?: Record<string, any> }>;
};

export type TooBroadOptions = {
  resultCount: number;
  filterOptions: InteractionOption[];
  question?: string;
};

export type AmbiguousOptions = {
  question: string;
  options: InteractionOption[];
  missingInfo?: string[];
};

export type MissingInfoOptions = {
  missingFields: string[];
  question: string;
  examples?: string[];
};

export type MultipleOptions = {
  question: string;
  options: InteractionOption[];
  allowMultiple?: boolean;
};

export type PlatformSelectionOptions = {
  question?: string;
  includeAll?: boolean;
};

export type FeatureImplementationOptions = {
  featureName?: string;
  askPlatform?: boolean;
  askDetails?: boolean;
  detailOptions?: InteractionOption[];
};

export const getPlatformOptions = (includeAll?: boolean): InteractionOption[] => {
  const platformOptions: InteractionOption[] = [
    { label: 'iOS', value: 'ios', description: 'iPhone/iPad 应用开发 (Swift/ObjC)' },
    { label: 'Android', value: 'android', description: 'Android 应用开发 (Kotlin/Java)' },
    { label: 'Web', value: 'web', description: '网页端开发 (JavaScript/TypeScript)' },
    { label: 'Flutter', value: 'flutter', description: '跨平台开发 (Dart, 无 CallKit 文档/源码)' },
    { label: 'React Native', value: 'react-native', description: '跨平台开发 (JS, 无 CallKit 文档/源码)' },
    { label: 'Unity', value: 'unity', description: '游戏开发 (C#, 仅支持 IMSDK)' },
    { label: 'Windows', value: 'windows', description: 'Windows 桌面开发 (C++/C#, 仅支持 IMSDK)' }
  ];

  if (includeAll) {
    platformOptions.push({ label: '全部平台', value: 'all', description: '查看所有平台的实现' });
  }

  return platformOptions;
};

export const buildNoResultsInteraction = (options: NoResultsOptions) => ({
  needsClarification: true,
  clarificationType: 'no_results' as const,
  question: `未找到与 "${options.query}" 相关的结果，您可以尝试：`,
  examples: options.suggestions || [
    '使用更通用的关键词',
    '检查拼写是否正确',
    '尝试中文或英文关键词'
  ],
  suggestedTools: options.alternativeTools
});

export const buildTooBroadInteraction = (options: TooBroadOptions) => ({
  needsClarification: true,
  clarificationType: 'too_broad' as const,
  question: options.question || `搜索结果过多（${options.resultCount} 个），请选择一个范围来缩小结果：`,
  options: options.filterOptions
});

export const buildAmbiguousInteraction = (options: AmbiguousOptions) => ({
  needsClarification: true,
  clarificationType: 'ambiguous_query' as const,
  question: options.question,
  options: options.options,
  missingInfo: options.missingInfo
});

export const buildMissingInfoInteraction = (options: MissingInfoOptions) => ({
  needsClarification: true,
  clarificationType: 'missing_info' as const,
  question: options.question,
  missingInfo: options.missingFields,
  examples: options.examples
});

export const buildMultipleOptionsInteraction = (options: MultipleOptions) => ({
  needsClarification: true,
  clarificationType: 'multiple_options' as const,
  question: options.question,
  options: options.options
});

export const buildPlatformSelectionInteraction = (options?: PlatformSelectionOptions) => ({
  needsClarification: true,
  clarificationType: 'missing_info' as const,
  question: options?.question || '请选择您的目标开发平台：',
  options: getPlatformOptions(options?.includeAll),
  missingInfo: ['目标平台']
});

export const buildFeatureImplementationInteraction = (options: FeatureImplementationOptions) => {
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

  const allOptions = options.detailOptions
    ? [...platformOptions, ...options.detailOptions]
    : platformOptions;

  return {
    needsClarification: true,
    clarificationType: 'missing_info' as const,
    question: options.featureName
      ? `您想在哪个平台实现「${options.featureName}」功能？`
      : questions.join(' '),
    options: allOptions,
    missingInfo: missingFields
  };
};
