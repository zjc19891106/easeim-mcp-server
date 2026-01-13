/**
 * 分片搜索 vs 全量搜索 性能对比测试
 */

import { SourceSearch } from '../src/search/SourceSearch.js';
import { ShardedSourceSearch } from '../src/search/ShardedSourceSearch.js';

const testQueries = [
  'MessageBubble',
  'ChatView',
  'Avatar',
  'Input',
  'call',
  '聊天',
  '消息列表',
  'theme',
  'color',
  'send',
];

async function runBenchmark() {
  console.log('='.repeat(60));
  console.log('分片搜索 vs 全量搜索 性能对比');
  console.log('='.repeat(60));

  // ==================== 全量搜索测试 ====================
  console.log('\n📦 [1] 全量搜索 (SourceSearch)');
  console.log('-'.repeat(40));

  const fullSearch = new SourceSearch();

  // 首次加载
  const fullLoadStart = performance.now();
  fullSearch.search('test');
  const fullLoadTime = performance.now() - fullLoadStart;
  console.log(`   首次加载耗时: ${fullLoadTime.toFixed(2)}ms`);

  // 多次搜索
  const fullTimes: number[] = [];
  for (let i = 0; i < 50; i++) {
    const query = testQueries[i % testQueries.length];
    const start = performance.now();
    fullSearch.search(query);
    fullTimes.push(performance.now() - start);
  }

  const fullAvg = fullTimes.reduce((a, b) => a + b, 0) / fullTimes.length;
  console.log(`   平均搜索耗时: ${fullAvg.toFixed(3)}ms`);

  // ==================== 分片搜索测试 ====================
  console.log('\n🔀 [2] 分片搜索 (ShardedSourceSearch)');
  console.log('-'.repeat(40));

  const shardedSearch = new ShardedSourceSearch();

  // 首次加载（只加载 manifest）
  const shardManifestStart = performance.now();
  const components = shardedSearch.getComponents();
  const shardManifestTime = performance.now() - shardManifestStart;
  console.log(`   清单加载耗时: ${shardManifestTime.toFixed(2)}ms`);
  console.log(`   可用组件: ${components.join(', ')}`);

  // 单组件搜索
  console.log('\n   [2a] 单组件搜索 (EaseChatUIKit):');
  const singleShardStart = performance.now();
  shardedSearch.search('MessageBubble', 'EaseChatUIKit');
  const singleShardTime = performance.now() - singleShardStart;
  console.log(`        首次加载+搜索: ${singleShardTime.toFixed(2)}ms`);

  const singleTimes: number[] = [];
  for (let i = 0; i < 50; i++) {
    const query = testQueries[i % testQueries.length];
    const start = performance.now();
    shardedSearch.search(query, 'EaseChatUIKit');
    singleTimes.push(performance.now() - start);
  }
  const singleAvg = singleTimes.reduce((a, b) => a + b, 0) / singleTimes.length;
  console.log(`        平均搜索耗时: ${singleAvg.toFixed(3)}ms`);

  // 全组件搜索
  console.log('\n   [2b] 全组件搜索 (all):');
  shardedSearch.clearCache(); // 清除缓存重新测试
  const allShardStart = performance.now();
  const allResult = shardedSearch.search('bubble', 'all');
  const allShardTime = performance.now() - allShardStart;
  console.log(`        首次加载所有分片+搜索: ${allShardTime.toFixed(2)}ms`);
  console.log(`        加载的分片: ${allResult.loadedShards.join(', ')}`);

  const allTimes: number[] = [];
  for (let i = 0; i < 50; i++) {
    const query = testQueries[i % testQueries.length];
    const start = performance.now();
    shardedSearch.search(query, 'all');
    allTimes.push(performance.now() - start);
  }
  const allAvg = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
  console.log(`        平均搜索耗时: ${allAvg.toFixed(3)}ms`);

  // ==================== 对比结果 ====================
  console.log('\n' + '='.repeat(60));
  console.log('📊 性能对比总结');
  console.log('='.repeat(60));

  console.log('\n首次加载:');
  console.log(`   全量索引:    ${fullLoadTime.toFixed(2)}ms`);
  console.log(`   分片清单:    ${shardManifestTime.toFixed(2)}ms (${((1 - shardManifestTime/fullLoadTime) * 100).toFixed(0)}% 更快)`);

  console.log('\n单组件搜索 (EaseChatUIKit):');
  console.log(`   全量搜索:    ${fullAvg.toFixed(3)}ms`);
  console.log(`   分片搜索:    ${singleAvg.toFixed(3)}ms`);

  console.log('\n全组件搜索 (all):');
  console.log(`   全量搜索:    ${fullAvg.toFixed(3)}ms`);
  console.log(`   分片搜索:    ${allAvg.toFixed(3)}ms`);

  // 缓存统计
  console.log('\n缓存状态:');
  const cacheStats = shardedSearch.getCacheStats();
  console.log(`   已缓存分片: ${cacheStats.cachedShards.join(', ')}`);
  console.log(`   缓存大小: ${cacheStats.cacheSize}/${cacheStats.maxSize}`);

  // 搜索质量验证
  console.log('\n' + '='.repeat(60));
  console.log('🔍 搜索质量验证');
  console.log('='.repeat(60));

  const qualityTests = [
    { query: 'MessageBubble', component: 'EaseChatUIKit' },
    { query: 'CallView', component: 'EaseCallUIKit' },
    { query: 'chatroom', component: 'all' },
  ];

  for (const test of qualityTests) {
    console.log(`\n查询: "${test.query}" (${test.component})`);
    const result = shardedSearch.search(test.query, test.component, 3);
    console.log(`   结果数: ${result.results.length}`);
    if (result.expandedTerms) {
      console.log(`   扩展词: ${result.expandedTerms.slice(0, 5).join(', ')}...`);
    }
    for (const r of result.results.slice(0, 3)) {
      console.log(`   - ${r.path.split('/').pop()} (score: ${r.score.toFixed(2)})`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 测试完成');
  console.log('='.repeat(60));
}

runBenchmark().catch(console.error);
