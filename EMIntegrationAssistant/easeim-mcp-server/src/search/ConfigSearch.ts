/**
 * 配置搜索引擎
 * 提供配置项和扩展点的查询功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ConfigIndex, ComponentConfig, ConfigProperty, ExtensionPoint, UIKitComponent } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Usage {
  file: string;
  line: number;
  context: string;
  component: string;
}

interface ConfigImpact {
  property: ConfigProperty;
  usageCount: number;
  usages: Usage[];
  affectedComponents: string[];
  category: string;
  summary: string;
}

interface ImpactAnalysis {
  version: string;
  generatedAt: string;
  totalConfigs: number;
  byComponent: Record<string, ConfigImpact[]>;
  byCategory: Record<string, ConfigImpact[]>;
}

export class ConfigSearch {
  private index: ConfigIndex | null = null;
  private indexPath: string;
  private impactAnalysis: ImpactAnalysis | null = null;
  private impactAnalysisPath: string;

  constructor() {
    this.indexPath = path.join(__dirname, '../../data/configs/index.json');
    this.impactAnalysisPath = path.join(__dirname, '../../data/configs/impact-analysis.json');
  }

  /**
   * 加载索引文件
   */
  private loadIndex(): ConfigIndex {
    if (this.index) {
      return this.index;
    }

    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      this.index = JSON.parse(content);
      return this.index!;
    } catch (error) {
      throw new Error(`Failed to load config index: ${error}`);
    }
  }

  /**
   * 加载影响分析数据
   */
  private loadImpactAnalysis(): ImpactAnalysis {
    if (this.impactAnalysis) {
      return this.impactAnalysis;
    }

    try {
      const content = fs.readFileSync(this.impactAnalysisPath, 'utf-8');
      this.impactAnalysis = JSON.parse(content);
      return this.impactAnalysis!;
    } catch (error) {
      throw new Error(`Failed to load impact analysis: ${error}`);
    }
  }

  /**
   * 列出配置项
   */
  listConfigOptions(component: UIKitComponent | 'all'): Record<string, ConfigProperty[]> {
    const index = this.loadIndex();
    const result: Record<string, ConfigProperty[]> = {};

    if (component === 'all') {
      // 返回所有组件的配置
      for (const [compName, compConfig] of Object.entries(index.components)) {
        if (compConfig.configProperties.length > 0) {
          result[compName] = compConfig.configProperties;
        }
      }
    } else {
      // 返回指定组件的配置
      const compConfig = index.components[component];
      if (compConfig && compConfig.configProperties.length > 0) {
        result[component] = compConfig.configProperties;
      }
    }

    return result;
  }

  /**
   * 获取扩展点
   */
  getExtensionPoints(
    component: UIKitComponent | 'all',
    type: 'protocol' | 'class' | 'all' = 'all'
  ): Record<string, ExtensionPoint[]> {
    const index = this.loadIndex();
    const result: Record<string, ExtensionPoint[]> = {};

    const components: [string, ComponentConfig][] = component === 'all'
      ? Object.entries(index.components)
      : [[component, index.components[component]]];

    for (const [compName, compConfig] of components) {
      if (!compConfig) continue;

      let extensionPoints = compConfig.extensionPoints;

      // 按类型过滤
      if (type !== 'all') {
        extensionPoints = extensionPoints.filter((e: ExtensionPoint) => e.type === type);
      }

      if (extensionPoints.length > 0) {
        result[compName as string] = extensionPoints;
      }
    }

    return result;
  }

  /**
   * 获取组件信息
   */
  getComponentInfo(component: UIKitComponent): ComponentConfig | null {
    const index = this.loadIndex();
    return index.components[component] || null;
  }

  /**
   * 获取所有组件列表
   */
  getAllComponents(): ComponentConfig[] {
    const index = this.loadIndex();
    return Object.values(index.components);
  }

  /**
   * 搜索配置项
   */
  searchConfigProperty(query: string): Record<string, ConfigProperty[]> {
    const index = this.loadIndex();
    const result: Record<string, ConfigProperty[]> = {};
    const lowerQuery = query.toLowerCase();

    for (const [compName, compConfig] of Object.entries(index.components)) {
      const matched = compConfig.configProperties.filter(prop => {
        return (
          prop.name.toLowerCase().includes(lowerQuery) ||
          prop.type.toLowerCase().includes(lowerQuery) ||
          prop.description?.toLowerCase().includes(lowerQuery)
        );
      });

      if (matched.length > 0) {
        result[compName] = matched;
      }
    }

    return result;
  }

  /**
   * 搜索扩展点
   */
  searchExtensionPoint(query: string): Record<string, ExtensionPoint[]> {
    const index = this.loadIndex();
    const result: Record<string, ExtensionPoint[]> = {};
    const lowerQuery = query.toLowerCase();

    for (const [compName, compConfig] of Object.entries(index.components)) {
      const matched = compConfig.extensionPoints.filter(point => {
        return (
          point.name.toLowerCase().includes(lowerQuery) ||
          point.description?.toLowerCase().includes(lowerQuery) ||
          point.methods?.some(m => m.toLowerCase().includes(lowerQuery))
        );
      });

      if (matched.length > 0) {
        result[compName] = matched;
      }
    }

    return result;
  }

  /**
   * 获取配置项的使用情况
   */
  getConfigUsage(propertyName: string, component: UIKitComponent | 'all' = 'all'): ConfigImpact | null {
    const analysis = this.loadImpactAnalysis();

    // 如果指定了组件，只搜索该组件
    if (component !== 'all') {
      const componentImpacts = analysis.byComponent[component];
      if (!componentImpacts) {
        return null;
      }

      const impact = componentImpacts.find(i => i.property.name === propertyName);
      return impact || null;
    }

    // 搜索所有组件
    for (const [compName, impacts] of Object.entries(analysis.byComponent)) {
      const impact = impacts.find(i => i.property.name === propertyName);
      if (impact) {
        return impact;
      }
    }

    return null;
  }

  /**
   * 获取配置项类别
   */
  getConfigCategory(propertyName: string): string | null {
    const analysis = this.loadImpactAnalysis();

    for (const [compName, impacts] of Object.entries(analysis.byComponent)) {
      const impact = impacts.find(i => i.property.name === propertyName);
      if (impact) {
        return impact.category;
      }
    }

    return null;
  }
}
