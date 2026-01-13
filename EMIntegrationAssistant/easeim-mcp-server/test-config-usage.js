#!/usr/bin/env node
/**
 * 测试 get_config_usage 工具
 */

import { ConfigSearch } from './dist/search/ConfigSearch.js';

const configSearch = new ConfigSearch();

console.log('🧪 测试 get_config_usage 工具...\n');

const testCases = [
  'avatarRadius',
  'primaryHue',
  'alertStyle',
  'actionSheetRowHeight',
  'avatarPlaceHolder',
  'invalidPropertyName'  // 测试不存在的配置项
];

for (const propertyName of testCases) {
  console.log('=' .repeat(70));
  console.log(`📋 测试: ${propertyName}`);
  console.log('=' .repeat(70));

  try {
    const usage = configSearch.getConfigUsage(propertyName);

    if (usage) {
      console.log(`\n✅ 找到配置项`);
      console.log(`  名称: ${usage.property.name}`);
      console.log(`  类型: ${usage.property.type}`);
      console.log(`  默认值: ${usage.property.defaultValue || 'N/A'}`);
      console.log(`  类别: ${usage.category}`);
      console.log(`  使用次数: ${usage.usageCount}`);
      console.log(`  影响组件数: ${usage.affectedComponents.length}`);

      if (usage.affectedComponents.length > 0) {
        console.log(`  影响的组件: ${usage.affectedComponents.slice(0, 5).join(', ')}${usage.affectedComponents.length > 5 ? ' ...' : ''}`);
      }

      console.log(`  摘要: ${usage.summary}`);
    } else {
      console.log(`\n❌ 未找到配置项`);
    }
  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}`);
  }

  console.log('\n');
}

// 测试最重要的配置项的详细输出
console.log('\n' + '='.repeat(70));
console.log('📊 avatarRadius 详细分析');
console.log('='.repeat(70));

const avatarRadiusUsage = configSearch.getConfigUsage('avatarRadius');
if (avatarRadiusUsage) {
  console.log(`\n🎯 这是影响范围最广的配置项！\n`);

  console.log(`基本信息:`);
  console.log(`  - 名称: ${avatarRadiusUsage.property.name}`);
  console.log(`  - 类型: ${avatarRadiusUsage.property.type}`);
  console.log(`  - 默认值: ${avatarRadiusUsage.property.defaultValue}`);
  console.log(`  - 类别: ${avatarRadiusUsage.category}`);

  console.log(`\n影响统计:`);
  console.log(`  - 使用次数: ${avatarRadiusUsage.usageCount} 处`);
  console.log(`  - 影响组件: ${avatarRadiusUsage.affectedComponents.length} 个`);

  console.log(`\n影响的组件类型分布:`);
  const byType = {};
  for (const comp of avatarRadiusUsage.affectedComponents) {
    if (comp.includes('Cell')) {
      byType['Cell'] = (byType['Cell'] || 0) + 1;
    } else if (comp.includes('View')) {
      byType['View'] = (byType['View'] || 0) + 1;
    } else if (comp.includes('Controller')) {
      byType['Controller'] = (byType['Controller'] || 0) + 1;
    } else {
      byType['Other'] = (byType['Other'] || 0) + 1;
    }
  }

  for (const [type, count] of Object.entries(byType)) {
    console.log(`  - ${type}: ${count} 个组件`);
  }

  console.log(`\n使用位置示例 (前3个):`);
  for (let i = 0; i < Math.min(3, avatarRadiusUsage.usages.length); i++) {
    const usage = avatarRadiusUsage.usages[i];
    console.log(`\n  ${i + 1}. ${usage.file}:${usage.line}`);
    console.log(`     组件: ${usage.component}`);
    const contextLines = usage.context.split('\n');
    const mainLine = contextLines.find(l => l.includes('>>>'));
    if (mainLine) {
      console.log(`     代码: ${mainLine.replace('>>> ', '').trim().substring(0, 80)}...`);
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log('🎉 测试完成！');
console.log('='.repeat(70));
