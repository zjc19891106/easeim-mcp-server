# 查询类型分析：内部检索 vs 大模型

## 📊 查询场景分类

### 1. 精确定位类查询（✅ 当前系统完全能处理）

**特征：**
- 用户知道要找什么
- 可以用关键词精确描述
- 答案在源码中明确存在

**示例：**
```
❓ "sendMessage 方法在哪里？"
✅ 搜索 "sendMessage" → 返回所有包含该方法的文件和行号

❓ "MessageBubble 类的定义"
✅ 搜索 "MessageBubble" → 找到类定义位置

❓ "颜色相关的代码"
✅ 搜索 "color" → 返回所有颜色相关文件 + 歧义检测
```

**当前系统能力：**
- ✅ 精确搜索类名、方法名、属性名
- ✅ 关键词模糊搜索
- ✅ 跨组件歧义检测
- ✅ 读取源码文件内容
- ✅ 查看符号上下文

---

### 2. 配置项查询（⚠️ 需要增强）

**特征：**
- 用户想知道"有哪些选项"
- 需要从代码中提取元信息
- 答案分散在多个文件中

**示例查询：**

#### 2.1 基础配置项查询
```
❓ "EaseChatUIKit 有哪些可配置项？"

当前系统：
  搜索 "config" 或 "Appearance"
  → 返回 Appearance.swift 文件
  → 用户需要自己阅读源码提取属性

理想方案 A（预生成配置索引）：
  {
    "EaseChatUIKit": {
      "Appearance": {
        "avatarRadius": {
          "type": "CGFloat",
          "default": 4.0,
          "description": "头像圆角半径"
        },
        "bubbleColor": {
          "type": "UIColor",
          "description": "消息气泡颜色"
        }
      }
    }
  }
  → 新增 MCP Tool: list_config_options(component)
  → 直接返回结构化的配置项列表

理想方案 B（LLM 动态分析）：
  1. search_source("Appearance")
  2. read_source(Appearance.swift)
  3. LLM 分析代码，提取所有公开属性
  4. 格式化输出配置项列表
```

#### 2.2 主题配置查询
```
❓ "如何配置聊天界面的主题？"

当前系统：
  搜索 "theme" → 返回相关文件
  → 用户不知道具体步骤

需要的能力：
  1. 找到 ThemeManager 或 Appearance 类
  2. 理解其 API 设计
  3. 给出配置示例代码

  → 这需要 LLM 理解代码架构
```

---

### 3. "如何做"类查询（❌ 必须用 LLM）

**特征：**
- 用户想要实现某个功能
- 需要理解架构和流程
- 需要多步骤指导

**场景分析：**

#### 3.1 简单定制（LLM + 检索）
```
❓ "如何修改消息气泡的背景色？"

需要的步骤：
  1. 找到气泡相关代码
     → search_source("bubble")
     → read_source(MessageBubble.swift)

  2. LLM 理解代码，发现有两种方式：
     a) 直接修改 MessageBubble.backgroundColor
     b) 通过 Appearance.bubbleColor 配置

  3. LLM 给出答案：
     ```swift
     // 方式 1：全局配置
     Appearance.bubbleColor = .red

     // 方式 2：自定义 Cell
     class CustomBubble: MessageBubble {
         override func setupAppearance() {
             super.setupAppearance()
             backgroundColor = .red
         }
     }
     ```

流程：
  内部检索（定位代码）→ LLM（理解+指导）
```

#### 3.2 中等复杂（LLM 主导 + 多次检索）
```
❓ "如何给长按菜单增加一个自定义选项？"

需要的步骤：
  1. 理解菜单系统架构
     → search_source("menu")
     → search_source("long press")
     → read_source(MessageMenuController.swift)

  2. LLM 分析架构：
     - 发现使用代理模式
     - 找到 MenuDelegate 协议
     - 找到菜单项配置方法

  3. LLM 给出实施步骤：
     ```
     步骤 1：实现代理方法
     步骤 2：返回自定义菜单项
     步骤 3：处理菜单点击事件

     示例代码：
     ...
     ```

流程：
  LLM 驱动（需要多次调用 MCP Tools 检索代码）
```

#### 3.3 复杂功能扩展（必须 LLM）
```
❓ "如何新增一种自定义消息类型，并添加发送入口？"

这是一个复杂的功能开发任务，需要：

1. 理解消息系统架构
   - 消息数据模型（EMMessage）
   - 消息渲染层（MessageCell）
   - 消息发送逻辑（ChatManager）
   - 输入栏扩展点（InputBar）

2. 多个文件的协同修改
   - 定义新消息类型
   - 创建自定义 Cell
   - 注册 Cell
   - 添加发送入口
   - 实现发送逻辑

3. 给出完整的实施指南
   包含：架构说明、分步骤代码、注意事项

→ 这完全需要 LLM 的理解和生成能力
→ MCP Tools 只是 LLM 的"眼睛"（用来读取代码）
```

---

## 🏗️ 系统能力分层

```
┌─────────────────────────────────────────────────────────┐
│                     用户查询                             │
└─────────────────────────────────────────────────────────┘
                           ↓
                      意图识别
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                   ↓
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Layer 1:      │  │ Layer 2:      │  │ Layer 3:      │
│ 精确定位      │  │ 配置查询      │  │ "如何做"      │
│ (内部检索)    │  │ (增强索引)    │  │ (LLM 驱动)    │
└───────────────┘  └───────────────┘  └───────────────┘
        ↓                  ↓                   ↓
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ MCP Tools     │  │ MCP Tools     │  │ LLM + MCP     │
│ - search_api  │  │ + 新工具:     │  │ - 理解架构    │
│ - search_src  │  │ list_configs  │  │ - 多次检索    │
│ - read_src    │  │ get_component │  │ - 生成指南    │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## 💡 建议的优化方向

### 优先级 1：增强配置项索引（可预生成）

**新增索引：**
```json
// data/configs/index.json
{
  "EaseChatUIKit": {
    "Appearance": {
      "properties": [
        {
          "name": "avatarRadius",
          "type": "CGFloat",
          "default": 4.0,
          "description": "头像圆角半径",
          "file": "Appearance.swift",
          "line": 42
        }
      ]
    },
    "extensionPoints": [
      {
        "name": "自定义消息 Cell",
        "protocol": "MessageCell",
        "description": "实现自定义消息样式",
        "example": "CustomMessageCell.swift"
      }
    ]
  }
}
```

**新增 MCP Tools：**
```typescript
{
  name: "list_config_options",
  description: "列出组件的所有配置项",
  inputSchema: {
    component: "EaseChatUIKit | EaseCallUIKit | EaseChatroomUIKit"
  }
}

{
  name: "get_extension_points",
  description: "获取组件的扩展点说明",
  inputSchema: {
    component: string
  }
}
```

### 优先级 2：最佳实践文档

**新增文档：**
```
data/guides/
  ├── customization/
  │   ├── bubble-customization.md     # 如何自定义气泡
  │   ├── theme-customization.md      # 如何自定义主题
  │   └── menu-customization.md       # 如何自定义菜单
  ├── extending/
  │   ├── custom-message-type.md      # 如何新增消息类型
  │   ├── custom-input-item.md        # 如何新增输入项
  │   └── custom-cell.md              # 如何自定义 Cell
  └── architecture/
      ├── message-system.md            # 消息系统架构
      ├── theme-system.md              # 主题系统架构
      └── plugin-system.md             # 插件系统架构
```

**新增 MCP Tool：**
```typescript
{
  name: "get_guide",
  description: "获取特定主题的开发指南",
  inputSchema: {
    topic: "bubble-customization | custom-message-type | ..."
  }
}
```

### 优先级 3：LLM 集成增强

**让 LLM 能够：**
1. 理解用户的"如何做"意图
2. 自主调用多个 MCP Tools
3. 理解代码架构
4. 生成分步骤指南
5. 提供示例代码

**示例流程：**
```
用户："如何修改气泡颜色？"
  ↓
LLM 理解意图："UI 定制"
  ↓
LLM 自主检索：
  1. search_source("bubble")
  2. read_source(MessageBubble.swift)
  3. search_source("Appearance")
  4. read_source(Appearance.swift)
  ↓
LLM 理解代码，发现两种方式
  ↓
LLM 生成答案：
  "有两种方式修改气泡颜色：
   方式 1（推荐）：全局配置...
   方式 2：自定义 Cell..."
```

---

## 📊 当前系统的定位

```
┌────────────────────────────────────────────────────┐
│           EM Integration Assistant                  │
├────────────────────────────────────────────────────┤
│                                                     │
│  当前 = MCP Server（代码检索引擎）                  │
│  ✅ 精确定位类/方法/属性                            │
│  ✅ 关键词搜索                                      │
│  ✅ 歧义检测                                        │
│  ✅ 读取源码                                        │
│                                                     │
│  未来 = 智能助手                                    │
│  ⚠️  配置项索引                                     │
│  ⚠️  扩展点文档                                     │
│  ⚠️  最佳实践指南                                   │
│  ❌ "如何做"理解（需要 LLM）                        │
│  ❌ 架构理解（需要 LLM）                            │
│  ❌ 代码生成（需要 LLM）                            │
│                                                     │
└────────────────────────────────────────────────────┘
```

---

## 🎯 结论

### 当前系统（MCP Server）适合：
1. ✅ **"在哪里"查询**：类/方法/属性的位置
2. ✅ **"找代码"查询**：关键词搜索
3. ⚠️ **"有什么"查询**：需要增强配置索引

### 必须结合 LLM 才能处理：
1. ❌ **"如何做"查询**：需要理解和指导
2. ❌ **"为什么"查询**：需要理解架构
3. ❌ **复杂实施**：需要多步骤协同

### 建议：
**采用混合架构**

```
用户复杂查询
     ↓
  调用 LLM
     ↓
LLM 使用 MCP Tools（多次）
  - search_source
  - read_source
  - list_configs
  - get_guide
     ↓
LLM 理解 + 生成答案
     ↓
返回给用户
```

**这样才是真正的 "Integration Assistant"！**
