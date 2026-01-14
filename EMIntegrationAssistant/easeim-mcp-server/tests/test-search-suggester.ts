/**
 * 搜索建议器测试
 * 测试 SearchSuggester 在不同场景下的建议生成
 */

import { SearchSuggester } from '../src/intelligence/SearchSuggester.js';

// ============================================================
// 测试场景
// ============================================================

// 场景 1: 结果为空
function testNoResults() {
  console.log('\n--- 场景 1: 结果为空 ---\n');

  const suggester = new SearchSuggester();
  const query = 'xyz123unknown';
  const results: any[] = [];

  const suggestion = suggester.generateSuggestions(query, results);

  console.log(`查询: "${query}"`);
  console.log(`结果数: ${results.length}`);

  if (suggestion) {
    console.log(`\n💡 建议类型: ${suggestion.type}`);
    console.log(`   消息: ${suggestion.message}`);
    console.log(`   替代搜索: ${suggestion.alternatives.join(', ')}`);
  } else {
    console.log('❌ 未生成建议');
  }
}

// 场景 2: 结果太少
function testFewResults() {
  console.log('\n--- 场景 2: 结果太少（<3个）---\n');

  const suggester = new SearchSuggester();
  const query = 'MessageCell';
  const results = [
    { name: 'MessageCell', description: '消息 Cell 基类' },
    { name: 'MessageEntity', description: '消息实体' }
  ];

  const suggestion = suggester.generateSuggestions(query, results);

  console.log(`查询: "${query}"`);
  console.log(`结果数: ${results.length}`);
  console.log(`结果: ${results.map(r => r.name).join(', ')}`);

  if (suggestion) {
    console.log(`\n💡 建议类型: ${suggestion.type}`);
    console.log(`   消息: ${suggestion.message}`);
    console.log(`   相关搜索: ${suggestion.alternatives.join(', ')}`);
  } else {
    console.log('❌ 未生成建议');
  }
}

// 场景 3: 结果太多
function testTooManyResults() {
  console.log('\n--- 场景 3: 结果太多（>20个）---\n');

  const suggester = new SearchSuggester();
  const query = 'cell';

  // 模拟 25 个结果
  const results = [
    { name: 'MessageCell', description: '' },
    { name: 'TextMessageCell', description: '' },
    { name: 'ImageMessageCell', description: '' },
    { name: 'VideoMessageCell', description: '' },
    { name: 'FileMessageCell', description: '' },
    { name: 'LocationMessageCell', description: '' },
    { name: 'CustomMessageCell', description: '' },
    { name: 'ContactCell', description: '' },
    { name: 'ContactListCell', description: '' },
    { name: 'ContactDetailCell', description: '' },
    { name: 'ConversationCell', description: '' },
    { name: 'ConversationListCell', description: '' },
    { name: 'ConversationDetailCell', description: '' },
    { name: 'GroupCell', description: '' },
    { name: 'GroupListCell', description: '' },
    { name: 'GroupMemberCell', description: '' },
    { name: 'ChatCell', description: '' },
    { name: 'ChatRoomCell', description: '' },
    { name: 'UserCell', description: '' },
    { name: 'ProfileCell', description: '' },
    { name: 'SettingsCell', description: '' },
    { name: 'MenuCell', description: '' },
    { name: 'ActionCell', description: '' },
    { name: 'ButtonCell', description: '' },
    { name: 'LabelCell', description: '' },
  ];

  const suggestion = suggester.generateSuggestions(query, results);

  console.log(`查询: "${query}"`);
  console.log(`结果数: ${results.length}`);

  if (suggestion) {
    console.log(`\n💡 建议类型: ${suggestion.type}`);
    console.log(`   消息: ${suggestion.message}`);
    console.log(`   分类建议:`);
    suggestion.alternatives.forEach(alt => {
      console.log(`     • ${alt}`);
    });
  } else {
    console.log('❌ 未生成建议');
  }
}

// 场景 4: 合适的结果数（3-20）
function testGoodResults() {
  console.log('\n--- 场景 4: 结果数合适（3-20个）---\n');

  const suggester = new SearchSuggester();
  const query = 'message bubble';
  const results = [
    { name: 'MessageBubbleView', description: '消息气泡视图' },
    { name: 'BubbleStyle', description: '气泡样式' },
    { name: 'MessageBubbleCell', description: '消息气泡 Cell' },
    { name: 'CustomBubbleView', description: '自定义气泡视图' },
    { name: 'BubbleColor', description: '气泡颜色' },
  ];

  const suggestion = suggester.generateSuggestions(query, results);

  console.log(`查询: "${query}"`);
  console.log(`结果数: ${results.length}`);
  console.log(`结果: ${results.map(r => r.name).join(', ')}`);

  if (suggestion) {
    console.log(`\n💡 建议: 不应生成建议（结果数合适）`);
    console.log(`   实际: 生成了建议 - ${suggestion.type}`);
  } else {
    console.log(`\n✅ 正确: 结果数合适，未生成建议`);
  }
}

// 场景 5: 拼写纠错 + 结果少
function testWithSpellCorrection() {
  console.log('\n--- 场景 5: 拼写纠错 + 结果少 ---\n');

  const suggester = new SearchSuggester();
  const query = 'mesage bubl';  // 拼写错误
  const results = [
    { name: 'MessageBubble', description: '消息气泡' }
  ];

  const suggestion = suggester.generateSuggestions(
    query,
    results,
    {
      correctedQuery: 'message bubble',  // 纠正后的查询
      expandedTerms: ['message', 'bubble', 'msg', 'chat']
    }
  );

  console.log(`原始查询: "${query}"`);
  console.log(`纠正为: "message bubble"`);
  console.log(`结果数: ${results.length}`);

  if (suggestion) {
    console.log(`\n💡 建议类型: ${suggestion.type}`);
    console.log(`   消息: ${suggestion.message}`);
    console.log(`   相关搜索: ${suggestion.alternatives.join(', ')}`);
  } else {
    console.log('❌ 未生成建议');
  }
}

// 场景 6: 热门搜索统计
function testPopularSearches() {
  console.log('\n--- 场景 6: 热门搜索统计 ---\n');

  const suggester = new SearchSuggester();

  // 模拟用户搜索
  suggester.updatePopularTerm('message', 10);
  suggester.updatePopularTerm('bubble', 5);
  suggester.updatePopularTerm('avatar', 8);
  suggester.updatePopularTerm('conversation', 12);

  const topSearches = suggester.getTopSearches(5);

  console.log('Top 5 热门搜索:');
  topSearches.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.term} (频率: ${item.frequency})`);
  });
}

// ============================================================
// 运行所有测试
// ============================================================

function runAllTests() {
  console.log('============================================================');
  console.log('搜索建议器测试');
  console.log('============================================================');

  testNoResults();
  testFewResults();
  testTooManyResults();
  testGoodResults();
  testWithSpellCorrection();
  testPopularSearches();

  console.log('\n============================================================');
  console.log('测试完成');
  console.log('============================================================');
}

runAllTests();
