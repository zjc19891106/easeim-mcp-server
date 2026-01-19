# EM Integration Assistant Usage Guide

This document explains how to inject platform materials and use the plugin-style registries for templates, knowledge, classes, and lexicon data in the MCP server.

## Quick Start

### Generate and validate indexes
- `npm run generate-template-shards`
- `npm run generate-lexicon-shards`
- `npm run generate-integration-shards`
- `npm run build`

## Plugin-style Injection Overview

The MCP server uses registry-style loaders for platform-specific data and a platform orchestrator for routing. Injection is done by adding data files and regenerating shards.

### Registries and Orchestrator
- `TemplateRegistry` → loads `data/templates` shards
- `KnowledgeRegistry` → loads `data/knowledge` shards
- `ClassRegistry` → loads `data/classes` shards
- `LexiconRegistry` → loads `data/lexicon` shards
- `IntentRegistry` → loads `data/intents` (patterns, rules)
- `PlatformOrchestrator` → routes template/scenario by platform

## Code Template Injection

### Where templates live
- `data/templates/index.json` — canonical template list
- `data/templates/shards/*.json` — generated platform shards

### Template schema (index.json)
Each template defines:
- `id`, `name`, `description`
- `platform` (e.g., `ios`, `android`, `web`, `flutter`, `rn`, `common`)
- `variables` (name/type/default/required)
- `template` and optional `usage`

### Steps to add a new template
1. Add a template entry to `data/templates/index.json`.
2. Run `npm run generate-template-shards` to refresh shards.
3. Rebuild: `npm run build`.

### Variable interpolation
`TemplateRenderer` replaces placeholders like `{{messageName}}`, `{{eventIdentifier}}`, `{{cellHeight}}`.
Defaults are filled for common fields such as:
- `messageName`, `messageName_lower`
- `menuName`, `menuTag`, `actionName`, `actionTag`
- `eventIdentifier`, `cellHeight`
- `textColor`, `fontSize`, `imageName`

### Platform-specific routing
`PlatformOrchestrator.generateCode(templateId, platform, context)` selects platform templates and fills variables.

## Scenario Knowledge Injection

### Where scenarios live
- `data/knowledge/index.json` — canonical scenario list
- `data/knowledge/shards/*.json` — generated platform shards

### Steps to add a scenario
1. Add a scenario entry to `data/knowledge/index.json`.
2. Run the corresponding shard generation script.
3. Rebuild.

### Consumption
- `KnowledgeRegistry.getScenario(id, platform)`
- `PlatformOrchestrator.buildScenarioViews(platform, keyword)`

## Class Metadata Injection

### Where class metadata lives
- `data/classes/index.json` — canonical class list
- `data/classes/shards/*.json` — generated platform shards

### Steps
1. Update `data/classes/index.json`.
2. Run `npm run generate-class-shards` (if present in scripts).
3. Rebuild.

### Consumption
- `KnowledgeGraph.getClassInfo(name)`
- `SmartAssistService.explainClass(name)`

## Lexicon Injection

### Where lexicon lives
- `data/lexicon/index.json`
- `data/lexicon/shards/*.json`

### Steps
1. Update `data/lexicon/index.json`.
2. Run `npm run generate-lexicon-shards`.
3. Rebuild.

### Consumption
- `QueryExpander` (synonyms/abbreviations)
- `SpellCorrector` (token dictionary)
- `SearchSuggester` (term-based suggestions)

## Intent Injection

### Where intents live
- `data/intents/index.json`

### What to update
- `patterns` and `intentDescriptions`
- `entityRules` (platform-aware extraction)
- `scenarioTargets` + `scenarioIntentMap`

### Consumption
- `IntentRegistry` / `IntentClassifier`

## Source and Doc Materials

### Docs
- `data/docs/index.json` and `data/docs/modules/*`
- Consumed by `DocSearch`

### Sources
- `data/sources/index.json` and `data/sources/shards/*`
- Consumed by `ShardedSourceSearch`

## Platform Injection (Android / Web / Flutter / RN / Harmony)

### Step 1: Choose the platform identifier
Use consistent platform keys across all data files:
- `android`, `web`, `flutter`, `rn`, `harmony`, `ios`, `unity`, `windows`, `common`

### Step 2: Inject platform materials
Add or update platform-specific data in the following locations:
- `data/docs/index.json` + `data/docs/modules/*`
- `data/sources/index.json` + `data/sources/shards/*`
- `data/templates/index.json`
- `data/knowledge/index.json`
- `data/classes/index.json`
- `data/lexicon/index.json`
- `data/intents/index.json`

### Step 3: Regenerate shards
- `npm run generate-template-shards`
- `npm run generate-lexicon-shards`
- `npm run generate-integration-shards`
- `npm run generate-class-shards` (if enabled)
- `npm run generate-source-shards` (if enabled)

### Step 4: Validate and sanity-check
- `npm run build`
- Validate MCP tools: `search_api`, `search_source`, `list_scenarios`, `generate_code`, `smart_assist`

## Plugin-style Injection Examples (iOS)

### Template entry (data/templates/index.json)
```json
{
  "id": "custom_message_full",
  "name": "Custom Message (Full)",
  "description": "Create a custom message cell and register it",
  "platform": "ios",
  "variables": [
    { "name": "messageName", "type": "string", "required": true, "default": "Order" },
    { "name": "cellHeight", "type": "number", "required": false, "default": 120 }
  ],
  "template": "// Swift code for {{messageName}}...",
  "usage": "Call setup{{messageName}}Message() during app init"
}
```

### iOS custom_message_full template snippet
Source: `data/templates/index.json` (id: `ios:message:custom_message_full`)

```swift
// ============================================================
// MARK: - {{messageName}} 消息完整实现 (渲染/逻辑/交互全闭环)
// ============================================================

import UIKit
import EaseChatUIKit

// MARK: - 1. 消息标识符定义
let EaseChatUIKit_{{messageName_lower}}_message = "{{eventIdentifier}}"

// MARK: - 2. 数据模型
struct {{messageName}}MessageData {
    let id: String
    let title: String
    let subtitle: String
    let imageURL: String
    let price: Double
    let status: String

    func toExtension() -> [String: Any] {
        return ["id": id, "title": title, "subtitle": subtitle, "imageURL": imageURL, "price": price, "status": status]
    }

    static func from(ext: [String: Any]?) -> {{messageName}}MessageData? {
        guard let ext = ext, let id = ext["id"] as? String, let title = ext["title"] as? String else { return nil }
        return {{messageName}}MessageData(
            id: id,
            title: title,
            subtitle: ext["subtitle"] as? String ?? "",
            imageURL: ext["imageURL"] as? String ?? "",
            price: ext["price"] as? Double ?? 0,
            status: ext["status"] as? String ?? ""
        )
    }
}

// MARK: - 3. 自定义消息 Cell (UI 渲染层)
@objc open class {{messageName}}MessageCell: CustomMessageCell {
    public private(set) lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        label.numberOfLines = 2
        return label
    }()

    public private(set) lazy var priceLabel: UILabel = {
        let label = UILabel()
        label.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        label.textColor = .systemRed
        return label
    }()

    @objc required public init(towards: BubbleTowards, reuseIdentifier: String) {
        super.init(towards: towards, reuseIdentifier: reuseIdentifier)
        self.content.addSubview(titleLabel)
        self.content.addSubview(priceLabel)
    }
}
```

The full template is stored at `data/templates/index.json` under `ios:message:custom_message_full`.

### Generate code example
```
generate_code scenario="custom_message" name="Order" platform="ios"
```
This returns the rendered Swift code with iOS defaults and variable substitutions.

### Smart assist example
```
smart_assist query="iOS 自定义订单消息怎么做" platform="ios"
```
The assistant will route to the iOS custom message template and return the generated code and steps.

### Scenario entry (data/knowledge/index.json)
```json
{
  "id": "custom_message",
  "platform": "ios",
  "scenario": "Custom message",
  "description": "Create and render a custom message",
  "steps": [
    "Create a custom message body",
    "Register the message cell",
    "Render the message in the list"
  ]
}
```

### Intent rule entry (data/intents/index.json)
```json
{
  "patterns": {
    "custom_message": ["custom message", "自定义消息", "卡片消息"]
  },
  "entityRules": {
    "ios": {
      "messageName": ["订单", "卡片", "通知"]
    }
  }
}
```

### Lexicon entry (data/lexicon/index.json)
```json
{
  "platforms": {
    "ios": {
      "synonyms": { "消息": ["message", "msg"] },
      "abbreviations": { "IM": ["instant messaging"] },
      "stopWords": ["怎么", "如何"]
    }
  }
}
```

### Docs module entry (data/docs/index.json)
```json
{
  "id": "message",
  "name": "Messaging",
  "description": "Send/receive messages",
  "keywords": ["message", "send", "receive"],
  "docPath": "modules/message.md",
  "apis": ["sendMessage", "resendMessage"],
  "errorCodes": [500, 501],
  "platform": "ios",
  "layer": "sdk"
}
```

### Source index entry (data/sources/index.json)
```json
{
  "path": "EaseChatUIKit/MessageCell.swift",
  "component": "EaseChatUIKit",
  "classes": ["MessageCell"],
  "keywords": ["cell", "message"],
  "description": "Message cell view",
  "platform": "ios"
}
```

## Example: iOS platform injection
1. Add `platform: "ios"` entries to templates, knowledge, lexicon, and intents.
2. Add iOS docs modules and source shard metadata to `data/docs/index.json` and `data/sources/index.json`.
3. Generate shards.
4. Run `npm run build`.

## Typical Platform Injection Flow

1. Add platform data in `data/docs`, `data/sources`, `data/templates`, `data/knowledge`, `data/classes`, `data/lexicon`, `data/intents`.
2. Generate shards for modified datasets.
3. Run `npm run build`.
4. Validate via MCP tools: `search_api`, `search_source`, `list_scenarios`, `generate_code`, `smart_assist`.

## Notes
- Keep platform identifiers consistent (`ios`, `android`, `web`, `flutter`, `rn`, `harmony`, `unity`, `windows`, `common`).
- For React Native, normalization to `rn` is applied in smart assist flows.
- `SmartAssistService` uses `PlatformOrchestrator` for platform-specific template generation.
