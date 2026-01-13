//
//  MultiCallBottomView.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/3/25.
//

import UIKit

public class MultiCallBottomView: UIView {

    // MARK: - UI Elements
    private var buttonViews: [CallButtonView] = []
    private var declineButton: CallButtonView!
    private var acceptButton: CallButtonView!
    
    // MARK: - Data
    private var isExpanded = false
    
    public var buttonData = [
        CallButtonData(title: "Flip".call.localize, imageName: "flip_back", selectedImageName: "flip_front", selectedTitle: "Flip".call.localize),
        CallButtonData(title: "Mic".call.localize, status: "on".call.localize, selectedStatus: "off".call.localize, imageName: "mic_on", selectedImageName: "mic_off",selectedTitle: "Mic".call.localize),
        CallButtonData(title: "Speaker".call.localize, status: "on".call.localize, selectedStatus: "off".call.localize, imageName: "speaker_on", selectedImageName: "speaker_off", selectedTitle: "Speaker".call.localize),
        CallButtonData(title: "Camera".call.localize,status: "on".call.localize, selectedStatus: "off".call.localize, imageName: "camera_on", selectedImageName: "camera_off", selectedTitle: "Camera".call.localize),
        CallButtonData(title: "End".call.localize, imageName: "phone_hang", selectedImageName: "phone_hang", color: UIColor.callTheme.errorColor7)
    ]
    
    // MARK: - Layout Constants
    private let buttonWidth: CGFloat = 50
    private let buttonHeight: CGFloat = 82
    private let buttonSpacing: CGFloat = (ScreenWidth-80-50*4)/3.0
    private let bottomButtonSpacing: CGFloat = 16
    private let bottomButtonHeight: CGFloat = 96
    private let bottomButtonWidth: CGFloat = 70
    
    public var didTapButton: ((CallButtonType) -> Void)?
    public var animationToExpand: (() -> Void)?
    
    // 添加属性来控制按钮的启用状态
    public var isCallConnected: Bool = false {
        didSet {
            updateButtonsInteractionState()
        }
    }
    
    // 添加属性来跟踪摄像头状态
    private var isCameraOn: Bool = true {
        didSet {
            updateFlipButtonState()
        }
    }
    
    // 添加需要在通话接通后才能使用的按钮索引
    private let requiresConnectionButtonIndexes: [Int] = [] // 不再限制任何按钮
    
    // 更新Flip按钮状态（基于Camera状态）
    private func updateFlipButtonState() {
        guard buttonViews.count > 0 else { return }
        let flipButton = buttonViews[0] // Flip按钮是第一个
//        flipButton.isUserInteractionEnabled = isCameraOn
        flipButton.alpha = isCameraOn ? 1.0 : 0.5
    }
    
    // 更新按钮交互状态
    private func updateButtonsInteractionState() {
        for (index, buttonView) in buttonViews.enumerated() {
            if requiresConnectionButtonIndexes.contains(index) {
//                buttonView.isUserInteractionEnabled = isCallConnected
                buttonView.alpha = isCallConnected ? 1.0 : 0.5 // 视觉提示
            }
        }
        // 同时更新Flip按钮状态
        updateFlipButtonState()
    }
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
        setupConstraints()
    }
    
    @objc public convenience init(frame: CGRect, connected: Bool) {
        self.init(frame: frame)
        if connected {
            expandImmediately()
        }
    }
    
    private func expandImmediately() {
        guard !isExpanded else { return }
        isExpanded = true

        // 隐藏底部按钮
        declineButton.alpha = 0
        acceptButton.alpha = 0

        // 设置父视图frame为展开状态的尺寸
        self.frame = CGRect(x: 0, y: ScreenHeight - bottomButtonHeight - 16 - BottomBarHeight, width: ScreenWidth, height: bottomButtonHeight + 16)

        // 移除按钮的自动布局约束影响
        buttonViews.forEach { $0.translatesAutoresizingMaskIntoConstraints = true }

        // 显示并重新布局所有按钮
        let positions = calculateExpandedPositions()

        for (index, buttonView) in buttonViews.enumerated() {
            let position = positions[index]
            buttonView.frame = CGRect(
                x: position.x - buttonWidth / 2,
                y: position.y - buttonHeight / 2,
                width: buttonWidth,
                height: buttonHeight
            )
            buttonView.alpha = 1
            buttonView.setNeedsLayout()
            buttonView.layoutIfNeeded()
        }
        self.animationToExpand?()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Setup
    private func setupUI() {
        backgroundColor = .clear
        
        setupButtonViews()
        setupBottomButtons()
    }
    
    private func setupButtonViews() {
        // 创建所有按钮视图
        buttonData.first?.isSelected = false
        for (index, data) in buttonData.enumerated() {
            let buttonView = CallButtonView(frame: CGRect(origin: .zero, size: CGSize(width: buttonWidth, height: buttonHeight)),iconTitleSpace: 4)
            if index == 4 {
                buttonView.allowSelection = false // End Call 按钮不允许选中变化图片文字
            } else {
                buttonView.allowSelection = true // 其他按钮允许选中
            }
            if index == 0 {
                data.isSelected = true
            }
            buttonView.configure(data: data)
            buttonView.tag = index
            buttonView.didTap = { [weak self] button in
                guard let self = self else { return }

                // 检查Flip按钮是否因Camera关闭而不可用
                if button.tag == 0 && !self.isCameraOn {
                    self.shakeButton(button)
                    return
                }

                // 检查按钮是否需要通话接通
                if self.requiresConnectionButtonIndexes.contains(button.tag) && !self.isCallConnected {
                    // 提供视觉反馈但不执行操作
                    self.shakeButton(button)
                    return
                }
                
                UIImpactFeedbackGenerator.impactOccurred(style: .medium)
                if let buttonData = button.data {
                    print("bottomClick title:\(buttonData.title) isSelected:\(buttonData.isSelected) status:\(buttonData.status) tag:\(button.tag)")
                    buttonData.isSelected.toggle()
                    buttonView.configure(data: buttonData)
                    
                    // 如果是Camera按钮，更新摄像头状态
                    if button.tag == 3 {
                        self.isCameraOn = !buttonData.isSelected // isSelected为true表示camera_off状态
                    }
                    
                    if let buttonType = self.getActionType(for: buttonData, button: button) {
                        print("bottomClick type:\(buttonType) title:\(buttonData.title) isSelected:\(buttonData.isSelected) status:\(buttonData.status)")
                        self.didTapButton?(buttonType)
                    }
                }
            }
            buttonView.translatesAutoresizingMaskIntoConstraints = false
            addSubview(buttonView)
            buttonViews.append(buttonView)
        }
        
        // 初始化Flip按钮状态
        updateFlipButtonState()
    }
    
    // 添加摇晃动画提示按钮不可用
    private func shakeButton(_ button: UIView) {
        UIImpactFeedbackGenerator.impactOccurred(style: .medium)
        let animation = CAKeyframeAnimation(keyPath: "transform.translation.x")
        animation.timingFunction = CAMediaTimingFunction(name: .linear)
        animation.duration = 0.4
        animation.values = [-10, 10, -10, 10, -5, 5, -2, 2, 0]
        button.layer.add(animation, forKey: "shake")
    }
    
    private func getActionType(for data: CallButtonData, button: CallButtonView) -> CallButtonType? {
        var type: CallButtonType?
        switch button.tag {
        case 4:
            type = .end
        case 3:
            type = data.isSelected ? .camera_off : .camera_on
        case 2:
            type = data.isSelected ? .speaker_off : .speaker_on
        case 1:
            type = data.isSelected ? .mic_off : .mic_on
        case 0:
            type = data.isSelected ? .flip_back : .flip_front
        default:
            break
        }
        return type
    }
    
    private func setupBottomButtons() {
        // Decline 按钮
        declineButton = CallButtonView(frame: CGRect(origin: .zero, size: CGSize(width: bottomButtonWidth, height: bottomButtonHeight)),iconTitleSpace: 12)
        declineButton.allowSelection = false
        declineButton.translatesAutoresizingMaskIntoConstraints = false
        declineButton.configure(data: CallButtonData(title: "Decline".call.localize, imageName: "phone_hang", selectedImageName: "phone_hang", color: UIColor.callTheme.errorColor7))
        declineButton.didTap = { _ in
            UIImpactFeedbackGenerator.impactOccurred(style: .medium)
            self.didTapButton?(.decline)
        }
        addSubview(declineButton)
        
        // Accept 按钮
        acceptButton = CallButtonView(frame: CGRect(origin: .zero, size: CGSize(width: bottomButtonWidth, height: bottomButtonHeight)),iconTitleSpace: 12)
        acceptButton.allowSelection = false
        acceptButton.translatesAutoresizingMaskIntoConstraints = false
        acceptButton.configure(data: CallButtonData(title: "Accept".call.localize, imageName: "phone_pick", selectedImageName: "phone_pick", color: UIColor.callTheme.secondaryColor4))
        acceptButton.didTap = { [weak self] _ in
            UIImpactFeedbackGenerator.impactOccurred(style: .medium)
            guard let `self` = self else { return }
            self.animateToExpandedState()
            self.didTapButton?(.accept)
        }
        addSubview(acceptButton)
    }
    
    private func setupConstraints() {
        // 设置初始状态的按钮位置 - 居中显示一行4个按钮
        let initialPositions = getInitialPositions()
        
        for i in 0..<min(4, buttonViews.count) {
            let buttonView = buttonViews[i]
            NSLayoutConstraint.activate([
                buttonView.centerXAnchor.constraint(equalTo: centerXAnchor, constant: initialPositions[i].x - self.bounds.width / 2),
                buttonView.topAnchor.constraint(equalTo: topAnchor, constant: 20),
                buttonView.widthAnchor.constraint(equalToConstant: buttonWidth),
                buttonView.heightAnchor.constraint(equalToConstant: buttonHeight)
            ])
        }
        
        // End按钮初始隐藏在屏幕外
        if buttonViews.count > 4 {
            let endButton = buttonViews[4]
            NSLayoutConstraint.activate([
                endButton.centerXAnchor.constraint(equalTo: centerXAnchor, constant: self.bounds.width),
                endButton.centerYAnchor.constraint(equalTo: centerYAnchor),
                endButton.widthAnchor.constraint(equalToConstant: buttonWidth),
                endButton.heightAnchor.constraint(equalToConstant: buttonHeight)
            ])
            endButton.alpha = 0
        }
        
        
        // 底部按钮约束
        NSLayoutConstraint.activate([
            declineButton.centerXAnchor.constraint(equalTo: centerXAnchor, constant: -112),
            declineButton.topAnchor.constraint(equalTo: topAnchor, constant: buttonHeight+24),
            declineButton.widthAnchor.constraint(equalToConstant: bottomButtonWidth),
            declineButton.heightAnchor.constraint(equalToConstant: bottomButtonHeight),
            
            acceptButton.centerXAnchor.constraint(equalTo: centerXAnchor, constant: 112),
            acceptButton.topAnchor.constraint(equalTo: topAnchor, constant: buttonHeight+24),
            acceptButton.widthAnchor.constraint(equalToConstant: bottomButtonWidth),
            acceptButton.heightAnchor.constraint(equalToConstant: bottomButtonHeight)
        ])
    }
    
    
    private func getInitialPositions() -> [CGPoint] {
        let centerX = bounds.width / 2
        let centerY = bounds.height / 2 - buttonWidth
        let totalWidth = CGFloat(3) * (buttonWidth + buttonSpacing) // 4个按钮，3个间距
        let startX = centerX - totalWidth / 2
        
        var positions: [CGPoint] = []
        for i in 0..<4 {
            let x = startX + CGFloat(i) * (buttonWidth + buttonSpacing)
            positions.append(CGPoint(x: x, y: centerY))
        }
        
        return positions
    }
    
    // MARK: - Animation Methods
    func animateToExpandedState() {
        guard !isExpanded else { return }
        isExpanded = true
        
        let animationDuration: TimeInterval = 0.8
        
        // 1. 隐藏底部按钮
        UIView.animate(withDuration: 0.3) {
            self.frame = CGRect(x: 0, y: ScreenHeight - self.bottomButtonHeight - 16 - BottomBarHeight, width: ScreenWidth, height: self.bottomButtonHeight+16)
            self.animationToExpand?()
            self.declineButton.alpha = 0
            self.acceptButton.alpha = 0
        }
        
        // 2. 计算展开后的目标位置（图三的正常边距和间距）
        let expandedPositions = calculateExpandedPositions()
        
        // 3. 移除所有按钮的现有约束以避免干扰
        buttonViews.forEach { $0.translatesAutoresizingMaskIntoConstraints = true }
        
        // 4. 显示所有按钮并移动到新位置
        for (index, buttonView) in buttonViews.enumerated() {
            let targetPosition = expandedPositions[index]
            let delay = Double(index) * 0.08 // 错开动画时间
                        
            UIView.animate(
                withDuration: animationDuration,
                delay: delay,
                usingSpringWithDamping: 0.75,
                initialSpringVelocity: 0.5,
                options: [.curveEaseInOut, .allowUserInteraction],
                animations: {
                    buttonView.center = targetPosition
                    buttonView.alpha = 1 // 确保 End 按钮显示
                    buttonView.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
                },
                completion: { _ in
                    UIView.animate(withDuration: 0.15) {
                        buttonView.transform = CGAffineTransform.identity
                    }
                }
            )
        }
    }

    private func animateToInitialState() {
        guard isExpanded else { return }
        isExpanded = false
        
        let animationDuration: TimeInterval = 0.6
        let initialPositions = getInitialPositions()
        
        // 1. 移动前4个按钮回到初始位置
        for i in 0..<min(4, buttonViews.count) {
            let buttonView = buttonViews[i]
            let delay = Double(3 - i) * 0.08 // 反向错开动画
            
            UIView.animate(
                withDuration: animationDuration,
                delay: delay,
                usingSpringWithDamping: 0.8,
                initialSpringVelocity: 0.5,
                options: [.curveEaseInOut, .allowUserInteraction],
                animations: {
                    buttonView.center = initialPositions[i]
                    buttonView.transform = CGAffineTransform.identity
                },
                completion: { _ in
                    if i == 0 { // 当第一个按钮动画完成时显示底部按钮
                        UIView.animate(withDuration: 0.4, delay: 0.3) {
                            self.declineButton.alpha = 1
                            self.acceptButton.alpha = 1
                        }
                    }
                }
            )
        }
        
        // 2. End按钮移出屏幕
        if buttonViews.count > 4 {
            UIView.animate(withDuration: 0.4) {
                self.buttonViews[4].center.x = self.bounds.width + 50
                self.buttonViews[4].alpha = 0
            }
        }
    }

    private func calculateExpandedPositions() -> [CGPoint] {
        let bottomY = CGFloat((bottomButtonHeight+bottomButtonSpacing)/2.0)
        let horizontalMargin: CGFloat = 17
        let spacing = (ScreenWidth - 2 * horizontalMargin - CGFloat(buttonViews.count) * buttonWidth) / CGFloat(buttonViews.count - 1) // 动态计算间距
        let startX = horizontalMargin + buttonWidth / 2 // 第一个按钮的起始 x 坐标
        
        var positions: [CGPoint] = []
        for i in 0..<buttonViews.count {
            let x = startX + CGFloat(i) * (buttonWidth + spacing)
            positions.append(CGPoint(x: x, y: bottomY))
        }
        
        return positions
    }

    func updateButtonSelectedStatus(selectedIndex: Int, triggerCallback: Bool = true) {
        guard selectedIndex >= 0 && selectedIndex < buttonViews.count else {
            consoleLogInfo("MultiCallBottomView: Invalid index for updating button status.", type: .error)
            return
        }

        // 更新按钮状态
        let buttonView = buttonViews[selectedIndex]
        if let data = buttonView.data {
            data.isSelected.toggle()
            buttonView.configure(data: data)

            // 如果是Camera按钮，更新摄像头状态
            if selectedIndex == 3 {
                isCameraOn = !data.isSelected
            }

            // 执行对应的操作（可选是否触发回调）
            if triggerCallback, let actionType = getActionType(for: data, button: buttonView) {
                didTapButton?(actionType)
            }
        }
    }
}
