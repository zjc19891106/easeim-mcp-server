#!/usr/bin/env tsx
/**
 * 搜索功能调试脚本
 */

import { DocSearch } from './src/search/DocSearch.js';
import { SourceSearch } from './src/search/SourceSearch.js';
import * as fs from 'fs';

const docSearch = new DocSearch();
const sourceSearch = new SourceSearch();

console.log('🔍 调试搜索功能...\n');

// 1. 检查文档索引中的 API
console.log('📚 检查文档索引:');
const docsIndex = JSON.parse(fs.readFileSync('data/docs/index.json', 'utf-8'));
console.log(`  - 总 API 数: ${Object.keys(docsIndex.apiIndex).length}`);
console.log(`  - 包含 "send" 的 API:`, Object.keys(docsIndex.apiIndex).filter(k => k.toLowerCase().includes('send')));
console.log('');

// 2. 检查源码索引中的符号
console.log('📦 检查源码索引:');
const sourcesIndex = JSON.parse(fs.readFileSync('data/sources/index.json', 'utf-8'));
console.log(`  - 总符号数: ${sourcesIndex.symbols.length}`);
const sendSymbols = sourcesIndex.symbols.filter((s: any) =>
  s.name.toLowerCase().includes('sendmessage')
);
console.log(`  - 包含 "sendMessage" 的符号数: ${sendSymbols.length}`);
if (sendSymbols.length > 0) {
  console.log('  前 5 个:');
  sendSymbols.slice(0, 5).forEach((s: any) => {
    console.log(`    - ${s.name} (${s.type}) in ${s.file}`);
  });
}
console.log('');

// 3. 测试 API 搜索
console.log('🔎 测试 API 搜索 "send":');
const apiResult1 = docSearch.searchApi('send');
console.log(`  结果数: ${apiResult1.results.length}`);
if (apiResult1.results.length > 0) {
  apiResult1.results.slice(0, 3).forEach(r => {
    console.log(`  - ${r.name} (模块: ${r.module}, 得分: ${r.score})`);
  });
}
console.log('');

// 4. 测试源码搜索 "sendMessage"
console.log('🔎 测试源码搜索 "sendMessage":');
const sourceResult1 = sourceSearch.search('sendMessage');
console.log(`  结果数: ${sourceResult1.results.length}`);
if (sourceResult1.results.length > 0) {
  sourceResult1.results.slice(0, 5).forEach(r => {
    console.log(`  - ${r.path}`);
    console.log(`    组件: ${r.component}, 得分: ${r.score}`);
    if (r.matchedSymbols && r.matchedSymbols.length > 0) {
      console.log(`    匹配符号: ${r.matchedSymbols.map(s => s.name).join(', ')}`);
    }
  });
}
console.log('');

// 5. 测试搜索 "send"（更通用）
console.log('🔎 测试源码搜索 "send":');
const sourceResult2 = sourceSearch.search('send');
console.log(`  结果数: ${sourceResult2.results.length}`);
if (sourceResult2.results.length > 0) {
  sourceResult2.results.slice(0, 5).forEach(r => {
    console.log(`  - ${r.path}`);
    console.log(`    组件: ${r.component}, 得分: ${r.score}`);
  });
}
console.log('');

// 6. 检查文件关键词
console.log('📋 检查源码文件关键词:');
const filesWithSend = sourcesIndex.files.filter((f: any) =>
  f.keywords.some((k: string) => k.toLowerCase().includes('send'))
);
console.log(`  包含 "send" 关键词的文件数: ${filesWithSend.length}`);
if (filesWithSend.length > 0) {
  filesWithSend.slice(0, 3).forEach((f: any) => {
    console.log(`  - ${f.path}`);
    console.log(`    关键词: ${f.keywords.filter((k: string) => k.toLowerCase().includes('send')).join(', ')}`);
  });
}

console.log('\n✅ 调试完成');
