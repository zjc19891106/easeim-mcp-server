//
//  Call1v1VideoViewController.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/25/25.
//

import UIKit
import AVKit

open class Call1v1VideoViewController: UIViewController {
    
    // 添加属性来控制是否使用自定义转场
    private var useCustomDismissTransition = false
    
    // 添加标记来跟踪PIP状态
    private var isPIPActive = false
    private var isRestoring = false
    
    public private(set) var remoteStreamTag = 1313
    
    public private(set) var localStreamTag = 1212
    
    public lazy var background: UIImageView = {
        let imageView = UIImageView(frame: self.view.bounds).contentMode(.scaleAspectFill).isUserInteractionEnabled(true).tag(1001)
        imageView.image = CallAppearance.backgroundImage
        return imageView
    }()
    
    public lazy var navigationBlur: UIImageView = {
        UIImageView(frame: self.view.bounds).contentMode(.scaleAspectFill).backgroundColor(.clear)
    }()
    
    public lazy var navigationBar: CallNavigationBar = {
        createNavigationBar()
    }()
    
    @objc func createNavigationBar() -> CallNavigationBar {
        CallNavigationBar(showLeftItem: true,textAlignment: .left).backgroundColor(.clear)
    }
    
    private var connected: Bool {
        if self.role != .callee {
            return true
        } else {
            if let call = CallKitManager.shared.callInfo {
                switch call.state {
                case .ringing:
                    return false
                case .answering:
                    return true
                default:
                    break
                }
            }
        }
        return false
    }
    
    public lazy var bottomView: MultiCallBottomView = {
        MultiCallBottomView(frame: CGRect(x: 0, y: ScreenHeight-218-BottomBarHeight, width: ScreenWidth, height: 218+BottomBarHeight), connected: self.connected).backgroundColor(.clear)
    }()
    
    public lazy var callView: PixelBufferRenderView = {
        let bigView = PixelBufferRenderView(frame: self.view.bounds).tag(localStreamTag).backgroundColor(.clear).cornerRadius(12)
        bigView.userId = ChatClient.shared().currentUsername ?? ""
        bigView.dragEnable = false
        bigView.clickDragViewBlock = { [weak self] dragView in
            self?.callViewClicked(dragView: dragView)
        }
        return bigView
    }()
    
    public lazy var floatView: PixelBufferRenderView = {
        let drag = PixelBufferRenderView(frame: CGRect(x: ScreenWidth - 12 - 108, y: NavigationHeight + 12, width: 108, height: 192)).cornerRadius(12).backgroundColor(.clear).tag(remoteStreamTag)
        drag.userId = (self.role == .caller ? CallKitManager.shared.callInfo?.calleeId : CallKitManager.shared.callInfo?.callerId) ?? ""
        drag.dragEnable = true
        drag.freeRect = CGRect(x: 12, y: NavigationHeight+12, width: ScreenWidth - 24, height: ScreenHeight-NavigationHeight-BottomBarHeight-12-96-16)
        drag.isKeepBounds = true
        drag.clickDragViewBlock = { [weak self] dragView in
            self?.floatViewClicked(dragView: dragView)
        }
        return drag
    }()
    
    public private(set) var role: CallRole = .caller
    
    /// Picture-in-Picture controller
    public internal(set) var pipController: AVPictureInPictureController?
    
    /// Video container view for Picture-in-Picture
    public internal(set) var videoCallbackController: AVPictureInPictureVideoCallViewController?
    
    var firstRemoteVideoAppeared = false
        
    @objc public init(role: CallRole) {
        self.role = role
        super.init(nibName: nil, bundle: nil)
        self.modalPresentationStyle = .fullScreen
    }
    
    required public init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
    }
    
    open override func viewIsAppearing(_ animated: Bool) {
        super.viewIsAppearing(animated)
        consoleLogInfo("Call1v1VideoViewController viewIsAppearing role:\(self.role)", type: .debug)
    }
    
    open override func viewDidLoad() {
        super.viewDidLoad()
        setupViews()
        
        if self.connected {
            if let call = CallKitManager.shared.callInfo,call.state == .answering {
                self.addCallTimer()
            }
        }
        self.bottomView.isCallConnected = true

        self.setupNavigationState()
        
        self.updateNavigationBar()
        
        self.navigationBar.clickClosure = { [weak self] in
            self?.navigationClick(type: $0, indexPath: $1)
        }
        self.bottomView.didTapButton = { [weak self] in
            self?.bottomClick(type: $0)
        }
        if CallKitManager.shared.config.enablePIPOn1V1VideoScene {
            self.configPIPViewController()
        }
        //When the app goes to background, pop the view controller
        NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.pop()
        }
        self.floatView.updateVideoState(true)
    }
    
    func updateBottomState() {
        if self.connected {
            self.bottomView.animateToExpandedState()
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
    
    private func setupNavigationState() {
        if self.role != .callee {
            self.navigationBar.subtitle = "calling".call.localize
        } else {
            if let call = CallKitManager.shared.callInfo {
                switch call.state {
                case .ringing:
                    self.navigationBar.subtitle = "invite_info_video".call.localize
                    if let callId = CallKitManager.shared.callInfo?.callId {
                        CallKitManager.shared.startRingTimer(callId: callId)
                    }
                case .answering:
                    self.navigationBar.subtitle = "Connecting".call.localize
                default:
                    break
                }
            }
        }
    }
    
    func addCallTimer() {
        if let call = CallKitManager.shared.callInfo {
            GlobalTimerManager.shared.registerListener(self, timerIdentify: "call-\(call.channelName)-answering-timer")
            GlobalTimerManager.shared.registerListener(CallKitManager.shared, timerIdentify: "call-\(call.channelName)-answering-timer")
        }
    }
    
    // 新增：集中管理视图层级
    private func setupViews() {

        self.view.addSubViews([self.background, self.navigationBar, self.bottomView,self.navigationBlur])
        self.background.addSubViews([self.callView, self.floatView])
        self.navigationBlur.image = UIImage(named: "mask", in: .callBundle, with: nil)
        // 确保floatView在最上层
        self.background.bringSubviewToFront(self.floatView)
    }
    
    func callViewClicked(dragView: DragFloatView) {
        guard CallKitManager.shared.isVideoExchanged else { return }
//            consoleLogInfo("click big view exchange stream:\(CallKitManager.shared.exchangeVideoFrame())", type: .debug)
        CallKitManager.shared.isVideoExchanged = false
        self.floatView.frame = dragView.frame
        self.floatView.dragEnable = true
        self.floatView.isKeepBounds = true
        self.floatView.freeRect = CGRect(x: 12, y: NavigationHeight+12, width: ScreenWidth - 24, height: ScreenHeight-NavigationHeight-BottomBarHeight-12-96-16)
        dragView.frame = self.view.bounds
        dragView.dragEnable = false
        dragView.isKeepBounds = false
        self.background.sendSubviewToBack(self.callView)
        self.background.bringSubviewToFront(self.floatView)
        self.floatView.isUserInteractionEnabled = true
        self.callView.isUserInteractionEnabled = false
        self.callView.micView.isHidden = true
        self.floatView.updateAudioState(self.floatView.isAudioMuted)
        self.floatView.blurEffectView.isHidden = true
        self.callView.blurEffectView.isHidden = false
    }
    
    func floatViewClicked(dragView: DragFloatView) {
        guard !CallKitManager.shared.isVideoExchanged else { return }
        CallKitManager.shared.isVideoExchanged = true
        self.callView.frame = dragView.frame
        self.callView.dragEnable = true
        self.callView.isKeepBounds = true
        self.callView.freeRect = CGRect(x: 12, y: NavigationHeight+12, width: ScreenWidth - 24, height: ScreenHeight-NavigationHeight-BottomBarHeight-12-96-16)
        dragView.frame = self.view.bounds
        dragView.dragEnable = false
        dragView.isKeepBounds = false
        self.background.sendSubviewToBack(self.floatView)
        self.background.bringSubviewToFront(self.callView)
        self.floatView.isUserInteractionEnabled = false
        self.callView.isUserInteractionEnabled = true
        self.floatView.micView.isHidden = true
        self.callView.micView.isHidden = true
        self.floatView.blurEffectView.isHidden = false
        self.callView.blurEffectView.isHidden = true
    }
    
    // 新增：确保floatView正确显示
    func ensureFloatViewVisible() {
        // 移除所有约束
        self.floatView.translatesAutoresizingMaskIntoConstraints = true
        
        // 确保floatView在正确的父视图中
        if self.floatView.superview != self.background {
            self.floatView.removeFromSuperview()
            self.background.addSubview(self.floatView)
        }
        
        // 恢复原始frame
        self.floatView.frame = CGRect(x: ScreenWidth - 12 - 108, y: NavigationHeight + 12, width: 108, height: 192)
        self.callView.frame = self.view.bounds
        self.background.bringSubviewToFront(self.floatView)
        self.background.sendSubviewToBack(self.callView)
    }
    
    @objc open func navigationClick(type: ChatNavigationBarClickEvent,indexPath: IndexPath?) {
        switch type {
        case .back,.title,.subtitle: self.pop()
        default:
            break
        }
    }
    
    @objc open func bottomClick(type: CallButtonType) {
        print("bottomClick type:\(type.rawValue)")
        switch type {
        case .mic_on: CallKitManager.shared.enableLocalAudio(true)
        case .mic_off: CallKitManager.shared.enableLocalAudio(false)
        case .flip_back: CallKitManager.shared.switchCamera()
        case .flip_front: CallKitManager.shared.switchCamera()
        case .camera_on:
            CallKitManager.shared.enableLocalVideo(true)
            self.callView.updateVideoState(false)
        case .camera_off:
            CallKitManager.shared.enableLocalVideo(false)
            self.callView.updateVideoState(true)
        case .speaker_on: CallKitManager.shared.turnSpeakerOn(on: true)
        case .speaker_off: CallKitManager.shared.turnSpeakerOn(on: false)
        case .decline:
            handleCallEnd()
            self.dismiss(animated: true)
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
            handleCallEnd()
            self.dismiss(animated: true)
        default: break
        }
    }
    
    // 新增：集中处理通话结束
    private func handleCallEnd() {
        CallKitManager.shared.hangup()
        releaseActiveVideoCallSourceView()
        if let call = CallKitManager.shared.callInfo {
            GlobalTimerManager.shared.removeListener(self, timerIdentify: "call-\(call.channelName)-answering-timer")
        }
        self.transitioningDelegate = nil
        // 清理CallKitManager中的引用
        if CallKitManager.shared.callVC === self {
            CallKitManager.shared.callVC = nil
        }
    }
    
    open override func dismiss(animated flag: Bool, completion: (() -> Void)? = nil) {
        super.dismiss(animated: flag, completion: completion)
    }
    
    // Alternative approach: Modify the pop() function to trigger custom animation before PiP
    @objc open func pop() {
        if CallKitManager.shared.config.enablePIPOn1V1VideoScene {
            if #available(iOS 17.4, *),CallKitManager.shared.config.enableVOIP {
                LiveCommunicationManager.shared.endCall()
            }
            // If PiP is not active, prepare to enter PiP mode
            let state = CallKitManager.shared.callInfo?.state ?? .idle
            if !isPIPActive {
                if state == .answering {
                    if self.navigationController != nil {
                        self.navigationController?.popViewController(animated: true)
                    } else {
                        // Save current instance to CallKitManager
                        if CallKitManager.shared.callVC == nil {
                            CallKitManager.shared.showPIP(vc: self)
                        }
                        if CallKitManager.shared.isVideoExchanged {//产品协商后画中画是preview对方流而不是自己流，所以开启画中画时默认preview远端流view也就是floatView
                            CallKitManager.shared.isVideoExchanged = false
                        }
                        
                        // Configure transition delegate before starting PiP
                        self.configurePIPTransition()
                        
                        // Create a snapshot of current view for animation.由于不知道画中画的位置变动，只要有变动这个缩小转场动画就会有问题
                        //                    createSnapshotAndAnimateToPiP {
                        //                        // Start PiP after animation completes
                        //                    }
                        self.pipAction(true)
                    }
                }
                if state == .dialing || state == .ringing {
                    // Non-PiP dismissal logic remains the same
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
            }
        } else {
            // Non-PiP dismissal logic remains the same
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
    }

    // Add new method to create snapshot and animate
    private func createSnapshotAndAnimateToPiP(completion: @escaping () -> Void) {
        // Calculate PiP target frame
        var targetFrame = CallKitManager.shared.lastPIPFrame
        if targetFrame == .zero {
            targetFrame = CGRect(x: ScreenWidth - 120, y: NavigationHeight + 12, width: 108, height: 192)
        }
        
        // Create snapshot of current view
        guard let snapshot = self.view.snapshotView(afterScreenUpdates: false) else {
            completion()
            return
        }
        
        // Add snapshot to window
        guard let window = self.view.window else {
            completion()
            return
        }
        
        snapshot.frame = self.view.frame
        window.addSubview(snapshot)
        
        // Create container for animation with shadow
        let animationContainer = UIView(frame: self.view.frame)
        animationContainer.backgroundColor = .clear
        animationContainer.layer.cornerRadius = 0
        animationContainer.clipsToBounds = true
        animationContainer.layer.shadowColor = UIColor.black.cgColor
        animationContainer.layer.shadowOffset = CGSize(width: 0, height: 4)
        animationContainer.layer.shadowOpacity = 0
        animationContainer.layer.shadowRadius = 10
        window.addSubview(animationContainer)
        
        // Move snapshot to container
        snapshot.removeFromSuperview()
        animationContainer.addSubview(snapshot)
        snapshot.frame = animationContainer.bounds
        
        // Hide navigation and bottom bars in snapshot
        if let navBarSnapshot = snapshot.subviews.first(where: { $0 is UIView && $0.frame.origin.y == 0 }) {
            navBarSnapshot.alpha = 0
        }
        
        // Animate to PiP size
        UIView.animate(withDuration: 0.5,
                       delay: 0,
                       usingSpringWithDamping: 0.85,
                       initialSpringVelocity: 0,
                       options: [.curveEaseInOut]) {
            
            // Shrink container to PiP size
            animationContainer.frame = targetFrame
            animationContainer.layer.cornerRadius = 12
            animationContainer.layer.shadowOpacity = 0.3
            
            // Scale snapshot to fit
            let scaleX = targetFrame.width / self.view.bounds.width
            let scaleY = targetFrame.height / self.view.bounds.height
            let scale = min(scaleX, scaleY)
            snapshot.transform = CGAffineTransform(scaleX: scale, y: scale)
            snapshot.center = CGPoint(x: targetFrame.width / 2, y: targetFrame.height / 2)
            
        } completion: { _ in
            // Remove animation views
            animationContainer.removeFromSuperview()
            
            // Save PiP frame
            CallKitManager.shared.lastPIPFrame = targetFrame
            
            // Dismiss without animation since we already did the animation
            self.dismiss(animated: false) {
                completion()
            }
        }
    }
    
    open override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        let point = touches.first?.location(in: self.view) ?? .zero
        
        // 将点击坐标转换到 background 的坐标系中
        let pointInBackground = self.background.convert(point, from: self.view)
        
        if !self.floatView.frame.contains(pointInBackground),self.floatView.isUserInteractionEnabled {
            if !self.bottomView.frame.contains(point) {
                self.cleanScreen()
            } else {
                self.bottomView.hitTest(point, with: event)
            }
        }
        if !self.callView.frame.contains(pointInBackground), self.callView.isUserInteractionEnabled {
            if !self.bottomView.frame.contains(point) {
                self.cleanScreen()
            } else {
                self.bottomView.hitTest(point, with: event)
            }
        }
    }
    
    func cleanScreen() {
        if self.navigationBar.alpha == 0, self.bottomView.alpha == 0 {
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
    
    open override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
    }
    
    deinit {
        // 清理资源
        if CallKitManager.shared.config.enablePIPOn1V1VideoScene {
            releaseActiveVideoCallSourceView()
        }
    }
}

extension Call1v1VideoViewController: TimerServiceListener {
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

// 1. 修改 CallKitManager 扩展，添加转场支持
@available(iOS 15.0, *)
extension Call1v1VideoViewController: AVPictureInPictureControllerDelegate {
    
    func configPIPViewController() {
        if !AVPictureInPictureController.isPictureInPictureSupported() ||  !CallKitManager.shared.config.enablePIPOn1V1VideoScene {
            consoleLogInfo("Picture in Picture is not supported on this device.", type: .error)
            return
        }
        
        // 确保之前的PiP已清理
        releaseActiveVideoCallSourceView()
        
        let videoCallViewController = AVPictureInPictureVideoCallViewController()
        videoCallViewController.preferredContentSize = CGSize(width: 108, height: 192)
        videoCallViewController.view.backgroundColor = .clear
        videoCallViewController.modalPresentationStyle = .overFullScreen
        self.videoCallbackController = videoCallViewController
        
        pipController = AVPictureInPictureController(contentSource: .init(
            activeVideoCallSourceView: self.floatView,
            contentViewController: videoCallViewController
        ))
        pipController?.canStartPictureInPictureAutomaticallyFromInline = true
        pipController?.delegate = self
        pipController?.requiresLinearPlayback = false
        pipController?.playerLayer.videoGravity = .resizeAspect
    }
    
    @objc func releaseActiveVideoCallSourceView() {
        guard let pipController = pipController,!CallKitManager.shared.config.enablePIPOn1V1VideoScene else { return }
        
        if pipController.isPictureInPictureActive {
            pipController.stopPictureInPicture()
        }
        
        // 确保floatView回到正确位置
        ensureFloatViewVisible()
        
        self.pipController = nil
        self.videoCallbackController = nil
        self.isPIPActive = false
    }
    
    @objc func pipAction(_ start: Bool = true) {
        if !CallKitManager.shared.config.enablePIPOn1V1VideoScene {
            return
        }
        if start && !isPIPActive {
            self.pipController?.startPictureInPicture()
        } else if !start && isPIPActive {
            self.pipController?.stopPictureInPicture()
        }
    }
    
    public func pictureInPictureControllerWillStartPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        if !CallKitManager.shared.config.enablePIPOn1V1VideoScene {
            return
        } else {
            consoleLogInfo("Starting Picture in Picture mode.", type: .debug)
            if #available(iOS 17.4, *),CallKitManager.shared.config.enableVOIP {
                LiveCommunicationManager.shared.endCall()
            }
        }
        guard let vc = pictureInPictureController.contentSource?.activeVideoCallContentViewController else {
            consoleLogInfo("No active video call content view controller found.", type: .error)
            return
        }
        
        // 保存当前frame
        let currentFrame = self.floatView.frame
        
        // 将floatView移到PiP容器
        self.floatView.removeFromSuperview()
        vc.view.addSubview(self.floatView)
        
        // 使用约束确保填满PiP窗口
        self.floatView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            self.floatView.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor),
            self.floatView.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor),
            self.floatView.topAnchor.constraint(equalTo: vc.view.topAnchor),
            self.floatView.bottomAnchor.constraint(equalTo: vc.view.bottomAnchor)
        ])
        
        // 保存frame以便恢复
        CallKitManager.shared.lastPIPFrame = currentFrame
    }
    
    public func pictureInPictureControllerDidStartPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        self.isPIPActive = true
        
        // 如果不是恢复过程，则隐藏视图控制器
        if !isRestoring {
            self.configurePIPTransition()
            self.dismiss(animated: false)//如果能找到画中画window的位置可以设置为true
        }
    }
    
    public func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController, failedToStartPictureInPictureWithError error: any Error) {
        consoleLogInfo("Failed to start Picture in Picture: \(error.localizedDescription)", type: .error)
        self.isPIPActive = false
        // 确保floatView在正确位置
        ensureFloatViewVisible()
    }
    
    public func pictureInPictureControllerDidStopPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        self.isPIPActive = false
        
        // 如果不是恢复过程，清理资源
        if !isRestoring {
            // 清理CallKitManager中的引用
            if CallKitManager.shared.callVC === self {
                CallKitManager.shared.callVC = nil
            }
        }
        
        self.isRestoring = false
    }
    
    public func pictureInPictureControllerWillStopPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        // 只在非恢复模式下执行
        if !isRestoring {
            ensureFloatViewVisible()
        }
        
    }
    
    public func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController,
                                   restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void) {
        self.isRestoring = true
        
        // 如果已经有CallKitManager中的实例，使用它
        if let existingVC = CallKitManager.shared.callVC as? Call1v1VideoViewController, existingVC !== self {
            // 确保使用正确的实例
            existingVC.isRestoring = true
            existingVC.isPIPActive = false
            
            // 设置转场代理
            existingVC.configurePIPTransition()
            
            // Present existing VC
            UIApplication.shared.call.keyWindow?.rootViewController?.present(existingVC, animated: true) {
                // 将floatView恢复到existingVC
                existingVC.ensureFloatViewVisible()
                existingVC.floatViewClicked(dragView: existingVC.floatView)
                completionHandler(true)
            }
        } else {
            // 使用当前实例
            self.configurePIPTransition()
            
            UIApplication.shared.call.keyWindow?.rootViewController?.present(self, animated: true) {
                // 恢复floatView
                self.ensureFloatViewVisible()
                self.floatViewClicked(dragView: self.floatView)
                completionHandler(true)
            }
        }
    }
}

// MARK: - 针对之前的Call1v1VideoViewController，添加一个扩展
extension Call1v1VideoViewController {
    
    // 配置PIP转场动画
    func configurePIPTransition() {
        self.transitioningDelegate = PIPTransitionDelegate.shared
        self.modalPresentationStyle = .custom
    }
    
    // 准备进入PIP模式
    func prepareForPIPMode() {
        // 记录当前floatView的位置作为PIP位置
        if let windowFrame = self.floatView.superview?.convert(self.floatView.frame, to: nil) {
            CallKitManager.shared.lastPIPFrame = windowFrame
        }
    }
}



