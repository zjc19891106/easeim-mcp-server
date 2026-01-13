/**
 * 知识图谱
 * 构建 API、类、场景之间的关系，支持智能推荐
 */

/**
 * 场景解决方案
 */
export interface ScenarioSolution {
  id: string;
  scenario: string;
  description: string;
  keywords: string[];
  steps: string[];
  relatedClasses: string[];
  relatedApis: string[];
  relatedConfigs: string[];
  codeTemplate: string;
  tips: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 类信息
 */
export interface ClassInfo {
  name: string;
  description: string;
  superclass: string | null;
  protocols: string[];
  isOpen: boolean;
  file: string;
  keyMethods: string[];
  keyProperties: string[];
  usageScenarios: string[];
}

/**
 * 相关项目
 */
export interface RelatedItems {
  classes: string[];
  apis: string[];
  configs: string[];
  guides: string[];
  scenarios: string[];
}

export class KnowledgeGraph {

  // 场景解决方案库
  private scenarios: Map<string, ScenarioSolution> = new Map();

  // 类信息库
  private classes: Map<string, ClassInfo> = new Map();

  // 继承关系图
  private inheritanceMap: Map<string, string[]> = new Map();

  // 关键词到场景的映射
  private keywordToScenario: Map<string, string[]> = new Map();

  constructor() {
    this.buildKnowledgeBase();
  }

  /**
   * 构建知识库
   */
  private buildKnowledgeBase() {
    this.buildScenarios();
    this.buildClassInfo();
    this.buildInheritanceMap();
    this.buildKeywordIndex();
  }

  /**
   * 构建场景解决方案
   */
  private buildScenarios() {
    // 自定义消息类型
    this.scenarios.set('custom_message', {
      id: 'custom_message',
      scenario: '自定义消息类型',
      description: '创建新的消息类型，如订单消息、商品消息、位置消息等',
      keywords: ['自定义消息', '新消息类型', '订单消息', '商品消息', 'custom message', '消息样式'],
      steps: [
        '1. 定义消息事件标识符 (如 EaseChatUIKit_order_message)',
        '2. 创建自定义消息 Cell，继承 CustomMessageCell',
        '3. 在 Cell 中添加 UI 组件并实现布局',
        '4. 重写 refresh(entity:) 方法绑定数据',
        '5. 重写 switchTheme(style:) 支持主题切换',
        '6. 继承 MessageEntity 处理 UI 逻辑与高度计算 (customSize)',
        '7. 使用 ComponentsRegister.shared.registerCustomCellClasses() 注册 Cell',
        '8. 继承 MessageListController 处理发送和点击事件',
      ],
      relatedClasses: ['CustomMessageCell', 'MessageCell', 'MessageEntity', 'ComponentsRegister', 'ChatCustomMessageBody'],
      relatedApis: ['registerCustomCellClasses', 'sendMessage', 'messageBubbleClicked', 'handleAttachmentAction'],
      relatedConfigs: ['inputExtendActions'],
      codeTemplate: 'custom_message_full',
      tips: [
        '💡 Cell 注册应在 UIKit 初始化时完成',
        '💡 强烈建议继承 MessageEntity 以获得最佳的高度计算性能',
        '💡 记得在 switchTheme 中处理深色/浅色模式',
        '💡 自定义消息的 event 标识符需要唯一',
      ],
      difficulty: 'medium',
    });

    // 添加附件菜单项
    this.scenarios.set('add_attachment_menu', {
      id: 'add_attachment_menu',
      scenario: '添加附件菜单项',
      description: '在输入框的 + 按钮菜单中添加新的选项',
      keywords: ['添加菜单', '附件菜单', 'menu', '菜单项', 'inputExtendActions'],
      steps: [
        '1. 创建 ActionSheetItem 定义菜单项',
        '2. 设置 title、tag、image 等属性',
        '3. 添加到 Appearance.chat.inputExtendActions 数组',
        '4. 继承 MessageListController',
        '5. 重写 handleAttachmentAction(item:) 处理点击',
        '6. 注册自定义的 MessageListController',
      ],
      relatedClasses: ['ActionSheetItem', 'MessageListController', 'MessageInputExtensionView'],
      relatedApis: ['handleAttachmentAction', 'attachmentDialog'],
      relatedConfigs: ['inputExtendActions'],
      codeTemplate: 'attachment_menu',
      tips: [
        '💡 tag 属性用于在 handleAttachmentAction 中识别菜单项',
        '💡 菜单项图标建议使用 24x24 的图片',
        '💡 可以在运行时动态修改 inputExtendActions',
      ],
      difficulty: 'easy',
    });

    // 自定义消息气泡样式
    this.scenarios.set('custom_bubble_style', {
      id: 'custom_bubble_style',
      scenario: '自定义消息气泡样式',
      description: '修改消息气泡的颜色、圆角、背景等样式',
      keywords: ['气泡样式', '气泡颜色', 'bubble', '消息背景', '圆角'],
      steps: [
        '1. 通过 Appearance.chat.bubbleStyle 设置气泡风格',
        '2. 可选值：.withArrow (带箭头) 或 .withMultiCorners (多圆角)',
        '3. 如需深度定制，继承对应的 MessageCell',
        '4. 重写相关的 UI 属性或方法',
      ],
      relatedClasses: ['MessageCell', 'TextMessageCell', 'ImageMessageCell'],
      relatedApis: ['switchTheme', 'refresh'],
      relatedConfigs: ['bubbleStyle', 'contentStyle', 'imageMessageCorner'],
      codeTemplate: 'bubble_style',
      tips: [
        '💡 bubbleStyle 需要在初始化前设置',
        '💡 图片消息有单独的圆角配置 imageMessageCorner',
      ],
      difficulty: 'easy',
    });

    // 主题颜色定制
    this.scenarios.set('theme_customization', {
      id: 'theme_customization',
      scenario: '主题颜色定制',
      description: '修改 UIKit 的整体主题色调',
      keywords: ['主题', '颜色', 'theme', 'color', 'primaryHue', '色调'],
      steps: [
        '1. 设置 Appearance.primaryHue 修改主色调',
        '2. 设置 Appearance.secondaryHue 修改次要色调',
        '3. 设置 Appearance.errorHue 修改错误提示色',
        '4. 设置 Appearance.neutralHue 修改中性色',
        '5. 所有使用这些色系的组件会自动更新',
      ],
      relatedClasses: ['Theme', 'ThemeSwitchProtocol'],
      relatedApis: ['switchTheme'],
      relatedConfigs: ['primaryHue', 'secondaryHue', 'errorHue', 'neutralHue', 'neutralSpecialHue'],
      codeTemplate: 'theme_config',
      tips: [
        '💡 色调值范围是 0-1，对应 0°-360° 色相环',
        '💡 修改色调会影响所有相关 UI 组件的颜色',
        '💡 建议在应用启动时设置',
      ],
      difficulty: 'easy',
    });

    // 头像样式定制
    this.scenarios.set('avatar_customization', {
      id: 'avatar_customization',
      scenario: '头像样式定制',
      description: '修改头像的圆角、占位图等样式',
      keywords: ['头像', 'avatar', '圆角', '占位图'],
      steps: [
        '1. 设置 Appearance.avatarRadius 修改头像圆角',
        '2. 设置 Appearance.avatarPlaceHolder 修改默认占位图',
        '3. 可选圆角值：.extraSmall, .small, .medium, .large',
      ],
      relatedClasses: ['ImageView'],
      relatedApis: [],
      relatedConfigs: ['avatarRadius', 'avatarPlaceHolder'],
      codeTemplate: 'avatar_config',
      tips: [
        '💡 .large 圆角会使头像接近圆形',
        '💡 占位图建议使用正方形图片',
      ],
      difficulty: 'easy',
    });

    // 消息长按菜单定制
    this.scenarios.set('message_long_press_menu', {
      id: 'message_long_press_menu',
      scenario: '消息长按菜单定制',
      description: '自定义消息长按后显示的操作菜单',
      keywords: ['长按菜单', '消息菜单', 'long press', '复制', '撤回', '删除'],
      steps: [
        '1. 修改 Appearance.chat.messageLongPressedActions 数组',
        '2. 添加或移除 ActionSheetItem 项',
        '3. 继承 MessageListController 处理自定义操作',
        '4. 重写 processMessage(item:message:) 方法',
      ],
      relatedClasses: ['ActionSheetItem', 'MessageListController'],
      relatedApis: ['processMessage', 'filterMessageActions'],
      relatedConfigs: ['messageLongPressedActions', 'messageLongPressMenuStyle'],
      codeTemplate: 'long_press_menu',
      tips: [
        '💡 可通过 tag 属性标识自定义操作',
        '💡 menuStyle 可选 .withArrow 或 .actionSheet',
      ],
      difficulty: 'easy',
    });

    // 聊天背景定制
    this.scenarios.set('chat_background_customization', {
      id: 'chat_background_customization',
      scenario: '自定义聊天页面背景图',
      description: '修改聊天详情页面的背景，支持图片背景和自定义颜色。',
      keywords: ['聊天背景', '背景图', 'background image', 'chat background', '修改背景'],
      steps: [
        '1. 继承 MessageListController',
        '2. 在 viewDidLoad 中创建 UIImageView',
        '3. 使用 insertSubview(..., at: 0) 将背景图插入最底层',
        '4. 设置 messageContainer 和 messageList 的 backgroundColor 为 .clear',
        '5. 通过 ComponentsRegister 注册自定义控制器',
      ],
      relatedClasses: ['MessageListController', 'MessageListView', 'ComponentsRegister'],
      relatedApis: ['viewDidLoad', 'insertSubview'],
      relatedConfigs: ['MessageViewController'],
      codeTemplate: 'chat_background_config',
      tips: [
        '💡 必须确保 messageContainer 的背景是透明的，否则背景图会被遮挡',
        '💡 建议使用 .scaleAspectFill 模式以适配不同屏幕尺寸',
        '💡 如果背景图颜色较深，记得调整 navigationBar 和状态栏的颜色',
      ],
      difficulty: 'easy',
    });

    // 用户信息更新方案
    this.scenarios.set('user_profile_update', {
      id: 'user_profile_update',
      scenario: '更新用户信息 (Provider vs Cache)',
      description: 'UIKit 通过 Provider 向 App 请求数据；App 也可以直接通过 userCache 实时更新。注意：Chat 和 Call 的 Provider 入口不同。',
      keywords: ['更新头像', '修改昵称', 'userProfileProvider', 'userCache', '用户信息', 'CallKit', 'profileProvider'],
      steps: [
        '1. 确保 ChatUIKit / CallKit 已完成初始化',
        '2. iOS Chat 注入：设置 ChatUIKitContext.shared.userProfileProvider = self',
        '3. iOS Call 注入：设置 CallKitManager.shared.profileProvider = self',
        '4. 主动更新：直接向 ChatUIKitContext.shared.userCache 注入数据实时刷新 UI',
      ],
      relatedClasses: ['ChatUIKitContext', 'CallKitManager', 'ChatUserProfile', 'ChatUserProfileProtocol'],
      relatedApis: ['userProfileProvider', 'profileProvider'],
      relatedConfigs: [],
      codeTemplate: 'user_profile_customization',
      tips: [
        '💡 这种方式适用于用户在 App 内修改了个人资料后，立即通知 UIKit 刷新的场景',
        '💡 userCache 是持久化缓存的，下次启动依然有效',
        '💡 ChatUIKit 和 CallKit 共用底层的缓存容器',
      ],
      difficulty: 'easy',
    });

    // 自定义文本样式 (颜色/字体)
    this.scenarios.set('custom_text_style', {
      id: 'custom_text_style',
      scenario: '自定义文本消息样式 (颜色/字体)',
      description: '修改文本消息的显示颜色、字体大小、行间距等。注意：气泡大小是根据富文本提前计算的，修改字体大小必须通过重写 MessageEntity 否则会导致气泡布局错误。',
      keywords: ['文本颜色', '修改文字颜色', '字体大小', '修改字号', 'font size', '紫色文字', '富文本', '行间距'],
      steps: [
        '1. 创建自定义类继承自 MessageEntity',
        '2. 重写 convertTextAttribute() 方法',
        '3. 调用 super 获取原始富文本 (包含表情解析)',
        '4. 使用 NSMutableAttributedString 修改颜色 (NSForegroundColorAttributeName) 或字体 (NSFontAttributeName)',
        '5. 在 AppDelegate 中通过 ComponentsRegister.shared.MessageRenderEntity 注册',
      ],
      relatedClasses: ['MessageEntity', 'ComponentsRegister', 'TextMessageCell'],
      relatedApis: ['convertTextAttribute'],
      relatedConfigs: ['MessageRenderEntity'],
      codeTemplate: 'text_style_customization',
      tips: [
        '💡 警告：在 TextMessageCell 中修改 label.font 会导致气泡大小不匹配，文字会被截断',
        '💡 MessageEntity 负责所有 UI 布局的预计算，它是 UI 定制的“数据源”',
        '💡 如果要修改链接（URL）的颜色，也建议在此处统一处理',
      ],
      difficulty: 'medium',
    });
  }

  /**
   * 构建类信息
   */
  private buildClassInfo() {
    this.classes.set('CustomMessageCell', {
      name: 'CustomMessageCell',
      description: '自定义消息 Cell 的基类，用于展示自定义类型的消息',
      superclass: 'MessageCell',
      protocols: ['ThemeSwitchProtocol'],
      isOpen: true,
      file: 'EaseChatUIKit/Classes/UI/Components/Chat/Cells/CustomMessageCell.swift',
      keyMethods: ['refresh(entity:)', 'switchTheme(style:)'],
      keyProperties: ['content', 'towards'],
      usageScenarios: ['custom_message'],
    });

    this.classes.set('MessageCell', {
      name: 'MessageCell',
      description: '消息 Cell 的基类，所有消息类型的 Cell 都继承自它',
      superclass: 'UITableViewCell',
      protocols: ['ThemeSwitchProtocol'],
      isOpen: true,
      file: 'EaseChatUIKit/Classes/UI/Components/Chat/Cells/MessageCell.swift',
      keyMethods: ['refresh(entity:)', 'switchTheme(style:)', 'createContent()', 'setupConstraints()'],
      keyProperties: ['entity', 'towards', 'bubbleWithArrow', 'bubbleMultiCorners', 'content', 'avatar', 'nickName'],
      usageScenarios: ['custom_message', 'custom_bubble_style'],
    });

    this.classes.set('MessageEntity', {
      name: 'MessageEntity',
      description: '消息实体类，封装 ChatMessage 并提供 UI 渲染所需的计算属性。注意：文本消息的颜色和字体是在该类的 convertTextAttribute 中确定的。',
      superclass: 'NSObject',
      protocols: [],
      isOpen: true,
      file: 'EaseChatUIKit/Classes/UI/Components/Chat/ViewModel/MessageEntity.swift',
      keyMethods: ['cellHeight()', 'updateBubbleSize()', 'customSize()', 'convertTextAttribute()'],
      keyProperties: ['message', 'bubbleSize', 'height', 'content', 'replySize'],
      usageScenarios: ['custom_message', 'custom_text_style'],
    });

    this.classes.set('MessageListController', {
      name: 'MessageListController',
      description: '消息列表页面控制器，管理消息的展示和交互',
      superclass: 'UIViewController',
      protocols: ['MessageListDriverEventsListener', 'ThemeSwitchProtocol'],
      isOpen: true,
      file: 'EaseChatUIKit/Classes/UI/Components/Chat/Controllers/MessageListController.swift',
      keyMethods: ['handleAttachmentAction(item:)', 'messageBubbleClicked(message:)', 'processMessage(item:message:)', 'sendMessage()'],
      keyProperties: ['viewModel', 'messageContainer', 'profile', 'chatType'],
      usageScenarios: ['custom_message', 'add_attachment_menu', 'message_long_press_menu', 'chat_background_customization'],
    });

    this.classes.set('ComponentsRegister', {
      name: 'ComponentsRegister',
      description: '组件注册中心，用于注册和替换 UIKit 中的各种组件',
      superclass: 'NSObject',
      protocols: [],
      isOpen: false,
      file: 'EaseChatUIKit/Classes/UI/Core/UIKit/Commons/ComponentsRegister.swift',
      keyMethods: ['registerCustomizeCellClass(cellType:)', 'registerCustomCellClasses(cellType:identifier:)'],
      keyProperties: ['shared', 'customCellClasses', 'customCellMaps', 'MessageViewController', 'MessageRenderEntity'],
      usageScenarios: ['custom_message'],
    });

    this.classes.set('ActionSheetItem', {
      name: 'ActionSheetItem',
      description: '操作菜单项，用于定义菜单的标题、图标、类型等',
      superclass: null,
      protocols: ['ActionSheetItemProtocol'],
      isOpen: false,
      file: 'EaseChatUIKit/Classes/UI/Core/UIKit/Commons/ActionSheetItem.swift',
      keyMethods: [],
      keyProperties: ['title', 'type', 'tag', 'image', 'action'],
      usageScenarios: ['add_attachment_menu', 'message_long_press_menu'],
    });
  }

  /**
   * 构建继承关系图
   */
  private buildInheritanceMap() {
    this.inheritanceMap.set('MessageCell', ['CustomMessageCell', 'TextMessageCell', 'ImageMessageCell', 'AudioMessageCell', 'VideoMessageCell', 'FileMessageCell', 'ContactCardCell', 'AlertMessageCell', 'LocationMessageCell', 'CombineMessageCell', 'GIFMessageCell']);
    this.inheritanceMap.set('CustomMessageCell', []);
    this.inheritanceMap.set('UIViewController', ['MessageListController', 'ConversationListController', 'ContactViewController']);
  }

  /**
   * 构建关键词索引
   */
  private buildKeywordIndex() {
    for (const [id, scenario] of this.scenarios) {
      for (const keyword of scenario.keywords) {
        const lowerKeyword = keyword.toLowerCase();
        if (!this.keywordToScenario.has(lowerKeyword)) {
          this.keywordToScenario.set(lowerKeyword, []);
        }
        this.keywordToScenario.get(lowerKeyword)!.push(id);
      }
    }
  }

  /**
   * 根据查询找到最匹配的场景
   */
  findScenario(query: string): ScenarioSolution | null {
    const lowerQuery = query.toLowerCase();
    let bestMatch: ScenarioSolution | null = null;
    let bestScore = 0;

    for (const [id, scenario] of this.scenarios) {
      let score = 0;
      for (const keyword of scenario.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          score += keyword.length * 2;
        }
      }
      if (lowerQuery.includes(scenario.scenario.toLowerCase())) {
        score += 50;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = scenario;
      }
    }
    return bestScore > 10 ? bestMatch : null;
  }

  /**
   * 根据场景 ID 获取解决方案
   */
  getScenarioById(id: string): ScenarioSolution | null {
    return this.scenarios.get(id) || null;
  }

  /**
   * 获取类信息
   */
  getClassInfo(className: string): ClassInfo | null {
    return this.classes.get(className) || null;
  }

  /**
   * 获取类的子类列表
   */
  getSubclasses(className: string): string[] {
    return this.inheritanceMap.get(className) || [];
  }

  /**
   * 获取类的继承链
   */
  getInheritanceChain(className: string): string[] {
    const chain: string[] = [className];
    const classInfo = this.classes.get(className);
    if (classInfo?.superclass) {
      chain.push(...this.getInheritanceChain(classInfo.superclass));
    }
    return chain;
  }

  /**
   * 根据功能需求推荐相关内容
   */
  getRelatedItems(query: string): RelatedItems {
    const related: RelatedItems = { classes: [], apis: [], configs: [], guides: [], scenarios: [] };
    const scenario = this.findScenario(query);
    if (scenario) {
      related.scenarios.push(scenario.id);
      related.classes.push(...scenario.relatedClasses);
      related.apis.push(...scenario.relatedApis);
      related.configs.push(...scenario.relatedConfigs);
    }
    return related;
  }

  /**
   * 获取所有场景列表
   */
  getAllScenarios(): ScenarioSolution[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * 根据场景 ID 获取解决方案 (别名)
   */
  getScenario(id: string): ScenarioSolution | null {
    return this.getScenarioById(id);
  }

  /**
   * 列出所有场景，支持关键词筛选
   */
  listScenarios(keyword?: string): Array<{
    id: string;
    name: string;
    description: string;
    icon?: string;
    steps: string[];
    relatedClasses: string[];
  }> {
    let scenarios = this.getAllScenarios();
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      scenarios = scenarios.filter(s =>
        s.scenario.toLowerCase().includes(lowerKeyword) ||
        s.description.toLowerCase().includes(lowerKeyword) ||
        s.keywords.some(k => k.toLowerCase().includes(lowerKeyword))
      );
    }

    const iconMap: Record<string, string> = {
      'custom_message': '📝',
      'add_attachment_menu': '➕',
      'custom_bubble_style': '💬',
      'theme_customization': '🎨',
      'avatar_customization': '👤',
      'message_long_press_menu': '📋',
      'chat_background_customization': '🖼️',
      'user_profile_update': '👤',
      'custom_text_style': '✍️'
    };

    return scenarios.map(s => ({
      id: s.id,
      name: s.scenario,
      description: s.description,
      icon: iconMap[s.id],
      steps: s.steps,
      relatedClasses: s.relatedClasses
    }));
  }
}