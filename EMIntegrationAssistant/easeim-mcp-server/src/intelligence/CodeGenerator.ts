/**
 * 代码模板生成器
 * 根据场景和参数生成完整可用的 Swift 代码
 */

/**
 * 代码模板
 */
export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  variables: TemplateVariable[];
  template: string;
}

/**
 * 模板变量
 */
export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

/**
 * 生成选项
 */
export interface GenerateOptions {
  messageName?: string;
  eventIdentifier?: string;
  cellHeight?: number;
  includeComments?: boolean;
  includeDataModel?: boolean;
}

/**
 * 代码生成结果
 */
export interface GenerateResult {
  success: boolean;
  code?: string;
  templateId?: string;
  description?: string;
  usage?: string;
  relatedFiles?: string[];
  error?: string;
}

export class CodeGenerator {

  private templates: Map<string, CodeTemplate> = new Map();

  constructor() {
    this.loadTemplates();
  }

  /**
   * 加载所有代码模板
   */
  private loadTemplates() {
    // 完整自定义消息模板 (V3 - 包含渲染、发送、点击、菜单定制)
    this.templates.set('custom_message_full', {
      id: 'custom_message_full',
      name: '自定义消息完整实现',
      description: '包含数据模型、Cell、注册、发送、点击处理、长按菜单定制的完整代码',
      variables: [
        { name: 'messageName', description: '消息名称（如 Order）', required: true },
        { name: 'eventIdentifier', description: '消息事件标识符', required: false, defaultValue: 'CUSTOM_MESSAGE' },
        { name: 'cellHeight', description: 'Cell 高度', required: false, defaultValue: '120' },
      ],
      template: `// ============================================================ 
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

    required public init?(coder: NSCoder) { fatalError() }

    open override func refresh(entity: MessageEntity) {
        super.refresh(entity: entity)
        guard let body = entity.message.body as? ChatCustomMessageBody,
              let data = {{messageName}}MessageData.from(ext: body.customExt) else { return }
        
        titleLabel.text = data.title
        priceLabel.text = "¥\(data.price)"
        
        // 布局 (示例)
        let bubbleWidth = self.bubbleWithArrow.frame.width
        titleLabel.frame = CGRect(x: 12, y: 12, width: bubbleWidth - 24, height: 40)
        priceLabel.frame = CGRect(x: 12, y: 56, width: 100, height: 20)
    }
}

// MARK: - 4. 消息实体与高度计算 (数据/布局层)
@objcMembers open class {{messageName}}MessageEntity: MessageEntity {

    public var customData: {{messageName}}MessageData?

    public override init(message: ChatMessage) {
        super.init(message: message)
        if let body = message.body as? ChatCustomMessageBody {
            self.customData = {{messageName}}MessageData.from(ext: body.customExt)
        }
    }

    open override func customSize() -> CGSize {
        guard let body = self.message.body as? ChatCustomMessageBody,
              body.event == EaseChatUIKit_{{messageName_lower}}_message else {
            return super.customSize()
        }
        return CGSize(width: limitBubbleWidth, height: {{cellHeight}})
    }
}

// MARK: - 5. 自定义消息列表控制器 (业务/交互层)
@objcMembers open class {{messageName}}MessageListController: MessageListController {

    // --- A. 发送逻辑 ---
    open override func handleAttachmentAction(item: ActionSheetItemProtocol) {
        if item.tag == "{{messageName}}" {
            send{{messageName}}Message()
            return
        }
        super.handleAttachmentAction(item: item)
    }

    private func send{{messageName}}Message() {
        let testData = {{messageName}}MessageData(id: "123", title: "测试{{messageName}}", subtitle: "", imageURL: "", price: 99.0, status: "OK")
        let body = ChatCustomMessageBody(event: EaseChatUIKit_{{messageName_lower}}_message, customExt: testData.toExtension())
        let message = ChatMessage(conversationID: self.profile.id, body: body, ext: nil)
        self.viewModel.driver?.showMessage(message: message)
        ChatClient.shared().chatManager?.send(message, progress: nil, completion: nil)
    }

    // --- B. 点击处理 ---
    open override func messageBubbleClicked(message: MessageEntity) {
        if let body = message.message.body as? ChatCustomMessageBody, body.event == EaseChatUIKit_{{messageName_lower}}_message {
            print("点击了{{messageName}}消息")
            return
        }
        super.messageBubbleClicked(message: message)
    }

    // --- C. 长按菜单定制 (关键补充) ---
    open override func filterMessageActions(message: MessageEntity) -> [ActionSheetItemProtocol] {
        var actions = super.filterMessageActions(message: message)
        
        if let body = message.message.body as? ChatCustomMessageBody, body.event == EaseChatUIKit_{{messageName_lower}}_message {
            // 1. 移除不需要的项 (如翻译)
            actions.removeAll { $0.tag == "Translate" || $0.tag == "OriginalText" }
            
            // 2. 新增业务项
            let customAction = ActionSheetItem(title: "业务操作", type: .normal, tag: "BizAction", image: UIImage(systemName: "star"))
            actions.append(customAction)
        }
        return actions
    }

    open override func processMessage(item: ActionSheetItemProtocol, message: ChatMessage) {
        if item.tag == "BizAction" {
            print("执行自定义菜单操作")
            return
        }
        super.processMessage(item: item, message: message)
    }
}

// MARK: - 6. 初始化注册
func setup{{messageName}}Message() {
    ComponentsRegister.shared.registerCustomCellClasses(cellType: {{messageName}}MessageCell.self, identifier: EaseChatUIKit_{{messageName_lower}}_message)
    ComponentsRegister.shared.MessageRenderEntity = {{messageName}}MessageEntity.self
    ComponentsRegister.shared.MessageViewController = {{messageName}}MessageListController.self
    
    let menuItem = ActionSheetItem(title: "发送{{messageName}}", type: .normal, tag: "{{messageName}}", image: UIImage(systemName: "cart"))
    Appearance.chat.inputExtendActions.append(menuItem)
}
`,
    });

    // 添加附件菜单模板
    this.templates.set('attachment_menu', {
      id: 'attachment_menu',
      name: '添加附件菜单项',
      description: '在输入框 + 按钮菜单中添加自定义选项',
      variables: [
        { name: 'menuName', description: '菜单名称', required: true },
        { name: 'menuTag', description: '菜单标识符', required: true },
        { name: 'iconName', description: 'SF Symbol 图标名', required: false, defaultValue: 'doc' },
      ],
      template: `// ============================================================ 
// MARK: - 添加附件菜单项：{{menuName}}
// ============================================================ 

import UIKit
import EaseChatUIKit

// MARK: - 1. 添加菜单项配置
func addCustomMenuItem() {
    let menuItem = ActionSheetItem(
        title: "{{menuName}}",
        type: .normal,
        tag: "{{menuTag}}",
        image: UIImage(systemName: "{{iconName}}")?.withTintColor(.systemBlue, renderingMode: .alwaysOriginal)
    )
    Appearance.chat.inputExtendActions.append(menuItem)
}

// MARK: - 2. 自定义消息列表控制器处理点击
@objcMembers open class Custom{{menuTag}}MessageListController: MessageListController {

    open override func handleAttachmentAction(item: ActionSheetItemProtocol) {
        switch item.tag {
        case "{{menuTag}}":
            handle{{menuTag}}Action()
        default:
            super.handleAttachmentAction(item: item)
        }
    }

    @objc open func handle{{menuTag}}Action() {
        print("{{menuName}} 被点击了")
    }
}

// MARK: - 3. 注册自定义控制器
func setupCustomMenu() {
    addCustomMenuItem()
    ComponentsRegister.shared.MessageViewController = Custom{{menuTag}}MessageListController.self
}
`,
    });

    // 主题配置模板
    this.templates.set('theme_config', {
      id: 'theme_config',
      name: '主题颜色配置',
      description: '配置 UIKit 的主题色调',
      variables: [
        { name: 'primaryHue', description: '主色调 (0-360)', required: false, defaultValue: '203' },
        { name: 'secondaryHue', description: '次要色调 (0-360)', required: false, defaultValue: '155' },
      ],
      template: `// ============================================================ 
// MARK: - UIKit 主题颜色配置
// ============================================================ 

import EaseChatUIKit

func configureTheme() {
    Appearance.primaryHue = {{primaryHue}}/360.0
    Appearance.secondaryHue = {{secondaryHue}}/360.0
    Appearance.errorHue = 350/360.0
    Appearance.neutralHue = 203/360.0
    Appearance.neutralSpecialHue = 220/360.0
}
`,
    });

    // 气泡样式模板
    this.templates.set('bubble_style', {
      id: 'bubble_style',
      name: '消息气泡样式配置',
      description: '配置消息气泡的外观样式',
      variables: [],
      template: `// ============================================================ 
// MARK: - 消息气泡样式配置
// ============================================================ 

import EaseChatUIKit

func configureBubbleStyle() {
    Appearance.chat.bubbleStyle = .withArrow
    Appearance.chat.contentStyle = [.withReply,.withAvatar,.withNickName,.withDateAndTime]
    Appearance.chat.imageMessageCorner = 8
    Appearance.avatarRadius = .medium
}
`,
    });

    // 长按菜单模板
    this.templates.set('long_press_menu', {
      id: 'long_press_menu',
      name: '消息长按菜单配置',
      description: '自定义消息长按后的操作菜单',
      variables: [
        { name: 'actionName', description: '操作名称', required: true },
        { name: 'actionTag', description: '操作标识符', required: true },
      ],
      template: `// ============================================================ 
// MARK: - 消息长按菜单配置
// ============================================================ 

import EaseChatUIKit

// MARK: - 1. 添加自定义菜单项
func addCustomLongPressAction() {
    let customAction = ActionSheetItem(title: "{{actionName}}", type: .normal, tag: "{{actionTag}}", image: UIImage(systemName: "star"))
    Appearance.chat.messageLongPressedActions.append(customAction)
}

// MARK: - 2. 处理自定义操作
@objcMembers open class CustomMenuMessageListController: MessageListController {
    open override func processMessage(item: ActionSheetItemProtocol, message: ChatMessage) {
        if item.tag == "{{actionTag}}" {
            print("执行 {{actionName}} 操作")
            return
        }
        super.processMessage(item: item, message: message)
    }
}

func setupCustomLongPressMenu() {
    addCustomLongPressAction()
    ComponentsRegister.shared.MessageViewController = CustomMenuMessageListController.self
}
`,
    });

    // 头像配置模板
    this.templates.set('avatar_config', {
      id: 'avatar_config',
      name: '头像样式配置',
      description: '配置头像的圆角和占位图',
      variables: [],
      template: `// ============================================================ 
// MARK: - 头像样式配置
// ============================================================ 

import EaseChatUIKit

func configureAvatarStyle() {
    Appearance.avatarRadius = .medium
    Appearance.avatarPlaceHolder = UIImage(named: "default_avatar")
    Appearance.conversation.singlePlaceHolder = UIImage(named: "single")
    Appearance.conversation.groupPlaceHolder = UIImage(named: "group")
}
`,
    });

    // 文本样式深度定制模板
    this.templates.set('text_style_customization', {
      id: 'text_style_customization',
      name: '文本消息样式深度定制',
      description: '通过重写 MessageEntity 拦截富文本生成过程，修改文字颜色、字体等。',
      variables: [
        { name: 'textColor', description: '文字颜色 (Swift 代码)', required: false, defaultValue: 'UIColor.systemPurple' },
        { name: 'fontSize', description: '字体大小', required: false, defaultValue: '16' },
      ],
      template: `// ============================================================ 
// MARK: - 文本消息样式深度定制
// ============================================================ 

import UIKit
import EaseChatUIKit

@objcMembers open class CustomTextStyleEntity: MessageEntity {
    open override func convertTextAttribute() -> NSAttributedString? {
        guard let original = super.convertTextAttribute() else { return nil }
        let mutable = NSMutableAttributedString(attributedString: original)
        let fullRange = NSRange(location: 0, length: mutable.length)
        let textColor = (self.message.direction == .send) ? UIColor.white : {{textColor}}
        mutable.addAttribute(.foregroundColor, value: textColor, range: fullRange)
        mutable.addAttribute(.font, value: UIFont.systemFont(ofSize: {{fontSize}}), range: fullRange)
        return mutable
    }
}

func setupCustomTextStyle() {
    ComponentsRegister.shared.MessageRenderEntity = CustomTextStyleEntity.self
}
`,
    });

    // 聊天背景定制模板
    this.templates.set('chat_background_config', {
      id: 'chat_background_config',
      name: '聊天页面背景定制',
      description: '为聊天页面添加自定义背景图',
      variables: [{ name: 'imageName', description: '图片资源名称', required: false, defaultValue: 'chat_bg' }],
      template: `// ============================================================ 
// MARK: - 聊天页面背景定制
// ============================================================ 

import UIKit
import EaseChatUIKit

@objcMembers open class CustomBackgroundMessageController: MessageListController {
    public private(set) lazy var backgroundImageView: UIImageView = {
        let imageView = UIImageView(frame: self.view.bounds)
        imageView.image = UIImage(named: "{{imageName}}")
        imageView.contentMode = .scaleAspectFill
        imageView.autoresizingMask = [.flexibleWidth, .autoresizableHeight]
        return imageView
    }()

    open override func viewDidLoad() {
        super.viewDidLoad()
        self.view.insertSubview(backgroundImageView, at: 0)
        self.messageContainer.backgroundColor = .clear
        self.messageContainer.messageList.backgroundColor = .clear
    }
}

func setupChatBackground() {
    ComponentsRegister.shared.MessageViewController = CustomBackgroundMessageController.self
}
`,
    });

    // 用户信息手动更新模板
    this.templates.set('user_profile_customization', {
      id: 'user_profile_customization',
      name: '手动更新用户信息 (userCache)',
      description: '手动向缓存注入用户信息以实时刷新 UI',
      variables: [
        { name: 'userId', description: '用户 ID', required: true },
        { name: 'nickname', description: '昵称', required: true },
        { name: 'avatarURL', description: '头像 URL', required: false, defaultValue: '' },
      ],
      template: `// ============================================================ 
// MARK: - 用户资料更新方案 (Provider 与 Cache)
// ============================================================ 

import EaseChatUIKit

func setupUserProfileProvider(provider: ChatUserProfileProvider) {
    ChatUIKitContext.shared?.userProfileProvider = provider
    // CallKitManager.shared.profileProvider = provider
}

func updateUserInfoManually(userId: String, nickname: String, avatarURL: String) {
    let profile = ChatUserProfile()
    profile.id = userId
    profile.nickname = nickname
    profile.avatarURL = avatarURL
    ChatUIKitContext.shared?.userCache?[userId] = profile
}
`,
    });
  }

  /**
   * 生成代码
   */
  generate(templateId: string, options: GenerateOptions = {}): GenerateResult {
    const template = this.templates.get(templateId);
    if (!template) {
      return { success: false, error: `模板不存在: ${templateId}` };
    }

    try {
      let code = template.template;
      const name = options.messageName || 'Custom';
      const lowerName = name.charAt(0).toLowerCase() + name.slice(1);
      
      code = code.replace(/{{messageName}}/g, name);
      code = code.replace(/{{messageName_lower}}/g, lowerName);
      code = code.replace(/{{eventIdentifier}}/g, options.eventIdentifier || `${name.toUpperCase()}_MESSAGE`);
      code = code.replace(/{{cellHeight}}/g, String(options.cellHeight || 120));
      
      // 其他默认值填充
      code = code.replace(/{{textColor}}/g, 'UIColor.systemPurple');
      code = code.replace(/{{fontSize}}/g, '16');
      code = code.replace(/{{imageName}}/g, 'chat_bg');
      code = code.replace(/{{menuName}}/g, name);
      code = code.replace(/{{menuTag}}/g, name);
      code = code.replace(/{{actionName}}/g, name);
      code = code.replace(/{{actionTag}}/g, name);

      const usageMap: Record<string, string> = {
        'custom_message_full': `在 AppDelegate 中调用 setup${name}Message() 完成初始化`,
        'user_profile_customization': '在需要更新资料处调用 updateUserInfoManually()',
        'chat_background_config': '在应用初始化时调用 setupChatBackground()',
        'text_style_customization': '在应用初始化时调用 setupCustomTextStyle()'
      };

      return {
        success: true,
        code,
        templateId,
        description: template.description,
        usage: usageMap[templateId] || '请参考代码注释进行集成',
        relatedFiles: ['ComponentsRegister.swift', 'MessageListController.swift']
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  getTemplate(templateId: string): CodeTemplate | null {
    return this.templates.get(templateId) || null;
  }

  listTemplates(): Array<{ id: string; name: string; description: string }> {
    return Array.from(this.templates.values()).map(t => ({ id: t.id, name: t.name, description: t.description }));
  }

  recommendTemplate(scenario: string): string | null {
    const map: Record<string, string> = {
      'custom_message': 'custom_message_full',
      'user_profile_update': 'user_profile_customization',
      'chat_background_customization': 'chat_background_config',
      'custom_text_style': 'text_style_customization'
    };
    return map[scenario] || null;
  }
}
