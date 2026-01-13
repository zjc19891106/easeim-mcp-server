# EM Integration Assistant

## 项目概述

环信 IM SDK 开发助手，包含两个核心组件：

1. **MCP Server** - 提供文档查询和源码搜索能力，可被多种 AI 客户端调用
2. **VS Code Extension** - 完整的 IDE 集成，支持编译、诊断、AI 对话

```
┌─────────────────────────────────────────────────────────────────┐
│                      EM Integration Assistant                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              MCP Server（核心能力）                       │  │
│   │                                                         │  │
│   │   • 文档搜索（闭源 SDK）                                 │  │
│   │   • 源码搜索（开源 UIKit）                               │  │
│   │   • 错误码查询                                           │  │
│   │   • 问题诊断                                             │  │
│   │                                                         │  │
│   │   支持：Xcode+Copilot / Claude Code / Cursor / VS Code  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ 调用                             │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              VS Code Extension（IDE 集成）               │  │
│   │                                                         │  │
│   │   • 调用 xcodebuild 编译 (调用前检测用户是否安装Xcode，如果没有安装做出提示)                               │  │
│   │   • 解析并显示编译错误                                   │  │
│   │   • 在搜索文档中常见错误无果后AI 驱动的错误诊断                                    │  │
│   │   • 快速修复建议（分为常见错误中已有以及没有，没有则交给AI）                                         │  │
│   │   • 侧边栏交互面板                                       │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 环信 SDK 体系

```
┌─────────────────────────────────────────────────────────────────┐
│                      环信 IM SDK 体系                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    UI 层（开源）                          │  │
│   │                                                         │  │
│   │   EaseChatUIKit        聊天界面组件                      │  │
│   │   EaseCallKit          音视频通话 UI                     │  │
│   │   EaseChatroomUIKit    聊天室/直播间 UI                  │  │
│   │   EaseIMKit            IM 综合 UI 组件                   │  │
│   │                                                         │  │
│   │   → 查源码：UI 定制、界面修改、主题、布局                  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ 调用                             │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   SDK 层（闭源）                          │  │
│   │                                                         │  │
│   │   HyphenateChat        IM 核心 SDK                       │  │
│   │                                                         │  │
│   │   → 查文档：API 用法、参数说明、错误码、功能介绍           │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# Part 1: MCP Server

## 技术栈

- **语言**: TypeScript
- **运行时**: Node.js >= 18
- **协议**: MCP (Model Context Protocol)
- **SDK**: @modelcontextprotocol/sdk
- **分发**: npm / Homebrew

## 支持的客户端

| 客户端 | 支持方式 |
|--------|---------|
| Xcode + GitHub Copilot | MCP 协议 |
| Claude Code (CLI) | MCP 协议 |
| Claude Desktop | MCP 协议 |
| Cursor | MCP 协议 |
| VS Code + Continue | MCP 协议 |
| EaseIM VS Code Extension | 直接调用 |

## 项目结构

```
easeim-mcp-server/
├── src/
│   ├── index.ts                    # MCP Server 入口
│   ├── server.ts                   # Server 实现
│   │
│   ├── tools/                      # MCP Tools
│   │   ├── index.ts                # Tools 注册
│   │   ├── lookupError.ts          # 错误码查询
│   │   ├── searchApi.ts            # API 搜索
│   │   ├── searchSource.ts         # 源码搜索
│   │   ├── getGuide.ts             # 获取指南
│   │   └── diagnose.ts             # 问题诊断
│   │
│   ├── search/                     # 搜索引擎
│   │   ├── DocSearch.ts            # 文档搜索
│   │   ├── SourceSearch.ts         # 源码搜索
│   │   └── IndexLoader.ts          # 索引加载
│   │
│   └── types/
│       └── index.ts
│
├── data/                           # 打包的数据 (~3.5MB)
│   ├── docs/                       # 闭源 SDK 文档 (~500KB)
│   │   ├── index.json
│   │   └── modules/*.md
│   │
│   └── sources/                    # 开源 UIKit 源码 (~3MB)
│       ├── index.json
│       ├── EaseChatUIKit/
│       ├── EaseCallKit/
│       ├── EaseChatroomUIKit/
│       └── EaseIMKit/
│
├── scripts/
│   ├── bundle-sources.sh
│   ├── generate-index.ts
│   └── update-docs.sh
│
├── package.json
├── tsconfig.json
└── README.md
```

## MCP Tools

### 1. lookup_error

```typescript
{
  name: "lookup_error",
  description: "查询环信 IM SDK 错误码的含义、原因和解决方案",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "number", description: "错误码数字，如 508" }
    },
    required: ["code"]
  }
}
```

### 2. search_api

```typescript
{
  name: "search_api",
  description: "搜索环信 IM SDK 的 API 文档",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "API 名称或关键词" }
    },
    required: ["query"]
  }
}
```

### 3. search_source

```typescript
{
  name: "search_source",
  description: "搜索环信开源 UIKit 组件的源码，用于 UI 定制",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索关键词" },
      component: {
        type: "string",
        enum: ["EaseChatUIKit", "EaseCallKit", "EaseChatroomUIKit", "EaseIMKit", "all"],
        default: "all"
      }
    },
    required: ["query"]
  }
}
```

### 4. get_guide

```typescript
{
  name: "get_guide",
  description: "获取环信 IM SDK 的集成指南和最佳实践",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        enum: ["quickstart", "login", "message", "group", "chatroom", "push", "migration"]
      }
    },
    required: ["topic"]
  }
}
```

### 5. diagnose

```typescript
{
  name: "diagnose",
  description: "根据问题症状诊断可能的原因",
  inputSchema: {
    type: "object",
    properties: {
      symptom: { type: "string", description: "问题症状描述" }
    },
    required: ["symptom"]
  }
}
```

## 数据格式

### 文档索引 - `data/docs/index.json`

```json
{
  "version": "4.0.0",
  "sdkName": "HyphenateChat",
  "lastUpdated": "2025-01-09",

  "modules": [
    {
      "id": "message",
      "name": "消息",
      "description": "消息收发、消息类型、已读回执、撤回",
      "keywords": ["消息", "message", "发送", "send", "接收", "撤回"],
      "docPath": "modules/message.md",
      "apis": ["sendMessage", "resendMessage", "recallMessage"],
      "errorCodes": [500, 501, 502, 503, 504, 505, 506, 507, 508]
    }
  ],

  "apiIndex": {
    "sendMessage": { "module": "message", "description": "发送消息" }
  },

  "errorCodeIndex": {
    "508": {
      "module": "message",
      "name": "MESSAGE_BLOCKED",
      "brief": "消息被拦截，用户被拉黑"
    }
  }
}
```

### 源码索引 - `data/sources/index.json`

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-01-09",

  "components": {
    "EaseChatUIKit": {
      "repo": "easemob/chatuikit-ios",
      "version": "1.2.0",
      "description": "聊天界面 UI 组件"
    }
  },

  "files": [
    {
      "path": "EaseChatUIKit/MessageBubble.swift",
      "component": "EaseChatUIKit",
      "classes": ["MessageBubbleView"],
      "keywords": ["气泡", "bubble", "背景色"],
      "description": "消息气泡视图"
    }
  ],

  "symbols": [
    {
      "name": "bubbleColor",
      "type": "property",
      "file": "EaseChatUIKit/MessageBubble.swift",
      "line": 45,
      "signature": "public var bubbleColor: UIColor"
    }
  ]
}
```

## 安装和使用

### 安装

```bash
# npm
npm install -g easeim-mcp-server

# Homebrew
brew install easeim-mcp-server
```

### 配置客户端

**Claude Code / Claude Desktop**

```json
// ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    "easeim": {
      "command": "easeim-mcp-server"
    }
  }
}
```

**Cursor**

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "easeim": {
      "command": "easeim-mcp-server"
    }
  }
}
```

**GitHub Copilot for Xcode**

在 Copilot 设置中添加 MCP Server。

---

# Part 2: VS Code Extension

## 技术栈

- **语言**: TypeScript
- **框架**: VS Code Extension API
- **UI**: WebView (React)
- **AI**: Claude API
- **构建**: xcodebuild

## 项目结构

```
easeim-vscode/
├── src/
│   ├── extension.ts                # 插件入口
│   │
│   ├── commands/                   # 命令
│   │   ├── build.ts               # 编译命令
│   │   ├── diagnose.ts            # 诊断命令
│   │   ├── searchDocs.ts          # 搜索文档
│   │   └── askAssistant.ts        # AI 对话
│   │
│   ├── providers/                  # VS Code Providers
│   │   ├── DiagnosticsProvider.ts # 编译错误显示
│   │   ├── CodeActionsProvider.ts # 快速修复
│   │   ├── HoverProvider.ts       # 悬浮提示
│   │   └── CompletionProvider.ts  # 代码补全
│   │
│   ├── build/                      # 构建相关
│   │   ├── XcodeBuild.ts          # xcodebuild 封装
│   │   ├── BuildParser.ts         # 解析编译输出
│   │   └── ProjectDetector.ts     # 项目检测
│   │
│   ├── ai/                         # AI 集成
│   │   ├── ClaudeClient.ts        # Claude API
│   │   ├── MCPClient.ts           # MCP Server 客户端
│   │   └── Prompts.ts             # 提示词模板
│   │
│   ├── views/                      # UI 视图
│   │   ├── SidebarProvider.ts     # 侧边栏
│   │   └── webview/               # WebView React 应用
│   │       ├── App.tsx
│   │       ├── ChatPanel.tsx
│   │       ├── BuildPanel.tsx
│   │       └── DocsPanel.tsx
│   │
│   └── utils/
│       └── logger.ts
│
├── data/                           # 同 MCP Server
│   ├── docs/
│   └── sources/
│
├── package.json                    # 插件清单
├── tsconfig.json
└── README.md
```

## 核心功能

### 1. 编译项目并获取错误

```typescript
// src/build/XcodeBuild.ts
import * as vscode from 'vscode';
import { exec } from 'child_process';

interface BuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  code?: number;  // 环信错误码（如果有）
}

interface BuildResult {
  success: boolean;
  errors: BuildError[];
  warnings: BuildError[];
  duration: number;
}

export class XcodeBuild {
  
  async build(projectPath: string, scheme: string): Promise<BuildResult> {
    const startTime = Date.now();
    
    const command = this.buildCommand(projectPath, scheme);
    
    return new Promise((resolve) => {
      exec(command, { 
        maxBuffer: 10 * 1024 * 1024,
        cwd: path.dirname(projectPath)
      }, (error, stdout, stderr) => {
        const errors = this.parseErrors(stdout + stderr);
        const warnings = this.parseWarnings(stdout + stderr);
        
        resolve({
          success: !error && errors.length === 0,
          errors,
          warnings,
          duration: Date.now() - startTime
        });
      });
    });
  }
  
  private buildCommand(projectPath: string, scheme: string): string {
    const ext = path.extname(projectPath);
    
    if (ext === '.xcworkspace') {
      return `xcodebuild -workspace "${projectPath}" -scheme "${scheme}" build 2>&1`;
    } else {
      return `xcodebuild -project "${projectPath}" -scheme "${scheme}" build 2>&1`;
    }
  }
  
  private parseErrors(output: string): BuildError[] {
    const errors: BuildError[] = [];
    
    // Swift 编译错误
    // /path/file.swift:42:10: error: message
    const swiftRegex = /(.+\.swift):(\d+):(\d+): error: (.+)/g;
    let match;
    
    while ((match = swiftRegex.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        message: match[4],
        code: this.extractEaseIMErrorCode(match[4])
      });
    }
    
    return errors;
  }
  
  private extractEaseIMErrorCode(message: string): number | undefined {
    // 尝试从错误信息中提取环信错误码
    const codeMatch = message.match(/error code[:\s]*(\d+)/i);
    if (codeMatch) {
      return parseInt(codeMatch[1]);
    }
    return undefined;
  }
  
  async getSchemes(projectPath: string): Promise<string[]> {
    return new Promise((resolve) => {
      exec(`xcodebuild -list -project "${projectPath}" -json`, (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        
        try {
          const data = JSON.parse(stdout);
          resolve(data.project?.schemes || []);
        } catch {
          resolve([]);
        }
      });
    });
  }
}
```

### 2. 在编辑器中显示错误

```typescript
// src/providers/DiagnosticsProvider.ts
import * as vscode from 'vscode';
import { BuildError } from '../build/XcodeBuild';
import { MCPClient } from '../ai/MCPClient';

export class DiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private mcpClient: MCPClient;
  
  constructor(mcpClient: MCPClient) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('easeim');
    this.mcpClient = mcpClient;
  }
  
  async showBuildErrors(errors: BuildError[]) {
    // 清除旧的诊断
    this.diagnosticCollection.clear();
    
    // 按文件分组
    const errorsByFile = this.groupByFile(errors);
    
    for (const [filePath, fileErrors] of errorsByFile) {
      const uri = vscode.Uri.file(filePath);
      const diagnostics: vscode.Diagnostic[] = [];
      
      for (const error of fileErrors) {
        const range = new vscode.Range(
          error.line - 1, 
          error.column - 1, 
          error.line - 1, 
          1000
        );
        
        const diagnostic = new vscode.Diagnostic(
          range,
          error.message,
          vscode.DiagnosticSeverity.Error
        );
        
        diagnostic.source = 'EaseIM';
        
        // 如果是环信错误码，添加额外信息
        if (error.code) {
          const errorInfo = await this.mcpClient.lookupError(error.code);
          if (errorInfo) {
            diagnostic.message = `[${error.code}] ${error.message}\n\n${errorInfo.description}`;
          }
        }
        
        diagnostics.push(diagnostic);
      }
      
      this.diagnosticCollection.set(uri, diagnostics);
    }
  }
  
  private groupByFile(errors: BuildError[]): Map<string, BuildError[]> {
    const map = new Map<string, BuildError[]>();
    
    for (const error of errors) {
      const existing = map.get(error.file) || [];
      existing.push(error);
      map.set(error.file, existing);
    }
    
    return map;
  }
}
```

### 3. AI 驱动的错误诊断

```typescript
// src/commands/diagnose.ts
import * as vscode from 'vscode';
import { ClaudeClient } from '../ai/ClaudeClient';
import { MCPClient } from '../ai/MCPClient';

export async function diagnoseError(
  error: BuildError,
  claudeClient: ClaudeClient,
  mcpClient: MCPClient
) {
  // 1. 读取错误所在的代码
  const document = await vscode.workspace.openTextDocument(error.file);
  const codeContext = getCodeContext(document, error.line, 15);
  
  // 2. 如果是环信错误码，先查文档
  let docContext = '';
  if (error.code) {
    const errorInfo = await mcpClient.lookupError(error.code);
    if (errorInfo) {
      docContext = `
环信错误码 ${error.code}:
- 名称: ${errorInfo.name}
- 描述: ${errorInfo.description}
- 可能原因: ${errorInfo.causes.join(', ')}
- 解决方案: ${errorInfo.solutions.join(', ')}
`;
    }
  }
  
  // 3. 调用 Claude 诊断
  const prompt = `
你是环信 IM SDK 专家。请分析以下编译错误并提供解决方案。

## 编译错误
文件: ${error.file}
行号: ${error.line}
错误: ${error.message}

## 相关代码
\`\`\`swift
${codeContext}
\`\`\`

${docContext ? `## 环信文档参考\n${docContext}` : ''}

请提供：
1. 错误原因分析
2. 具体的修复代码
3. 相关的最佳实践建议
`;

  const response = await claudeClient.chat(prompt);
  
  // 4. 显示诊断结果
  showDiagnosisPanel(error, response);
  
  // 5. 如果有代码修复建议，提供快速修复
  const fixCode = extractCodeFix(response);
  if (fixCode) {
    offerQuickFix(document, error, fixCode);
  }
}

function getCodeContext(document: vscode.TextDocument, line: number, contextLines: number): string {
  const startLine = Math.max(0, line - contextLines - 1);
  const endLine = Math.min(document.lineCount, line + contextLines);
  
  const lines: string[] = [];
  for (let i = startLine; i < endLine; i++) {
    const lineText = document.lineAt(i).text;
    const marker = i === line - 1 ? '>>> ' : '    ';
    lines.push(`${marker}${i + 1}: ${lineText}`);
  }
  
  return lines.join('\n');
}
```

### 4. 快速修复

```typescript
// src/providers/CodeActionsProvider.ts
import * as vscode from 'vscode';

export class EaseIMCodeActionsProvider implements vscode.CodeActionProvider {
  
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'EaseIM') continue;
      
      // 诊断此错误
      const diagnoseAction = new vscode.CodeAction(
        '🔍 诊断此错误',
        vscode.CodeActionKind.QuickFix
      );
      diagnoseAction.command = {
        command: 'easeim.diagnoseError',
        title: '诊断错误',
        arguments: [diagnostic]
      };
      actions.push(diagnoseAction);
      
      // 查看环信文档
      const errorCode = this.extractErrorCode(diagnostic.message);
      if (errorCode) {
        const docAction = new vscode.CodeAction(
          `📖 查看错误码 ${errorCode} 的文档`,
          vscode.CodeActionKind.QuickFix
        );
        docAction.command = {
          command: 'easeim.lookupError',
          title: '查看文档',
          arguments: [errorCode]
        };
        actions.push(docAction);
      }
    }
    
    return actions;
  }
  
  private extractErrorCode(message: string): number | undefined {
    const match = message.match(/\[(\d+)\]/);
    return match ? parseInt(match[1]) : undefined;
  }
}
```

### 5. 侧边栏面板

```typescript
// src/views/SidebarProvider.ts
import * as vscode from 'vscode';
import { XcodeBuild } from '../build/XcodeBuild';
import { MCPClient } from '../ai/MCPClient';
import { ClaudeClient } from '../ai/ClaudeClient';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private xcodeBuild: XcodeBuild;
  private mcpClient: MCPClient;
  private claudeClient: ClaudeClient;
  
  constructor(
    private readonly extensionUri: vscode.Uri,
    xcodeBuild: XcodeBuild,
    mcpClient: MCPClient,
    claudeClient: ClaudeClient
  ) {
    this.xcodeBuild = xcodeBuild;
    this.mcpClient = mcpClient;
    this.claudeClient = claudeClient;
  }
  
  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    
    webviewView.webview.html = this.getHtml(webviewView.webview);
    
    // 处理来自 WebView 的消息
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'build':
          await this.handleBuild(webviewView.webview, message);
          break;
          
        case 'chat':
          await this.handleChat(webviewView.webview, message);
          break;
          
        case 'searchDocs':
          await this.handleSearchDocs(webviewView.webview, message);
          break;
          
        case 'lookupError':
          await this.handleLookupError(webviewView.webview, message);
          break;
      }
    });
  }
  
  private async handleBuild(webview: vscode.Webview, message: any) {
    webview.postMessage({ type: 'buildStarted' });
    
    const result = await this.xcodeBuild.build(
      message.projectPath,
      message.scheme
    );
    
    webview.postMessage({ 
      type: 'buildResult', 
      data: result 
    });
  }
  
  private async handleChat(webview: vscode.Webview, message: any) {
    const response = await this.claudeClient.chat(message.question);
    
    webview.postMessage({
      type: 'chatResponse',
      data: response
    });
  }
  
  private async handleSearchDocs(webview: vscode.Webview, message: any) {
    const results = await this.mcpClient.searchApi(message.query);
    
    webview.postMessage({
      type: 'docsResult',
      data: results
    });
  }
  
  private async handleLookupError(webview: vscode.Webview, message: any) {
    const result = await this.mcpClient.lookupError(message.code);
    
    webview.postMessage({
      type: 'errorResult',
      data: result
    });
  }
  
  private getHtml(webview: vscode.Webview): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EM Integration Assistant</title>
  <style>
    :root {
      --bg-color: var(--vscode-editor-background);
      --text-color: var(--vscode-editor-foreground);
      --border-color: var(--vscode-panel-border);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
    }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--text-color);
      background: var(--bg-color);
      padding: 12px;
      margin: 0;
    }
    
    .panel {
      margin-bottom: 16px;
    }
    
    .panel-title {
      font-weight: bold;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .search-box {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .search-box input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      background: var(--input-bg);
      color: var(--input-fg);
      border-radius: 4px;
    }
    
    button {
      padding: 6px 12px;
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    button:hover {
      opacity: 0.9;
    }
    
    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .quick-actions button {
      font-size: 12px;
      padding: 4px 8px;
    }
    
    .results {
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 12px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .chat-messages {
      max-height: 400px;
      overflow-y: auto;
      margin-bottom: 12px;
    }
    
    .message {
      padding: 8px 12px;
      margin-bottom: 8px;
      border-radius: 8px;
    }
    
    .message.user {
      background: var(--button-bg);
      margin-left: 20%;
    }
    
    .message.assistant {
      background: var(--input-bg);
      margin-right: 20%;
    }
    
    .error-item {
      padding: 8px;
      margin-bottom: 8px;
      background: rgba(255, 0, 0, 0.1);
      border-left: 3px solid #f44336;
      border-radius: 4px;
    }
    
    .error-item .file {
      font-size: 11px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="panel-title">💬 AI 助手</div>
    <div class="search-box">
      <input type="text" id="chatInput" placeholder="问问环信助手..." />
      <button onclick="sendChat()">发送</button>
    </div>
    <div id="chatMessages" class="chat-messages"></div>
  </div>
  
  <div class="panel">
    <div class="panel-title">⚡ 快捷操作</div>
    <div class="quick-actions">
      <button onclick="buildProject()">🔨 编译项目</button>
      <button onclick="showErrorLookup()">🔍 查错误码</button>
      <button onclick="searchDocs()">📖 搜索文档</button>
    </div>
  </div>
  
  <div class="panel" id="resultsPanel" style="display: none;">
    <div class="panel-title">📋 结果</div>
    <div id="results" class="results"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    function sendChat() {
      const input = document.getElementById('chatInput');
      const question = input.value.trim();
      if (!question) return;
      
      addMessage(question, 'user');
      input.value = '';
      
      vscode.postMessage({ type: 'chat', question });
    }
    
    function addMessage(text, role) {
      const container = document.getElementById('chatMessages');
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.textContent = text;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }
    
    function buildProject() {
      vscode.postMessage({ 
        type: 'build',
        projectPath: '', // 从配置获取
        scheme: ''
      });
    }
    
    function showErrorLookup() {
      const code = prompt('输入错误码:');
      if (code) {
        vscode.postMessage({ type: 'lookupError', code: parseInt(code) });
      }
    }
    
    function searchDocs() {
      const query = prompt('搜索关键词:');
      if (query) {
        vscode.postMessage({ type: 'searchDocs', query });
      }
    }
    
    function showResults(html) {
      document.getElementById('resultsPanel').style.display = 'block';
      document.getElementById('results').innerHTML = html;
    }
    
    // 处理来自插件的消息
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'chatResponse':
          addMessage(message.data, 'assistant');
          break;
          
        case 'buildResult':
          if (message.data.success) {
            showResults('<p>✅ 编译成功！耗时 ' + message.data.duration + 'ms</p>');
          } else {
            let html = '<p>❌ 编译失败</p>';
            for (const error of message.data.errors) {
              html += '<div class="error-item">';
              html += '<div class="file">' + error.file + ':' + error.line + '</div>';
              html += '<div>' + error.message + '</div>';
              html += '</div>';
            }
            showResults(html);
          }
          break;
          
        case 'errorResult':
          if (message.data) {
            showResults(
              '<h4>' + message.data.code + ' - ' + message.data.name + '</h4>' +
              '<p>' + message.data.description + '</p>' +
              '<h5>解决方案:</h5>' +
              '<ul>' + message.data.solutions.map(s => '<li>' + s + '</li>').join('') + '</ul>'
            );
          }
          break;
          
        case 'docsResult':
          let html = '';
          for (const result of message.data) {
            html += '<div class="doc-item"><strong>' + result.name + '</strong>';
            html += '<p>' + result.description + '</p></div>';
          }
          showResults(html);
          break;
      }
    });
    
    // 回车发送
    document.getElementById('chatInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') sendChat();
    });
  </script>
</body>
</html>
    `;
  }
}
```

### 6. 插件入口

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { XcodeBuild } from './build/XcodeBuild';
import { MCPClient } from './ai/MCPClient';
import { ClaudeClient } from './ai/ClaudeClient';
import { DiagnosticsProvider } from './providers/DiagnosticsProvider';
import { EaseIMCodeActionsProvider } from './providers/CodeActionsProvider';
import { SidebarProvider } from './views/SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('EM Integration Assistant activated');
  
  // 初始化服务
  const xcodeBuild = new XcodeBuild();
  const mcpClient = new MCPClient();
  const claudeClient = new ClaudeClient(getApiKey());
  const diagnosticsProvider = new DiagnosticsProvider(mcpClient);
  
  // 注册侧边栏
  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    xcodeBuild,
    mcpClient,
    claudeClient
  );
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'easeim.sidebar',
      sidebarProvider
    )
  );
  
  // 注册 CodeActions
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'swift' },
      new EaseIMCodeActionsProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  );
  
  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('easeim.build', async () => {
      const projectPath = await detectProject();
      if (!projectPath) {
        vscode.window.showErrorMessage('未找到 Xcode 项目');
        return;
      }
      
      const schemes = await xcodeBuild.getSchemes(projectPath);
      const scheme = await vscode.window.showQuickPick(schemes, {
        placeHolder: '选择 Scheme'
      });
      
      if (!scheme) return;
      
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在编译...',
        cancellable: false
      }, async () => {
        const result = await xcodeBuild.build(projectPath, scheme);
        
        if (result.success) {
          vscode.window.showInformationMessage(
            `✅ 编译成功！耗时 ${result.duration}ms`
          );
        } else {
          diagnosticsProvider.showBuildErrors(result.errors);
          vscode.window.showErrorMessage(
            `❌ 编译失败：${result.errors.length} 个错误`
          );
        }
      });
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('easeim.diagnoseError', async (diagnostic) => {
      const error = extractBuildError(diagnostic);
      await diagnoseError(error, claudeClient, mcpClient);
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('easeim.lookupError', async (code?: number) => {
      if (!code) {
        const input = await vscode.window.showInputBox({
          prompt: '输入错误码',
          placeHolder: '如: 508'
        });
        code = parseInt(input || '');
      }
      
      if (isNaN(code)) return;
      
      const result = await mcpClient.lookupError(code);
      if (result) {
        showErrorDoc(result);
      } else {
        vscode.window.showWarningMessage(`未找到错误码 ${code} 的说明`);
      }
    })
  );
}

export function deactivate() {}
```

### 7. package.json

```json
{
  "name": "easeim-assistant",
  "displayName": "EM Integration Assistant",
  "description": "环信 IM SDK 开发助手 - AI 驱动的编译诊断和文档查询",
  "version": "1.0.0",
  "publisher": "easemob",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other", "Programming Languages"],
  "keywords": ["easemob", "im", "chat", "ios", "swift"],
  "activationEvents": [
    "workspaceContains:**/*.xcodeproj",
    "workspaceContains:**/*.xcworkspace",
    "onLanguage:swift"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "easeim.build",
        "title": "EaseIM: 编译项目"
      },
      {
        "command": "easeim.diagnoseError",
        "title": "EaseIM: 诊断错误"
      },
      {
        "command": "easeim.lookupError",
        "title": "EaseIM: 查询错误码"
      },
      {
        "command": "easeim.searchDocs",
        "title": "EaseIM: 搜索文档"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "easeim",
          "title": "EM Integration Assistant",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "easeim": [
        {
          "type": "webview",
          "id": "easeim.sidebar",
          "name": "助手"
        }
      ]
    },
    "configuration": {
      "title": "EM Integration Assistant",
      "properties": {
        "easeim.claudeApiKey": {
          "type": "string",
          "default": "",
          "description": "Claude API Key"
        },
        "easeim.defaultScheme": {
          "type": "string",
          "default": "",
          "description": "默认编译 Scheme"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0"
  }
}
```

---

# Part 3: 数据维护

## 打包源码脚本

```bash
#!/bin/bash
# scripts/bundle-sources.sh

SOURCES_DIR="data/sources"
rm -rf $SOURCES_DIR
mkdir -p $SOURCES_DIR

bundle_repo() {
    local name=$1
    local repo=$2
    local tag=$3
    
    echo "📦 Bundling $name ($tag)..."
    
    git clone --depth 1 --branch $tag "https://github.com/$repo.git" "/tmp/$name"
    
    mkdir -p "$SOURCES_DIR/$name"
    find "/tmp/$name" -name "*.swift" -exec cp {} "$SOURCES_DIR/$name/" \;
    
    rm -rf "/tmp/$name"
    echo "✅ $name done"
}

bundle_repo "EaseChatUIKit" "easemob/chatuikit-ios" "1.2.0"
bundle_repo "EaseCallKit" "easemob/easecallkit-ios" "1.1.0"
bundle_repo "EaseChatroomUIKit" "easemob/ChatroomUIKit" "1.0.0"
bundle_repo "EaseIMKit" "easemob/easeimkit-ios" "4.0.0"

echo "📝 Generating index..."
npx ts-node scripts/generate-index.ts

echo "🎉 Done! Size: $(du -sh $SOURCES_DIR)"
```

## 更新流程

```
1. 环信发布新版本
       │
       ▼
2. 更新 scripts/bundle-sources.sh 中的版本号
       │
       ▼
3. 运行 ./scripts/bundle-sources.sh
       │
       ▼
4. 更新 data/docs/ 中的文档
       │
       ▼
5. 运行 npm run generate-index
       │
       ▼
6. 测试
       │
       ▼
7. 发布新版本
   - npm publish (MCP Server)
   - vsce publish (VS Code Extension)
```

---

# Part 4: 使用示例

## 在 Claude Code 中使用

```bash
# 配置 MCP Server 后
claude

> 错误码 508 是什么意思？如何解决？

Claude: [调用 lookup_error(508)]

错误码 508 (MESSAGE_BLOCKED) 表示消息被拦截，通常是因为您已被对方拉黑。

解决方案：
1. 检查好友关系状态
2. 使用友好的错误提示，如"消息发送失败，请检查好友状态"
3. 不要直接向用户暴露"被拉黑"的信息

示例代码：
```swift
EMClient.shared().chatManager?.send(message) { msg, error in
    if let error = error, error.code == 508 {
        self.showToast("消息发送失败，请检查好友状态")
        return
    }
}
```
```

## 在 VS Code 中使用

1. **编译项目**：`Cmd+Shift+P` → `EaseIM: 编译项目`
2. **查看错误**：编译错误会显示在编辑器中，带有环信错误码解释
3. **快速修复**：点击错误左侧的💡图标 → 选择"诊断此错误"
4. **侧边栏**：点击活动栏的 EaseIM 图标，使用 AI 助手

---

# 待办事项

## Phase 1: MCP Server 基础

- [ ] 项目初始化
- [ ] 文档索引结构
- [ ] 源码索引结构
- [ ] lookup_error 实现
- [ ] search_api 实现
- [ ] search_source 实现
- [ ] 打包脚本

## Phase 2: MCP Server 完善

- [ ] diagnose 实现
- [ ] get_guide 实现
- [ ] 索引生成脚本
- [ ] npm 发布
- [ ] 文档

## Phase 3: VS Code Extension

- [ ] 项目初始化
- [ ] XcodeBuild 封装
- [ ] 错误解析
- [ ] DiagnosticsProvider
- [ ] CodeActionsProvider
- [ ] 侧边栏 WebView

## Phase 4: VS Code Extension 完善

- [ ] Claude API 集成
- [ ] 快速修复
- [ ] 配置管理
- [ ] 发布到 VS Code Marketplace
