# Claude Code 配置和测试指南

## 📋 前置准备

### 1. 确认 MCP Server 已构建

```bash
cd /Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server
npm run build
```

### 2. 测试 Server 是否能正常启动

```bash
node dist/index.js
```

如果看到以下输出，说明启动成功：
```
🚀 环信 IM SDK MCP Server 已启动
📚 文档索引已加载
📦 源码索引已加载
⚙️  配置索引已加载
✨ 准备就绪，等待请求...
```

按 `Ctrl+C` 退出。

---

## ⚙️ 配置 Claude Code

### 方法 1：修改配置文件（推荐）

1. **打开 Claude Code 配置文件**

```bash
# macOS
code ~/.config/claude/claude_desktop_config.json

# 或者直接编辑
nano ~/.config/claude/claude_desktop_config.json
```

2. **添加 MCP Server 配置**

```json
{
  "mcpServers": {
    "easeim": {
      "command": "node",
      "args": [
        "/Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server/dist/index.js"
      ]
    }
  }
}
```

**注意**: 如果文件中已经有其他 MCP Server，保留它们：

```json
{
  "mcpServers": {
    "other-server": {
      "command": "..."
    },
    "easeim": {
      "command": "node",
      "args": [
        "/Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server/dist/index.js"
      ]
    }
  }
}
```

3. **重启 Claude Code**

```bash
# 完全退出 Claude Code，然后重新启动
```

### 方法 2：使用 npm link（开发推荐）

如果你想更方便地管理，可以使用 npm link：

```bash
# 1. 在项目目录下创建全局链接
cd /Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server
npm link

# 2. 配置文件中使用命令名
```

然后配置文件改为：
```json
{
  "mcpServers": {
    "easeim": {
      "command": "easeim-mcp-server"
    }
  }
}
```

---

## 🧪 测试 MCP 工具

### 测试 1：验证 Server 连接

在 Claude Code 中输入：

```
你好，请列出所有可用的 MCP 工具
```

**预期输出**: 应该看到包含以下工具：
- lookup_error
- search_api
- search_source
- get_guide
- diagnose
- read_doc
- read_source
- list_config_options ⭐
- get_extension_points ⭐
- get_config_usage ⭐ NEW

---

### 测试 2：list_config_options

**测试所有配置项**:
```
请列出 EaseChatUIKit 的所有配置项
```

**Claude Code 会调用**:
```
list_config_options(component: "EaseChatUIKit")
```

**预期输出**:
- 10 个配置项
- 包含 avatarRadius, primaryHue, alertStyle 等
- 每个配置项显示类型、默认值、说明

---

### 测试 3：get_extension_points

**测试协议列表**:
```
请列出 EaseChatUIKit 有哪些可以实现的协议？
```

**Claude Code 会调用**:
```
get_extension_points(component: "EaseChatUIKit", type: "protocol")
```

**预期输出**:
- 18 个协议
- 包含 ChatUserProfileProtocol, ContactServiceProtocol 等
- 显示协议的方法列表

**测试可继承类**:
```
EaseChatUIKit 有哪些可以继承的类？
```

**Claude Code 会调用**:
```
get_extension_points(component: "EaseChatUIKit", type: "class")
```

**预期输出**:
- 91 个可继承类
- 包含各种 Cell, View, Controller

---

### 测试 4：get_config_usage ⭐ NEW

**测试配置项详情**:
```
avatarRadius 这个配置项是做什么的？会影响哪些组件？
```

**Claude Code 会调用**:
```
get_config_usage(propertyName: "avatarRadius")
```

**预期输出**:
- 📋 基本信息（类型、默认值、类别）
- 🎯 影响概述（使用 33 次，影响 25 个组件）
- 🎨 影响的组件列表（按类型分组）
- 📍 使用位置示例（最多 5 个）
- 💡 使用建议（如何配置圆角）

**测试颜色配置**:
```
primaryHue 配置项的作用是什么？如何使用？
```

**Claude Code 会调用**:
```
get_config_usage(propertyName: "primaryHue")
```

**预期输出**:
- 说明这是主色调配置
- 默认值 203/360.0（蓝色）
- 影响整个应用的主题色
- 提供修改示例代码

**测试图片配置**:
```
如何修改头像的占位图？
```

**Claude Code 会调用**:
```
get_config_usage(propertyName: "avatarPlaceHolder")
```

**预期输出**:
- 类型：UIImage?
- 影响 6 个组件
- 使用位置示例
- 替换自定义图片的代码

**测试不存在的配置项**:
```
查询一下 invalidName 配置项
```

**Claude Code 会调用**:
```
get_config_usage(propertyName: "invalidName")
```

**预期输出**:
- 友好的错误提示
- 建议使用 list_config_options 查看所有配置项

---

## 🔍 综合测试场景

### 场景 1：自定义头像圆角

**对话流程**:

```
你: 我想让所有头像都是圆形的，应该怎么做？

Claude: [调用 get_config_usage(propertyName: "avatarRadius")]

根据查询结果，avatarRadius 配置项控制头像的圆角：
- 当前默认值：.extraSmall（小圆角）
- 影响 25 个组件，包括所有消息、联系人、会话列表的头像
- 使用次数：33 处

要实现圆形头像，可以这样配置：

```swift
// 在 UIKit 初始化之前设置
Appearance.avatarRadius = .large  // 大圆角（接近圆形）
```

你: 能具体告诉我这会影响哪些界面吗？

Claude: [已经从 get_config_usage 的结果中获取]

这个配置会影响以下界面：

Cell 组件（14个）：
- ChatHistoryCell - 聊天历史
- MessageCell - 消息气泡
- ContactCell - 联系人列表
- ConversationListCell - 会话列表
... 等

View 组件（8个）：
- ContactCardView - 联系人卡片
- MessageInputEmojiView - 输入框
... 等

基本上所有显示头像的地方都会变成圆形。
```

---

### 场景 2：修改主题色

**对话流程**:

```
你: 我想把应用的主题色改成绿色

Claude: [调用 get_config_usage(propertyName: "primaryHue")]

要修改主题色，需要配置 primaryHue：

当前默认值：203/360.0（蓝色系）

修改为绿色：
```swift
Appearance.primaryHue = 120/360.0  // 绿色
```

这个配置虽然直接使用只有 1 次，但通过 ColorTheme 类会生成 13 个相关颜色对象，影响整个应用的主题色，包括：
- 按钮强调色
- 导航栏标题颜色
- 选中状态图标颜色
- 链接文本颜色
- 进度指示器颜色

你: 还需要配置其他颜色吗？

Claude: 建议同时配置辅助色：

```swift
Appearance.primaryHue = 120/360.0      // 主色：绿色
Appearance.secondaryHue = 140/360.0    // 辅助色：青绿
Appearance.errorHue = 350/360.0        // 错误色：红色（保持不变）
```
```

---

### 场景 3：查看所有配置项并逐个了解

**对话流程**:

```
你: 请列出 EaseChatroomUIKit 的所有配置项

Claude: [调用 list_config_options(component: "EaseChatroomUIKit")]

EaseChatroomUIKit 共有 30 个配置项：

[显示配置项列表...]

你: messageDisplayStyle 这个配置项是做什么的？

Claude: [调用 get_config_usage(propertyName: "messageDisplayStyle")]

messageDisplayStyle 控制聊天区域的消息显示样式：
- 类型：ChatMessageDisplayContentStyle
- 使用次数：4 处
- 影响 3 个组件

[显示详细信息和代码示例...]

你: 那 giftAreaRowHeight 呢？

Claude: [调用 get_config_usage(propertyName: "giftAreaRowHeight")]

giftAreaRowHeight 控制礼物区域的行高：
- 类型：CGFloat
- 使用次数：6 处
- 用于礼物选择列表

[显示详细信息...]
```

---

## 🐛 常见问题排查

### 问题 1：Claude Code 没有显示工具调用

**现象**: 问问题后，Claude 没有调用 MCP 工具

**排查步骤**:

1. **检查配置文件**
```bash
cat ~/.config/claude/claude_desktop_config.json
```

确认配置正确，路径无误。

2. **检查 Server 日志**

配置文件中添加日志输出：
```json
{
  "mcpServers": {
    "easeim": {
      "command": "node",
      "args": [
        "/Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

3. **手动测试 Server**
```bash
cd /Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server
node dist/index.js
```

应该看到启动信息。

4. **完全重启 Claude Code**
```bash
# macOS: 完全退出应用
# 然后重新打开
```

---

### 问题 2：工具调用失败

**现象**: 看到工具调用，但返回错误

**检查**:

1. **确认数据文件存在**
```bash
ls -la /Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server/data/configs/
```

应该看到：
- index.json
- impact-analysis.json

2. **如果缺少 impact-analysis.json，重新生成**
```bash
npx tsx scripts/analyze-config-impact.ts
```

3. **重新构建**
```bash
npm run build
```

---

### 问题 3：返回数据不完整

**现象**: 工具返回的信息很少或为空

**可能原因**:
- 配置项名称拼写错误
- 数据未生成

**解决方法**:

1. **查看所有配置项**
```
请列出所有组件的配置项
```

2. **使用正确的名称**
```
get_config_usage(propertyName: "avatarRadius")  ✅
get_config_usage(propertyName: "avatar_radius") ❌
```

---

## 📊 验证清单

测试完成后，确认以下功能正常：

- [ ] Claude Code 能连接到 MCP Server
- [ ] `list_config_options` 返回配置项列表
- [ ] `get_extension_points` 返回扩展点
- [ ] `get_config_usage` 返回详细信息
  - [ ] 基本信息正确
  - [ ] 影响组件列表正确
  - [ ] 代码示例正确
  - [ ] 使用建议正确
- [ ] 错误处理正常（测试不存在的配置项）
- [ ] 所有三个新工具都能正常工作

---

## 🎯 快速测试命令

复制以下命令在 Claude Code 中测试：

```
# 测试 1：列出配置项
请列出 EaseChatUIKit 的所有配置项

# 测试 2：查看协议
EaseChatUIKit 有哪些可实现的协议？

# 测试 3：查看可继承类
EaseChatUIKit 有哪些可继承的类？

# 测试 4：查询 avatarRadius
avatarRadius 配置项是做什么的？影响哪些组件？

# 测试 5：查询 primaryHue
primaryHue 如何使用？会影响什么？

# 测试 6：查询 avatarPlaceHolder
如何自定义头像占位图？

# 测试 7：错误处理
查询 invalidName 配置项

# 测试 8：综合场景
我想把所有头像改成圆形，并且修改主题色为绿色，应该怎么做？
```

---

## 🎉 成功标志

如果看到以下内容，说明配置成功：

1. ✅ Claude Code 能识别并调用 MCP 工具
2. ✅ 工具返回结构化的 Markdown 格式信息
3. ✅ 包含代码示例和使用建议
4. ✅ Claude 能基于工具返回的信息回答问题

---

## 📚 下一步

配置成功后，你可以：

1. 在实际开发中使用这些工具
2. 询问任何关于环信 UIKit 配置的问题
3. 让 Claude 帮你生成配置代码
4. 结合其他工具（search_source, read_source）深入了解实现细节
