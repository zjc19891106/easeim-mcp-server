/**
 * IntegrationGuide 功能测试
 */

import { IntegrationGuide, PLATFORM_REQUIREMENTS, INTEGRATION_PROBLEMS } from '../src/intelligence/IntegrationGuide.js';

console.log('='.repeat(60));
console.log('IntegrationGuide 功能测试');
console.log('='.repeat(60));

const guide = new IntegrationGuide();

// ==================== 测试 1: 平台要求 ====================
console.log('\n📋 [1] 平台要求测试');
console.log('-'.repeat(40));

const components = ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit'];
for (const comp of components) {
  const req = guide.getRequirements(comp);
  if (req) {
    console.log(`   ${comp}: iOS ${req.minVersion}+, Xcode ${req.xcodeVersion || 'N/A'}+`);
  }
}

// ==================== 测试 2: Podfile 检查 ====================
console.log('\n🔍 [2] Podfile 配置检查');
console.log('-'.repeat(40));

// 测试正确的 Podfile
const correctPodfile = `
platform :ios, '15.0'

target 'MyApp' do
  use_frameworks!
  pod 'EaseChatUIKit'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
end
`;

const correctCheck = guide.checkPodfileConfig(correctPodfile, 'EaseChatUIKit');
console.log(`   ✅ 正确配置检查: ${correctCheck.valid ? '通过' : '失败'}`);
console.log(`      问题数: ${correctCheck.issues.length}, 建议数: ${correctCheck.suggestions.length}`);

// 测试错误的 Podfile
const wrongPodfile = `
platform :ios, '13.0'

target 'MyApp' do
  pod 'EaseChatUIKit'
end
`;

const wrongCheck = guide.checkPodfileConfig(wrongPodfile, 'EaseChatUIKit');
console.log(`   ❌ 错误配置检查: ${wrongCheck.valid ? '通过' : '检测到问题'}`);
console.log(`      问题数: ${wrongCheck.issues.length}`);
for (const issue of wrongCheck.issues) {
  console.log(`      - ${issue.type}: ${issue.message}`);
}

// ==================== 测试 3: 错误诊断 ====================
console.log('\n🛠️ [3] 构建错误诊断');
console.log('-'.repeat(40));

const testErrors = [
  'Sandbox: rsync.samba deny file-write-create',
  'PBXFileSystemSynchronizedRootGroup unknown ISA',
  'building for iOS Simulator but arm64 architecture',
  'NSCameraUsageDescription this app has crashed',
  'framework not found EaseChatUIKit'
];

for (const error of testErrors) {
  const problems = guide.diagnoseError(error);
  console.log(`\n   错误: "${error.substring(0, 40)}..."`);
  console.log(`   匹配问题数: ${problems.length}`);
  if (problems.length > 0) {
    console.log(`   最可能原因: ${problems[0].symptom}`);
    console.log(`   优先级: ${problems[0].priority}`);
  }
}

// ==================== 测试 4: Podfile 模板 ====================
console.log('\n\n📄 [4] Podfile 模板');
console.log('-'.repeat(40));

for (const comp of ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit']) {
  const template = guide.getPodfileTemplate(comp);
  console.log(`   ${comp}: ${template ? `✅ 有模板 (${template.length} 字符)` : '❌ 无模板'}`);
}

// ==================== 测试 5: 集成检查清单 ====================
console.log('\n✅ [5] 集成检查清单');
console.log('-'.repeat(40));

const checklist = guide.generateChecklist('EaseChatUIKit');
const checklistLines = checklist.split('\n').length;
console.log(`   EaseChatUIKit 检查清单: ${checklistLines} 行`);

// 显示部分清单内容
const previewLines = checklist.split('\n').slice(0, 10).join('\n');
console.log(`   预览:\n${previewLines}\n   ...`);

// ==================== 测试 6: 问题搜索 ====================
console.log('\n🔎 [6] 问题搜索');
console.log('-'.repeat(40));

const searchQueries = ['rsync', 'cocoapods', 'simulator', 'permission'];
for (const query of searchQueries) {
  const results = guide.searchProblems(query);
  console.log(`   "${query}": ${results.length} 个匹配问题`);
}

// ==================== 统计信息 ====================
console.log('\n' + '='.repeat(60));
console.log('📊 知识库统计');
console.log('='.repeat(60));
console.log(`   平台要求: ${Object.keys(PLATFORM_REQUIREMENTS).length} 个组件`);
console.log(`   已知问题: ${INTEGRATION_PROBLEMS.length} 个`);
console.log(`   优先级分布:`);
const priorities = INTEGRATION_PROBLEMS.reduce((acc, p) => {
  acc[p.priority] = (acc[p.priority] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
for (const [priority, count] of Object.entries(priorities)) {
  console.log(`      ${priority}: ${count}`);
}

console.log('\n' + '='.repeat(60));
console.log('✅ 测试完成');
console.log('='.repeat(60));
