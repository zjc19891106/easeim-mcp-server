//
//  CallButtonView.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/2/25.
//

// MARK: - CallButtonView
@objc public class CallButtonView: UIView {
    
    private let imageView = UIImageView().contentMode(.scaleAspectFit).backgroundColor(.clear)
    private let nameLabel = UILabel()  // 第一行：名称标签（如 "Mike"）
    private let statusLabel = UILabel()  // 第二行：状态标签（如 "on/off"）
    public let containerView = UIView()
    public var allowSelection: Bool = true
    public var buttonTag = 0
    // 闭包属性，用于处理点击事件
    public var didTap: ((CallButtonView) -> Void)?
    
    public private(set) var data: CallButtonData?
    
    private var containerCornerRadius: CGFloat = 0
    
    // 存储约束以便动态调整
    private var nameLabelTopConstraint: NSLayoutConstraint!
    
    // iconTitleSpace 设置为可修改的计算属性
    public var iconTitleSpace: CGFloat = 4
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        self.containerCornerRadius = frame.width / 2
        setupUI()
    }
    
    convenience public init(frame: CGRect, iconTitleSpace: CGFloat = 4) {
        self.init(frame: frame)
        self.iconTitleSpace = iconTitleSpace
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        // 容器视图
        containerView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(containerView)
        
        // 图标
        imageView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(imageView)
        
        // 名称标签（第一行）
        nameLabel.textColor = .white
        nameLabel.font = UIFont.systemFont(ofSize: 11)
        nameLabel.textAlignment = .center
        nameLabel.numberOfLines = 1
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(nameLabel)
        
        // 状态标签（第二行）
        statusLabel.textColor = .white
        statusLabel.font = UIFont.systemFont(ofSize: 11)  // 稍小的字体
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 1
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(statusLabel)
        
        // 创建名称标签顶部约束并存储引用
        nameLabelTopConstraint = nameLabel.topAnchor.constraint(equalTo: containerView.bottomAnchor, constant: iconTitleSpace)
        
        // 约束
        NSLayoutConstraint.activate([
            // 容器视图约束
            containerView.topAnchor.constraint(equalTo: topAnchor),
            containerView.centerXAnchor.constraint(equalTo: centerXAnchor),
            containerView.widthAnchor.constraint(equalTo: widthAnchor),
            containerView.heightAnchor.constraint(equalTo: widthAnchor),
            
            // 图标约束
            imageView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 9),
            imageView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -9),
            imageView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 9),
            imageView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -9),
            
            // 名称标签约束
            nameLabelTopConstraint, // 使用存储的约束
            nameLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            nameLabel.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor),
            nameLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor),
            
            // 状态标签约束
            statusLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 2),
            statusLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            statusLabel.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor),
            statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor),
            statusLabel.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor)
        ])
        
        containerView.layer.cornerRadius = self.containerCornerRadius
        self.isUserInteractionEnabled = true
        self.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(buttonTapped)))
    }
    
    // 更新图标与标题之间的间距
    private func updateIconTitleSpacing() {
        nameLabelTopConstraint.constant = iconTitleSpace
        layoutIfNeeded()
    }
    
    @objc private func buttonTapped() {
        // 触发缩放动画
        UIView.animate(withDuration: 0.1, animations: {
            self.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
        }) { _ in
            UIView.animate(withDuration: 0.1) {
                self.transform = CGAffineTransform.identity
            }
        }
        
        // 调用闭包，通知外部点击事件
        didTap?(self)
    }
    
    @MainActor func configure(data: CallButtonData) {
        self.data = data
        if allowSelection {
            containerView.backgroundColor = data.isSelected ? UIColor.callTheme.barrageLightColor5:UIColor.callTheme.barrageDarkColor9
            imageView.image = UIImage(named: data.isSelected ? data.selectedImageName:data.imageName, in: .callBundle, with: nil)
            nameLabel.text = data.title
            statusLabel.text = data.isSelected ? data.selectedStatus : data.status
        } else {
            containerView.backgroundColor = data.color
            imageView.image = UIImage(named: data.imageName, in: .callBundle, with: nil)
            nameLabel.text = data.title
            statusLabel.text = data.status
        }
    }
    
    // 便捷方法：设置间距并可选择是否带动画
    public func setIconTitleSpacing(_ spacing: CGFloat, animated: Bool = false) {
        if animated {
            UIView.animate(withDuration: 0.3) {
                self.iconTitleSpace = spacing
                self.updateIconTitleSpacing()
            }
        } else {
            self.iconTitleSpace = spacing
            self.updateIconTitleSpacing()
        }
    }
    
    // 便捷方法：更新标签样式
    public func setLabelStyles(nameFontSize: CGFloat = 12, statusFontSize: CGFloat = 11,
                               nameColor: UIColor = .white, statusColor: UIColor = .white) {
        nameLabel.font = UIFont.systemFont(ofSize: nameFontSize)
        nameLabel.textColor = nameColor
        statusLabel.font = UIFont.systemFont(ofSize: statusFontSize)
        statusLabel.textColor = statusColor
    }
}

@objc public enum CallButtonType: UInt {
    case mic_on
    case mic_off
    case flip_back
    case flip_front
    case camera_on
    case camera_off
    case speaker_on
    case speaker_off
    case decline
    case accept
    case end
    case virtual_on
    case virtual_off
    case screen_share_on
    case screen_share_off
}

@objc public class CallButtonData: NSObject {
    var title: String  // 第一行文字（如 "Mike"）
    var status: String  // 第二行文字（如 "off"）
    var selectedStatus: String  // 选中时的第二行文字（如 "on"）
    var selectedTitle: String?  // 选中时的第一行文字（可选）
    var imageName: String
    var selectedImageName: String
    var color: UIColor?
    var isSelected: Bool = false
    
    public init(title: String,
                status: String = "",
                selectedStatus: String = "",
                imageName: String,
                selectedImageName: String,
                color: UIColor? = nil,
                selectedTitle: String? = nil) {
        self.title = title
        self.status = status
        self.selectedStatus = selectedStatus.isEmpty ? status : selectedStatus
        self.imageName = imageName
        self.selectedImageName = selectedImageName
        self.color = color
        self.selectedTitle = selectedTitle
        super.init()
    }
}

// 使用示例
/*
let micButton = CallButtonView(frame: CGRect(x: 0, y: 0, width: 60, height: 80))
let micData = CallButtonData(
    title: "Mike",
    status: "off",
    selectedStatus: "on",
    imageName: "mic_off",
    selectedImageName: "mic_on"
)
micButton.configure(data: micData)
*/
