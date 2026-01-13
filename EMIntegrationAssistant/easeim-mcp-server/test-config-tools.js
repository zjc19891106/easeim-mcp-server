#!/usr/bin/env node
/**
 * 测试配置工具的简单脚本
 */

import { ConfigSearch } from './dist/search/ConfigSearch.js';

const configSearch = new ConfigSearch();

console.log('🧪 测试配置搜索功能...\n');

// 测试 1: 列出所有组件的配置项
console.log('📋 测试 1: list_config_options(all)');
console.log('=' .repeat(60));
try {
  const allConfigs = configSearch.listConfigOptions('all');

  for (const [compName, props] of Object.entries(allConfigs)) {
    console.log(`\n${compName}: ${props.length} 个配置项`);
    if (props.length > 0) {
      console.log(`  示例: ${props[0].name} (${props[0].type})`);
    }
  }
  console.log('\n✅ 测试 1 通过\n');
} catch (error) {
  console.error('❌ 测试 1 失败:', error.message);
}

// 测试 2: 列出单个组件的配置项
console.log('📋 测试 2: list_config_options(EaseChatroomUIKit)');
console.log('=' .repeat(60));
try {
  const configs = configSearch.listConfigOptions('EaseChatroomUIKit');

  for (const [compName, props] of Object.entries(configs)) {
    console.log(`\n${compName}: ${props.length} 个配置项`);
    props.slice(0, 3).forEach(prop => {
      console.log(`  - ${prop.name}: ${prop.type}`);
      if (prop.description) {
        console.log(`    说明: ${prop.description}`);
      }
    });
  }
  console.log('\n✅ 测试 2 通过\n');
} catch (error) {
  console.error('❌ 测试 2 失败:', error.message);
}

// 测试 3: 获取所有扩展点
console.log('📋 测试 3: get_extension_points(all, all)');
console.log('=' .repeat(60));
try {
  const allExtensions = configSearch.getExtensionPoints('all', 'all');

  for (const [compName, points] of Object.entries(allExtensions)) {
    const protocols = points.filter(p => p.type === 'protocol').length;
    const classes = points.filter(p => p.type === 'class').length;
    console.log(`\n${compName}: ${protocols} 个协议, ${classes} 个可继承类`);
  }
  console.log('\n✅ 测试 3 通过\n');
} catch (error) {
  console.error('❌ 测试 3 失败:', error.message);
}

// 测试 4: 只获取协议
console.log('📋 测试 4: get_extension_points(EaseChatUIKit, protocol)');
console.log('=' .repeat(60));
try {
  const protocols = configSearch.getExtensionPoints('EaseChatUIKit', 'protocol');

  for (const [compName, points] of Object.entries(protocols)) {
    console.log(`\n${compName}: ${points.length} 个协议`);
    points.slice(0, 3).forEach(proto => {
      console.log(`  - ${proto.name}`);
      if (proto.methods && proto.methods.length > 0) {
        console.log(`    方法数: ${proto.methods.length}`);
      }
    });
  }
  console.log('\n✅ 测试 4 通过\n');
} catch (error) {
  console.error('❌ 测试 4 失败:', error.message);
}

// 测试 5: 搜索配置项
console.log('📋 测试 5: searchConfigProperty(color)');
console.log('=' .repeat(60));
try {
  const results = configSearch.searchConfigProperty('color');

  let totalCount = 0;
  for (const [compName, props] of Object.entries(results)) {
    console.log(`\n${compName}: ${props.length} 个匹配`);
    props.slice(0, 2).forEach(prop => {
      console.log(`  - ${prop.name}: ${prop.type}`);
    });
    totalCount += props.length;
  }
  console.log(`\n总共找到 ${totalCount} 个包含 "color" 的配置项`);
  console.log('\n✅ 测试 5 通过\n');
} catch (error) {
  console.error('❌ 测试 5 失败:', error.message);
}

// 测试 6: 搜索扩展点
console.log('📋 测试 6: searchExtensionPoint(delegate)');
console.log('=' .repeat(60));
try {
  const results = configSearch.searchExtensionPoint('delegate');

  let totalCount = 0;
  for (const [compName, points] of Object.entries(results)) {
    console.log(`\n${compName}: ${points.length} 个匹配`);
    points.slice(0, 2).forEach(point => {
      console.log(`  - ${point.name} (${point.type})`);
    });
    totalCount += points.length;
  }
  console.log(`\n总共找到 ${totalCount} 个包含 "delegate" 的扩展点`);
  console.log('\n✅ 测试 6 通过\n');
} catch (error) {
  console.error('❌ 测试 6 失败:', error.message);
}

console.log('🎉 所有测试完成！');
