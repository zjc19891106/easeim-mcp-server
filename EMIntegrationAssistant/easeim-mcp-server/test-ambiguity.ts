#!/usr/bin/env tsx
/**
 * 歧义检测功能测试脚本
 */

import { DocSearch } from './src/search/DocSearch.js';
import { SourceSearch } from './src/search/SourceSearch.js';

const docSearch = new DocSearch();
const sourceSearch = new SourceSearch();

console.log('🧪 开始测试歧义检测功能...\n');

// 测试 1: API 搜索 - UI 相关查询（应该检测到层级歧义）
console.log('📌 测试 1: 搜索 "颜色"（UI 相关，可能涉及 SDK 和 UIKit）');
const test1 = docSearch.searchApi('颜色');
console.log(`结果数量: ${test1.results.length}`);
console.log(`是否有歧义: ${test1.ambiguity.hasAmbiguity}`);
if (test1.ambiguity.hasAmbiguity) {
  console.log(`歧义类型: ${test1.ambiguity.type}`);
  console.log(`问题: ${test1.ambiguity.question}`);
}
console.log('');

// 测试 2: API 搜索 - 指定层级后应该没有歧义
console.log('📌 测试 2: 搜索 "颜色" + 指定 layer=uikit');
const test2 = docSearch.searchApi('颜色', { layer: 'uikit' });
console.log(`结果数量: ${test2.results.length}`);
console.log(`是否有歧义: ${test2.ambiguity.hasAmbiguity}`);
console.log('');

// 测试 3: 源码搜索 - 气泡（可能涉及多个组件）
console.log('📌 测试 3: 搜索源码 "bubble"（可能在多个 UIKit 组件中）');
const test3 = sourceSearch.search('bubble');
console.log(`结果数量: ${test3.results.length}`);
console.log(`是否有歧义: ${test3.ambiguity.hasAmbiguity}`);
if (test3.ambiguity.hasAmbiguity) {
  console.log(`歧义类型: ${test3.ambiguity.type}`);
  console.log(`问题: ${test3.ambiguity.question}`);
  if (test3.ambiguity.options) {
    console.log('选项:');
    test3.ambiguity.options.forEach(opt => {
      console.log(`  - ${opt.description} (${opt.count} 个结果)`);
    });
  }
}
console.log('');

// 测试 4: 源码搜索 - 指定组件后应该没有歧义
console.log('📌 测试 4: 搜索源码 "bubble" + 指定 component=EaseChatUIKit');
const test4 = sourceSearch.search('bubble', 'EaseChatUIKit');
console.log(`结果数量: ${test4.results.length}`);
console.log(`是否有歧义: ${test4.ambiguity.hasAmbiguity}`);
console.log('');

// 测试 5: API 搜索 - 普通查询（不应该有歧义）
console.log('📌 测试 5: 搜索 "sendMessage"（精确匹配，不应该有歧义）');
const test5 = docSearch.searchApi('sendMessage');
console.log(`结果数量: ${test5.results.length}`);
console.log(`是否有歧义: ${test5.ambiguity.hasAmbiguity}`);
console.log('');

console.log('✅ 测试完成！');
