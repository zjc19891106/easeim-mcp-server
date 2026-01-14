
import { detectMissingPlatform, ResponseBuilder } from './src/utils/ResponseBuilder.js';

console.log('🧪 开始测试平台检测逻辑...\n');

const testCases = [
  { query: "我想自定义一个订单消息", desc: "模糊的功能实现查询" },
  { query: "iOS 上怎么发送图片消息", desc: "包含平台的查询" },
  { query: "发送消息失败", desc: "非功能实现查询" },
  { query: "如何实现群组功能", desc: "模糊的群组功能查询" }
];

for (const test of testCases) {
  console.log(`📌 测试查询: "${test.query}" (${test.desc})`);
  const result = detectMissingPlatform(test.query);
  
  console.log(`   需要平台信息: ${result.needsPlatform ? '✅ 是' : '❌ 否'}`);
  if (result.detectedPlatform) {
    console.log(`   检测到平台: ${result.detectedPlatform}`);
  }
  if (result.featureName) {
    console.log(`   提取功能名: ${result.featureName}`);
  }
  console.log(`   是否为实现类查询: ${result.isImplementationQuery ? '✅ 是' : '❌ 否'}`);
  
  // 如果需要平台信息，模拟构建响应
  if (result.needsPlatform && result.isImplementationQuery) {
    console.log('   🛠 模拟构建交互响应...');
    const builder = ResponseBuilder.create();
    builder.setPlatformSelectionInteraction({
        question: `您想在哪个平台实现「${result.featureName}」功能？`
    });
    const response = builder.build();
    // 检查响应中是否包含 interaction
    const metadataStr = response.content[0].text.split('<!-- MCP_METADATA')[1]?.split('MCP_METADATA -->')[0];
    if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        console.log(`   交互请求类型: ${metadata.interaction?.clarificationType}`);
        console.log(`   交互问题: ${metadata.interaction?.question}`);
    } else {
        console.log('   ⚠️ 响应中未找到 Metadata (交互信息构建失败)');
    }
  }
  
  console.log('---\n');
}
