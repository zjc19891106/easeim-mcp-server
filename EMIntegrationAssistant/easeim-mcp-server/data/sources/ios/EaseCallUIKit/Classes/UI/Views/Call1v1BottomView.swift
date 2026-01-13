//
//  Call1v1BottomView.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/7/25.
//

import UIKit

enum Call1v1BottomViewState {
    case incoming      // 被叫状态（2个按钮）
    case outgoing      // 主叫状态（3个按钮）
    case connected     // 接通状态（3个按钮）
}

// MARK: - CallControlView
public class Call1v1BottomView: UIView {
    
    public var didTapButton: ((CallButtonType) -> Void)?
    
    // MARK: - Properties
    var currentState: Call1v1BottomViewState = .incoming
    private let buttonSize: CGFloat = 64
    private let incomingButtonSpacing: CGFloat = 105  // decline/accept 按钮距离中心的距离
    private let connectedButtonSpacing: CGFloat = 128 // mic/speaker 按钮距离 End 按钮的距离
    private let animationDuration: TimeInterval = 0.5
    private let staggerDelay: TimeInterval = 0.1
    private let declineTag = 1
    private let acceptTag = 2
    private let muteTag = 3
    private let speakerTag = 5
    private let hangupTag = 4
    
    // Button sizes
    private let mainButtonSize = CGSize(width: 70, height: 96)  // decline/accept/hangup buttons
    private let smallButtonSize = CGSize(width: 50, height: 82)  // mute/speaker buttons
    
    // Buttons using CallButtonView
    private lazy var declineButton: CallButtonView = {
        let button = createCallButton(
            data: CallButtonData(
                title: "Decline".call.localize,
                imageName: "phone_hang",
                selectedImageName: "",
                color: UIColor.callTheme.errorColor7
            ),
            tag: declineTag
        )
        return button
    }()
    
    private lazy var acceptButton: CallButtonView = {
        let button = createCallButton(
            data: CallButtonData(
                title: "Accept".call.localize,
                imageName: "phone_pick",
                selectedImageName: "",
                color: UIColor.callTheme.secondaryColor4
            ),
            tag: acceptTag
        )
        return button
    }()
    
    private lazy var muteButton: CallButtonView = {
        let button = createCallButton(
            data: CallButtonData(
                title: "Mic".call.localize,
                status: "on".call.localize,
                selectedStatus: "off".call.localize,
                imageName: "mic_on",
                selectedImageName: "mic_off",
                color: nil,
                selectedTitle: "Mic".call.localize
            ),
            tag: muteTag
        )
        return button
    }()
    
    private lazy var speakerButton: CallButtonView = {
        let button = createCallButton(
            data: CallButtonData(
                title: "Speaker".call.localize,
                status: "on".call.localize,
                selectedStatus: "off".call.localize,
                imageName: "speaker_on",
                selectedImageName: "speaker_off",
                color: nil,
                selectedTitle: "Speaker".call.localize
            ),
            tag: speakerTag
        )
        return button
    }()
    
    private lazy var hangupButton: CallButtonView = {
        let button = createCallButton(
            data: CallButtonData(
                title: "End".call.localize,
                imageName: "phone_end",
                selectedImageName: "",
                color: UIColor.callTheme.errorColor7
            ),
            tag: hangupTag
        )
        return button
    }()
    
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
        backgroundColor = .clear
        clipsToBounds = false // Allow buttons to appear from outside bounds
        setupInitialState()
    }
    
    private func createCallButton(data: CallButtonData, tag: Int) -> CallButtonView {
        var buttonAllowSelection = true
        var buttonSize: CGSize
        var space = CGFloat(4)
        
        if tag == declineTag || tag == hangupTag || tag == acceptTag {
            buttonSize = mainButtonSize
            buttonAllowSelection = false
            space = 12
        } else {
            buttonSize = smallButtonSize
        }
        
        let button = CallButtonView(frame: CGRect(origin: .zero, size: buttonSize), iconTitleSpace: space)
        button.allowSelection = buttonAllowSelection
        button.configure(data: data)
        button.buttonTag = tag
        
        // Set up tap handler
        button.didTap = { [weak self] sender in
            if sender.allowSelection {
                sender.data?.isSelected.toggle()
                if let data = sender.data {
                    sender.configure(data: data)
                }
            }
            self?.handleButtonTap(sender)
        }
        
        return button
    }
    
    private func setupInitialState() {
        // Add all buttons but hide some initially
        addSubview(declineButton)
        addSubview(acceptButton)
        addSubview(muteButton)
        addSubview(speakerButton)
        addSubview(hangupButton)
        
        // Set initial frames
        declineButton.frame.size = mainButtonSize
        acceptButton.frame.size = mainButtonSize
        muteButton.frame.size = smallButtonSize
        speakerButton.frame.size = smallButtonSize
        hangupButton.frame.size = mainButtonSize
        
        // Set initial state
        setState(.incoming, animated: false)
    }
    
    // MARK: - State Management
    func setState(_ state: Call1v1BottomViewState, animated: Bool = true) {
        if currentState == state {
            return
        }
        let previousState = currentState
        currentState = state
        
        // Reset decline button tag if transitioning away from connected state
        if previousState == .connected && state != .connected && declineButton.tag == CallButtonType.end.rawValue {
            declineButton.tag = Int(CallButtonType.decline.rawValue)
        }
        
        if animated {
            animateToState(state, from: previousState)
        } else {
            setButtonsForState(state, animated: false)
        }
    }
    
    private func setButtonsForState(_ state: Call1v1BottomViewState, animated: Bool) {
        let centerY = bounds.height / 2.0 - 20
        let centerX = bounds.width / 2.0
        
        switch state {
        case .incoming:
            // Two buttons: decline and accept (距离中心 105)
            positionButton(declineButton, at: CGPoint(x: centerX - incomingButtonSpacing, y: centerY), animated: animated)
            positionButton(acceptButton, at: CGPoint(x: centerX + incomingButtonSpacing, y: centerY), animated: animated)
            
            // Hide other buttons
            hideButton(muteButton, animated: animated)
            hideButton(speakerButton, animated: animated)
            hideButton(hangupButton, animated: animated)
            
        case .outgoing, .connected:
            // Three buttons: mute, hangup/decline(as hangup), speaker (mic/speaker 距离 End 按钮 128)
            if state == .connected && declineButton.tag == CallButtonType.end.rawValue {
                // If decline button is acting as hangup, keep it in center
                positionButton(declineButton, at: CGPoint(x: centerX, y: centerY), animated: animated)
                hideButton(hangupButton, animated: false)
            } else {
                // Normal state: use hangup button
                positionButton(hangupButton, at: CGPoint(x: centerX, y: centerY), animated: animated)
                hideButton(declineButton, animated: animated)
            }
            
            positionButton(muteButton, at: CGPoint(x: centerX - connectedButtonSpacing, y: centerY), animated: animated)
            positionButton(speakerButton, at: CGPoint(x: centerX + connectedButtonSpacing, y: centerY), animated: animated)
            
            // Hide accept button
            hideButton(acceptButton, animated: animated)
        }
    }
    
    private func animateToState(_ state: Call1v1BottomViewState, from previousState: Call1v1BottomViewState) {
        if state == previousState {
            return
        }
        switch state {
        case .incoming:
            setButtonsForState(state, animated: true)
            
        case .connected where previousState == .incoming:
            // Special animation when accepting call
            animateAcceptCall()
            
        case .outgoing, .connected:
            setButtonsForState(state, animated: true)
        }
    }
    
    private func animateAcceptCall() {
        let centerY = bounds.height / 2.0 - 20
        let centerX = bounds.width / 2.0
        let offscreenY = bounds.height + buttonSize
        
        // 准备从底部滑入的按钮
        muteButton.center = CGPoint(x: centerX - connectedButtonSpacing, y: offscreenY)
        muteButton.alpha = 1
        muteButton.transform = .identity
        muteButton.isHidden = false
        
        speakerButton.center = CGPoint(x: centerX + connectedButtonSpacing, y: offscreenY)
        speakerButton.alpha = 1
        speakerButton.transform = .identity
        speakerButton.isHidden = false
        
        // 准备 hangup 按钮（初始隐藏）
        hangupButton.center = CGPoint(x: centerX, y: centerY)
        hangupButton.alpha = 0
        hangupButton.isHidden = false
        
        // 第一阶段：Accept 按钮消失，decline 按钮移动到中间
        UIView.animate(withDuration: animationDuration * 0.6,
                       delay: 0,
                       usingSpringWithDamping: 0.8,
                       initialSpringVelocity: 0.5,
                       options: [.curveEaseInOut],
                       animations: {
            // Accept 按钮淡出并缩放
            self.acceptButton.alpha = 0
            self.acceptButton.transform = CGAffineTransform(scaleX: 0.5, y: 0.5)
            
            // Decline 按钮移动到中间
            self.declineButton.center = CGPoint(x: centerX, y: centerY)
            
        }) { _ in
            self.acceptButton.isHidden = true
            
            // 第二阶段：Decline 按钮淡出，hangup 按钮淡入
            UIView.animate(withDuration: 0.3,
                           animations: {
                self.declineButton.alpha = 0
                self.hangupButton.alpha = 1
            }) { _ in
                self.declineButton.isHidden = true
                self.hangupButton.tag = Int(CallButtonType.end.rawValue)
            }
        }
        
        // Mute 和 Speaker 按钮依次滑入
        UIView.animate(withDuration: animationDuration,
                       delay: animationDuration * 0.3,
                       usingSpringWithDamping: 0.7,
                       initialSpringVelocity: 0.8,
                       options: [.curveEaseOut],
                       animations: {
            self.muteButton.center = CGPoint(x: centerX - self.connectedButtonSpacing, y: centerY)
        })
        
        UIView.animate(withDuration: animationDuration,
                       delay: animationDuration * 0.3 + self.staggerDelay,
                       usingSpringWithDamping: 0.7,
                       initialSpringVelocity: 0.8,
                       options: [.curveEaseOut],
                       animations: {
            self.speakerButton.center = CGPoint(x: centerX + self.connectedButtonSpacing, y: centerY)
        })
        
        // Hangup 按钮的弹跳效果
        UIView.animate(withDuration: 0.2,
                       delay: animationDuration * 0.8,
                       usingSpringWithDamping: 0.5,
                       initialSpringVelocity: 1.0,
                       options: [.curveEaseInOut],
                       animations: {
            self.hangupButton.transform = CGAffineTransform(scaleX: 1, y: 1)
        }) { _ in
            UIView.animate(withDuration: 0.2) {
                self.hangupButton.transform = .identity
            }
        }
    }
    
    private func positionButton(_ button: CallButtonView, at point: CGPoint, animated: Bool) {
        button.isHidden = false  // Always ensure button is not hidden
        
        if animated {
            UIView.animate(withDuration: animationDuration * 0.8,
                           delay: 0,
                           usingSpringWithDamping: 0.7,
                           initialSpringVelocity: 0.5,
                           options: [.curveEaseOut],
                           animations: {
                button.alpha = 1
                button.transform = .identity
                button.center = point
            })
        } else {
            button.center = point
            button.alpha = 1
            button.transform = .identity
        }
    }
    
    private func hideButton(_ button: CallButtonView, animated: Bool) {
        if animated {
            UIView.animate(withDuration: animationDuration * 0.5,
                           animations: {
                button.alpha = 0
                button.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
                // Move button below visible area
                button.center.y = self.bounds.height + self.buttonSize
            })
        } else {
            button.alpha = 0
            button.center.y = bounds.height + buttonSize
            button.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
        }
    }
    
    // MARK: - Actions
    private func handleButtonTap(_ sender: CallButtonView) {
        // Haptic feedback
        UIImpactFeedbackGenerator.impactOccurred(style: .medium)
        print("tag: \(sender.buttonTag)")
        
        guard let data = sender.data, let buttonType = self.getActionType(for: data, button: sender) else { return }
        self.didTapButton?(buttonType)
        
        if buttonType == .accept {
            animateAcceptCall()
        }
    }
    
    private func getActionType(for data: CallButtonData, button: CallButtonView) -> CallButtonType? {
        var type: CallButtonType?
        switch button.buttonTag {
        case speakerTag:
            type = data.isSelected ? .speaker_off : .speaker_on
        case hangupTag:
            type = .end
        case muteTag:
            type = data.isSelected ? .mic_off : .mic_on
        case acceptTag:
            type = .accept
        case declineTag:
            type = .decline
        default:
            break
        }
        return type
    }
    
    func toggleMuteButton() {
        guard let data = muteButton.data else { return }
        data.isSelected = !data.isSelected
        muteButton.configure(data: data)
        
        // Update tag based on state
        muteButton.tag = Int(data.isSelected ? CallButtonType.mic_off.rawValue : CallButtonType.mic_on.rawValue)
    }
    
    func updateMuteState(isMuted: Bool) {
        guard let data = muteButton.data else { return }
        data.isSelected = isMuted
        muteButton.configure(data: data)
        
        // Update tag based on state
        muteButton.tag = Int(data.isSelected ? CallButtonType.mic_off.rawValue : CallButtonType.mic_on.rawValue)
    }
    
    private func toggleSpeakerButton() {
        guard let data = speakerButton.data else { return }
        data.isSelected = !data.isSelected
        speakerButton.configure(data: data)
        
        // Update tag based on state
        speakerButton.tag = Int(data.isSelected ? CallButtonType.speaker_on.rawValue : CallButtonType.speaker_off.rawValue)
    }
    
    // MARK: - Layout
    public override func layoutSubviews() {
        super.layoutSubviews()
        
        // Only update positions if view size changed significantly
        if abs(bounds.width - lastLayoutWidth) > 1 || abs(bounds.height - lastLayoutHeight) > 1 {
            // Update button positions based on current state
            setButtonsForState(currentState, animated: false)
            lastLayoutWidth = bounds.width
            lastLayoutHeight = bounds.height
        }
    }
    
    private var lastLayoutWidth: CGFloat = 0
    private var lastLayoutHeight: CGFloat = 0
    
    deinit {
        consoleLogInfo("Call1v1BottomView deinit", type: .debug)
    }
}
