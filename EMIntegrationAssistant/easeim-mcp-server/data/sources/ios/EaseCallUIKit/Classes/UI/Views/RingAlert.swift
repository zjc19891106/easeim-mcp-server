//
//  RingAlert.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/30/25.
//

import UIKit

@objc public enum RingAlertAction: Int {
    case other
    case accept
    case decline
}

public class RingAlert: UIView {
    
    private lazy var profileImageView: ImageView = {
        let imageView = ImageView(frame: .zero)
        imageView.contentMode = .scaleAspectFill
        imageView.layer.cornerRadius = 4
//        imageView.layer.borderWidth = 2
        imageView.layer.borderColor = UIColor.white.cgColor
        imageView.clipsToBounds = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()
    
    private lazy var usernameLabel: UILabel = {
        let label = UILabel()
        label.textColor = .white
        label.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var messageLabel: UILabel = {
        let label = UILabel()
        label.textColor = .white
        label.font = UIFont.systemFont(ofSize: 14, weight: .regular)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var declineButton: UIButton = {
        let button = UIButton(type: .custom)
        button.imageView?.contentMode = .scaleAspectFit
        button.backgroundColor = UIColor.callTheme.errorColor6
        button.setImage(UIImage(named: "phone_hang_mini", in: .callBundle, with: nil), for: .normal)
        button.layer.cornerRadius = 18
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(declineCall), for: .touchUpInside)
        return button
    }()
    
    private lazy var acceptButton: UIButton = {
        let button = UIButton(type: .custom)
        button.backgroundColor = UIColor.callTheme.secondaryColor4
        button.imageView?.contentMode = .scaleAspectFit
        button.setImage(UIImage(named: "phone_pick_mini", in: .callBundle, with: nil), for: .normal)
        button.layer.cornerRadius = 18
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(acceptCall), for: .touchUpInside)
        return button
    }()
    
    public var actionClosure: ((RingAlertAction) -> Void)?
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }
    
    // MARK: - Setup
    
    private func setupView() {
        // Configure the main view
        backgroundColor = UIColor(red: 0.173, green: 0.173, blue: 0.18, alpha: 1.0) // #2C2C2E
        layer.cornerRadius = 12
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.3
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowRadius = 5
        
        self.isUserInteractionEnabled = true
        self.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(otherAction)))
        // Add subviews
        addSubview(profileImageView)
        addSubview(usernameLabel)
        addSubview(messageLabel)
        addSubview(declineButton)
        addSubview(acceptButton)
        
        // Set up constraints
        setupConstraints()
        
    }
    
    private func setupConstraints() {
        // Profile image constraints
        NSLayoutConstraint.activate([
            profileImageView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            profileImageView.centerYAnchor.constraint(equalTo: centerYAnchor),
            profileImageView.widthAnchor.constraint(equalToConstant: 40),
            profileImageView.heightAnchor.constraint(equalToConstant: 40),
            usernameLabel.leadingAnchor.constraint(equalTo: profileImageView.trailingAnchor, constant: 12),
            usernameLabel.topAnchor.constraint(equalTo: profileImageView.topAnchor, constant: 2),
            messageLabel.leadingAnchor.constraint(equalTo: usernameLabel.leadingAnchor),
            messageLabel.topAnchor.constraint(equalTo: usernameLabel.bottomAnchor),
            messageLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -126),
            
            acceptButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            acceptButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            acceptButton.widthAnchor.constraint(equalToConstant: 36),
            acceptButton.heightAnchor.constraint(equalToConstant: 36),
            declineButton.trailingAnchor.constraint(equalTo: acceptButton.leadingAnchor, constant: -16),
            declineButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            declineButton.widthAnchor.constraint(equalToConstant: 36),
            declineButton.heightAnchor.constraint(equalToConstant: 36),
            
        ])
        
        acceptButton.setHitTestEdgeInsets(UIEdgeInsets(top: -5, left: -5, bottom: -5, right: -5))
        declineButton.setHitTestEdgeInsets(UIEdgeInsets(top: -2, left: -2, bottom: -2, right: -2))
        
    }
    
    public override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
    }
    
    // MARK: - Public Methods
    
    func refresh(profile: CallProfileProtocol, type: CallType) {
        usernameLabel.text = profile.nickname.isEmpty ? profile.id:profile.nickname
        profileImageView.image(with: profile.avatarURL, placeHolder: CallAppearance.avatarPlaceHolder)
        switch type {
        case .singleAudio:
            messageLabel.text = "invite_info_audio".call.localize
        case .singleVideo:
            messageLabel.text = "invite_info_video".call.localize
        case .groupCall:
            messageLabel.text = "group_invite_info".call.localize
        }
            
    }
    
    
    // MARK: - Actions
    
    @objc private func declineCall() {
        self.actionClosure?(.decline)
    }
    
    @objc private func acceptCall() {
        self.actionClosure?(.accept)
    }
    
    @objc private func otherAction() {
        self.actionClosure?(.other)
    }
}


public class CallPopupView: UIView {
    
    // MARK: - Properties
    private let backgroundView = UIView()
    private let callCardView = RingAlert()
    public var callCardAction: ((RingAlertAction) -> Void)?
    
    // 灵动岛的位置和大小（iPhone 14 Pro系列）
    private let dynamicIslandFrame = CGRect(x: (UIScreen.main.bounds.width - 126) / 2, y: 20, width: 126, height: 37)
    
    // 动画相关属性
    private let dynamicIslandCornerRadius: CGFloat = 18.5  // 灵动岛的圆角（高度的一半）
    private let normalCornerRadius: CGFloat = 12  // 正常展开后的圆角
    
    // 约束引用
    private var cardTopConstraint: NSLayoutConstraint!
    private var cardLeadingConstraint: NSLayoutConstraint!
    private var cardTrailingConstraint: NSLayoutConstraint!
    private var cardHeightConstraint: NSLayoutConstraint!
    
    // MARK: - Initialization
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
        self.callCardView.actionClosure = { [weak self] in
            self?.handlerCallCardAction($0)
        }
    }
    
    private func handlerCallCardAction(_ action: RingAlertAction) {
        self.callCardAction?(action)
        self.dismiss()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Setup
    private func setupViews() {
        // 设置背景视图
        backgroundView.backgroundColor = UIColor.black.withAlphaComponent(0.3)
        backgroundView.translatesAutoresizingMaskIntoConstraints = false
        backgroundView.alpha = 0
        addSubview(backgroundView)
        
        // 背景视图约束
        NSLayoutConstraint.activate([
            backgroundView.topAnchor.constraint(equalTo: topAnchor),
            backgroundView.leadingAnchor.constraint(equalTo: leadingAnchor),
            backgroundView.trailingAnchor.constraint(equalTo: trailingAnchor),
            backgroundView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        
        // 设置呼叫卡片视图
        setupCallCardView()
    }
    
    private func setupCallCardView() {
        // 初始状态：与灵动岛相同的圆角
        callCardView.layer.cornerRadius = dynamicIslandCornerRadius
        callCardView.layer.masksToBounds = true
        callCardView.clipsToBounds = true
        
        // 设置阴影（使用单独的阴影层以避免与masksToBounds冲突）
        callCardView.layer.shadowColor = UIColor.black.cgColor
        callCardView.layer.shadowOpacity = 0
        callCardView.layer.shadowOffset = CGSize(width: 0, height: 10)
        callCardView.layer.shadowRadius = 20
        
        callCardView.translatesAutoresizingMaskIntoConstraints = false
        callCardView.alpha = 0  // 初始透明
        addSubview(callCardView)
        
        // 设置初始约束（灵动岛位置）
        cardTopConstraint = callCardView.topAnchor.constraint(equalTo: topAnchor, constant: dynamicIslandFrame.origin.y)
        cardLeadingConstraint = callCardView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: dynamicIslandFrame.origin.x)
        cardTrailingConstraint = callCardView.trailingAnchor.constraint(equalTo: leadingAnchor, constant: dynamicIslandFrame.origin.x + dynamicIslandFrame.width)
        cardHeightConstraint = callCardView.heightAnchor.constraint(equalToConstant: dynamicIslandFrame.height)
        
        // 激活约束
        NSLayoutConstraint.activate([
            cardTopConstraint,
            cardLeadingConstraint,
            cardTrailingConstraint,
            cardHeightConstraint
        ])
    }
    
    // MARK: - Animation
    func show() {
        consoleLogInfo("CallPopupView show", type: .info)
        
        // 确保视图在最前面
        if let window = UIApplication.shared.call.keyWindow {
            window.addSubview(self)
        } else {
            UIApplication.shared.keyWindow?.addSubview(self)
        }
        
        // 强制初始布局
        self.layoutIfNeeded()
        
        // 初始状态设置
        callCardView.alpha = 1
        callCardView.layer.cornerRadius = dynamicIslandCornerRadius
        
        // 计算最终位置
        let statusBarHeight: CGFloat
        if #available(iOS 13.0, *) {
            statusBarHeight = StatusBarHeight
        } else {
            statusBarHeight = UIApplication.shared.statusBarFrame.height
        }
        
        let screenWidth = ScreenWidth
        let finalTop = statusBarHeight
        let finalLeading: CGFloat = 12
        let finalTrailing = screenWidth - 12
        let finalHeight: CGFloat = 80
        
        // 分两步动画
        // 第一步：快速扩展并保持圆角
        cardTopConstraint.constant = finalTop
        cardLeadingConstraint.constant = finalLeading
        cardTrailingConstraint.constant = finalTrailing
        cardHeightConstraint.constant = finalHeight
        
        // 使用弹性动画效果
        UIView.animate(withDuration: 0.618,
                      delay: 0,
                      usingSpringWithDamping: 0.8,
                      initialSpringVelocity: 0.5,
                      options: [.curveEaseOut],
                      animations: {
            // 背景淡入
            self.backgroundView.alpha = 0.3
            
            // 应用约束变化
            self.layoutIfNeeded()
            
            // 逐渐调整圆角
            let progress = min(1.0, self.callCardView.frame.height / self.finalHeight)
            self.callCardView.layer.cornerRadius = self.dynamicIslandCornerRadius +
                (self.normalCornerRadius - self.dynamicIslandCornerRadius) * progress
            
            // 添加阴影动画
            self.callCardView.layer.shadowOpacity = 0.3
        }) { _ in
            // 第二步：微调圆角到最终状态
            UIView.animate(withDuration: 0.2, animations: {
                self.callCardView.layer.cornerRadius = self.normalCornerRadius
            }) { _ in
                // 确保布局正确
                self.callCardView.setNeedsLayout()
                self.callCardView.layoutIfNeeded()
            }
        }
    }
    
    func dismiss() {
        // 第一步：调整圆角并准备收缩
        UIView.animate(withDuration: 0.15, animations: {
            // 先调整圆角
            self.callCardView.layer.cornerRadius = self.dynamicIslandCornerRadius
            // 淡出阴影
            self.callCardView.layer.shadowOpacity = 0
        }) { _ in
            // 第二步：收缩到灵动岛位置
            self.cardTopConstraint.constant = self.dynamicIslandFrame.origin.y
            self.cardLeadingConstraint.constant = self.dynamicIslandFrame.origin.x
            self.cardTrailingConstraint.constant = self.dynamicIslandFrame.origin.x + self.dynamicIslandFrame.width
            self.cardHeightConstraint.constant = self.dynamicIslandFrame.height
            
            UIView.animate(withDuration: 0.35,
                          delay: 0,
                          usingSpringWithDamping: 0.9,
                          initialSpringVelocity: 0.5,
                          options: [.curveEaseIn],
                          animations: {
                // 背景淡出
                self.backgroundView.alpha = 0
                
                // 应用约束变化
                self.layoutIfNeeded()
                
                // 轻微缩小效果（模拟进入灵动岛）
                self.callCardView.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
            }) { _ in
                // 第三步：最终消失动画
                UIView.animate(withDuration: 0.1, animations: {
                    self.callCardView.alpha = 0
                    self.callCardView.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
                }) { _ in
                    self.removeFromSuperview()
                }
            }
        }
    }
    
    // 辅助属性
    private var finalHeight: CGFloat {
        return 80
    }
    
    // MARK: - Touch Handling
    public override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        // 如果点击在卡片外部，可以考虑dismiss
        if let touch = touches.first {
            let location = touch.location(in: self)
            if !callCardView.frame.contains(location) {
                // 点击背景区域时dismiss（可选）
                self.callCardAction?(.other)
            }
        }
    }
}

// MARK: - 使用示例
extension CallPopupView {
    
    // 配置呼叫者信息
    func refresh(profile: CallProfileProtocol, type: CallType) {
        callCardView.refresh(profile: profile,type: type)
    }
}

