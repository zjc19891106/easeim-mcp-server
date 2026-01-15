/**
 * 分片配置搜索引擎
 *
 * 性能优化:
 * - 首次只加载 manifest (~1KB) 而非完整索引
 * - 按平台按需加载分片
 * - LRU 缓存自动淘汰不常用分片
 *
 * 功能:
 * - 配置项查询
 * - 扩展点查询
 * - 组件信息获取
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ConfigProperty, ExtensionPoint, ComponentConfig, UIKitComponent } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== 类型定义 ====================

interface ShardInfo {
  path: string;
  platform: string;
  componentCount: number;
  configPropertyCount: number;
  extensionPointCount: number;
  sizeBytes: number;
  components: string[];
}

interface ConfigManifest {
  version: string;
  lastUpdated: string;
  description: string;
  platforms: string[];
  shards: Record<string, ShardInfo>;
  stats: {
    totalComponents: number;
    totalConfigProperties: number;
    totalExtensionPoints: number;
  };
}

interface PlatformShard {
  version: string;
  platform: string;
  lastUpdated: string;
  components: Record<string, ComponentConfig>;
  stats: {
    componentCount: number;
    configPropertyCount: number;
    extensionPointCount: number;
  };
}

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

interface CachedShard {
  shard: PlatformShard;
  lastAccess: number;
}

// ==================== LRU 缓存 ====================

class LRUCache<K, V> {
  private cache: Map<K, { value: V; lastAccess: number }> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 4) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      let oldestKey: K | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache) {
        if (v.lastAccess < oldestTime) {
          oldestTime = v.lastAccess;
          oldestKey = k;
        }
      }

      if (oldestKey !== null) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { value, lastAccess: Date.now() });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }
}

// ==================== 分片配置搜索引擎 ====================

export class ShardedConfigSearch {
  private configsDir: string;
  private manifest: ConfigManifest | null = null;
  private shardCache: LRUCache<string, CachedShard>;
  private impactAnalysis: ImpactAnalysis | null = null;
  private impactAnalysisPath: string;

  constructor(maxCachedShards: number = 4) {
    this.configsDir = path.join(__dirname, '../../data/configs');
    this.shardCache = new LRUCache(maxCachedShards);
    this.impactAnalysisPath = path.join(this.configsDir, 'impact-analysis.json');
  }

  /**
   * 加载清单文件
   */
  private loadManifest(): ConfigManifest {
    if (this.manifest) return this.manifest;

    const manifestPath = path.join(this.configsDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}. Run 'npx tsx scripts/generate-config-shards.ts' first.`);
    }

    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return this.manifest!;
  }

  /**
   * 加载指定平台的分片
   */
  private loadPlatformShard(platform: string): CachedShard {
    const cached = this.shardCache.get(platform);
    if (cached) {
      return cached;
    }

    const manifest = this.loadManifest();
    const shardInfo = manifest.shards[platform];
    if (!shardInfo) {
      throw new Error(`Platform shard not found: ${platform}`);
    }

    const shardPath = path.join(this.configsDir, shardInfo.path);
    const shard: PlatformShard = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));

    const cachedShard: CachedShard = {
      shard,
      lastAccess: Date.now(),
    };

    this.shardCache.set(platform, cachedShard);
    return cachedShard;
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
   * 查找包含指定组件的平台
   */
  private findPlatformForComponent(component: string): string | null {
    const manifest = this.loadManifest();

    for (const [platform, shardInfo] of Object.entries(manifest.shards)) {
      if (shardInfo.components.includes(component)) {
        return platform;
      }
    }

    return null;
  }

  /**
   * 获取所有可用平台
   */
  getPlatforms(): string[] {
    const manifest = this.loadManifest();
    return manifest.platforms;
  }

  /**
   * 获取平台统计信息
   */
  getPlatformStats(platform: string): ShardInfo | null {
    const manifest = this.loadManifest();
    return manifest.shards[platform] || null;
  }

  /**
   * 列出配置项
   */
  listConfigOptions(
    component: UIKitComponent | 'all',
    platform?: string
  ): Record<string, ConfigProperty[]> {
    const result: Record<string, ConfigProperty[]> = {};
    const manifest = this.loadManifest();

    // 确定要搜索的平台
    const targetPlatforms = platform ? [platform] : manifest.platforms;

    for (const plat of targetPlatforms) {
      try {
        const cached = this.loadPlatformShard(plat);

        if (component === 'all') {
          for (const [compName, compConfig] of Object.entries(cached.shard.components)) {
            if (compConfig.configProperties.length > 0) {
              if (result[compName]) {
                result[compName].push(...compConfig.configProperties);
              } else {
                result[compName] = [...compConfig.configProperties];
              }
            }
          }
        } else {
          const compConfig = cached.shard.components[component];
          if (compConfig && compConfig.configProperties.length > 0) {
            result[component] = compConfig.configProperties;
          }
        }
      } catch {
        continue;
      }
    }

    return result;
  }

  /**
   * 获取扩展点
   */
  getExtensionPoints(
    component: UIKitComponent | 'all',
    type: 'protocol' | 'class' | 'all' = 'all',
    platform?: string
  ): Record<string, ExtensionPoint[]> {
    const result: Record<string, ExtensionPoint[]> = {};
    const manifest = this.loadManifest();
    const targetPlatforms = platform ? [platform] : manifest.platforms;

    for (const plat of targetPlatforms) {
      try {
        const cached = this.loadPlatformShard(plat);

        const components: [string, ComponentConfig][] = component === 'all'
          ? Object.entries(cached.shard.components)
          : [[component, cached.shard.components[component]]];

        for (const [compName, compConfig] of components) {
          if (!compConfig) continue;

          let extensionPoints = compConfig.extensionPoints;

          // 按类型过滤
          if (type !== 'all') {
            extensionPoints = extensionPoints.filter(e => e.type === type);
          }

          if (extensionPoints.length > 0) {
            if (result[compName]) {
              result[compName].push(...extensionPoints);
            } else {
              result[compName] = [...extensionPoints];
            }
          }
        }
      } catch {
        continue;
      }
    }

    return result;
  }

  /**
   * 获取组件信息
   */
  getComponentInfo(component: UIKitComponent, platform?: string): ComponentConfig | null {
    const manifest = this.loadManifest();

    // 如果指定了平台，直接从该平台获取
    if (platform) {
      try {
        const cached = this.loadPlatformShard(platform);
        return cached.shard.components[component] || null;
      } catch {
        return null;
      }
    }

    // 否则搜索所有平台
    for (const plat of manifest.platforms) {
      try {
        const cached = this.loadPlatformShard(plat);
        const comp = cached.shard.components[component];
        if (comp) return comp;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * 获取所有组件列表
   */
  getAllComponents(platform?: string): ComponentConfig[] {
    const manifest = this.loadManifest();
    const targetPlatforms = platform ? [platform] : manifest.platforms;
    const components: ComponentConfig[] = [];

    for (const plat of targetPlatforms) {
      try {
        const cached = this.loadPlatformShard(plat);
        components.push(...Object.values(cached.shard.components));
      } catch {
        continue;
      }
    }

    return components;
  }

  /**
   * 搜索配置项
   */
  searchConfigProperty(query: string, platform?: string): Record<string, ConfigProperty[]> {
    const result: Record<string, ConfigProperty[]> = {};
    const lowerQuery = query.toLowerCase();
    const manifest = this.loadManifest();
    const targetPlatforms = platform ? [platform] : manifest.platforms;

    for (const plat of targetPlatforms) {
      try {
        const cached = this.loadPlatformShard(plat);

        for (const [compName, compConfig] of Object.entries(cached.shard.components)) {
          const matched = compConfig.configProperties.filter(prop => {
            return (
              prop.name.toLowerCase().includes(lowerQuery) ||
              prop.type.toLowerCase().includes(lowerQuery) ||
              prop.description?.toLowerCase().includes(lowerQuery)
            );
          });

          if (matched.length > 0) {
            if (result[compName]) {
              result[compName].push(...matched);
            } else {
              result[compName] = [...matched];
            }
          }
        }
      } catch {
        continue;
      }
    }

    return result;
  }

  /**
   * 搜索扩展点
   */
  searchExtensionPoint(query: string, platform?: string): Record<string, ExtensionPoint[]> {
    const result: Record<string, ExtensionPoint[]> = {};
    const lowerQuery = query.toLowerCase();
    const manifest = this.loadManifest();
    const targetPlatforms = platform ? [platform] : manifest.platforms;

    for (const plat of targetPlatforms) {
      try {
        const cached = this.loadPlatformShard(plat);

        for (const [compName, compConfig] of Object.entries(cached.shard.components)) {
          const matched = compConfig.extensionPoints.filter(point => {
            return (
              point.name.toLowerCase().includes(lowerQuery) ||
              point.description?.toLowerCase().includes(lowerQuery) ||
              point.methods?.some(m => m.toLowerCase().includes(lowerQuery))
            );
          });

          if (matched.length > 0) {
            if (result[compName]) {
              result[compName].push(...matched);
            } else {
              result[compName] = [...matched];
            }
          }
        }
      } catch {
        continue;
      }
    }

    return result;
  }

  /**
   * 获取配置项的使用情况
   */
  getConfigUsage(propertyName: string, component: UIKitComponent | 'all' = 'all'): ConfigImpact | null {
    const analysis = this.loadImpactAnalysis();

    if (component !== 'all') {
      const componentImpacts = analysis.byComponent[component];
      if (!componentImpacts) {
        return null;
      }

      const impact = componentImpacts.find(i => i.property.name === propertyName);
      return impact || null;
    }

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

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    cachedPlatforms: string[];
    cacheSize: number;
    maxSize: number;
  } {
    return {
      cachedPlatforms: this.shardCache.keys(),
      cacheSize: this.shardCache.size,
      maxSize: 4,
    };
  }

  /**
   * 预加载指定平台
   */
  preload(platforms: string[]): void {
    for (const platform of platforms) {
      this.loadPlatformShard(platform);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.shardCache.clear();
    this.impactAnalysis = null;
  }
}
