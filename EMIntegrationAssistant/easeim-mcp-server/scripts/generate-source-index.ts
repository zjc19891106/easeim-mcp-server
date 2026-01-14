#!/usr/bin/env node
/**
 * 生成源码索引脚本 (v2 - 递归多平台支持)
 * 处理 raw-materials/sources/ 下的多端源码
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RAW_SOURCES_DIR = path.join(PROJECT_ROOT, 'raw-materials/sources');
const OUTPUT_DIR = path.join(__dirname, '../data/sources');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'index.json');

type Platform = 'ios' | 'android' | 'web' | 'flutter' | 'unity' | 'rn' | 'windows' | 'all' | 'unknown';

interface CodeSymbol {
  name: string;
  type: string;
  file: string;
  line: number;
  signature: string;
  platform: Platform;
  component: string;
}

interface SourceFile {
  path: string;
  platform: Platform;
  component: string;
  classes: string[];
  lines: number;
}

interface SourceIndex {
  version: string;
  lastUpdated: string;
  platforms: Platform[];
  files: SourceFile[];
  symbols: CodeSymbol[];
}

/**
 * 递归获取所有文件
 */
function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

/**
 * 基础解析逻辑 (目前侧重 iOS Swift，可扩展)
 */
function parseFile(filePath: string, platform: Platform, component: string): { symbols: CodeSymbol[], classes: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(RAW_SOURCES_DIR, filePath);
  const symbols: CodeSymbol[] = [];
  const classes: string[] = [];

  // Swift 简单解析
  if (filePath.endsWith('.swift')) {
    const classRegex = /(class|struct|protocol|enum)\s+([A-Z]\w+)/g;
    const methodRegex = /func\s+([a-z]\w+)\s*\(/g;
    
    lines.forEach((line, index) => {
      let match;
      if ((match = classRegex.exec(line)) !== null) {
        classes.push(match[2]);
        symbols.push({ name: match[2], type: match[1], file: relativePath, line: index + 1, signature: line.trim(), platform, component });
      }
      if ((match = methodRegex.exec(line)) !== null) {
        symbols.push({ name: match[1], type: 'method', file: relativePath, line: index + 1, signature: line.trim(), platform, component });
      }
    });
  }

  // Kotlin / Java 解析
  if (filePath.endsWith('.kt') || filePath.endsWith('.java')) {
    const classRegex = /(class|interface|object|enum)\s+([A-Z]\w+)/g;
    const methodRegex = /(fun|void|[\w<>]+)\s+([a-z]\w+)\s*\(/g; // 简化版匹配

    lines.forEach((line, index) => {
      let match;
      if ((match = classRegex.exec(line)) !== null) {
        classes.push(match[2]);
        symbols.push({ name: match[2], type: match[1], file: relativePath, line: index + 1, signature: line.trim(), platform, component });
      }
      // Java/Kotlin 方法匹配比较复杂，这里仅做简单匹配，避免噪音
      if ((match = methodRegex.exec(line)) !== null) {
        const methodName = match[2];
        const keyword = match[1];
        // 排除常见控制流关键字
        if (!['if', 'for', 'while', 'switch', 'catch'].includes(methodName) && keyword !== 'new') {
           symbols.push({ name: methodName, type: 'method', file: relativePath, line: index + 1, signature: line.trim(), platform, component });
        }
      }
    });
  }
  
  return { symbols, classes };
}

function main() {
  console.log('🚀 开始生成多端源码索引...\n');

  if (!fs.existsSync(RAW_SOURCES_DIR)) {
    console.error('❌ 源码目录不存在');
    return;
  }

  const platformsDir = fs.readdirSync(RAW_SOURCES_DIR).filter(d => fs.statSync(path.join(RAW_SOURCES_DIR, d)).isDirectory());
  
  const allFiles: SourceFile[] = [];
  const allSymbols: CodeSymbol[] = [];

  for (const platform of platformsDir) {
    const platformPath = path.join(RAW_SOURCES_DIR, platform);
    console.log(`🌐 处理平台: ${platform}`);

    const components = fs.readdirSync(platformPath).filter(d => fs.statSync(path.join(platformPath, d)).isDirectory());
    
    for (const component of components) {
      const componentPath = path.join(platformPath, component);
      console.log(`  📦 组件: ${component}`);

      const files = walk(componentPath).filter(f => /\.(swift|java|kt|ts|js)$/.test(f));
      
      for (const file of files) {
        const { symbols, classes } = parseFile(file, platform as Platform, component);
        const relativePath = path.relative(RAW_SOURCES_DIR, file);
        const content = fs.readFileSync(file, 'utf-8');

        allFiles.push({
          path: relativePath,
          platform: platform as Platform,
          component,
          classes,
          lines: content.split('\n').length
        });
        allSymbols.push(...symbols);
      }
    }
  }

  // 1. 写入索引
  const index: SourceIndex = {
    version: '2.0.0',
    lastUpdated: new Date().toISOString(),
    platforms: platformsDir as Platform[],
    files: allFiles,
    symbols: allSymbols
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));

  // 2. 同步源码文件到 data/sources (保持平台/组件结构)
  console.log('\n📄 同步源码文件...');
  for (const file of allFiles) {
    const src = path.join(RAW_SOURCES_DIR, file.path);
    const dest = path.join(OUTPUT_DIR, file.path);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }

  console.log(`\n✅ 索引已生成: ${OUTPUT_FILE}`);
  console.log(`📊 统计: ${allFiles.length} 个文件, ${allSymbols.length} 个符号`);
}

main();