# 环信 IM SDK MCP Server

提供环信 IM SDK 文档查询、源码搜索、智能助手和集成诊断能力的 MCP Server。

## 功能概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    easeim-mcp-server                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   搜索引擎层    │  │   智能化层      │  │   诊断层        │ │
│  │                 │  │                 │  │                 │ │
│  │ • 文档搜索      │  │ • 意图分类      │  │ • 集成检查      │ │
│  │ • 源码搜索      │  │ • 实体提取      │  │ • 错误诊断      │ │
│  │ • 配置搜索      │  │ • 查询扩展      │  │ • Podfile 检查  │ │
│  │ • 分片搜索      │  │ • 代码生成      │  │ • 检查清单      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    核心算法层                              │ │
│  │                                                           │ │
│  │  BM25 评分 • 倒排索引 • LRU 缓存 • 歧义检测 • 上下文感知 • 拼写纠错 • 搜索建议 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## MCP 工具列表（19 个）

### 基础工具（10 个）

| 工具 | 描述 |
|------|------|
| `lookup_error` | 查询错误码含义、原因和解决方案 |
| `search_api` | 搜索 API 文档，支持平台/层级过滤 |
| `search_source` | 搜索 UIKit 源码，支持组件过滤 |
| `get_guide` | 获取集成指南和最佳实践 |
| `diagnose` | 根据症状诊断错误原因 |
| `read_doc` | 读取完整 API 文档 |
| `read_source` | 读取源码文件（支持行范围） |
| `list_config_options` | 列出 Appearance 配置项 |
| `get_extension_points` | 获取可继承类和协议 |
| `get_config_usage` | 查询配置项的使用详情 |

### 智能化工具（4 个）

| 工具 | 描述 |
|------|------|
| `smart_assist` | 🧠 自然语言智能助手，**支持上下文感知**，自动理解意图和连续性问题 |
| `generate_code` | 📝 代码生成器，生成完整代码模板 |
| `explain_class` | 📖 类解释器，说明继承关系和用法 |
| `list_scenarios` | 📋 列出所有支持的开发场景 |

### 集成诊断工具（5 个）

| 工具 | 描述 |
|------|------|
| `check_integration` | 🔍 检查 Podfile 配置是否符合要求 |
| `diagnose_build_error` | 🛠️ 诊断 Xcode 构建错误 |
| `get_podfile_template` | 📄 获取推荐的 Podfile 模板 |
| `get_integration_checklist` | ✅ 获取完整集成检查清单 |
| `get_platform_requirements` | 📋 查询平台版本要求 |

---

## 工具日志获取（全局）

所有 tools 调用均输出结构化日志（JSON Lines），用于问题复现与优化排查。

### 开启日志

```bash
EASEIM_TOOL_LOG=1
```

### 输出位置（可选）

未设置路径时，日志默认写到 stderr。

```bash
EASEIM_TOOL_LOG=1
EASEIM_TOOL_LOG_PATH="/tmp/easeim-tool.log"
```

### 日志内容示例（JSONL）

```json
{"log_version":"v1","timestamp":"2025-01-01T00:00:00.000Z","request_id":"...","session_id":"default","tool":{"name":"search_api","args":{"query":"发送消息"}},"response":{"type":"success","content_length":256},"timing_ms":{"total":12}}
```

---

## 技术实现

### 🔧 源码索引增强（参数名准确性）

为降低“参数名猜测”错误，源码索引增强了权威定义信息：

- 索引符号新增 `startLine`/`endLine`，便于精准定位定义块
- 提取并展示 `signature`（支持多行声明拼接）
- 解析并保留 `params`（参数名/类型/外部标签）
- 增加 `owner`（所属类/协议）与 `doc/description`（注释摘要）

对应脚本：`scripts/generate-source-index.ts`  
索引输出：`data/sources/index.json`

### 🎉 本次实现的两大功能总结

| 功能 | 代码行数 | 测试覆盖 | 用户价值 |
|------|----------|----------|----------|
| 拼写纠错 | ~550 行 | 28/28 ✅ | 自动纠正输入错误 |
| 搜索建议 | ~350 行 | 6/6 ✅ | 引导用户找到内容 |

### 搜索优化算法

本项目采用多层次搜索优化策略，按优先级分为 P0、P1、P2 三个阶段：

#### P0: 智能化基础

| 优化项 | 实现 | 效果 |
|--------|------|------|
| **实体提取增强** | 正则 + 关键词匹配，提取错误码、类名、组件名、功能名等 | 准确识别用户意图中的关键实体 |
| **查询扩展（同义词）** | 中英文同义词库 + 领域术语映射 | "消息"→"message,msg,chat" 扩展搜索范围 |
| **意图分类** | 基于关键词和模式的多意图分类器 | 识别 10+ 种用户意图（修复错误、定制UI等）|

```typescript
// 查询扩展示例
"发送消息" → ["发送", "消息", "send", "message", "msg", "chat"]
"气泡颜色" → ["气泡", "颜色", "bubble", "color", "背景色"]
```

#### P0.5: 拼写纠错 (SpellCorrector)

| 优化项 | 实现 | 效果 |
|--------|------|------|
| **Levenshtein 距离** | 编辑距离算法，支持最大距离 2 | 自动纠正常见拼写错误 |
| **领域词典** | 242+ 环信 SDK 专业术语 | 高准确率的领域纠错 |
| **词频加权** | 高频词优先匹配 | message > msg 优先级更高 |
| **驼峰拆分** | 自动从类名提取词汇 | 动态扩展词典 |

```typescript
// 拼写纠错示例
"mesage bubble"  → "message bubble"   ✅ 自动纠正
"avater style"   → "avatar style"     ✅ 自动纠正
"custum cell"    → "custom cell"      ✅ 自动纠正
"converstion"    → "conversation"     ✅ 自动纠正

// 返回结果包含纠正提示
{
  results: [...],
  spellCorrection: {
    originalQuery: "mesage bubble",
    correctedQuery: "message bubble",
    suggestion: "已自动纠正: \"mesage\" → \"message\""
  }
}
```

#### P0.6: 搜索建议 (SearchSuggester)

| 优化项 | 实现 | 效果 |
|--------|------|------|
| **结果为空时** | 推荐热门搜索词 | 引导用户发现内容 |
| **结果太少时** | 推荐相关搜索 | 扩展搜索范围 |
| **结果太多时** | 按类别分组建议 | 帮助用户缩小范围 |
| **智能相关推荐** | 基于结果推断用户意图 | MessageCell → CustomMessageCell |

```typescript
// 搜索建议示例

// 场景1: 结果为空
搜索 "xyz123" → {
  results: [],
  suggestion: {
    type: 'popular',
    message: '未找到匹配结果，您可能想搜索：',
    alternatives: ['message', 'conversation', 'chat']
  }
}

// 场景2: 结果太少（<3个）
搜索 "MessageCell" → {
  results: [MessageCell, MessageEntity],
  suggestion: {
    type: 'related',
    message: '找到 2 个结果，您可能还想搜索：',
    alternatives: ['CustomMessageCell', 'MessageController']
  }
}

// 场景3: 结果太多（>20个）
搜索 "cell" → {
  results: [25+ items],
  suggestion: {
    type: 'clarify',
    message: '找到 25+ 个结果，建议按类别缩小范围：',
    alternatives: [
      '消息相关 (7 个)',
      '联系人相关 (5 个)',
      '会话相关 (5 个)'
    ]
  }
}
```

#### P0.9: 精准度与防幻觉策略

| 策略 | 实现 | 价值 |
|------|------|------|
| **最小相关性阈值** | 结果低于 minScore 直接视为未命中 | 阻断低相关结果进入回答 |
| **歧义强制澄清** | 平台/层级/组件歧义时不直接输出结果 | 避免跨平台/跨组件误答 |
| **证据绑定输出** | API/源码/诊断输出均带路径+行号/ID | 保证可追溯与可验证 |

#### P1: 倒排索引 + BM25 评分

| 优化项 | 实现 | 效果 |
|--------|------|------|
| **倒排索引** | 词项 → 文档ID列表，支持快速查找 | O(1) 时间复杂度定位候选文档 |
| **BM25 评分** | 考虑词频、文档长度、IDF | 比 TF-IDF 更准确的相关性排序 |
| **字段权重** | className(4.0) > symbolName(3.0) > path(2.5) > description(1.5) | 类名匹配优先于描述匹配 |
| **歧义检测** | 检测多平台/多组件结果，提示用户过滤 | 减少用户困惑，提高搜索精度 |

```typescript
// BM25 评分公式
score = Σ IDF(qi) × (f(qi,D) × (k1+1)) / (f(qi,D) + k1 × (1-b+b×|D|/avgdl))

// 参数配置
k1 = 1.2  // 词频饱和参数
b = 0.75  // 文档长度归一化参数
```

#### P2: 源码分片索引（按组件）

| 优化项 | 实现 | 效果 |
|--------|------|------|
| **分片加载** | 按组件拆分索引文件 | 首次加载 98% 更快（0.5ms vs 23ms）|
| **LRU 缓存** | 最多缓存 4 个分片，自动淘汰 | 内存占用可控 |
| **并行搜索** | 多分片并行搜索 | 全组件搜索仍保持高性能 |
| **驼峰拆分** | "MessageBubble" → "message bubble" | 提高类名搜索准确率 |

```
索引结构:
data/sources/
├── manifest.json        (7 KB)     # 清单文件
└── shards/
    ├── EaseChatUIKit.json   (827 KB)
    ├── EaseCallUIKit.json   (256 KB)
    ├── EaseChatroomUIKit.json (320 KB)
    └── EaseChatDemo.json    (172 KB)
```

#### P3: 平台分片索引（按平台）

| 优化项 | 实现 | 效果 |
|--------|------|------|
| **文档平台分片** | 按 iOS/Android 等平台拆分文档索引 | 启动内存节省 99% |
| **配置平台分片** | 按平台拆分配置索引 | 启动内存节省 99.1% |
| **LRU 平台缓存** | 最多缓存 4 个平台分片 | 支持 10+ 平台无压力 |
| **智能平台检测** | 根据查询关键词自动识别目标平台 | 无需手动指定平台 |
| **错误码共享** | 错误码独立分片，跨平台共享 | 避免重复存储 |

```
索引结构:
data/docs/
├── manifest.json           (1.17 KB)   # 清单文件
└── shards/
    ├── ios.json            (32.66 KB)  # iOS 平台分片
    ├── android.json        (46.05 KB)  # Android 平台分片
    └── error-codes.json    (45.99 KB)  # 共享错误码

data/configs/
├── manifest.json           (0.61 KB)   # 清单文件
└── shards/
    └── ios.json            (66.11 KB)  # iOS 配置分片
```

**性能对比：**

| 数据类型 | 原始大小 | Manifest 大小 | 启动内存节省 |
|----------|----------|---------------|--------------|
| 文档索引 | 120.92 KB | 1.17 KB | **99.0%** |
| 配置索引 | 66.11 KB | 0.61 KB | **99.1%** |

**使用方式：**

```typescript
// 推荐使用分片版本
import { ShardedDocSearch, ShardedConfigSearch } from './search/index.js';

const docSearch = new ShardedDocSearch(4);  // 最多缓存4个平台
const configSearch = new ShardedConfigSearch(4);

// 自动检测平台
const results = docSearch.searchApi('发送消息');

// 指定平台
const iosResults = docSearch.searchApi('消息', { platform: 'ios' });

// 预加载常用平台
docSearch.preload(['ios', 'android']);
```

### 性能基准测试

```
============================================================
分片搜索 vs 全量搜索 性能对比
============================================================

首次加载:
   全量索引:    23.65ms
   分片清单:    0.50ms (98% 更快)

单组件搜索 (EaseChatUIKit):
   全量搜索:    9.756ms
   分片搜索:    0.263ms (37x 更快)

全组件搜索 (all):
   全量搜索:    9.756ms
   分片搜索:    0.396ms (24x 更快)
```

### 智能化模块

#### 意图分类器 (IntentClassifier)

支持识别以下用户意图：

| 意图 | 触发示例 |
|------|----------|
| `FIX_ERROR` | "错误码 508 怎么解决"、"登录失败" |
| `CUSTOMIZE_MESSAGE` | "自定义订单消息"、"添加卡片消息" |
| `ADD_MENU_ITEM` | "添加发送位置菜单"、"增加附件类型" |
| `CUSTOMIZE_UI` | "修改气泡颜色"、"自定义头像样式" |
| `UNDERSTAND_CLASS` | "MessageCell 是什么"、"如何继承" |
| `INTEGRATE_SDK` | "如何集成"、"快速开始" |
| `IMPLEMENT_FEATURE` | "如何实现已读回执"、"怎么发送图片" |

#### 知识图谱 (KnowledgeGraph)

存储类的继承关系、使用场景、关键方法等结构化知识：

```typescript
// 类信息示例
{
  name: "CustomMessageCell",
  description: "自定义消息 Cell 基类",
  superclass: "MessageCell",
  protocols: ["MessageCellProtocol"],
  keyMethods: ["createContent()", "refresh(entity:)"],
  usageScenarios: ["custom_message"]
}
```

#### 代码生成器 (CodeGenerator)

支持的代码模板：

| 模板 | 描述 |
|------|------|
| `custom_message` | 自定义消息类型完整实现 |
| `attachment_menu` | 添加附件菜单项 |
| `bubble_style` | 气泡样式定制 |
| `theme_config` | 主题颜色配置 |
| `avatar_config` | 头像样式配置 |
| `long_press_menu` | 长按菜单定制 |

#### 上下文管理器 (ContextManager)

支持上下文感知搜索，自动记住对话历史，识别连续性问题：

| 功能 | 说明 |
|------|------|
| **会话管理** | 支持多会话（通过 session_id），30 分钟超时自动清理 |
| **连续性检测** | 识别 "更多细节"、"继续"、"然后呢" 等后续问题 |
| **查询增强** | 自动为模糊查询添加上下文 |
| **智能推荐** | 基于当前话题推荐相关内容 |

**连续性类型：**

| 类型 | 触发示例 |
|------|----------|
| `more_detail` | "更多"、"详细"、"继续"、"continue"、"more details" |
| `follow_up` | "那怎么办"、"然后呢"、"接下来"、"what's next" |
| `related` | "类似的"、"相关的"、"还有其他"、"similar" |

**使用示例：**

```
会话 1:
  👤 "错误码 508 怎么解决"  → 话题: 错误处理, 焦点: 508
  👤 "更多细节"            → 自动增强为 "更多细节 (关于错误码 508)"
  👤 "类似的错误有哪些"     → 识别为 related，推荐相关错误码

会话 2 (独立):
  👤 "怎么自定义订单消息"   → 话题: 消息, 焦点: 消息
  👤 "然后怎么注册"        → 识别为 follow_up，保持消息话题
```

### 集成诊断知识库

#### 平台要求

| 组件 | iOS 版本 | Xcode 版本 | CocoaPods 版本 |
|------|----------|------------|----------------|
| EaseChatUIKit | 15.0+ | 16.0+ | 1.14.3+ |
| EaseCallUIKit | 15.0+ | 16.0+ | 1.14.3+ |
| EaseChatroomUIKit | 13.0+ | 15.0+ | 1.14.3+ |
| EaseIMKit | 13.0+ | 15.0+ | 1.14.3+ |

#### 已知问题诊断（10 个）

| 问题 | 优先级 | 触发关键词 |
|------|--------|------------|
| Podfile iOS 版本过低 | 🔴 Critical | `platform`, `deployment target` |
| rsync 沙盒错误 | 🔴 Critical | `rsync`, `sandbox`, `deny` |
| 权限配置缺失 | 🔴 Critical | `NSCameraUsageDescription`, `privacy` |
| 环信服务未开通 | 🔴 Critical | `appkey`, `RTC`, `service not enabled` |
| CocoaPods 版本问题 | 🟠 High | `PBXFileSystemSynchronizedRootGroup` |
| Xcode 版本兼容 | 🟠 High | `project format`, `cannot be opened` |
| Swift 版本不匹配 | 🟠 High | `SWIFT_VERSION`, `module compiled` |
| Framework 未找到 | 🟠 High | `framework not found`, `No such module` |
| 模拟器架构问题 | 🟡 Medium | `simulator`, `arm64`, `Rosetta` |
| Bitcode 问题 | 🟡 Medium | `ENABLE_BITCODE`, `bitcode` |

---

## 安装

```bash
npm install -g easeim-mcp-server
```

或本地开发：

```bash
cd easeim-mcp-server
npm install
npm run build
```

## 配置

### Claude Code / Claude Desktop

编辑 `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "easeim": {
      "command": "node",
      "args": ["/path/to/easeim-mcp-server/dist/index.js"]
    }
  }
}
```

### Cursor

创建 `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "easeim": {
      "command": "node",
      "args": ["/path/to/easeim-mcp-server/dist/index.js"]
    }
  }
}
```

## 使用示例

### 智能助手（推荐）

```
> 我想自定义一个订单消息

Claude: [调用 smart_assist]

🧠 智能助手分析
识别意图: 自定义消息类型 (置信度: 95%)
提取的关键信息: 消息类型: Order

## 实现步骤
1. 创建自定义 Cell 类继承 CustomMessageCell
2. 实现 createContent() 返回自定义视图
3. 在 ComponentsRegister 中注册
4. 创建并发送 ChatCustomMessageBody

## 完整代码
```swift
// OrderMessageCell.swift
class OrderMessageCell: CustomMessageCell {
    ...
}
```
```

### 构建错误诊断

```
> rsync.samba deny file-write-create 怎么解决

Claude: [调用 diagnose_build_error]

🛠️ 构建错误诊断
优先级: 🔴 critical
原因: Xcode 15 默认启用了脚本沙盒

解决方案:
1. Build Settings → User Script Sandboxing → NO
2. 或在 Podfile post_install 中添加:
   config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
```

### 集成检查

```
> 检查我的 Podfile 是否正确

Claude: [调用 check_integration]

🔍 EaseChatUIKit 集成配置检查

❌ 发现问题:
1. iOS 部署目标版本过低: 13.0，要求 15.0+
2. 缺少 use_frameworks! 声明

💡 优化建议:
1. 添加 IPHONEOS_DEPLOYMENT_TARGET = '15.0'
2. 添加 ENABLE_USER_SCRIPT_SANDBOXING = 'NO'
```

## 数据统计

### 文档索引
- API 模块: 49 个
- API 总数: 56 个
- 错误码: 99+ 个

### 源码索引
- 组件数: 3 个
- 源文件: 326 个
- 代码符号: 2605 个
  - 类: 56 个
  - 方法: 1644 个
  - 属性: 816 个

### 知识库
- 已知集成问题: 10 个
- 代码模板: 6+ 个
- 类信息: 20+ 个

## 项目结构

```text
easeim-mcp-server/
├── src/
│   ├── index.ts                    # 入口文件
│   ├── server.ts                   # MCP Server 实现
│   │
│   ├── search/                     # 搜索引擎
│   │   ├── index.ts                # 搜索模块导出
│   │   ├── DocSearch.ts            # 文档搜索（全量加载，向后兼容）
│   │   ├── ShardedDocSearch.ts     # 分片文档搜索（按平台，推荐）
│   │   ├── SourceSearch.ts         # 源码搜索（全量加载）
│   │   ├── ShardedSourceSearch.ts  # 分片源码搜索（按组件，推荐）
│   │   ├── ConfigSearch.ts         # 配置搜索（全量加载）
│   │   ├── ShardedConfigSearch.ts  # 分片配置搜索（按平台，推荐）
│   │   ├── InvertedIndex.ts        # 倒排索引实现
│   │   └── AmbiguityDetector.ts    # 歧义检测
│   │
│   ├── intelligence/               # 智能化模块
│   │   ├── IntentClassifier.ts     # 意图分类器
│   │   ├── QueryExpander.ts        # 查询扩展
│   │   ├── SpellCorrector.ts       # 拼写纠错器
│   │   ├── SearchSuggester.ts      # 搜索建议生成器
│   │   ├── KnowledgeGraph.ts       # 知识图谱
│   │   ├── CodeGenerator.ts        # 代码生成器
│   │   ├── SimilarityMatcher.ts    # 相似度匹配
│   │   ├── ContextManager.ts       # 上下文管理器（会话、连续性）
│   │   └── IntegrationGuide.ts     # 集成诊断知识库
│   │
│   ├── tools/                      # MCP Tools 定义
│   └── types/                      # 类型定义
│
├── data/
│   ├── docs/                       # 文档索引（按平台分片）
│   │   ├── manifest.json           # 文档清单
│   │   ├── index.json              # 完整索引（向后兼容）
│   │   └── shards/                 # 平台分片
│   │       ├── ios.json
│   │       ├── android.json
│   │       └── error-codes.json
│   ├── configs/                    # 配置索引（按平台分片）
│   │   ├── manifest.json           # 配置清单
│   │   ├── index.json              # 完整索引（向后兼容）
│   │   └── shards/
│   │       └── ios.json
│   └── sources/                    # 源码索引（按组件分片）
│       ├── manifest.json
│       └── shards/
│
├── scripts/                        # 索引生成脚本
│   ├── generate-docs-index.ts      # 文档索引生成
│   ├── generate-source-index.ts    # 源码索引生成
│   ├── generate-shards.ts          # 源码分片生成（按组件）
│   ├── generate-doc-shards.ts      # 文档分片生成（按平台）
│   └── generate-config-shards.ts   # 配置分片生成（按平台）
│
├── tests/                          # 测试文件
│   ├── benchmark-sharded-search.ts
│   ├── test-integration-guide.ts
│   ├── test-spell-corrector.ts     # 拼写纠错测试
│   └── test-search-suggester.ts    # 搜索建议测试
│
└── docs/
    └── TECHNICAL_OVERVIEW.md       # 技术文档
```

## 开发

### 生成索引

```bash
# 生成文档索引
npm run generate-docs-index

# 生成源码索引
npm run generate-source-index

# 生成源码分片索引（按组件）
npx tsx scripts/generate-shards.ts

# 生成文档分片索引（按平台）
npx tsx scripts/generate-doc-shards.ts

# 生成配置分片索引（按平台）
npx tsx scripts/generate-config-shards.ts

# 生成所有索引
npm run generate-all
```

### 添加新平台

当需要支持新平台（如 Flutter、Web、Unity）时：

**1. 文档索引**
```bash
# 1. 编辑 data/docs/index.json，添加新平台的 guides 和 apiModules
#    确保每个条目的 platform 字段设为正确的平台标识

# 2. 重新生成分片
npx tsx scripts/generate-doc-shards.ts
```

**2. 配置索引**
```bash
# 1. 编辑 data/configs/index.json，添加新平台组件
#    确保文件路径以平台名开头，如 "flutter/EaseChatUIKit/..."

# 2. 如需支持新平台名，编辑 scripts/generate-config-shards.ts:
#    if (['ios', 'android', 'flutter', 'web', 'unity'].includes(platform))

# 3. 重新生成分片
npx tsx scripts/generate-config-shards.ts
```

分片生成后，搜索引擎会自动识别新平台，无需修改代码。

### 运行测试

```bash
# 性能基准测试
npx tsx tests/benchmark-sharded-search.ts

# 集成诊断测试
npx tsx tests/test-integration-guide.ts

# 拼写纠错测试
npx tsx tests/test-spell-corrector.ts

# 搜索建议测试
npx tsx tests/test-search-suggester.ts
```

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run watch
```

## 许可

MIT
