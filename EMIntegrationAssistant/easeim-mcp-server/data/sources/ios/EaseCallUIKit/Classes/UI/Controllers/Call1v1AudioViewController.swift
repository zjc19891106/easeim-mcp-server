//
//  Call1v1AudioViewController.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/25/25.
//

import UIKit

public class Call1v1AudioViewController: UIViewController {
    
    public lazy var background: UIImageView = {
        let imageView = UIImageView(frame: self.view.bounds)
        imageView.image = CallAppearance.backgroundImage
        imageView.contentMode = .scaleAspectFill
        return imageView
    }()
    
    public lazy var navigationBar: CallNavigationBar = {
        createNavigationBar()
    }()
    
    @objc func createNavigationBar() -> CallNavigationBar {
        CallNavigationBar(showLeftItem: true,textAlignment: .left).backgroundColor(.clear)
    }
    
    public lazy var bottomView: Call1v1BottomView = {
        Call1v1BottomView(frame: CGRect(x: 0, y: ScreenHeight-170-BottomBarHeight, width: ScreenWidth, height: 150+BottomBarHeight)).backgroundColor(.clear)
    }()
    
    public private(set) var role: CallRole = .caller
    
    @objc public init(role: CallRole) {
        self.role = role
        super.init(nibName: nil, bundle: nil)
        self.modalPresentationStyle = .fullScreen
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        self.view.addSubViews([self.background, self.navigationBar,self.bottomView])
        self.setupBottomsState()
        self.updateNavigationBar()
        // Do any additional setup after loading the view.
        
        self.navigationBar.clickClosure = { [weak self] in
            self?.navigationClick(type: $0, indexPath: $1)
        }
        self.bottomView.didTapButton = { [weak self] in
            self?.bottomClick(type: $0)
        }
    }
    
    func updateNavigationBar() {
        var showUserId = (self.role == .caller ? CallKitManager.shared.callInfo?.calleeId : CallKitManager.shared.callInfo?.callerId) ?? ""
        if showUserId.isEmpty {
            showUserId = ChatClient.shared().chatManager?.getMessageWithMessageId(CallKitManager.shared.callInfo?.inviteMessageId ?? "")?.from ?? showUserId
        }
        let username = CallKitManager.shared.usersCache[showUserId]?.nickname ?? ""
        let avatarURL = CallKitManager.shared.usersCache[showUserId]?.avatarURL
        self.navigationBar.title = username.isEmpty ? showUserId:username
        self.navigationBar.avatarURL = avatarURL
    }
    
    public override func viewIsAppearing(_ animated: Bool) {
        super.viewIsAppearing(animated)
        if CallKitManager.shared.callVC != nil {
            self.bottomView.setState(self.bottomView.currentState, animated: false)
        }
    }
    
    func addCallTimer() {
        if let call = CallKitManager.shared.callInfo {
            self.updateSeconds(seconds: 1)
            GlobalTimerManager.shared.registerListener(self, timerIdentify: "call-\(call.channelName)-answering-timer")
            GlobalTimerManager.shared.registerListener(CallKitManager.shared, timerIdentify: "call-\(call.channelName)-answering-timer")
        }
    }
    
    func updateBottomState() {
        CallKitManager.shared.enableLocalAudio(true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: {
            if CallKitManager.shared.callInfo?.state ?? .idle == .answering,self.bottomView.currentState == .connected {
                return
            }
            self.bottomView.setState(.connected, animated: false)
        })
    }
    
    private func setupBottomsState() {
        if self.role != .callee {
            self.bottomView.setState(.outgoing)
            self.navigationBar.subtitle = "calling".call.localize
        } else {
            if let call = CallKitManager.shared.callInfo {
                consoleLogInfo("Call1v1AudioViewController setupBottomsState call state:\(call.state.rawValue)", type: .info)
                switch call.state {
                case .ringing:
                    self.navigationBar.subtitle = "invite_info_audio".call.localize
                    self.bottomView.setState(.incoming)
                    if let callId = CallKitManager.shared.callInfo?.callId {
                        CallKitManager.shared.startRingTimer(callId: callId)
                    }
                case .answering:
                    self.bottomView.setState(.connected)
                    self.navigationBar.subtitle = "Connecting".call.localize
                    self.addCallTimer()
                default:
                    break
                }
            }
        }
    }
    
    @objc open func navigationClick(type: ChatNavigationBarClickEvent,indexPath: IndexPath?) {
        switch type {
        case .back,.title,.subtitle: self.pop()
        default:
            break
        }
    }
    
    @objc open func bottomClick(type: CallButtonType) {
        switch type {
        case .mic_on: CallKitManager.shared.enableLocalAudio(true)
        case .mic_off: CallKitManager.shared.enableLocalAudio(false)
        case .speaker_on: CallKitManager.shared.turnSpeakerOn(on: true)
        case .speaker_off: CallKitManager.shared.turnSpeakerOn(on: false)
        case .decline:
            CallKitManager.shared.callVC = nil
            self.dismiss(animated: true, completion: nil)
            CallKitManager.shared.hangup()
        case .accept:
            if #available(iOS 17.4, *),CallKitManager.shared.config.enableVOIP {
                if LiveCommunicationManager.shared.manager != nil {
                    CallKitManager.shared.updateLiveCommunicationStateIfNeeded()
                } else {
                    CallKitManager.shared.accept()
                }
            } else {
                CallKitManager.shared.accept()
            }
            self.addCallTimer()
        case .end:
            if let call = CallKitManager.shared.callInfo {
                GlobalTimerManager.shared.removeListener(self, timerIdentify: "call-\(call.channelName)-answering-timer")
            }
            CallKitManager.shared.hangup()
            self.dismiss(animated: true, completion: nil)
        default: break
        }
    }
    
    public override func dismiss(animated flag: Bool, completion: (() -> Void)? = nil) {
        super.dismiss(animated: flag, completion: completion)
    }
    
    @objc open func pop() {
        if self.navigationController != nil {
            self.navigationController?.popViewController(animated: true)
        } else {
            if CallKitManager.shared.callVC == nil {
                self.dismiss(animated: false)
                CallKitManager.shared.showMiniAudioView(vc: self)
            } else {
                self.dismiss(animated: true)
            }
        }
    }

    open override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        if self.navigationBar.alpha == 0,self.bottomView.alpha == 0 {
            UIView.animate(withDuration: 0.3) {
                self.navigationBar.alpha = 1
                self.bottomView.alpha = 1
            }
        } else {
            UIView.animate(withDuration: 0.3) {
                self.navigationBar.alpha = 0
                self.bottomView.alpha = 0
            }
        }
    }
    
    deinit {
        if let call = CallKitManager.shared.callInfo {
            CallKitManager.shared.stopRingTimer(callId: call.callId)
        }
        CallKitManager.shared.lastPIPFrame = .zero
    }
}

extension Call1v1AudioViewController: TimerServiceListener {
    public func timeChanged(_ timerIdentify: String, interval seconds: UInt) {
        if let call = CallKitManager.shared.callInfo, timerIdentify == "call-\(call.channelName)-answering-timer" {
            self.updateSeconds(seconds: Int(seconds))
            FloatingAudioView.getFloatingView()?.updateSeconds(seconds: Int(seconds))
        }
    }
    
    func updateSeconds(seconds: Int) {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60
        self.navigationBar.subtitle = String(format: "%02d:%02d:%02d", hours, minutes, secs)
    }
}

