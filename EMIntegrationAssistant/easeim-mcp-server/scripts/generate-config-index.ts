#!/usr/bin/env node
/**
 * 生成配置项索引脚本 (v2 - 支持平台子目录)
 * 提取各组件的配置项、扩展点信息
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RAW_SOURCES_DIR = path.join(PROJECT_ROOT, 'raw-materials/sources');
const OUTPUT_DIR = path.join(__dirname, '../data/configs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'index.json');

interface ConfigProperty {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
  file: string;
  line: number;
}

interface ExtensionPoint {
  name: string;
  type: 'protocol' | 'class' | 'override-method';
  description?: string;
  file: string;
  line: number;
  methods?: string[];
}

interface ComponentConfig {
  name: string;
  description: string;
  configProperties: ConfigProperty[];
  extensionPoints: ExtensionPoint[];
}

function extractDescription(lines: string[], startIndex: number): string | undefined {
  const descriptions: string[] = [];
  for (let i = startIndex - 1; i >= Math.max(0, startIndex - 10); i--) {
    const line = lines[i].trim();
    if (line.startsWith('///')) {
      descriptions.unshift(line.replace(/^\/{3,}\s*/, ''));
    } else if (line.startsWith('//')) {
      const content = line.replace(/^\/{2,}\s*/, '');
      if (content && !content.startsWith('-') && !content.startsWith('=')) {
        descriptions.unshift(content);
      }
    } else if (line === '' || line.startsWith('@') || line.startsWith('import')) {
      continue;
    } else {
      break;
    }
  }
  return descriptions.length > 0 ? descriptions.join(' ').trim() : undefined;
}

function parseAppearanceFile(filePath: string, baseDir: string): ConfigProperty[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(baseDir, filePath);
  const properties: ConfigProperty[] = [];
  const propertyRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(public\s+|open\s+)?(static\s+)?(var|let)\s+(\w+)\s*:\s*([^=\n{]+?)(?:\s*=\s*(.+?))?(?:\s*\{|	*$)/;

  let inAppearanceClass = false;
  let braceLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.includes('class Appearance') || trimmed.includes('struct Appearance')) {
      inAppearanceClass = true;
      braceLevel = 0;
    }
    if (inAppearanceClass) {
      braceLevel += (line.match(/\{/g) || []).length;
      braceLevel -= (line.match(/\}/g) || []).length;
      if (trimmed.startsWith('//')) continue;
      const match = trimmed.match(propertyRegex);
      if (match) {
        const [, , , varType, name, type, defaultValue] = match;
        if (name.startsWith('_')) continue;
        const description = extractDescription(lines, i);
        properties.push({
          name,
          type: type.trim(),
          defaultValue: defaultValue?.trim(),
          description,
          file: relativePath,
          line: i + 1
        });
      }
      if (braceLevel === 0 && inAppearanceClass && trimmed === '}') {
        break;
      }
    }
  }
  return properties;
}

function parseProtocolFile(filePath: string, baseDir: string): ExtensionPoint[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(baseDir, filePath);
  const protocols: ExtensionPoint[] = [];
  const protocolRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(public\s+|open\s+)?protocol\s+(\w+)/;
  const methodRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*func\s+(\w+)/;

  let currentProtocol: ExtensionPoint | null = null;
  let braceLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    const protocolMatch = trimmed.match(protocolRegex);
    if (protocolMatch) {
      const [, , name] = protocolMatch;
      if (['Delegate', 'DataSource', 'Protocol', 'Driver', 'EventListener'].some(k => name.includes(k))) {
        const description = extractDescription(lines, i);
        currentProtocol = { name, type: 'protocol', description, file: relativePath, line: i + 1, methods: [] };
        protocols.push(currentProtocol);
        braceLevel = 0;
      }
    }
    if (currentProtocol) {
      braceLevel += (line.match(/\{/g) || []).length;
      braceLevel -= (line.match(/\}/g) || []).length;
      const methodMatch = trimmed.match(methodRegex);
      if (methodMatch && currentProtocol.methods) {
        currentProtocol.methods.push(methodMatch[1]);
      }
      if (braceLevel === 0 && trimmed === '}') {
        currentProtocol = null;
      }
    }
  }
  return protocols;
}

function findOverridableClasses(componentDir: string, baseDir: string): ExtensionPoint[] {
  const overridableClasses: ExtensionPoint[] = [];
  const keyClassPatterns = [/Cell$/, /Controller$/, /View$/, /ViewModel$/];

  function traverse(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.swift')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(baseDir, fullPath);
        const classRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(open\s+)(class)\s+(\w+)/;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const match = line.match(classRegex);
          if (match) {
            const name = match[3];
            if (keyClassPatterns.some(pattern => pattern.test(name))) {
              const description = extractDescription(lines, i);
              overridableClasses.push({
                name,
                type: 'class',
                description: description || `可继承的 ${name} 类`,
                file: relativePath,
                line: i + 1
              });
            }
          }
        }
      }
    }
  }
  traverse(componentDir);
  return overridableClasses;
}

// ... (Swift parsing functions remain unchanged)

function parseAndroidConfigFile(filePath: string, baseDir: string): ConfigProperty[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(baseDir, filePath);
  const properties: ConfigProperty[] = [];

  // 匹配 Kotlin object/companion object 或 Java static final 字段
  // Kotlin: const val PRIMARY_COLOR = 0xFF0000
  // Java: public static final int PRIMARY_COLOR = 0xFF0000;
  const kotlinRegex = /^\s*(const\s+)?val\s+(\w+)\s*(?::\s*(\w+))?\s*=\s*(.+)/;
  const javaRegex = /^\s*public\s+static\s+(?:final\s+)?(\w+)\s+(\w+)\s*=\s*(.+);/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

    let match = line.match(kotlinRegex);
    if (match) {
      const [, , name, type, defaultValue] = match;
      const description = extractDescription(lines, i);
      properties.push({
        name,
        type: type || 'Unknown',
        defaultValue: defaultValue.trim(),
        description,
        file: relativePath,
        line: i + 1
      });
      continue;
    }

    match = line.match(javaRegex);
    if (match) {
      const [, type, name, defaultValue] = match;
      const description = extractDescription(lines, i);
      properties.push({
        name,
        type,
        defaultValue: defaultValue.trim(),
        description,
        file: relativePath,
        line: i + 1
      });
    }
  }
  return properties;
}

function parseAndroidResources(filePath: string, baseDir: string): ConfigProperty[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(baseDir, filePath);
  const properties: ConfigProperty[] = [];
  
  // 简单正则匹配 XML 资源
  // <color name="ease_primary_color">#0091FF</color>
  // <string name="ease_cancel">Cancel</string>
  const resourceRegex = /<(\w+)\s+name="([^"]+)"[^>]*>(.*?)<\/\1>/g;
  
  let match;
  while ((match = resourceRegex.exec(content)) !== null) {
    const [fullMatch, type, name, value] = match;
    // 过滤一些无需索引的资源类型
    if (['color', 'string', 'dimen', 'bool', 'integer'].includes(type)) {
      // 计算行号（简单估算）
      const line = content.substring(0, match.index).split('\n').length;
      properties.push({
        name,
        type: `xml:${type}`,
        defaultValue: value,
        description: `${type} resource in ${path.basename(filePath)}`,
        file: relativePath,
        line
      });
    }
  }
  return properties;
}

function findAndroidOverridableClasses(componentDir: string, baseDir: string): ExtensionPoint[] {
    const extensionPoints: ExtensionPoint[] = [];
    
    function traverse(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                traverse(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.kt') || entry.name.endsWith('.java'))) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                const relativePath = path.relative(baseDir, fullPath);
                
                // Kotlin: open class / interface / abstract class
                const kotlinClassRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(open|abstract)\s+class\s+(\w+)/;
                const kotlinInterfaceRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:public\s+)?interface\s+(\w+)/;
                
                // Java: public abstract class / public interface
                const javaClassRegex = /^\s*public\s+abstract\s+class\s+(\w+)/;
                const javaInterfaceRegex = /^\s*public\s+interface\s+(\w+)/;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    let match = line.match(kotlinClassRegex);
                    if (match) {
                        extensionPoints.push({
                            name: match[2],
                            type: 'class',
                            description: extractDescription(lines, i) || `Open/Abstract class`,
                            file: relativePath,
                            line: i + 1
                        });
                        continue;
                    }
                     match = line.match(javaClassRegex);
                    if (match) {
                        extensionPoints.push({
                            name: match[1],
                            type: 'class',
                            description: extractDescription(lines, i) || `Abstract class`,
                            file: relativePath,
                            line: i + 1
                        });
                        continue;
                    }
                    
                    match = line.match(kotlinInterfaceRegex) || line.match(javaInterfaceRegex);
                     if (match) {
                        extensionPoints.push({
                            name: match[match.length - 1], // Last group is name
                            type: 'protocol',
                            description: extractDescription(lines, i) || `Interface`,
                            file: relativePath,
                            line: i + 1
                        });
                    }
                }
            }
        }
    }
    traverse(componentDir);
    return extensionPoints;
}

function processComponent(platform: string, component: string): ComponentConfig | null {
  const componentDir = path.join(RAW_SOURCES_DIR, platform, component);
  if (!fs.existsSync(componentDir)) return null;

  console.log(`📦 处理 ${platform}/${component}...`);
  const configProperties: ConfigProperty[] = [];
  const extensionPoints: ExtensionPoint[] = [];

  function findFiles(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findFiles(fullPath);
      } else if (entry.isFile()) {
        // iOS / Swift 处理逻辑
        if (entry.name === 'Appearance.swift') {
          configProperties.push(...parseAppearanceFile(fullPath, RAW_SOURCES_DIR));
        } else if (entry.name.endsWith('.swift')) {
          extensionPoints.push(...parseProtocolFile(fullPath, RAW_SOURCES_DIR));
        }
        
        // Android / Kotlin / Java 处理逻辑
        else if (platform === 'android') {
             // 匹配配置类：包含 Config 且为 .kt/.java
             if (entry.name.match(/Config\.(kt|java)$/)) {
                 configProperties.push(...parseAndroidConfigFile(fullPath, RAW_SOURCES_DIR));
             }
             // 匹配资源文件：XML 且在 values 目录下
             else if (entry.name.endsWith('.xml') && fullPath.includes('/res/values')) {
                 configProperties.push(...parseAndroidResources(fullPath, RAW_SOURCES_DIR));
             }
        }
      }
    }
  }

  findFiles(componentDir);
  
  if (platform === 'ios') {
      extensionPoints.push(...findOverridableClasses(componentDir, RAW_SOURCES_DIR));
  } else if (platform === 'android') {
      extensionPoints.push(...findAndroidOverridableClasses(componentDir, RAW_SOURCES_DIR));
  }

  return {
    name: component,
    description: `${platform} 平台的 ${component} 组件`,
    configProperties,
    extensionPoints
  };
}

function main() {
  console.log('🚀 开始生成配置索引 (支持平台子目录).\n');
  const componentsConfig: Record<string, ComponentConfig> = {};
  
  if (!fs.existsSync(RAW_SOURCES_DIR)) return;
  const platforms = fs.readdirSync(RAW_SOURCES_DIR).filter(d => fs.statSync(path.join(RAW_SOURCES_DIR, d)).isDirectory());

  for (const platform of platforms) {
    const platformPath = path.join(RAW_SOURCES_DIR, platform);
    const components = fs.readdirSync(platformPath).filter(d => fs.statSync(path.join(platformPath, d)).isDirectory());
    for (const component of components) {
      const config = processComponent(platform, component);
      if (config) componentsConfig[component] = config;
    }
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ version: '2.0.0', lastUpdated: new Date().toISOString(), components: componentsConfig }, null, 2));
  console.log(`\n📝 配置索引已生成: ${OUTPUT_FILE}`);
  console.log('✅ 配置索引生成完成！');
}

main();
