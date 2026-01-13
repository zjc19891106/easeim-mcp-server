# Claude Code 测试案例

## ✅ 配置已完成

配置文件位置: `~/.config/claude/claude_desktop_config.json`

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

---

## 🚀 开始测试

### 步骤 1: 重启 Claude Code

1. 完全退出 Claude Code（不是最小化，是完全退出）
2. 重新打开 Claude Code
3. 等待几秒让 MCP Server 连接

---

## 📝 测试案例

### 测试 1: 验证工具列表 ⭐ 基础测试

**输入**:
```
你好，请列出所有可用的 MCP 工具
```

**预期结果**:
- ✅ Claude 应该列出 9 个工具
- ✅ 包含: lookup_error, search_api, search_source, get_guide, diagnose, read_doc, read_source
- ✅ **重点**: 包含新工具: list_config_options, get_extension_points, get_config_usage

**成功标志**:
```
可用的工具包括：
1. lookup_error - 查询错误码
2. search_api - 搜索 API
3. search_source - 搜索源码
...
7. list_config_options - 列出配置项 ⭐
8. get_extension_points - 获取扩展点 ⭐
9. get_config_usage - 查询配置使用情况 ⭐
```

---

### 测试 2: list_config_options

**输入**:
```
请列出 EaseChatUIKit 的所有配置项
```

**预期工具调用**:
```
list_config_options(component: "EaseChatUIKit")
```

**预期结果**:
- ✅ 返回 10 个配置项
- ✅ 包含: pageContainerTitleBarItemWidth, alertStyle, primaryHue, secondaryHue, errorHue, neutralHue, neutralSpecialHue, avatarRadius, actionSheetRowHeight, avatarPlaceHolder
- ✅ 每个配置项显示类型、默认值、说明

**成功标志**:
```
EaseChatUIKit 共有 10 个配置项：

1. pageContainerTitleBarItemWidth
   - 类型: CGFloat
   - 默认值: (ScreenWidth-32)/2.0
   - 说明: ...

2. alertStyle
   - 类型: AlertStyle
   - 默认值: .large
   ...
```

---

### 测试 3: get_extension_points (协议)

**输入**:
```
EaseChatUIKit 有哪些可以实现的协议？
```

**预期工具调用**:
```
get_extension_points(component: "EaseChatUIKit", type: "protocol")
```

**预期结果**:
- ✅ 返回 18 个协议
- ✅ 包含 ChatUserProfileProtocol, ContactServiceProtocol 等
- ✅ 显示每个协议的方法列表

**成功标志**:
```
EaseChatUIKit 共有 18 个可实现的协议：

1. ChatUserProfileProtocol
   - 说明: Profile of the ChatUIKit display needed
   - 方法: toJsonObject
   - 位置: ...

2. ContactServiceProtocol
   - 方法: bindContactEventListener, unbindContactEventListener, ...
   ...
```

---

### 测试 4: get_extension_points (类)

**输入**:
```
EaseChatUIKit 有哪些可以继承的类？
```

**预期工具调用**:
```
get_extension_points(component: "EaseChatUIKit", type: "class")
```

**预期结果**:
- ✅ 返回 91 个可继承类
- ✅ 包含各种 Cell, View, Controller
- ✅ 显示类的位置

**成功标志**:
```
EaseChatUIKit 共有 91 个可继承的类，可以用来自定义 UI：

Cell 类：
- ChatHistoryCell
- MessageCell
- ForwardTargetCell
...

View 类：
- MessageListView
- ContactCardView
...
```

---

### 测试 5: get_config_usage (avatarRadius) ⭐⭐⭐ 核心测试

**输入**:
```
avatarRadius 这个配置项是做什么的？会影响哪些组件？
```

**预期工具调用**:
```
get_config_usage(propertyName: "avatarRadius")
```

**预期结果**:
- ✅ 📋 基本信息
  - 名称: avatarRadius
  - 类型: CornerRadius
  - 默认值: .extraSmall
  - 类别: Corner

- ✅ 🎯 影响概述
  - 使用次数: 33 处
  - 影响组件数: 25 个

- ✅ 🎨 影响的组件列表
  - Cell 组件: 14 个
  - View 组件: 8 个
  - Controller 组件: 2 个

- ✅ 📍 使用位置示例
  - 显示至少 3-5 个代码示例
  - 包含文件路径和代码上下文

- ✅ 💡 使用建议
  - 提供圆角配置的代码示例
  - 说明 .none, .extraSmall, .small, .medium, .large 的含义

**成功标志**:
```
avatarRadius 是一个圆角配置项，控制头像的圆角样式。

基本信息:
- 类型: CornerRadius
- 默认值: .extraSmall
- 使用次数: 33 处
- 影响 25 个组件

影响的组件包括:
- ChatHistoryCell (聊天历史中的头像)
- MessageCell (消息气泡中的头像)
- ContactCell (联系人列表头像)
...

使用示例:
```swift
Appearance.avatarRadius = .large  // 圆形头像
```

可选值:
- .none - 无圆角（方形）
- .extraSmall - 极小圆角
- .small - 小圆角
- .medium - 中等圆角
- .large - 大圆角（接近圆形）
```

---

### 测试 6: get_config_usage (primaryHue)

**输入**:
```
primaryHue 配置项的作用是什么？如何使用？
```

**预期工具调用**:
```
get_config_usage(propertyName: "primaryHue")
```

**预期结果**:
- ✅ 说明这是主色调配置
- ✅ 默认值 203/360.0（蓝色）
- ✅ 说明通过 ColorTheme 影响整个应用
- ✅ 提供修改示例代码

**成功标志**:
```
primaryHue 是主题色调配置项。

虽然直接使用只有 1 次，但通过 ColorTheme 类会生成 13 个相关颜色对象，影响整个应用的主题色。

影响的 UI 包括:
- 按钮强调色
- 导航栏标题颜色
- 选中状态图标颜色
...

使用示例:
```swift
Appearance.primaryHue = 120/360.0  // 绿色主题
```
```

---

### 测试 7: get_config_usage (avatarPlaceHolder)

**输入**:
```
如何自定义头像占位图？
```

**预期工具调用**:
```
get_config_usage(propertyName: "avatarPlaceHolder")
```

**预期结果**:
- ✅ 类型: UIImage?
- ✅ 影响 6 个组件
- ✅ 使用位置包含 MessageCell, ContactCardView 等
- ✅ 提供替换自定义图片的代码

**成功标志**:
```
avatarPlaceHolder 是头像占位图配置项。

影响的组件:
- MessageCell - 消息发送者头像
- ContactCardView - 联系人卡片
- GroupParticipantCell - 群成员头像
...

使用示例:
```swift
Appearance.avatarPlaceHolder = UIImage(named: "my_custom_avatar")
```
```

---

### 测试 8: 错误处理

**输入**:
```
查询一下 invalidName 配置项
```

**预期工具调用**:
```
get_config_usage(propertyName: "invalidName")
```

**预期结果**:
- ✅ 友好的错误提示
- ✅ 说明可能的原因
- ✅ 建议使用 list_config_options

**成功标志**:
```
未找到配置项 "invalidName" 的使用信息。

可能的原因：
1. 配置项名称拼写错误
2. 该配置项不存在
3. 尚未生成影响分析数据

建议使用 list_config_options 查看所有可用的配置项。
```

---

### 测试 9: 综合场景 ⭐⭐⭐ 实际应用测试

**输入**:
```
我想把所有头像改成圆形，并且把主题色改成绿色，应该怎么做？
```

**预期行为**:
1. Claude 会调用 `get_config_usage(propertyName: "avatarRadius")`
2. Claude 会调用 `get_config_usage(propertyName: "primaryHue")`
3. Claude 基于工具返回的信息，给出完整的配置方案

**预期结果**:
- ✅ 识别需要配置两个属性
- ✅ 调用两次 get_config_usage
- ✅ 整合信息，给出完整代码
- ✅ 说明配置时机

**成功标志**:
```
要实现你的需求，需要配置两个属性：

1. 头像圆形化 - avatarRadius
   [调用 get_config_usage 获取信息]

2. 主题色修改 - primaryHue
   [调用 get_config_usage 获取信息]

完整配置代码:
```swift
// 在 UIKit 初始化之前配置
func configureAppearance() {
    // 圆形头像
    Appearance.avatarRadius = .large

    // 绿色主题
    Appearance.primaryHue = 120/360.0
    Appearance.secondaryHue = 140/360.0
}

// 然后初始化 UIKit
ChatUIKitClient.shared.setup(appKey: "your_app_key")
```

这会影响:
- 25 个组件的头像显示
- 整个应用的主题色
```

---

### 测试 10: 查询所有组件的配置

**输入**:
```
请列出所有 UIKit 组件的配置项
```

**预期工具调用**:
```
list_config_options(component: "all")
```

**预期结果**:
- ✅ EaseChatUIKit: 10 个配置项
- ✅ EaseChatroomUIKit: 30 个配置项
- ✅ EaseCallUIKit: 0 个配置项

---

## 🎯 成功标准

### 基础功能 (必须全部通过)
- [ ] 测试 1: 工具列表显示 ✅
- [ ] 测试 2: list_config_options 工作 ✅
- [ ] 测试 3: get_extension_points (协议) 工作 ✅
- [ ] 测试 4: get_extension_points (类) 工作 ✅
- [ ] 测试 5: get_config_usage (avatarRadius) 工作 ✅
- [ ] 测试 8: 错误处理正确 ✅

### 高级功能 (建议测试)
- [ ] 测试 6: get_config_usage (primaryHue) 工作 ✅
- [ ] 测试 7: get_config_usage (avatarPlaceHolder) 工作 ✅
- [ ] 测试 9: 综合场景处理 ✅
- [ ] 测试 10: 查询所有组件 ✅

---

## 🐛 如果测试失败

### 1. Claude Code 没有调用工具

**检查**:
```bash
# 查看配置文件
cat ~/.config/claude/claude_desktop_config.json

# 确认路径正确
ls -l /Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server/dist/index.js
```

**解决**:
- 完全退出并重启 Claude Code
- 确认配置文件格式正确（JSON 语法）
- 确认路径没有空格或特殊字符

### 2. 工具调用失败

**检查**:
```bash
# 手动测试 Server
cd /Users/zhujichao_1/Desktop/zjc19891106/EMIntegrationAssistant/easeim-mcp-server
node dist/index.js
```

应该看到启动信息。

### 3. 返回数据为空

**检查数据文件**:
```bash
ls -lh data/configs/
```

应该看到:
- index.json (66K)
- impact-analysis.json (196K)

如果缺少，运行:
```bash
npx tsx scripts/analyze-config-impact.ts
npm run build
```

---

## 📚 参考文档

- `docs/CLAUDE_CODE_SETUP.md` - 详细配置指南
- `docs/GET_CONFIG_USAGE_GUIDE.md` - get_config_usage 使用指南
- `docs/CONFIG_IMPACT_ANALYSIS.md` - 配置项影响分析报告

---

## ✅ 测试完成后

如果所有测试通过，恭喜！你可以：

1. 在实际开发中使用这些工具
2. 询问任何关于环信 UIKit 配置的问题
3. 让 Claude 帮你生成配置代码
4. 结合 search_source, read_source 深入了解实现

祝你使用愉快！🎉
