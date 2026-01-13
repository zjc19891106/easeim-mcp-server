#!/usr/bin/env node
/**
 * 分析配置项影响范围 (v2 - 支持平台子目录)
 * 通过源码搜索找到每个配置项被使用的位置，分析它影响哪些 UI 组件
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RAW_SOURCES_DIR = path.join(PROJECT_ROOT, 'raw-materials/sources');
const CONFIG_INDEX_PATH = path.join(__dirname, '../data/configs/index.json');
const OUTPUT_DIR = path.join(__dirname, '../data/configs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'impact-analysis.json');

interface ConfigProperty {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
  file: string;
  line: number;
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

function loadConfigIndex(): any {
  const content = fs.readFileSync(CONFIG_INDEX_PATH, 'utf-8');
  return JSON.parse(content);
}

function searchUsage(propertyName: string, searchDir: string): Usage[] {
  const usages: Usage[] = [];
  function searchInFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(RAW_SOURCES_DIR, filePath);
    const patterns = [new RegExp(`Appearance\.${propertyName}\b`, 'g'), new RegExp(`Appearance\.default\.${propertyName}\b`, 'g')];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          const contextStart = Math.max(0, i - 2);
          const contextEnd = Math.min(lines.length, i + 3);
          const context = lines.slice(contextStart, contextEnd).map((l, idx) => {
            const lineNum = contextStart + idx + 1;
            const marker = lineNum === i + 1 ? '>>> ' : '    ';
            return `${marker}${l}`;
          }).join('\n');

          usages.push({
            file: relativePath,
            line: i + 1,
            context,
            component: extractComponent(relativePath, line)
          });
        }
      }
    }
  }

  function traverse(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) traverse(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.swift')) searchInFile(fullPath);
    }
  }
  traverse(searchDir);
  return usages;
}

function extractComponent(filePath: string, codeLine: string): string {
  const patterns = [/\/([A-Z]\w+(?:Cell|View|Controller|Bar|Button|Label|Field|ViewModel))\./, /\b([A-Z]\w+(?:Cell|View|Controller|Bar|Button|Label|Field|ViewModel))\b/];
  for (const p of patterns) {
    const m = filePath.match(p) || codeLine.match(p);
    if (m) return m[1];
  }
  return 'Unknown';
}

function categorizeConfig(prop: ConfigProperty): string {
  const name = prop.name.toLowerCase();
  if (name.includes('hue') || name.includes('color')) return 'Color';
  if (prop.type.toLowerCase().includes('cgfloat') || name.includes('width') || name.includes('height')) return 'Size';
  if (name.includes('radius') || name.includes('corner')) return 'Corner';
  if (name.includes('image') || name.includes('icon')) return 'Image';
  return 'Other';
}

function main() {
  console.log('🚀 开始分析配置项影响范围 (支持多平台)...\n');
  const configIndex = loadConfigIndex();
  const byComponent: Record<string, ConfigImpact[]> = {};
  const byCategory: Record<string, ConfigImpact[]> = {};
  let totalConfigs = 0;

  for (const [compName, config] of Object.entries(configIndex.components) as [string, any][]) {
    if (config.configProperties.length === 0) continue;
    console.log(`\n📦 分析 ${compName}...`);
    const impacts: ConfigImpact[] = [];
    // 在整个 RAW_SOURCES_DIR 下搜索，因为配置项可能被跨组件使用
    for (const prop of config.configProperties) {
      const usages = searchUsage(prop.name, RAW_SOURCES_DIR);
      const affectedComponents = [...new Set(usages.map(u => u.component))].filter(c => c !== 'Unknown');
      const category = categorizeConfig(prop);
      impacts.push({ property: prop, usageCount: usages.length, usages: usages.slice(0, 10), affectedComponents, category, summary: `影响 ${affectedComponents.length} 个组件` });
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(impacts[impacts.length - 1]);
    }
    byComponent[compName] = impacts;
    totalConfigs += impacts.length;
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ version: '2.0.0', generatedAt: new Date().toISOString(), totalConfigs, byComponent, byCategory }, null, 2));
  console.log(`\n✅ 分析完成！总计 ${totalConfigs} 个配置项`);
}

main();