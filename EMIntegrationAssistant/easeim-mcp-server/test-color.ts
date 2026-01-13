#!/usr/bin/env tsx
/**
 * 测试 "颜色/color" 搜索和歧义检测
 */

import { SourceSearch } from './src/search/SourceSearch.js';

const sourceSearch = new SourceSearch();

console.log('🎨 测试颜色相关搜索...\n');

// 1. 搜索 "颜色"（中文）
console.log('📌 测试 1: 搜索 "颜色"（中文关键词）');
const test1 = sourceSearch.search('颜色');
console.log(`结果数: ${test1.results.length}`);
console.log(`歧义: ${test1.ambiguity.hasAmbiguity}`);
console.log('');

// 2. 搜索 "color"（英文）
console.log('📌 测试 2: 搜索 "color"（英文关键词）');
const test2 = sourceSearch.search('color');
console.log(`结果数: ${test2.results.length}`);
console.log(`歧义: ${test2.ambiguity.hasAmbiguity}`);
if (test2.ambiguity.hasAmbiguity) {
  console.log(`类型: ${test2.ambiguity.type}`);
  console.log(`问题: ${test2.ambiguity.question}`);
  if (test2.ambiguity.options) {
    console.log('选项:');
    test2.ambiguity.options.forEach(opt => {
      console.log(`  - ${opt.description}: ${opt.count} 个结果`);
    });
  }
}

if (test2.results.length > 0) {
  console.log('\n前 10 个结果:');
  test2.results.slice(0, 10).forEach((r, i) => {
    console.log(`${i + 1}. [${r.component}] ${r.path.split('/').pop()}`);
    console.log(`   ${r.description}`);
    if (r.tags.length > 0) {
      console.log(`   标签: ${r.tags.join(', ')}`);
    }
  });
}
console.log('');

// 3. 搜索 "bubble"（气泡）
console.log('📌 测试 3: 搜索 "bubble"（气泡）');
const test3 = sourceSearch.search('bubble');
console.log(`结果数: ${test3.results.length}`);
console.log(`歧义: ${test3.ambiguity.hasAmbiguity}`);
if (test3.ambiguity.hasAmbiguity) {
  console.log(`类型: ${test3.ambiguity.type}`);
  console.log(`问题: ${test3.ambiguity.question}`);
  if (test3.ambiguity.options) {
    console.log('选项:');
    test3.ambiguity.options.forEach(opt => {
      console.log(`  - ${opt.description}: ${opt.count} 个结果`);
    });
  }
}

// 统计各组件的结果
if (test3.results.length > 0) {
  const byComponent: Record<string, number> = {};
  test3.results.forEach(r => {
    byComponent[r.component] = (byComponent[r.component] || 0) + 1;
  });
  console.log('\n按组件分布:');
  Object.entries(byComponent).forEach(([comp, count]) => {
    console.log(`  - ${comp}: ${count} 个`);
  });
}
console.log('');

console.log('✅ 测试完成');
