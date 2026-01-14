/**
 * 拼写纠错器测试
 * 测试 SpellCorrector 的纠错能力和准确性
 */

import { SpellCorrector } from '../src/intelligence/SpellCorrector.js';

// ============================================================
// 测试用例
// ============================================================

const testCases = [
  // 常见拼写错误
  { input: 'mesage', expected: 'message', desc: '漏字母' },
  { input: 'messge', expected: 'message', desc: '漏字母' },
  { input: 'messsage', expected: 'message', desc: '多字母' },
  { input: 'massege', expected: 'message', desc: '字母顺序错误' },

  { input: 'bubbel', expected: 'bubble', desc: '字母错位' },
  { input: 'bublle', expected: 'bubble', desc: '字母打错' },
  { input: 'buble', expected: 'bubble', desc: '漏字母' },

  { input: 'avater', expected: 'avatar', desc: '常见拼错' },
  { input: 'avatr', expected: 'avatar', desc: '漏字母' },

  { input: 'converstion', expected: 'conversation', desc: '漏字母' },
  { input: 'converastion', expected: 'conversation', desc: '字母顺序' },

  { input: 'controler', expected: 'controller', desc: '漏字母' },
  { input: 'cotroller', expected: 'controller', desc: '漏字母' },

  { input: 'deleagte', expected: 'delegate', desc: '字母顺序' },
  { input: 'delgate', expected: 'delegate', desc: '漏字母' },

  { input: 'callbck', expected: 'callback', desc: '漏字母' },
  { input: 'calback', expected: 'callback', desc: '漏字母' },

  { input: 'apearance', expected: 'appearance', desc: '漏字母' },
  { input: 'appearence', expected: 'appearance', desc: '字母错误' },

  // 正确的词（不应被纠错）
  { input: 'message', expected: 'message', desc: '正确词' },
  { input: 'bubble', expected: 'bubble', desc: '正确词' },
  { input: 'controller', expected: 'controller', desc: '正确词' },

  // 完全未知的词
  { input: 'xyz123', expected: 'xyz123', desc: '未知词不纠错' },
  { input: 'ab', expected: 'ab', desc: '太短不纠错' },
];

const queryTestCases = [
  {
    input: 'mesage bubble',
    expectedContains: 'message',
    desc: '多词查询纠错'
  },
  {
    input: 'send messsage',
    expectedContains: 'message',
    desc: '部分纠错'
  },
  {
    input: 'custum cell',
    expectedContains: 'custom',
    desc: '自定义 Cell 纠错'
  },
  {
    input: 'avater style',
    expectedContains: 'avatar',
    desc: '头像样式纠错'
  },
];

// ============================================================
// 运行测试
// ============================================================

function runTests() {
  console.log('============================================================');
  console.log('拼写纠错器测试');
  console.log('============================================================\n');

  const corrector = new SpellCorrector();

  console.log(`📖 词典大小: ${corrector.getDictionarySize()} 词\n`);

  // 单词纠错测试
  console.log('--- 单词纠错测试 ---\n');

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = corrector.correct(tc.input);
    const success = result.corrected === tc.expected;

    if (success) {
      passed++;
      console.log(`✅ "${tc.input}" → "${result.corrected}" (${tc.desc})`);
    } else {
      failed++;
      console.log(`❌ "${tc.input}" → "${result.corrected}" (期望: "${tc.expected}", ${tc.desc})`);
      if (result.suggestions) {
        console.log(`   其他建议: ${result.suggestions.join(', ')}`);
      }
    }
  }

  console.log(`\n单词纠错: ${passed}/${testCases.length} 通过\n`);

  // 查询纠错测试
  console.log('--- 查询纠错测试 ---\n');

  let queryPassed = 0;
  let queryFailed = 0;

  for (const tc of queryTestCases) {
    const result = corrector.correctQuery(tc.input);
    const success = result.correctedQuery.includes(tc.expectedContains);

    if (success) {
      queryPassed++;
      console.log(`✅ "${tc.input}"`);
      console.log(`   → "${result.correctedQuery}"`);
      if (result.suggestion) {
        console.log(`   💡 ${result.suggestion}`);
      }
    } else {
      queryFailed++;
      console.log(`❌ "${tc.input}"`);
      console.log(`   → "${result.correctedQuery}" (期望包含: "${tc.expectedContains}")`);
    }
    console.log();
  }

  console.log(`查询纠错: ${queryPassed}/${queryTestCases.length} 通过\n`);

  // 相似词测试
  console.log('--- 相似词查找测试 ---\n');

  const similarTests = ['msg', 'cel', 'bubl', 'contrler'];
  for (const word of similarTests) {
    const similar = corrector.getSimilarWords(word, 3);
    console.log(`"${word}" 的相似词: ${similar.join(', ') || '(无)'}`);
  }

  // 总结
  console.log('\n============================================================');
  console.log('测试总结');
  console.log('============================================================');
  console.log(`单词纠错: ${passed}/${testCases.length} (${(passed / testCases.length * 100).toFixed(1)}%)`);
  console.log(`查询纠错: ${queryPassed}/${queryTestCases.length} (${(queryPassed / queryTestCases.length * 100).toFixed(1)}%)`);

  const totalPassed = passed + queryPassed;
  const totalTests = testCases.length + queryTestCases.length;
  console.log(`\n总计: ${totalPassed}/${totalTests} (${(totalPassed / totalTests * 100).toFixed(1)}%)`);

  if (totalPassed === totalTests) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log(`\n⚠️  ${totalTests - totalPassed} 个测试失败`);
  }
}

// 执行测试
runTests();
