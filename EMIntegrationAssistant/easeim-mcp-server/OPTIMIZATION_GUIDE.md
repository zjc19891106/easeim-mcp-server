# 智能上下文识别和歧义检测 - 优化指南

## 🎯 优化目标

解决用户查询中的歧义问题，提供更精准的引导和结果。

## 📋 核心问题

### 问题 1：平台混淆

**场景：**
```
用户：如何发送消息？

当前问题：
- 没有区分 iOS/Android/Web/Flutter
- 不同平台的实现方式不同
- 返回的是 iOS 的结果，但用户可能是 Android 开发者

应该做到：
- 检测是否指定了平台
- 如果没有，根据结果分布判断是否需要反问
```

### 问题 2：层级混淆（SDK vs UIKit）

**场景：**
```
用户：修改消息气泡颜色

当前问题：
- SDK 不管 UI，这是 UIKit 的事
- 但可能返回了 SDK 的消息相关 API

应该做到：
- 识别这是 UI 相关的查询
- 只返回 UIKit 层的结果
- 或者明确告诉用户："气泡颜色属于 UIKit 层，SDK 不涉及 UI"
```

### 问题 3：组件混淆

**场景：**
```
用户：修改消息气泡颜色

当前问题：
- EaseChatUIKit 有消息气泡（单聊/群聊）
- EaseChatroomUIKit 也有消息气泡（聊天室/直播）
- EaseCallUIKit 可能没有传统气泡

应该做到：
- 检测用户想改哪个组件的气泡
- 如果不明确，列出选项让用户选择
```

## 🏗️ 架构设计

### 1. 数据结构增强

```typescript
// 为每个 API 模块添加元信息
interface ApiModule {
  platform: 'ios' | 'android' | 'web' | 'flutter' | 'unity' | 'all';
  layer: 'sdk' | 'uikit' | 'demo';
  component?: 'EaseChatUIKit' | 'EaseCallUIKit' | 'EaseChatroomUIKit';
}

// 为源码文件添加标签
interface SourceFile {
  tags: string[];  // ['bubble', 'color', 'ui', 'chat']
}
```

### 2. 智能检测流程

```
用户查询
    ↓
分析查询意图
    ↓
搜索相关结果
    ↓
歧义检测
    ↓
┌─────────────┬─────────────┬─────────────┐
│   无歧义    │  平台歧义   │  层级歧义   │  组件歧义
│   直接返回  │  反问平台   │  反问层级   │  反问组件
└─────────────┴─────────────┴─────────────┘
    ↓
格式化结果
    ↓
返回给用户
```

### 3. 歧义检测规则

#### 平台歧义
```typescript
// 如果搜索结果跨多个平台，且分布较均匀
platforms = {
  'ios': 5,
  'android': 4,
  'web': 3
}
→ 需要反问："您想查询哪个平台的实现？"
```

#### 层级歧义
```typescript
// 如果查询是 UI 相关，但也有 SDK 结果
query = "修改气泡颜色"
results = {
  'sdk': 2,     // 消息相关 API
  'uikit': 5    // 气泡 UI 组件
}
→ 提示："气泡颜色属于 UIKit 层，您想了解：
   1. UIKit 层：如何修改气泡颜色 (5 个结果)
   2. SDK 层：消息数据结构 (2 个结果)"
```

#### 组件歧义
```typescript
// 如果多个 UIKit 组件都有相关实现
query = "修改气泡颜色"
results = {
  'EaseChatUIKit': 3,      // 单聊/群聊气泡
  'EaseChatroomUIKit': 2   // 聊天室气泡
}
→ 反问："您想修改哪个组件的气泡？
   1. EaseChatUIKit（单聊/群聊）- 3 个结果
   2. EaseChatroomUIKit（聊天室/直播）- 2 个结果"
```

## 🔧 实现方案

### Phase 1: 数据标注（已完成）

1. ✅ 更新类型定义
   - 添加 `Platform`、`Layer`、`UIKitComponent` 类型
   - 为所有数据结构添加元信息字段

2. ✅ 创建歧义检测器 `AmbiguityDetector`
   - 检测平台歧义
   - 检测层级歧义
   - 检测组件歧义
   - 分析查询意图

### Phase 2: 索引增强（待实施）

需要更新索引生成脚本：

```typescript
// scripts/generate-docs-index.ts
modules.push({
  id: moduleId,
  name: title,
  platform: 'ios',           // 👈 新增
  layer: detectLayer(title), // 👈 新增
  component: detectComponent(title), // 👈 新增
  // ... 其他字段
});
```

### Phase 3: 搜索增强（待实施）

更新 `DocSearch.searchApi()`:

```typescript
searchApi(query, context?) {
  // 1. 分析查询意图
  const intent = ambiguityDetector.analyzeQueryIntent(query);

  // 2. 执行搜索
  const results = this.doSearch(query, intent);

  // 3. 检测歧义
  const ambiguity = ambiguityDetector.detectApiAmbiguity(
    query,
    results,
    context
  );

  // 4. 返回结果 + 歧义信息
  return { results, ambiguity };
}
```

### Phase 4: 响应优化（待实施）

MCP Server 返回格式：

```typescript
// 无歧义
{
  content: [{
    type: 'text',
    text: '找到 3 个相关 API...'
  }]
}

// 有歧义
{
  content: [{
    type: 'text',
    text: `
⚠️ 发现多个可能的选项

您想查询哪个平台的实现？
1. iOS（Swift/Objective-C）- 5 个结果
2. Android（Java/Kotlin）- 4 个结果
3. Web（JavaScript）- 3 个结果

请指定平台后重新查询，例如：
- search_api(query="发送消息", platform="ios")
`
  }]
}
```

## 📊 优化效果

### 优化前

```
用户：修改消息气泡颜色

返回：
1. EMChatMessage - SDK 消息类
2. sendMessage - 发送消息 API
3. MessageBubbleView - 气泡视图
4. ChatroomBubbleCell - 聊天室气泡
```

问题：SDK 和 UIKit 混在一起，不同组件混在一起

### 优化后

```
用户：修改消息气泡颜色

检测：
- 这是 UI 相关查询 → 应该查 UIKit
- 多个组件都有气泡 → 需要确认组件

返回：
⚠️ "修改消息气泡颜色" 属于 UIKit 层的 UI 定制

找到以下组件有相关实现：
1. EaseChatUIKit（单聊/群聊界面）- 3 个结果
   - MessageBubbleView.swift
   - BubbleColorConfig
   - ...

2. EaseChatroomUIKit（聊天室/直播界面）- 2 个结果
   - ChatroomBubbleCell.swift
   - ...

请问您想修改哪个组件的气泡？
- 单聊/群聊 → search_source(query="气泡", component="EaseChatUIKit")
- 聊天室/直播 → search_source(query="气泡", component="EaseChatroomUIKit")
```

## 🎯 关键优势

### 1. 精准定位

**层级清晰：**
- SDK 层：核心 IM 功能（发消息、接收消息、数据存储）
- UIKit 层：UI 组件（气泡、输入框、头像、主题）
- Demo 层：示例代码和集成演示

**组件明确：**
- EaseChatUIKit：单聊/群聊
- EaseCallUIKit：音视频通话
- EaseChatroomUIKit：聊天室/直播

### 2. 智能引导

**自动识别：**
```typescript
"如何发送消息" → SDK 层功能
"修改气泡颜色" → UIKit 层，可能多个组件
"通话界面布局" → EaseCallUIKit
"聊天室弹幕" → EaseChatroomUIKit
```

**主动提示：**
- 当结果不明确时，主动列出选项
- 提供精确的查询示例
- 避免用户困惑

### 3. 可扩展性

**多端支持：**
```typescript
platforms: ['ios', 'android', 'web', 'flutter', 'unity']
```

每个平台的实现独立索引，互不干扰。

**新组件支持：**
```typescript
components: {
  'EaseChatUIKit': { ... },
  'EaseCallUIKit': { ... },
  'EaseChatroomUIKit': { ... },
  'NewUIKit': { ... }  // 👈 轻松添加
}
```

## 🔮 后续计划

### Phase 2: 实施优化
1. 更新索引生成脚本
2. 标注现有数据（platform、layer、component）
3. 集成歧义检测器
4. 更新搜索和响应逻辑
5. 重新生成索引

### Phase 3: 测试验证
1. 测试各种歧义场景
2. 验证引导文案准确性
3. 优化检测阈值

### Phase 4: 多端扩展
1. 添加 Android 文档和源码
2. 添加 Web 文档
3. 添加 Flutter 文档
4. 支持跨平台对比

## 📝 使用示例

### 示例 1：指定平台

```typescript
// 用户明确指定平台
search_api({
  query: "发送消息",
  platform: "ios"
})

→ 只返回 iOS 平台的结果
```

### 示例 2：指定层级

```typescript
// 用户明确查询 UIKit
search_api({
  query: "消息",
  layer: "uikit"
})

→ 只返回 UIKit 层的结果（UI 组件）
```

### 示例 3：指定组件

```typescript
// 用户明确查询特定组件
search_source({
  query: "气泡",
  component: "EaseChatUIKit"
})

→ 只返回 EaseChatUIKit 的气泡相关代码
```

---

**状态：** 📐 设计完成，待实施
**优先级：** ⭐⭐⭐⭐⭐ 高
**预计工作量：** 2-3 小时
