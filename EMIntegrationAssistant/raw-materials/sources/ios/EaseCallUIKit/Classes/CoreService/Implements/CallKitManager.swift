//
//  CallKitManager.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/24/25.
//

import Foundation
import AgoraRtcKit
import AVKit
import AVFAudio
import PushKit

public let CallKitVersion = "4.18.1"

@objcMembers public class CallKitManager: NSObject {
    /// Cache for user profiles
    @CallAtomicUnfairLock public var usersCache: [String: CallProfileProtocol] = [:]
    
    /// CallKitManager shared instance
    public static let shared = CallKitManager()
    
    /// Provider for user profiles
    public var profileProvider: CallUserProfileProvider?
    
    /// Provider for user profiles in Objective-C
    public var profileProviderOC: CallUserProfileProviderOC?
    
    /// Provider for call token
    public private(set) var tokenProvider: CallTokenProvider?
    
    /// Current call information
    public internal(set) var callInfo : CallInfo? = nil
    
    public internal(set) var receivedCalls = [String:CallInfo]()
        
    /// Cache for call stream views
    public internal(set) var canvasCache: [String: CallStreamView] = [:]
    
    /// Cache for call stream items
    public internal(set) var itemsCache: [String: CallStreamItem] = [:] 
    
    /// Listeners for call events
    public internal(set) var listeners:NSHashTable<CallServiceListener> = NSHashTable<CallServiceListener>.weakObjects()
    
    /// AgoraRtcEngineKit instance
    public private(set) var engine:AgoraRtcEngineKit?
    
    /// Current call view controller
    public internal(set) var callVC: UIViewController?
    
    /// Current user profile information
    public var currentUserInfo: CallProfileProtocol? {
        didSet {
            if let info = currentUserInfo {
                usersCache[ChatClient.shared().currentUsername ?? ""] = info
            }
        }
    }
    
    /// Current user token for AgoraRTC SDK
    @CallUserDefault("CallKitManager.token", defaultValue: "") public var token: String
    
    /// Current user RTC UID
    @CallUserDefault("CallKitManager.currentUserRTCUID", defaultValue: UInt32(0)) public var currentUserRTCUID
    
    var hadJoinedChannel: Bool = false
    
    /// Last Picture-in-Picture frame
    public internal(set) var lastPIPFrame = CGRect.zero
    
    /// Indicates whether the call is currently in a video exchange state
    public internal(set) var isVideoExchanged = false
    
    /// Popup view for call notifications
    public internal(set) var popup: CallPopupView?
    
    /// Application ID for Agora SDK
    public var appID: String = ""
    
    /// The throttler for RTC callbacks
    let rtcThrottler = RTCCallbackThrottler()
    
    public private(set) var config: CallKitConfig = CallKitConfig()

    private override init() {
        super.init()
        // Initialize CallKit related services or configurations here
    }
    
    /// Sets up the CallKitManager with an optional token provider.
    @objc public func setup(_ config: CallKitConfig? = nil) {
        ChatClient.shared().add(self, delegateQueue: nil)
        ChatClient.shared().chatManager?.add(self, delegateQueue: .main)
        if let config = config {
            self.config = config
        }
        if tokenProvider != nil {
            self.appID = tokenProvider!.getAppId()
            if self.appID.isEmpty {
//                return CallError.error(code: ChatErrorCode.invalidAppkey.rawValue, message: "App ID is not set. Please configure the App ID in CallTokenProvider.")
            }
            
//            self.tokenProvider = tokenProvider
//            if let currentUserId = ChatClient.shared().currentUsername {
//                tokenProvider?.fetchCallToken { [weak self] uid, token, expiration in
//                    if let token = token, !token.isEmpty {
//                        self?.token = token
//                        self?.tokenExpired = expiration
//                        self?.currentUserRTCUID = uid
//                        consoleLogInfo("Call token fetched successfully: \(token)", type: .info)
//                    } else {
//                        consoleLogInfo("Failed to fetch call token", type: .error)
//                    }
//                }
//            }
//            let error = self.setupEngine()
//            if error != nil {
//                return error
//            }
        }
        _ = AudioPlayerManager.shared
        consoleLogInfo("CallKitManager setup completed", type: .info)
        if #available(iOS 17.4, *),self.config.enableVOIP {
            LiveCommunicationManager.shared.setupPushKit()
        }
        NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
            if let info = self?.callInfo, info.state == .ringing {
                if let controller = UIViewController.currentController {
                    if self?.callInfo?.calleeId == ChatClient.shared().currentUsername {
                        if !(controller is CallMultiViewController || controller is Call1v1AudioViewController || controller is Call1v1VideoViewController) {
                            self?.presentCalleeController(call: info)
                        }
                    }
                }
            }
        }
        NotificationCenter.default.addObserver(forName: UIApplication.willTerminateNotification, object: nil, queue: .main) { [weak self] _ in
            self?.hangup()
        }
//        return nil
    }
    
    @objc func setupEngine() -> ChatError? {
        if self.engine != nil {
            for listener in self.listeners.allObjects {
                if let engine = self.engine {
                    listener.onRtcEngineCreated?(engine: engine)
                }
            }
            return nil
        }
        self.engine?.setParameters("{\"che.audio.mix_with_others\":false}")
        if self.appID.isEmpty {
            self.appID = ChatClient.shared().options.appId ?? ""
        }
        if self.appID.isEmpty {
            return ChatError(description: "App ID is not set.", code: .invalidAppkey)
        } else {
            self.engine = AgoraRtcEngineKit.sharedEngine(withAppId: self.appID, delegate: self)
        }
        let configuration = AgoraVideoEncoderConfiguration()
        configuration.orientationMode = .fixedPortrait
        configuration.dimensions = CGSize(width: 1280, height: 720)
        configuration.frameRate = .fps30
        self.engine?.setVideoEncoderConfiguration(configuration)
        
        let cameraConfig = AgoraCameraCapturerConfiguration()
        cameraConfig.cameraDirection = .front
        self.engine?.setCameraCapturerConfiguration(cameraConfig)
        for listener in self.listeners.allObjects {
            if let engine = self.engine {
                listener.onRtcEngineCreated?(engine: engine)
            }
        }
        self.engine?.enableAudio()
        self.engine?.enable(inEarMonitoring: true)
        self.engine?.enableAudioVolumeIndication(618, smooth: 5, reportVad: true)
        self.engine?.setDefaultAudioRouteToSpeakerphone(true)
        self.engine?.setVideoFrameDelegate(self)
        return nil
    }

    /// Checks and requests camera permission.
    public func checkCameraPermission() {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        consoleLogInfo("The camera permission is granted.", type: .info)
                    } else {
                        DispatchQueue.main.async {
                            UIViewController.currentController?.showCallToast(toast: "检测到用户拒绝授予摄像头权限，请前往设置开启摄像头权限",duration: 3.0,delay: 0.5)
                        }
                        consoleLogInfo("The camera permission is denied, please enable it in settings.", type: .error)
                    }
                }
            }
        case .authorized:
            consoleLogInfo("The camera permission is authorized.", type: .info)
        case .denied, .restricted:
            // permission denied or restricted
            consoleLogInfo("The camera permission is denied or restricted.", type: .error)
            // 可引导用户去设置中开启：Settings -> 应用名称 -> 摄像头
            DispatchQueue.main.async {
                UIViewController.currentController?.showCallToast(toast: "检测到摄像头权限未开启，请前往设置开启摄像头权限",duration: 3.0,delay: 0.5)
            }
        @unknown default:
            consoleLogInfo("Unknown camera permission status", type: .error)
        }
    }
    
    /// Checks and requests microphone permission.
    public func checkMicrophonePermission() {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        switch status {
        case .notDetermined:
            // 首次请求权限
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                DispatchQueue.main.async {
                    if granted {
                        consoleLogInfo("The microphone permission is granted.", type: .info)
                    } else {
                        DispatchQueue.main.async {
                            UIViewController.currentController?.showCallToast(toast: "检测到用户拒绝授予麦克风权限，请前往设置开启麦克风权限",duration: 3.0,delay: 0.5)
                        }
                        consoleLogInfo("The microphone permission is denied, please enable it in settings.", type: .error)
                    }
                }
            }
        case .authorized:
            consoleLogInfo("The microphone permission is authorized.", type: .info)
        case .denied, .restricted:
            consoleLogInfo("The microphone permission is denied or restricted, please enable it in settings.", type: .error)
            // 引导用户去设置中开启：Settings -> 应用名称 -> 麦克风
            DispatchQueue.main.async {
                UIViewController.currentController?.showCallToast(toast: "检测到麦克风权限未开启，请前往设置开启麦克风权限",duration: 3.0,delay: 0.5)
            }
        @unknown default:
            consoleLogInfo("Unknown microphone permission status", type: .error)
        }
    }
    
    /// Tears down the CallKitManager, releasing resources and stopping the player.Notice that this method should be called when the application is about to terminate or when the CallKitManager is no longer needed.
    @objc public func tearDown() {
        self.itemsCache.removeAll()
        self.canvasCache.removeAll()
        self.usersCache.removeAll()
        self.listeners.removeAllObjects()
        AgoraRtcEngineKit.destroy()
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            consoleLogInfo("Failed to deactivate audio session: \(error.localizedDescription)", type: .error)
        }
        self.quitCall()
        ChatClient.shared().chatManager?.remove(self)
        AudioPlayerManager.shared.stopAudio()
    }
    
    /// Quits the current call, stopping any ongoing call and cleaning up resources.
    func ringTimeout() {
        DispatchQueue.main.async {
            AudioPlayerManager.shared.stopAudio()
            if let call = self.callInfo, call.state == .ringing {
                consoleLogInfo("Call ringing timeout, ending call", type: .info)
                self.updateCallEndReason(.noResponse)
            }
        }
    }
    
    /// Updates the call end reason and notifies listeners.
    func cleanUICache() {
        self.itemsCache.removeAll()
        self.canvasCache.removeAll()
    }
    
    /// Updates the call end reason and notifies listeners.
    /// - Parameter vc: The view controller to present the call end reason.
    func showMiniAudioView(vc: UIViewController) {
        self.callVC = vc
        if self.lastPIPFrame == .zero {
            let floating = FloatingAudioView.addToWindow()
            floating?.clickDragViewBlock = { [weak self] in
                guard let `self` = self else { return }
                if let callVC = self.callVC {
                    ($0 as? FloatingAudioView)?.present(on: callVC)
                }
            }
        }
    }
    
    /// Shows the Picture-in-Picture (PIP) view for 1v1 video calls.
    /// - Parameter vc: The view controller to present the PIP view.
    func showPIP(vc: UIViewController) {
        if self.config.enablePIPOn1V1VideoScene {
            if let pipVC = vc as? Call1v1VideoViewController {
                self.callVC = pipVC
            } else {
                consoleLogInfo("PIP is only supported in CallVideoViewController", type: .error)
            }
        } else {
            consoleLogInfo("PIP is not enabled for 1v1 video calls", type: .info)
        }
    }
    
    
    /// When you logout IM SDK, you should call this method to clean up the user defaults.
    @objc public func cleanUserDefaults() {
        self.currentUserRTCUID = 0
        self.token = ""
    }
    
    private func validateItemsCache() {
        let currentUserId = ChatClient.shared().currentUsername ?? ""
        itemsCache = itemsCache.filter { key, item in
            return item.userId == currentUserId ||
            item.uid == self.currentUserRTCUID ||
            key == currentUserId
        }
    }
    
    private func validateCanvasCache() {
        let currentUserId = ChatClient.shared().currentUsername ?? ""
        canvasCache = canvasCache.filter { key, view in
            return key == currentUserId || view.item.uid == self.currentUserRTCUID || view.item.userId == currentUserId
        }
    }
}

extension CallKitManager: ChatClientListener {
    public func connectionStateDidChange(_ aConnectionState: ConnectionState) {
        if aConnectionState == .connected {//IM SDK connected successfully
            let engineError = self.setupEngine()//Set up Agora engine
            if let error = engineError {
                self.handleError(error)
                consoleLogInfo("Failed to setup engine: \(String(describing: error.errorDescription))", type: .error)
                return
            }
            if self.token.isEmpty {//When the token is empty.First we need to fetch it from the IM SDK.
                if let currentUserId = ChatClient.shared().currentUsername,!currentUserId.isEmpty {
                    if self.tokenProvider != nil {
//                        self.tokenProvider?.fetchCallToken{ [weak self] uid, token, expiration in
//                            if let token = token, !token.isEmpty {
//                                self?.token = token
//                                self?.tokenExpired = expiration
//                                self?.currentUserRTCUID = uid
//                                consoleLogInfo("Call token fetched successfully: \(token)", type: .info)
//                            } else {
//                                consoleLogInfo("Failed to fetch call token", type: .error)
//                            }
//                        }
                    } else {
                        self.getRTCTokenFromIMSDK()
                    }
                } else {
                    consoleLogInfo("Current user ID is empty, cannot fetch call token", type: .error)
                    self.handleError(ChatError(description: "Current user ID is empty, cannot fetch call token", code: .invalidAppkey))
                }
            }
        }
    }
    
    public func userDidForbidByServer() {
        self.hangup()
    }
    
    public func userAccountDidRemoveFromServer() {
        self.hangup()
    }
    
    public func userAccountDidForced(toLogout aError: ChatError?) {
        if aError != nil {
            self.hangup()
        }
    }
    
    public func userAccountDidLoginFromOtherDevice(with info: LoginExtensionInfo?) {
        self.hangup()
        self.callVC?.dismiss(animated: true)
    }
    
    func getRTCTokenFromIMSDK(_ refreshRTCToken: Bool = false) {
        ChatClient.shared().getRTCToken(withChannel: nil) { [weak self] uid, token, expiration, error in
            if let error = error {
                self?.token = ""
                self?.handleError(error)
                consoleLogInfo("Failed to fetch call token: \(String(describing: error.errorDescription))", type: .error)
            } else {
                let rtcToken = token ?? ""
                self?.token = rtcToken
                self?.currentUserRTCUID = UInt32(uid)
                if refreshRTCToken {
                    self?.engine?.renewToken(rtcToken)
                }
                consoleLogInfo("Call token fetched successfully: \(String(describing: token))", type: .info)
            }
        }
    }
}
