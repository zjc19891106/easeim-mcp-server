# 安装方案


## 方案 1: GitHub 直接安装 (最快)

`npm install -g github:zjc19891106/easeim-mcp-server`

或指定分支/tag

`npm install -g github:zjc19891106/easeim-mcp-server#v1.0.0`


---
## 方案 2: 手动配置路径 (零发布)

用户克隆repo或者下载源码
git clone https://github.com/zjc19891106/easeim-mcp-server
cd easeim-mcp-server/EMIntegrationAssistant/easeim-mcp-server/ && npm install && npm run build

## 配置 Claude（使用绝对路径）
```Json
{
  "mcpServers": {
    "easeim":{
      "command": "node",
      "args": ["/Path/easeim-mcp-server/EMIntegrationAssistant/easeim-mcp-server/dist/index.js"]
    }
  }
}
```

# 功能概览

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
│  │  BM25 评分 • 倒排索引 • LRU 缓存 • 歧义检测 • 上下文感知   │ │
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

# 精准度保障

- 最小相关性阈值：低于阈值直接视为未命中
- 歧义强制澄清：平台/层级/组件歧义不直接输出结果
- 证据绑定输出：API 文档路径、源码行号或错误码索引可追溯
