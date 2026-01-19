import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { UserIntent } from './IntentClassifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type IntentPattern = {
  intent: UserIntent;
  patterns: string[];
  weight: number;
};

export type ScenarioTarget = {
  id: string;
  text: string;
};

type IntentIndex = {
  version: string;
  lastUpdated: string;
  patterns: Array<{ intent: string; patterns: string[]; weight: number }>;
  scenarioTargets: ScenarioTarget[];
  scenarioIntentMap: Record<string, string>;
  intentDescriptions: Record<string, string>;
  entityRules: {
    common?: {
      errorCode?: { patterns: string[]; range?: { min: number; max: number } };
      component?: { patterns: string[]; mapping?: Record<string, string> };
      className?: { patterns: string[]; exclude?: string[] };
      messageName?: { patterns: string[] };
      configProperty?: { patterns: string[] };
      featureName?: { patterns: string[] };
    };
    ios?: Record<string, { patterns: string[] }>;
    android?: Record<string, { patterns: string[] }>;
    web?: Record<string, { patterns: string[] }>;
    flutter?: Record<string, { patterns: string[] }>;
    harmony?: Record<string, { patterns: string[] }>;
    rn?: Record<string, { patterns: string[] }>;
    unity?: Record<string, { patterns: string[] }>;
  };
};

export class IntentRegistry {
  private dataDir: string;
  private index: IntentIndex | null = null;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(__dirname, '../../data/intents');
  }

  getPatterns(): Array<{ intent: UserIntent; patterns: RegExp[]; weight: number }> {
    const index = this.load();
    return index.patterns.map(item => ({
      intent: this.mapIntent(item.intent),
      patterns: item.patterns.map(p => new RegExp(p, 'i')),
      weight: item.weight
    }));
  }

  getScenarioTargets(): ScenarioTarget[] {
    return this.load().scenarioTargets;
  }

  getScenarioIntentMap(): Record<string, UserIntent> {
    const map: Record<string, UserIntent> = {};
    const raw = this.load().scenarioIntentMap || {};
    for (const [key, value] of Object.entries(raw)) {
      map[key] = this.mapIntent(value);
    }
    return map;
  }

  getIntentDescriptions(): Record<UserIntent, string> {
    const raw = this.load().intentDescriptions || {};
    const result: Record<UserIntent, string> = {
      [UserIntent.IMPLEMENT_FEATURE]: raw.implement_feature || '实现功能',
      [UserIntent.CUSTOMIZE_UI]: raw.customize_ui || '定制 UI 样式',
      [UserIntent.CUSTOMIZE_MESSAGE]: raw.customize_message || '自定义消息类型',
      [UserIntent.ADD_MENU_ITEM]: raw.add_menu_item || '添加菜单项',
      [UserIntent.FIX_ERROR]: raw.fix_error || '修复错误',
      [UserIntent.UNDERSTAND_API]: raw.understand_api || '理解 API',
      [UserIntent.UNDERSTAND_CLASS]: raw.understand_class || '理解类/组件',
      [UserIntent.INTEGRATE_SDK]: raw.integrate_sdk || '集成 SDK',
      [UserIntent.CONFIGURE_APPEARANCE]: raw.configure_appearance || '配置外观',
      [UserIntent.UNKNOWN]: raw.unknown || '未知意图'
    };
    return result;
  }

  getEntityRules(platform: string = 'common') {
    const rules = this.load().entityRules || {};
    const commonRules = rules.common || {};
    const platformRules = (rules as Record<string, Record<string, { patterns: string[] }> | undefined>)[platform] || {};

    return {
      ...commonRules,
      ...platformRules
    };
  }

  private load(): IntentIndex {
    if (this.index) return this.index;

    const indexPath = path.join(this.dataDir, 'index.json');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Intent index not found: ${indexPath}`);
    }

    this.index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as IntentIndex;
    return this.index;
  }

  private mapIntent(value: string): UserIntent {
    switch (value) {
      case UserIntent.IMPLEMENT_FEATURE:
      case UserIntent.CUSTOMIZE_UI:
      case UserIntent.CUSTOMIZE_MESSAGE:
      case UserIntent.ADD_MENU_ITEM:
      case UserIntent.FIX_ERROR:
      case UserIntent.UNDERSTAND_API:
      case UserIntent.UNDERSTAND_CLASS:
      case UserIntent.INTEGRATE_SDK:
      case UserIntent.CONFIGURE_APPEARANCE:
      case UserIntent.UNKNOWN:
        return value as UserIntent;
      default:
        return UserIntent.UNKNOWN;
    }
  }
}
