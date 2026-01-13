/**
 * 源码搜索引擎
 * 提供 UIKit 源码的搜索功能
 *
 * v2.1 优化：集成 QueryExpander 提升召回率
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { SourceIndex, SourceSearchResult, CodeSymbol, AmbiguityDetection } from '../types/index.js';
import { AmbiguityDetector } from './AmbiguityDetector.js';
import { QueryExpander } from '../intelligence/QueryExpander.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SourceSearch {
  private index: SourceIndex | null = null;
  private indexPath: string;
  private ambiguityDetector: AmbiguityDetector;
  private queryExpander: QueryExpander;

  constructor() {
    this.indexPath = path.join(__dirname, '../../data/sources/index.json');
    this.ambiguityDetector = new AmbiguityDetector();
    this.queryExpander = new QueryExpander();
  }

  /**
   * 加载索引文件
   */
  private loadIndex(): SourceIndex {
    if (this.index) {
      return this.index;
    }

    try {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      this.index = JSON.parse(content);
      return this.index!;
    } catch (error) {
      throw new Error(`Failed to load source index: ${error}`);
    }
  }

  /**
   * 搜索源码 - 支持查询扩展
   */
  search(
    query: string,
    component: string = 'all',
    limit: number = 10
  ): {
    results: SourceSearchResult[];
    ambiguity: AmbiguityDetection;
    expandedTerms?: string[];
  } {
    const index = this.loadIndex();
    const results: Array<SourceSearchResult & { _score: number }> = [];

    // === 查询扩展 ===
    const expandedQuery = this.queryExpander.expand(query);
    const searchTerms = expandedQuery.expanded.map(t => t.toLowerCase());
    const originalTerm = query.toLowerCase();

    // 过滤文件
    const files = component === 'all'
      ? index.files
      : index.files.filter(f => f.component === component);

    for (const file of files) {
      let score = 0;
      const matchedSymbols: CodeSymbol[] = [];
      const filePath = file.path.toLowerCase();

      // 匹配文件路径 - 原始词高权重
      if (filePath.includes(originalTerm)) {
        score += 30;
      }
      // 扩展词匹配
      for (const term of searchTerms) {
        if (term !== originalTerm && filePath.includes(term)) {
          score += 15;
        }
      }

      // 匹配类名
      for (const className of file.classes) {
        const lowerClassName = className.toLowerCase();

        // 原始词精确匹配 - 最高权重
        if (lowerClassName.includes(originalTerm)) {
          score += 50;
          const classSymbols = index.symbols.filter(
            s => s.file === file.path && s.name.startsWith(className)
          );
          matchedSymbols.push(...classSymbols.slice(0, 5));
        }

        // 扩展词匹配
        for (const term of searchTerms) {
          if (term !== originalTerm && lowerClassName.includes(term)) {
            score += 25;
            const classSymbols = index.symbols.filter(
              s => s.file === file.path && s.name.startsWith(className)
            );
            matchedSymbols.push(...classSymbols.slice(0, 3));
          }
        }
      }

      // 搜索符号
      const fileSymbols = index.symbols.filter(s => s.file === file.path);
      for (const symbol of fileSymbols) {
        const lowerSymbolName = symbol.name.toLowerCase();
        const lowerSymbolDesc = (symbol.description || '').toLowerCase();

        // 符号名匹配
        if (lowerSymbolName.includes(originalTerm)) {
          score += 25;
          if (!matchedSymbols.find(s => s.name === symbol.name)) {
            matchedSymbols.push(symbol);
          }
        } else {
          for (const term of searchTerms) {
            if (term !== originalTerm && lowerSymbolName.includes(term)) {
              score += 12;
              if (!matchedSymbols.find(s => s.name === symbol.name)) {
                matchedSymbols.push(symbol);
              }
              break;
            }
          }
        }

        // 符号描述匹配
        if (lowerSymbolDesc.includes(originalTerm)) {
          score += 10;
          if (!matchedSymbols.find(s => s.name === symbol.name)) {
            matchedSymbols.push(symbol);
          }
        } else {
          for (const term of searchTerms) {
            if (term !== originalTerm && lowerSymbolDesc.includes(term)) {
              score += 5;
              if (!matchedSymbols.find(s => s.name === symbol.name)) {
                matchedSymbols.push(symbol);
              }
              break;
            }
          }
        }
      }

      if (score > 0) {
        results.push({
          path: file.path,
          component: file.component,
          description: `来自 ${file.component} 的源文件`,
          classes: file.classes,
          matchedSymbols: matchedSymbols.slice(0, 5),
          score,
          tags: [file.platform, file.component],
          _score: score
        });
      }
    }

    // 按得分排序并限制数量
    const sortedResults = results
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...rest }) => rest);

    // 检测歧义
    const ambiguity = this.ambiguityDetector.detectSourceAmbiguity(query, sortedResults);

    return {
      results: sortedResults,
      ambiguity,
      expandedTerms: expandedQuery.synonymsUsed.length > 0 ? searchTerms : undefined
    };
  }

  /**
   * 查找特定类的定义
   */
  findClass(className: string): CodeSymbol | null {
    const index = this.loadIndex();
    return index.symbols.find(
      s => (s.type === 'class' || s.type === 'struct' || s.type === 'protocol') &&
           s.name === className
    ) || null;
  }

  /**
   * 查找类的所有成员
   */
  findClassMembers(className: string): CodeSymbol[] {
    const index = this.loadIndex();
    return index.symbols.filter(
      s => s.name.startsWith(`${className}.`)
    );
  }

  /**
   * 读取源码文件内容
   */
  readSource(filePath: string): string | null {
    try {
      const fullPath = path.join(__dirname, '../../data/sources', filePath);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取文件的指定行范围
   */
  getFileLines(filePath: string, startLine: number, endLine: number): string | null {
    const content = this.readSource(filePath);
    if (!content) return null;

    const lines = content.split('\n');
    return lines.slice(startLine - 1, endLine).join('\n');
  }

  /**
   * 获取符号的代码上下文
   */
  getSymbolContext(symbol: CodeSymbol, contextLines: number = 5): string | null {
    const content = this.readSource(symbol.file);
    if (!content) return null;

    const lines = content.split('\n');
    const start = Math.max(0, symbol.line - contextLines - 1);
    const end = Math.min(lines.length, symbol.line + contextLines);

    return lines.slice(start, end).map((line, idx) => {
      const lineNum = start + idx + 1;
      const marker = lineNum === symbol.line ? '>>> ' : '    ';
      return `${marker}${lineNum}: ${line}`;
    }).join('\n');
  }

  /**
   * 获取所有组件信息
   */
  getAllComponents() {
    const index = this.loadIndex();
    return index.components;
  }

  /**
   * 获取组件的统计信息
   */
  getComponentStats(componentName: string) {
    const index = this.loadIndex();
    const files = index.files.filter(f => f.component === componentName);
    const symbols = index.symbols.filter(s =>
      files.some(f => f.path === s.file)
    );

    const symbolsByType = symbols.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      component: componentName,
      fileCount: files.length,
      symbolCount: symbols.length,
      symbolsByType,
      classes: files.flatMap(f => f.classes)
    };
  }
}
