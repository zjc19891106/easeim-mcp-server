/**
 * MCP Tools 定义
 */

export const TOOLS = [
  {
    name: 'lookup_error',
    description: '查询环信 IM SDK 错误码的含义、原因和解决方案',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'number',
          description: '错误码数字，如 508'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['code', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'search_api',
    description: '搜索环信 IM SDK 的 API 文档，支持中英文关键词搜索，支持按平台、层级、组件过滤',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'API 名称或关键词，如 "发送消息"、"sendMessage"'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        },
        layer: {
          type: 'string',
          enum: ['sdk', 'uikit'],
          description: '指定层级，sdk=核心功能，uikit=UI组件'
        },
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit'],
          description: '指定 UIKit 组件（仅当 layer=uikit 时有效）'
        },
        limit: {
          type: 'number',
          description: '返回结果数量限制，默认 10',
          default: 10
        }
      },
      required: ['query', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'search_source',
    description: '搜索环信开源 UIKit 组件的源码，用于 UI 定制和问题排查',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词，如类名、方法名、"消息气泡"、"MessageBubble"'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        },
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'all'],
          description: '指定搜索的组件，默认搜索所有组件',
          default: 'all'
        },
        limit: {
          type: 'number',
          description: '返回结果数量限制，默认 10',
          default: 10
        }
      },
      required: ['query', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'get_guide',
    description: '获取环信 IM SDK 的集成指南和最佳实践文档',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: ['quickstart', 'login', 'message', 'group', 'chatroom', 'push', 'migration'],
          description: '指南主题：quickstart(快速开始), login(登录), message(消息), group(群组), chatroom(聊天室), push(推送), migration(迁移升级)'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['topic', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'diagnose',
    description: '根据问题症状诊断可能的错误原因，自动匹配相关错误码',
    inputSchema: {
      type: 'object',
      properties: {
        symptom: {
          type: 'string',
          description: '问题症状描述，如 "消息发送失败"、"被拉黑"、"登录超时"'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['symptom', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'read_doc',
    description: '读取完整的 API 文档内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文档路径，如 "api/message_send.md"'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['path', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'read_source',
    description: '读取完整的源码文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '源码文件路径，相对于 sources/ 目录'
        },
        symbol: {
          type: 'string',
          description: '符号名称（类/方法），如 "MessageListController" 或 "MessageListController.handleAttachmentAction"'
        },
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit', 'all'],
          description: '指定搜索的组件（可选）',
          default: 'all'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony, windows'
        },
        startLine: {
          type: 'number',
          description: '起始行号（可选）'
        },
        endLine: {
          type: 'number',
          description: '结束行号（可选）'
        }
      },
      required: ['platform'],

      additionalProperties: false
    }
  },
  {
    name: 'list_config_options',
    description: '列出 UIKit 组件的所有配置项（Appearance 属性），用于了解有哪些可配置选项',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit', 'all'],
          description: '指定组件，或 "all" 查看所有组件的配置项',
          default: 'all'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['platform'],
      additionalProperties: false
    }
  },
  {
    name: 'get_extension_points',
    description: '获取 UIKit 组件的扩展点（可实现的协议、可继承的类），用于了解如何自定义和扩展功能',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit', 'all'],
          description: '指定组件，或 "all" 查看所有组件的扩展点',
          default: 'all'
        },
        type: {
          type: 'string',
          enum: ['protocol', 'class', 'all'],
          description: '扩展点类型：protocol(协议) / class(可继承类) / all(全部)',
          default: 'all'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['platform'],
      additionalProperties: false
    }
  },
  {
    name: 'get_config_usage',
    description: '查询某个配置项的详细使用情况，包括影响的 UI 组件、使用位置、代码示例等',
    inputSchema: {
      type: 'object',
      properties: {
        propertyName: {
          type: 'string',
          description: '配置项名称，如 "avatarRadius"、"primaryHue"、"alertStyle"'
        },
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit', 'all'],
          description: '指定组件（可选），默认搜索所有组件',
          default: 'all'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['propertyName', 'platform'],
      additionalProperties: false
    }
  },
  // ============================================================
  // 智能化工具 (P0)
  // ============================================================
  {
    name: 'smart_assist',
    description: '🧠 智能助手 - 用自然语言描述你的需求，自动理解意图并提供最佳方案。支持上下文感知：自动记住对话历史，识别连续性问题（如"继续"、"更多细节"），并提供相关推荐。示例："我想自定义一个订单消息"、"如何添加发送位置的菜单"、"错误码 508 怎么解决"、"继续"、"更多细节"',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '用自然语言描述你想做什么或遇到的问题'
        },
        session_id: {
          type: 'string',
          description: '(可选) 会话 ID，用于维护上下文。同一会话使用相同 ID 可获得连续性支持'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，如 ios/android/web/flutter/rn/harmony/unity'
        }
      },
      required: ['query', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'generate_code',
    description: '📝 代码生成器 - 根据场景生成完整可用的 Swift 代码模板，包含注册、发送、点击处理等完整实现',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: {
          type: 'string',
          enum: ['custom_message', 'attachment_menu', 'bubble_style', 'theme_config', 'avatar_config', 'long_press_menu', 'text_style_customization'],
          description: '场景类型：custom_message(自定义消息), attachment_menu(添加菜单项), bubble_style(气泡样式), theme_config(主题配置), avatar_config(头像配置), long_press_menu(长按菜单), text_style_customization(文本样式定制)'
        },
        name: {
          type: 'string',
          description: '自定义名称（用于自定义消息等场景），如 "Order"、"Product"、"Location"'
        },
        cellHeight: {
          type: 'number',
          description: '消息 Cell 高度（仅 custom_message 场景需要），默认 120',
          default: 120
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['scenario', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'explain_class',
    description: '📖 类解释器 - 详细解释一个类的作用、继承关系、关键方法、使用场景，帮助理解如何继承和扩展',
    inputSchema: {
      type: 'object',
      properties: {
        className: {
          type: 'string',
          description: '类名，如 "MessageCell"、"ChatViewController"'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['className', 'platform'],

      additionalProperties: false
    }
  },
  {
    name: 'list_scenarios',
    description: '📋 场景列表 - 列出所有支持的开发场景及其解决方案概览',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜索关键词（可选），用于过滤场景列表'
        },
        platform: {
          type: 'string',
          enum: ['ios', 'android', 'web', 'flutter', 'unity', 'rn', 'harmony', 'windows'],
          description: '指定平台，可选：ios, android, web, flutter, unity, rn, harmony'
        }
      },
      required: ['platform'],

      additionalProperties: false
    }
  },
  // ============================================================
  // 集成诊断工具 (Integration)
  // ============================================================
  {
    name: 'check_integration',
    description: '🔍 集成配置检查 - 检查 Podfile 配置是否符合 UIKit 组件的要求，诊断版本、设置等问题',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit'],
          description: '目标组件：EaseChatUIKit, EaseCallUIKit, EaseChatroomUIKit, EaseIMKit'
        },
        podfileContent: {
          type: 'string',
          description: 'Podfile 文件内容（可选，用于检查具体配置问题）'
        }
      },
      required: ['component', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'diagnose_build_error',
    description: '🛠️ 构建错误诊断 - 根据 Xcode 构建错误信息诊断问题原因，提供解决方案（rsync、CocoaPods、架构等问题）',
    inputSchema: {
      type: 'object',
      properties: {
        errorMessage: {
          type: 'string',
          description: '构建错误信息，如 "Sandbox: rsync.samba deny file-write-create"、"PBXFileSystemSynchronizedRootGroup"'
        },
        platform: {
          type: 'string',
          enum: ['ios'],
          description: '指定平台，仅支持 ios'
        }
      },
      required: ['errorMessage', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'get_podfile_template',
    description: '📄 获取 Podfile 模板 - 获取指定组件的推荐 Podfile 配置模板',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit'],
          description: '目标组件：EaseChatUIKit, EaseCallUIKit, EaseChatroomUIKit'
        },
        platform: {
          type: 'string',
          enum: ['ios'],
          description: '指定平台，仅支持 ios'
        }
      },
      required: ['component', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'get_integration_checklist',
    description: '✅ 集成检查清单 - 获取指定组件的完整集成检查清单，包含环境要求、配置项、权限设置等',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit'],
          description: '目标组件：EaseChatUIKit, EaseCallUIKit, EaseChatroomUIKit, EaseIMKit'
        },
        platform: {
          type: 'string',
          enum: ['ios'],
          description: '指定平台，仅支持 ios'
        }
      },
      required: ['component', 'platform'],
      additionalProperties: false
    }
  },
  {
    name: 'get_platform_requirements',
    description: '📋 获取平台要求 - 查询指定组件的 iOS 版本、Xcode 版本、CocoaPods 版本等要求',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          enum: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit', 'EaseIMKit', 'all'],
          description: '目标组件，或 "all" 查看所有组件的要求',
          default: 'all'
        },
        platform: {
          type: 'string',
          enum: ['ios'],
          description: '指定平台，仅支持 ios'
        }
      },
      required: ['platform'],
      additionalProperties: false
    }
  }
] as const;
