/**
 * 歧义检测器
 * 识别用户查询中的歧义并提供引导
 */

import type {
  AmbiguityDetection,
  SearchContext,
  Platform,
  Layer,
  UIKitComponent,
  ApiSearchResult,
  SourceSearchResult
} from '../types/index.js';

export class AmbiguityDetector {

  /**
   * 检测 API 搜索结果中的歧义
   */
  detectApiAmbiguity(
    query: string,
    results: ApiSearchResult[],
    context?: SearchContext
  ): AmbiguityDetection {

    // 如果结果太少，不需要检测歧义
    if (results.length < 2) {
      return { hasAmbiguity: false };
    }

    // 1. 检查平台歧义
    if (!context?.platform) {
      const platformAmbiguity = this.detectPlatformAmbiguity(results);
      if (platformAmbiguity.hasAmbiguity) {
        return platformAmbiguity;
      }
    }

    // 2. 检查层级歧义（SDK vs UIKit）
    if (!context?.layer) {
      const layerAmbiguity = this.detectLayerAmbiguity(results, query);
      if (layerAmbiguity.hasAmbiguity) {
        return layerAmbiguity;
      }
    }

    // 3. 检查 UIKit 组件歧义
    if (!context?.component) {
      const componentAmbiguity = this.detectComponentAmbiguity(results, query);
      if (componentAmbiguity.hasAmbiguity) {
        return componentAmbiguity;
      }
    }

    return { hasAmbiguity: false };
  }

  /**
   * 检测源码搜索结果中的歧义
   */
  detectSourceAmbiguity(
    query: string,
    results: SourceSearchResult[]
  ): AmbiguityDetection {

    if (results.length < 2) {
      return { hasAmbiguity: false };
    }

    // 检查是否跨多个组件
    const components = new Set(results.map(r => r.component));

    if (components.size > 1) {
      const componentCounts = new Map<string, number>();
      results.forEach(r => {
        componentCounts.set(r.component, (componentCounts.get(r.component) || 0) + 1);
      });

      // 判断是否需要引导
      const options = Array.from(componentCounts.entries()).map(([comp, count]) => ({
        value: comp,
        description: this.getComponentDescription(comp as UIKitComponent),
        count
      }));

      // 计算最大组件的占比
      const totalResults = results.length;
      const maxCount = Math.max(...options.map(o => o.count));
      const maxPercentage = (maxCount / totalResults) * 100;

      // 优化后的歧义检测逻辑：
      // 1. 如果有多个组件都有结果，且没有明显主导组件（占比 < 70%），则提示
      // 2. 或者至少有 2 个组件的结果数 >= 2，说明都有一定相关性
      const significantComponents = options.filter(o => o.count >= 2);

      if (maxPercentage < 70 || significantComponents.length >= 2) {
        return {
          hasAmbiguity: true,
          type: 'component',
          options: options.sort((a, b) => b.count - a.count),
          question: this.buildComponentQuestion(query, options)
        };
      }
    }

    return { hasAmbiguity: false };
  }

  /**
   * 检测平台歧义
   */
  private detectPlatformAmbiguity(results: ApiSearchResult[]): AmbiguityDetection {
    // 统计不同平台的结果数量
    const platforms = new Map<Platform, number>();
    results.forEach(r => {
      if (r.platform !== 'all') {
        platforms.set(r.platform, (platforms.get(r.platform) || 0) + 1);
      }
    });

    // 如果有多个平台且分布较均匀
    if (platforms.size > 1) {
      const options = Array.from(platforms.entries()).map(([platform, count]) => ({
        value: platform,
        description: this.getPlatformDescription(platform),
        count
      }));

      return {
        hasAmbiguity: true,
        type: 'platform',
        options: options.sort((a, b) => b.count - a.count),
        question: '您想查询哪个平台的实现？\n' +
          options.map(o => `- ${o.description} (${o.count} 个相关结果)`).join('\n')
      };
    }

    return { hasAmbiguity: false };
  }

  /**
   * 检测层级歧义（SDK vs UIKit）
   */
  private detectLayerAmbiguity(results: ApiSearchResult[], query: string): AmbiguityDetection {
    // 统计不同层级的结果
    const layers = new Map<Layer, number>();
    results.forEach(r => {
      layers.set(r.layer, (layers.get(r.layer) || 0) + 1);
    });

    // 如果同时有 SDK 和 UIKit 的结果
    if (layers.has('sdk') && layers.has('uikit')) {
      // 判断查询是否明显偏向某一层
      const isUIQuery = this.isUIRelatedQuery(query);
      const sdkCount = layers.get('sdk') || 0;
      const uikitCount = layers.get('uikit') || 0;

      // 如果查询明显是 UI 相关，但 SDK 结果也不少，需要提示
      if (isUIQuery && sdkCount > 0) {
        return {
          hasAmbiguity: true,
          type: 'layer',
          options: [
            {
              value: 'uikit',
              description: 'UIKit 层（UI 组件和界面定制）',
              count: uikitCount
            },
            {
              value: 'sdk',
              description: 'SDK 层（核心 IM 功能和数据）',
              count: sdkCount
            }
          ],
          question: `"${query}" 可能涉及不同层级：\n` +
            `- UIKit 层：UI 组件和界面定制 (${uikitCount} 个结果)\n` +
            `- SDK 层：核心 IM 功能和数据 (${sdkCount} 个结果)\n\n` +
            '您想了解哪一层的实现？'
        };
      }

      // 如果不明显，且分布均匀，也提示
      if (Math.abs(sdkCount - uikitCount) < sdkCount * 0.5) {
        return {
          hasAmbiguity: true,
          type: 'layer',
          options: [
            {
              value: 'sdk',
              description: 'SDK 层（核心功能）',
              count: sdkCount
            },
            {
              value: 'uikit',
              description: 'UIKit 层（UI 组件）',
              count: uikitCount
            }
          ].sort((a, b) => b.count - a.count),
          question: '您想查询 SDK 核心功能还是 UIKit 界面组件？'
        };
      }
    }

    return { hasAmbiguity: false };
  }

  /**
   * 检测 UIKit 组件歧义
   */
  private detectComponentAmbiguity(results: ApiSearchResult[], query: string): AmbiguityDetection {
    // 只统计 UIKit 层的结果
    const uikitResults = results.filter(r => r.layer === 'uikit' && r.component);

    if (uikitResults.length < 2) {
      return { hasAmbiguity: false };
    }

    // 统计不同组件的结果
    const components = new Map<UIKitComponent, number>();
    uikitResults.forEach(r => {
      if (r.component) {
        components.set(r.component, (components.get(r.component) || 0) + 1);
      }
    });

    // 如果有多个组件且分布较均匀
    if (components.size > 1) {
      const options = Array.from(components.entries()).map(([component, count]) => ({
        value: component,
        description: this.getComponentDescription(component),
        count
      }));

      const maxCount = Math.max(...options.map(o => o.count));
      const minCount = Math.min(...options.map(o => o.count));

      if (maxCount / minCount < 3) {
        return {
          hasAmbiguity: true,
          type: 'component',
          options: options.sort((a, b) => b.count - a.count),
          question: this.buildComponentQuestion(query, options)
        };
      }
    }

    return { hasAmbiguity: false };
  }

  /**
   * 判断查询是否为 UI 相关
   */
  private isUIRelatedQuery(query: string): boolean {
    const uiKeywords = [
      '颜色', 'color', '背景', 'background', '气泡', 'bubble',
      '界面', 'ui', '样式', 'style', '主题', 'theme',
      '布局', 'layout', '显示', 'display', '按钮', 'button',
      '输入框', 'input', '头像', 'avatar', '图标', 'icon',
      '字体', 'font', '大小', 'size', '位置', 'position',
      '动画', 'animation', '自定义', 'custom', '修改', 'modify'
    ];

    const lowerQuery = query.toLowerCase();
    return uiKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * 构建组件选择问题
   */
  private buildComponentQuestion(query: string, options: Array<{value: string, description: string, count: number}>): string {
    const isUIQuery = this.isUIRelatedQuery(query);

    if (isUIQuery) {
      return `"${query}" 在多个 UIKit 组件中都有实现：\n` +
        options.map(o => `- ${o.description} (${o.count} 个相关结果)`).join('\n') +
        '\n\n您想查看哪个组件的实现？';
    }

    return `找到多个组件的相关结果：\n` +
      options.map(o => `- ${o.description} (${o.count} 个结果)`).join('\n') +
      '\n\n请指定您想查询的组件。';
  }

  /**
   * 获取平台描述
   */
  private getPlatformDescription(platform: Platform): string {
    const descriptions: Record<Platform, string> = {
      ios: 'iOS（Swift/Objective-C）',
      android: 'Android（Java/Kotlin）',
      web: 'Web（JavaScript/TypeScript）',
      flutter: 'Flutter（Dart）',
      unity: 'Unity（C#）',
      all: '所有平台'
    };
    return descriptions[platform] || platform;
  }

  /**
   * 获取组件描述
   */
  private getComponentDescription(component: UIKitComponent): string {
    const descriptions: Record<UIKitComponent, string> = {
      EaseChatUIKit: 'EaseChatUIKit（单聊/群聊界面）',
      EaseCallUIKit: 'EaseCallUIKit（音视频通话界面）',
      EaseChatroomUIKit: 'EaseChatroomUIKit（聊天室/直播间界面）',
      EaseIMKit: 'EaseIMKit（IM 综合组件）'
    };
    return descriptions[component] || component;
  }

  /**
   * 分析查询意图
   */
  analyzeQueryIntent(query: string): {
    likelyPlatform?: Platform;
    likelyLayer?: Layer;
    likelyComponent?: UIKitComponent;
  } {
    const lowerQuery = query.toLowerCase();
    const intent: any = {};

    // 检测平台关键词
    if (lowerQuery.includes('ios') || lowerQuery.includes('swift') || lowerQuery.includes('objective-c')) {
      intent.likelyPlatform = 'ios';
    } else if (lowerQuery.includes('android') || lowerQuery.includes('java') || lowerQuery.includes('kotlin')) {
      intent.likelyPlatform = 'android';
    } else if (lowerQuery.includes('web') || lowerQuery.includes('javascript') || lowerQuery.includes('typescript')) {
      intent.likelyPlatform = 'web';
    } else if (lowerQuery.includes('flutter') || lowerQuery.includes('dart')) {
      intent.likelyPlatform = 'flutter';
    } else if (lowerQuery.includes('unity') || lowerQuery.includes('c#')) {
      intent.likelyPlatform = 'unity';
    }

    // 检测层级
    if (this.isUIRelatedQuery(query)) {
      intent.likelyLayer = 'uikit';
    } else if (lowerQuery.includes('sdk') || lowerQuery.includes('api')) {
      intent.likelyLayer = 'sdk';
    }

    // 检测组件
    if (lowerQuery.includes('单聊') || lowerQuery.includes('群聊') || lowerQuery.includes('chat')) {
      intent.likelyComponent = 'EaseChatUIKit';
    } else if (lowerQuery.includes('音视频') || lowerQuery.includes('通话') || lowerQuery.includes('call')) {
      intent.likelyComponent = 'EaseCallUIKit';
    } else if (lowerQuery.includes('聊天室') || lowerQuery.includes('直播') || lowerQuery.includes('chatroom')) {
      intent.likelyComponent = 'EaseChatroomUIKit';
    }

    return intent;
  }
}
