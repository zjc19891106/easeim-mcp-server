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
  startLine: number;
  endLine: number;
  signature: string;
  owner?: string;
  params?: Array<{ name: string; type?: string; label?: string }>;
  description?: string;
  doc?: string;
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

function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

function extractDocComment(lines: string[], startIndex: number): { doc?: string; description?: string } {
  let i = startIndex - 1;
  const docLines: string[] = [];

  while (i >= 0) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      break;
    }

    if (line.startsWith('///') || line.startsWith('//')) {
      docLines.unshift(line.replace(/^\/\/\/?/, '').trim());
      i -= 1;
      continue;
    }

    if (line.endsWith('*/')) {
      const block: string[] = [];
      block.unshift(line.replace(/\*\/\s*$/, '').trim());
      i -= 1;
      while (i >= 0) {
        const blockLine = lines[i].trim();
        const isStart = blockLine.startsWith('/**') || blockLine.startsWith('/*');
        block.unshift(blockLine.replace(/^\/\*\*?/, '').replace(/^\*/, '').trim());
        i -= 1;
        if (isStart) break;
      }
      const cleaned = block.filter(Boolean);
      docLines.unshift(...cleaned);
      break;
    }

    break;
  }

  if (docLines.length === 0) return {};

  const doc = docLines.join('\n');
  const description = docLines[0] || undefined;
  return { doc, description };
}

function extractParamSection(signature: string): string {
  let depth = 0;
  let started = false;
  let result = '';
  for (const char of signature) {
    if (char === '(') {
      if (!started) {
        started = true;
        depth = 1;
        continue;
      }
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (started && depth === 0) break;
    }
    if (started && depth >= 1) {
      result += char;
    }
  }
  return result.trim();
}

function splitTopLevelParams(paramSection: string): string[] {
  const params: string[] = [];
  let current = '';
  let angle = 0;
  let paren = 0;
  let bracket = 0;

  for (const char of paramSection) {
    if (char === '<') angle += 1;
    if (char === '>') angle = Math.max(0, angle - 1);
    if (char === '(') paren += 1;
    if (char === ')') paren = Math.max(0, paren - 1);
    if (char === '[') bracket += 1;
    if (char === ']') bracket = Math.max(0, bracket - 1);

    if (char === ',' && angle === 0 && paren === 0 && bracket === 0) {
      if (current.trim()) params.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) params.push(current.trim());
  return params;
}

function parseSwiftParams(signature: string): Array<{ name: string; type?: string; label?: string }> {
  const section = extractParamSection(signature);
  if (!section) return [];
  const params = splitTopLevelParams(section);
  return params.map(param => {
    const cleaned = param.split('=').shift()?.trim() || param.trim();
    const [namePart, typePart] = cleaned.split(':').map(part => part.trim());
    if (!typePart) {
      return { name: namePart };
    }
    const nameTokens = namePart.split(/\s+/).filter(Boolean);
    if (nameTokens.length >= 2) {
      return { label: nameTokens[0], name: nameTokens[1], type: typePart };
    }
    return { name: nameTokens[0], label: nameTokens[0], type: typePart };
  });
}

function parseKotlinParams(signature: string): Array<{ name: string; type?: string }> {
  const section = extractParamSection(signature);
  if (!section) return [];
  const params = splitTopLevelParams(section);
  return params.map(param => {
    const cleaned = param.split('=').shift()?.trim() || param.trim();
    const [namePart, typePart] = cleaned.split(':').map(part => part.trim());
    if (!typePart) return { name: namePart };
    return { name: namePart, type: typePart };
  });
}

function parseJavaParams(signature: string): Array<{ name: string; type?: string }> {
  const section = extractParamSection(signature);
  if (!section) return [];
  const params = splitTopLevelParams(section);
  return params.map(param => {
    const cleaned = param.replace(/@\w+(\([^)]*\))?\s*/g, '').replace(/\bfinal\s+/g, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return { name: cleaned };
    const name = parts[parts.length - 1];
    const type = parts.slice(0, -1).join(' ');
    return { name, type };
  });
}

function collectDeclaration(lines: string[], startIndex: number): string {
  const signatureLines: string[] = [];
  let parenBalance = 0;
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i].trim();
    signatureLines.push(line);
    parenBalance += countChar(line, '(');
    parenBalance -= countChar(line, ')');
    if (parenBalance <= 0 && line.endsWith(')')) break;
    if (parenBalance <= 0 && line.includes('{')) break;
    if (parenBalance <= 0 && line.endsWith(';')) break;
    if (parenBalance <= 0 && line.endsWith(') {')) break;
  }
  return signatureLines.join(' ').replace(/\s+/g, ' ').trim();
}

function findBlockEnd(lines: string[], startIndex: number): number {
  let depth = 0;
  let seenBrace = false;
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    const open = countChar(line, '{');
    const close = countChar(line, '}');
    if (open > 0) {
      seenBrace = true;
      depth += open;
    }
    if (close > 0) {
      depth -= close;
    }
    if (seenBrace && depth <= 0) {
      return i + 1;
    }
  }
  return startIndex + 1;
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
  const ownerStack: Array<{ name: string; endLine: number }> = [];

  // Swift 简单解析
  if (filePath.endsWith('.swift')) {
    const classRegex = /(class|struct|protocol|enum)\s+([A-Z]\w+)/g;
    const extensionRegex = /extension\s+([A-Z]\w+)/g;
    const methodRegex = /\bfunc\s+([a-zA-Z_]\w*)\s*\(/g;
    const initRegex = /\b(init)\s*\(/g;
    const propertyRegex = /\b(var|let)\s+([a-zA-Z_]\w*)\s*:/g;
    
    lines.forEach((line, index) => {
      while (ownerStack.length > 0 && ownerStack[ownerStack.length - 1].endLine < index + 1) {
        ownerStack.pop();
      }
      const currentOwner = ownerStack[ownerStack.length - 1]?.name;

      let match;
      classRegex.lastIndex = 0;
      extensionRegex.lastIndex = 0;
      methodRegex.lastIndex = 0;
      initRegex.lastIndex = 0;
      propertyRegex.lastIndex = 0;

      if ((match = classRegex.exec(line)) !== null) {
        classes.push(match[2]);
        const signature = line.trim();
        const { doc, description } = extractDocComment(lines, index);
        const endLine = findBlockEnd(lines, index);
        symbols.push({
          name: match[2],
          type: match[1],
          file: relativePath,
          line: index + 1,
          startLine: index + 1,
          endLine,
          signature,
          description,
          doc,
          platform,
          component
        });
        ownerStack.push({ name: match[2], endLine });
      } else if ((match = extensionRegex.exec(line)) !== null) {
        const endLine = findBlockEnd(lines, index);
        ownerStack.push({ name: match[1], endLine });
      }
      if ((match = methodRegex.exec(line)) !== null) {
        const signature = collectDeclaration(lines, index);
        const params = parseSwiftParams(signature);
        const { doc, description } = extractDocComment(lines, index);
        const endLine = signature.includes('{') ? findBlockEnd(lines, index) : index + 1;
        symbols.push({
          name: match[1],
          type: 'method',
          file: relativePath,
          line: index + 1,
          startLine: index + 1,
          endLine,
          signature,
          owner: currentOwner,
          params,
          description,
          doc,
          platform,
          component
        });
      } else if ((match = initRegex.exec(line)) !== null) {
        const signature = collectDeclaration(lines, index);
        const params = parseSwiftParams(signature);
        const { doc, description } = extractDocComment(lines, index);
        const endLine = signature.includes('{') ? findBlockEnd(lines, index) : index + 1;
        symbols.push({
          name: 'init',
          type: 'method',
          file: relativePath,
          line: index + 1,
          startLine: index + 1,
          endLine,
          signature,
          owner: currentOwner,
          params,
          description,
          doc,
          platform,
          component
        });
      } else if ((match = propertyRegex.exec(line)) !== null) {
        const signature = line.trim();
        const { doc, description } = extractDocComment(lines, index);
        symbols.push({
          name: match[2],
          type: 'property',
          file: relativePath,
          line: index + 1,
          startLine: index + 1,
          endLine: index + 1,
          signature,
          owner: currentOwner,
          description,
          doc,
          platform,
          component
        });
      }
    });
  }

  // Kotlin / Java 解析
  if (filePath.endsWith('.kt') || filePath.endsWith('.java')) {
    const classRegex = /(class|interface|object|enum)\s+([A-Z]\w+)/g;
    const methodRegex = /(fun|void|[\w<>]+)\s+([a-z]\w+)\s*\(/g; // 简化版匹配

    lines.forEach((line, index) => {
      while (ownerStack.length > 0 && ownerStack[ownerStack.length - 1].endLine < index + 1) {
        ownerStack.pop();
      }
      const currentOwner = ownerStack[ownerStack.length - 1]?.name;

      let match;
      classRegex.lastIndex = 0;
      methodRegex.lastIndex = 0;
      if ((match = classRegex.exec(line)) !== null) {
        classes.push(match[2]);
        const signature = line.trim();
        const { doc, description } = extractDocComment(lines, index);
        const endLine = findBlockEnd(lines, index);
        symbols.push({
          name: match[2],
          type: match[1],
          file: relativePath,
          line: index + 1,
          startLine: index + 1,
          endLine,
          signature,
          description,
          doc,
          platform,
          component
        });
        ownerStack.push({ name: match[2], endLine });
      }
      // Java/Kotlin 方法匹配比较复杂，这里仅做简单匹配，避免噪音
      if ((match = methodRegex.exec(line)) !== null) {
        const methodName = match[2];
        const keyword = match[1];
        // 排除常见控制流关键字
        if (!['if', 'for', 'while', 'switch', 'catch'].includes(methodName) && keyword !== 'new') {
           const signature = collectDeclaration(lines, index);
           const params = filePath.endsWith('.kt') ? parseKotlinParams(signature) : parseJavaParams(signature);
           const { doc, description } = extractDocComment(lines, index);
           const endLine = signature.includes('{') ? findBlockEnd(lines, index) : index + 1;
           symbols.push({
             name: methodName,
             type: 'method',
             file: relativePath,
             line: index + 1,
             startLine: index + 1,
             endLine,
             signature,
             owner: currentOwner,
             params,
             description,
             doc,
             platform,
             component
           });
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
    version: '2.1.0',
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
