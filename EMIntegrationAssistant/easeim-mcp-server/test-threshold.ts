#!/usr/bin/env tsx
/**
 * 测试阈值计算
 */

import { SourceSearch } from './src/search/SourceSearch.js';

const sourceSearch = new SourceSearch();

console.log('🧮 测试歧义检测阈值...\n');

const result = sourceSearch.search('color');

// 统计各组件分布
const componentCounts = new Map<string, number>();
result.results.forEach(r => {
  componentCounts.set(r.component, (componentCounts.get(r.component) || 0) + 1);
});

console.log('📊 "color" 搜索结果分布:');
const entries = Array.from(componentCounts.entries()).sort((a, b) => b[1] - a[1]);
entries.forEach(([comp, count]) => {
  console.log(`  ${comp}: ${count} 个`);
});

const maxCount = Math.max(...Array.from(componentCounts.values()));
const minCount = Math.min(...Array.from(componentCounts.values()));
const ratio = maxCount / minCount;

console.log(`\n📐 阈值计算:`);
console.log(`  最大值: ${maxCount}`);
console.log(`  最小值: ${minCount}`);
console.log(`  比值: ${ratio.toFixed(2)}`);
console.log(`  当前阈值: < 2`);
console.log(`  是否触发歧义: ${ratio < 2 ? '是' : '否'}`);

console.log(`\n💡 分析:`);
if (componentCounts.size > 1) {
  console.log(`  - 结果跨 ${componentCounts.size} 个组件`);

  // 计算每个组件的占比
  const total = result.results.length;
  entries.forEach(([comp, count]) => {
    const percentage = (count / total * 100).toFixed(1);
    console.log(`  - ${comp}: ${percentage}%`);
  });

  console.log(`\n  建议: 当结果跨多个组件，且没有明显主导组件（占比 < 70%）时，应该询问用户。`);
}
