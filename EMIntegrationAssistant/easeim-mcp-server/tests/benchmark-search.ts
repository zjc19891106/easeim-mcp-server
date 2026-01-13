/**
 * 搜索性能基准测试
 * 对比优化前后的搜索性能
 */

import { DocSearch } from '../src/search/DocSearch.js';
import { InvertedIndex } from '../src/search/InvertedIndex.js';

// 测试用例
const testQueries = [
  '发送消息',
  'send message',
  '登录',
  'login',
  '聊天室',
  'chatroom',
  '群组管理',
  'group management',
  '推送通知',
  'push notification',
  '错误码 508',
  '用户状态',
  'connection',
  '消息撤回',
  '已读回执'
];

async function runBenchmark() {
  console.log('='.repeat(60));
  console.log('搜索性能基准测试');
  console.log('='.repeat(60));

  const docSearch = new DocSearch();

  // 预热：首次加载索引
  console.log('\n[1] 预热：首次加载索引...');
  const warmupStart = performance.now();
  docSearch.searchApi('test');
  const warmupTime = performance.now() - warmupStart;
  console.log(`   索引加载 + 倒排索引构建耗时: ${warmupTime.toFixed(2)}ms`);

  // 多次搜索性能测试
  console.log('\n[2] 搜索性能测试...');
  const iterations = 100;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const query = testQueries[i % testQueries.length];
    const start = performance.now();
    docSearch.searchApi(query);
    times.push(performance.now() - start);
  }

  // 统计结果
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const sortedTimes = [...times].sort((a, b) => a - b);
  const p50 = sortedTimes[Math.floor(times.length * 0.5)];
  const p95 = sortedTimes[Math.floor(times.length * 0.95)];
  const p99 = sortedTimes[Math.floor(times.length * 0.99)];

  console.log(`\n   执行 ${iterations} 次搜索:`);
  console.log(`   - 平均耗时: ${avgTime.toFixed(3)}ms`);
  console.log(`   - 最小耗时: ${minTime.toFixed(3)}ms`);
  console.log(`   - 最大耗时: ${maxTime.toFixed(3)}ms`);
  console.log(`   - P50: ${p50.toFixed(3)}ms`);
  console.log(`   - P95: ${p95.toFixed(3)}ms`);
  console.log(`   - P99: ${p99.toFixed(3)}ms`);

  // 测试倒排索引统计
  console.log('\n[3] 倒排索引统计...');
  // 由于 invertedIndex 是私有的，我们通过搜索结果来间接验证

  // 测试不同查询的搜索质量
  console.log('\n[4] 搜索质量验证...');
  const qualityTests = [
    { query: '发送消息', expectKeyword: 'message' },
    { query: 'login', expectKeyword: 'login' },
    { query: '聊天室', expectKeyword: 'chatroom' },
  ];

  for (const test of qualityTests) {
    const result = docSearch.searchApi(test.query, undefined, 5);
    console.log(`\n   查询: "${test.query}"`);
    console.log(`   结果数: ${result.results.length}`);
    if (result.expandedTerms) {
      console.log(`   扩展词: ${result.expandedTerms.join(', ')}`);
    }
    if (result.results.length > 0) {
      console.log(`   Top 3 结果:`);
      result.results.slice(0, 3).forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.name} (score: ${r.score.toFixed(2)})`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

runBenchmark().catch(console.error);
