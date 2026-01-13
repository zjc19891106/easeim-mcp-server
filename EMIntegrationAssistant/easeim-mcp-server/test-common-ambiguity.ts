#!/usr/bin/env tsx
/**
 * 测试常见 UI 关键词的歧义检测
 */

import { SourceSearch } from './src/search/SourceSearch.js';

const sourceSearch = new SourceSearch();

// 定义测试用例 - 这些都是可能跨多个 UIKit 组件的常见关键词
const testKeywords = [
  // UI 样式相关
  { keyword: 'font', desc: '字体' },
  { keyword: 'background', desc: '背景' },
  { keyword: 'theme', desc: '主题' },
  { keyword: 'style', desc: '样式' },
  { keyword: 'layout', desc: '布局' },

  // UI 组件相关
  { keyword: 'avatar', desc: '头像' },
  { keyword: 'button', desc: '按钮' },
  { keyword: 'input', desc: '输入框' },
  { keyword: 'textfield', desc: '文本框' },
  { keyword: 'cell', desc: '列表单元格' },
  { keyword: 'tableview', desc: '表格视图' },

  // 功能相关
  { keyword: 'message', desc: '消息' },
  { keyword: 'user', desc: '用户' },
  { keyword: 'emoji', desc: '表情' },
  { keyword: 'image', desc: '图片' },
  { keyword: 'video', desc: '视频' },

  // 特定 UI 元素
  { keyword: 'bubble', desc: '气泡' },
  { keyword: 'badge', desc: '角标' },
  { keyword: 'placeholder', desc: '占位符' },
];

console.log('🔍 测试常见 UI 关键词的歧义检测\n');
console.log('=' .repeat(80));

const results: Array<{
  keyword: string;
  desc: string;
  totalResults: number;
  hasAmbiguity: boolean;
  components: Record<string, number>;
}> = [];

for (const { keyword, desc } of testKeywords) {
  const searchResult = sourceSearch.search(keyword, 'all', 20); // 增加 limit 确保覆盖

  // 统计各组件分布
  const componentCounts: Record<string, number> = {};
  searchResult.results.forEach(r => {
    componentCounts[r.component] = (componentCounts[r.component] || 0) + 1;
  });

  results.push({
    keyword,
    desc,
    totalResults: searchResult.results.length,
    hasAmbiguity: searchResult.ambiguity.hasAmbiguity,
    components: componentCounts
  });
}

// 按是否有歧义分组显示
const withAmbiguity = results.filter(r => r.hasAmbiguity);
const withoutAmbiguity = results.filter(r => !r.hasAmbiguity);

console.log('\n✅ 检测到歧义的关键词 (需要询问用户):');
console.log('-'.repeat(80));
if (withAmbiguity.length === 0) {
  console.log('  （无）');
} else {
  withAmbiguity.forEach(r => {
    console.log(`\n📌 ${r.keyword} (${r.desc})`);
    console.log(`   总结果: ${r.totalResults} 个`);
    console.log(`   分布:`);
    const entries = Object.entries(r.components).sort((a, b) => b[1] - a[1]);
    entries.forEach(([comp, count]) => {
      const percentage = ((count / r.totalResults) * 100).toFixed(1);
      console.log(`     - ${comp}: ${count} 个 (${percentage}%)`);
    });
  });
}

console.log('\n\n❌ 未检测到歧义的关键词:');
console.log('-'.repeat(80));
if (withoutAmbiguity.length === 0) {
  console.log('  （无）');
} else {
  withoutAmbiguity.forEach(r => {
    if (r.totalResults > 0) {
      console.log(`\n📌 ${r.keyword} (${r.desc})`);
      console.log(`   总结果: ${r.totalResults} 个`);
      console.log(`   分布:`);
      const entries = Object.entries(r.components).sort((a, b) => b[1] - a[1]);
      entries.forEach(([comp, count]) => {
        const percentage = ((count / r.totalResults) * 100).toFixed(1);
        console.log(`     - ${comp}: ${count} 个 (${percentage}%)`);
      });

      // 判断是否应该触发歧义
      const componentCount = Object.keys(r.components).length;
      if (componentCount > 1) {
        const maxCount = Math.max(...Object.values(r.components));
        const maxPercentage = (maxCount / r.totalResults) * 100;
        const significantComponents = Object.values(r.components).filter(c => c >= 2).length;

        if (maxPercentage < 70 || significantComponents >= 2) {
          console.log(`   ⚠️  应该触发歧义！(跨 ${componentCount} 个组件，主导占比 ${maxPercentage.toFixed(1)}%)`);
        }
      }
    }
  });
}

// 统计
console.log('\n\n📊 统计:');
console.log('-'.repeat(80));
console.log(`  测试关键词总数: ${testKeywords.length}`);
console.log(`  有结果的关键词: ${results.filter(r => r.totalResults > 0).length}`);
console.log(`  检测到歧义: ${withAmbiguity.length}`);
console.log(`  未检测到歧义: ${withoutAmbiguity.filter(r => r.totalResults > 0).length}`);
console.log(`  无结果: ${results.filter(r => r.totalResults === 0).length}`);

console.log('\n✅ 测试完成');
