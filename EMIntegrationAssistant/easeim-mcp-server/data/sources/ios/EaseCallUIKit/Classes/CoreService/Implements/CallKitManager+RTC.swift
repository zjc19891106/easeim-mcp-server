//
//  CallKitManager+RTC.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/4/25.
//

import Foundation
import AgoraRtcKit


extension CallKitManager: CallActionService {
    
    /// Switch the camera direction
    func switchCamera() {
        let result = self.engine?.switchCamera()
        consoleLogInfo("switchCamera result: \(String(describing: result))", type: .debug)
    }
    
    /// Turn on/off the speaker
    /// - Parameter on: true to turn on the speaker, false to turn off
    func turnSpeakerOn(on: Bool) {
        let result = self.engine?.setEnableSpeakerphone(on)
        consoleLogInfo("setEnableSpeakerphone result: \(String(describing: result))", type: .debug)
    }
    
    /// Enable or disable local audio stream
    /// - Parameter enable: true to enable local audio, false to disable
    func enableLocalAudio(_ enable: Bool) {
        if #available(iOS 17.4, *),self.config.enableVOIP {
            if LiveCommunicationManager.shared.manager != nil {
                if UIApplication.shared.applicationState == .active {
                    LiveCommunicationManager.shared.currentUserMute = !enable
                    LiveCommunicationManager.shared.performAction(type: .mute)
                } else {
                    if let controller = UIViewController.currentController as? Call1v1AudioViewController {
                        controller.bottomView.updateMuteState(isMuted: !enable)
                    } else {
                        if let controller = self.callVC as? Call1v1AudioViewController {
                            controller.bottomView.updateMuteState(isMuted: !enable)
                        }
                    }
                }
            }
        }
        let result = self.engine?.muteLocalAudioStream(!enable)
        consoleLogInfo("muteLocalAudioStream result: \(String(describing: result))", type: .debug)
    }
    
    /// Enable or disable local video stream
    /// - Parameter enable: true to enable local video, false to disable
    func enableLocalVideo(_ enable: Bool) {
        let result = self.engine?.muteLocalVideoStream(!enable)
        consoleLogInfo("muteLocalVideoStream result: \(String(describing: result)) previewResult:\("String(describing: previewResult)")", type: .debug)
    }
    
    /// Set up local video capturing and rendering
    func setupLocalVideo() {
        self.engine?.enableVideo()
        self.engine?.enableAudio()
        if let call = self.callInfo {
            if call.type == .groupCall {
                let canvas = AgoraRtcVideoCanvas()
                canvas.renderMode = .hidden
                let currentUserId = ChatClient.shared().currentUsername ?? ""
                if !currentUserId.isEmpty,self.canvasCache[currentUserId] == nil {
                    let item = CallStreamItem(userId: currentUserId, index: 0, isExpanded: false)
                    item.uid = self.currentUserRTCUID
                    self.itemsCache[currentUserId] = item
                    let view = CallStreamView(item: item)
                    self.canvasCache[currentUserId] = view
                    canvas.uid = UInt(self.currentUserRTCUID)
                    canvas.view = view.canvasView
                } else {
                    canvas.uid = UInt(self.currentUserRTCUID)
                    canvas.view = self.canvasCache[currentUserId]?.canvasView
                }
                self.engine?.setupLocalVideo(canvas)
            }
        }
        self.engine?.startPreview()
    }
    
    /// Set up remote video view for a user
    /// - Parameters:
    ///   - userId: The user ID of the remote user whose video stream is to be displayed.
    ///   - uid: The unique identifier (UID) of the remote user on the RTC channel.
    func setupRemoteVideoView(userId: String,uid: UInt) {
        guard let engine = self.engine else {
            consoleLogInfo("setupRemoteVideoView failed, engine is nil", type: .error)
            return
        }
        
        let canvas = AgoraRtcVideoCanvas()
        canvas.uid = uid
        canvas.renderMode = .hidden
        if let call = self.callInfo {
            if call.type == .groupCall {
                if let streamView = self.canvasCache[userId] {
                    streamView.item.uid = UInt32(uid)
                    canvas.uid = UInt(streamView.item.uid)
                    canvas.view = streamView.canvasView
                } else {
                    let item = CallStreamItem(userId: userId, index: 1, isExpanded: false)
                    item.uid = UInt32(uid)
                    let view = CallStreamView(item: item)
                    self.canvasCache[userId] = view
                    canvas.uid = UInt(view.item.uid)
                    canvas.view = view.canvasView
                    for listener in self.listeners.allObjects {
                        listener.remoteUserDidJoined?(userId: userId, channelName: call.channelName, type: call.type)
                    }
                }
                engine.setupRemoteVideo(canvas)
            }
        }
    }
}

extension CallKitManager: AgoraRtcEngineDelegate {
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, didOccurError errorCode: AgoraErrorCode) {
        consoleLogInfo("rtcEngine didOccurError: \(errorCode.rawValue)", type: .error)
        for listener in self.listeners.allObjects {
            listener.didOccurError?(error: CallError(CallError.RTC(code: errorCode, message: "RTC error occurred with code: \(errorCode.rawValue)"), module: .rtc))
        }
        switch errorCode {
        case .invalidToken:
            self.hangup()
        default:
            break
        }
    }
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, networkQuality uid: UInt, txQuality: AgoraNetworkQuality, rxQuality: AgoraNetworkQuality) {
        //When transport network quality is unknown, we skip the update
        if txQuality == .unknown {//If the quality is unknown, we skip the update
            return
        }
        let uids = [NSNumber(value: uid != 0 ? UInt32(uid):self.currentUserRTCUID)]
        // Get userId by RTC uid
        ChatClient.shared().getUserId(byRTCUIds: uids) { [weak self] relations, error in
            guard let `self` = self else { return }
            var userId = relations?.values.first ?? ""
            if userId.isEmpty || error != nil {
                userId = "uid-\(uid)"
            }
            if let call = self.callInfo {
                if call.type == .groupCall {
                    if let streamView = self.canvasCache[userId],let item = self.itemsCache[userId] {
                        item.networkStatus = mirrorNetworkQuality(txQuality)
                        streamView.item = item
                        DispatchQueue.main.async {// Update network UI on the main thread
                            streamView.updateNetworkStatus(item.networkStatus)
                        }
                    }
                } else {
                    let currentUserId = ChatClient.shared().currentUsername ?? ""
                    let networkStatus = mirrorNetworkQuality(txQuality)
                    switch networkStatus {
                    case .poor,.bad:
                        DispatchQueue.main.async {// Show network toast on the main thread
                            UIViewController.currentController?.showCallToast(toast: (userId != currentUserId ? "The other party's network is poor.":"Your network is poor.").call.localize)
                        }
                    default: break
                    }
                }
            }
        }
        
    }
    
    /// Mirror the AgoraNetworkQuality to ``CallNetworkStatus``.
    /// - Parameter quality: The `AgoraNetworkQuality` to be mirrored.
    /// - Returns: The corresponding ``CallNetworkStatus``.
    private func mirrorNetworkQuality(_ quality: AgoraNetworkQuality) -> CallNetworkStatus {
        switch quality {
        case .excellent,.good:
            return .good
        case .poor:
            return .poor
        case .bad, .vBad:
            return .bad
        default:
            return .unknown
        }
    }
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, tokenPrivilegeWillExpire token: String) {// This method is called when the token will expire
        if let channelName = self.callInfo?.channelName,let userId = ChatClient.shared().currentUsername {
            consoleLogInfo("rtcEngine tokenPrivilegeWillExpire for channel: \(channelName) userId: \(userId)", type: .debug)
            if self.tokenProvider != nil {
//                self.tokenProvider?.fetchCallToken{ [weak self] uid, token, expire in
//                    if let token = token, !token.isEmpty {
//                        self?.token = token
//                        self?.tokenExpired = expire
//                        self?.currentUserRTCUID = uid
//                        let result = engine.renewToken(token)
//                        consoleLogInfo("rtcEngine renewToken: \(token) result: \(String(describing: result))", type: .debug)
//                    } else {
//                        consoleLogInfo("rtcEngine renewToken failed to fetch new token", type: .error)
//                    }
//                }
            } else {
                self.getRTCTokenFromIMSDK(true)
            }
        }
        
        
    }
    
    public func rtcEngineRequestToken(_ engine: AgoraRtcEngineKit) {// This method is called when the token was expired
        if let channelName = self.callInfo?.channelName,let userId = ChatClient.shared().currentUsername {
            if self.tokenProvider != nil {
//                self.tokenProvider?.fetchCallToken{ [weak self] uid ,token, expire in
//                    if let token = token, !token.isEmpty {
//                        self?.token = token
//                        self?.joinChannel(channelName: channelName) { success in
//                            consoleLogInfo("rtcEngine renewToken: \(token) result: \(success)", type: .debug)
//                        }
//                    } else {
//                        consoleLogInfo("rtcEngine renewToken failed to fetch new token", type: .error)
//                    }
//                }
            } else {
                // Fetch the call token from the IM SDK
                ChatClient.shared().getRTCToken(withChannel: nil) { [weak self] uid, token, expiration, error in
                    guard let `self` = self else { return }
                    if let error = error {
                        self.token = ""
                        self.handleError(error)
                        consoleLogInfo("Failed to fetch call token: \(String(describing: error.errorDescription))", type: .error)
                    } else {
                        let rtcToken = token ?? ""
                        self.token = rtcToken
                        self.currentUserRTCUID = UInt32(uid)
                        let options: AgoraRtcChannelMediaOptions = AgoraRtcChannelMediaOptions()
                        options.autoSubscribeAudio = true
                        options.autoSubscribeVideo = true
                        options.publishCameraTrack = true
                        options.publishMicrophoneTrack = true
                        options.clientRoleType = .broadcaster
                        options.channelProfile = .liveBroadcasting
                        options.token = rtcToken
                        // Update the channel with the new token
                        let result = self.engine?.updateChannelEx(with: options, connection: AgoraRtcConnection(channelId: channelName, localUid: Int(uid)))
                        consoleLogInfo("Call token fetched successfully when token expired: \(String(describing: token)) updateChannelEx result: \(String(describing: result)) channelName: \(channelName) uid: \(uid) userId: \(userId)", type: .info)
                        if result == 0 {
                            self.callInfo?.state = .answering
                            self.joinedThenPresentCallVC()
                            if uid == self.currentUserRTCUID {
                                self.hadJoinedChannel = true
                                self.updateCallEndReason(.abnormalEnd,false)
                            }
                        }
//                        self.joinChannel(channelName: <#T##String#>, completion: <#T##((Bool) -> Void)##((Bool) -> Void)##(Bool) -> Void#>)
                    }
                }
            }
            
        }
    }
    
    /// Get the AgoraVideoStreamType based on the number of users in the call.
    /// - Parameter count: The number of users currently in the call.
    /// - Returns: `AgoraVideoStreamType` representing the render quality for the stream.
    func getStreamRenderQuality(with count: UInt) -> AgoraVideoStreamType {
        var type = AgoraVideoStreamType.low
        switch count {
        case 1...4: type = .high
        default:
            break
        }
        return type
    }
    
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, didJoinedOfUid uid: UInt, elapsed: Int) {//On successful joining of a remote user to the RTC channel
        consoleLogInfo("rtcEngine didJoinedOfUid: \(uid) elapsed: \(elapsed)", type: .debug)
        AudioPlayerManager.shared.stopAudio()
        //Setting remote video render qutity for the user who just joined
        if let call = self.callInfo,!call.callId.isEmpty {
            if call.callerId == ChatClient.shared().currentUsername ?? "" {
                call.state = .answering
            }
            if call.type == .groupCall {
                DispatchQueue.main.async {
                    if let currentVC = UIViewController.currentController as? CallMultiViewController {
                        currentVC.updateBottomState()
                    } else {
                        if let currentVC = self.callVC as? CallMultiViewController {
                            currentVC.updateBottomState()
                        }
                    }
                }
                
                //Add the user to the RTC throttler
                self.rtcThrottler.addUserJoin(uid: uid, elapsed: elapsed) { [weak self] infos in
                    guard let `self` = self else { return }
                    let ids = infos.map { NSNumber(value: $0.uid ) }
                    // Get userId by RTC uid
                    ChatClient.shared().getUserId(byRTCUIds: ids) { [weak self] relations, error in
                        guard let `self` = self else { return }
                        if let error = error {
                            consoleLogInfo("Failed to get userId by RTC UIDs: \(error.errorDescription ?? "Unknown error")", type: .error)
                            return
                        }
                        for info in infos {
                            let uidKey = NSNumber(value: info.uid)
                            let userId = relations?[uidKey] ?? ""
                            //Find and remove any existing timers related to this user
                            CallKitManager.shared.stopRingTimer(callId: call.callId)
                            CallKitManager.shared.stopConfirmBuildConnectionTimer(callId: call.callId)
                            CallKitManager.shared.stopInvitationSignalTimer(callId: call.callId)
                            // Update existing CallStreamItem and CallStreamView for the remote user
                            var userIdNotFound = false
                            var uidNotFound = false
                            if let streamView = self.canvasCache[userId],let item = self.itemsCache[userId]  {
                                item.uid = UInt32(truncating: uidKey)
                                item.waiting = false
                                streamView.updateUserInfo(newItem: item)
                                consoleLogInfo("rtcEngine didJoinedOfUid: setRemoteVideoStream userId:\(userId) uidKey:\(uidKey) uidNotFound:\(uidNotFound) userIdNotFound:\(userIdNotFound)", type: .debug)
                            } else {
                                userIdNotFound = true
                            }
                            
                            if let first = self.itemsCache.values.first(where: { $0.uid == UInt32(truncating: uidKey) })  {
                                first.uid = UInt32(truncating: uidKey)
                                first.waiting = false
                                canvasCache[first.userId]?.updateUserInfo(newItem: first)
                                consoleLogInfo("rtcEngine didJoinedOfUid: setRemoteVideoStream userId:\(userId) uidKey:\(uidKey) uidNotFound:\(uidNotFound) userIdNotFound:\(userIdNotFound)", type: .debug)
                            } else {
                                uidNotFound = true
                            }
                            
                            if uidNotFound,userIdNotFound {
                                let item = CallStreamItem(userId: userId, index: 1, isExpanded: false)
                                item.waiting = false
                                item.uid = UInt32(truncating: uidKey)
                                self.itemsCache[userId] = item
                                let view = CallStreamView(item: item)
                                self.canvasCache[userId] = view
                                for listener in self.listeners.allObjects {
                                    listener.remoteUserDidJoined?(userId: userId, channelName: call.channelName, type: call.type)
                                }
                            }
                            consoleLogInfo("rtcEngine didJoinedOfUid: setRemoteVideoStream  userId:\(userId) uidKey:\(uidKey) uidNotFound:\(uidNotFound) userIdNotFound:\(userIdNotFound)", type: .debug)
                            let type = self.getStreamRenderQuality(with: UInt(self.itemsCache.count))
                            engine.setRemoteVideoStream(uidKey.uintValue, type: type)
                        }
                        if let currentVC = UIViewController.currentController as? CallMultiViewController {
                            currentVC.callView.updateWithItems()
                        } else {
                            if let controller = self.callVC as? CallMultiViewController {
                                controller.callView.updateWithItems()
                            }
                        }
                        self.providerFetchUsersInfo(relations?.values.map { $0 } ?? [])
                    }
                }
                
                
            } else {
                CallKitManager.shared.stopRingTimer(callId: call.callId)
                CallKitManager.shared.callStartTimerStop(callId: call.callId)
                CallKitManager.shared.stopConfirmBuildConnectionTimer(callId: call.callId)
                CallKitManager.shared.stopInvitationSignalTimer(callId: call.callId)
                //Single call add timer when remote user joined
                DispatchQueue.main.async {
                    if let controller = UIViewController.currentController as? Call1v1VideoViewController {
                        controller.addCallTimer()
                    }
                    if let controller = UIViewController.currentController as? Call1v1AudioViewController {
                        controller.addCallTimer()
                    }
                }
            }
            self.stopRingTimer(callId: call.callId)
        }
    }
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, didJoinChannel channel: String, withUid uid: UInt, elapsed: Int) {//On local user successfully joining the RTC channel
        consoleLogInfo("rtcEngine didJoinChannel: \(channel) withUid: \(uid) elapsed: \(elapsed)", type: .debug)
    }
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, didOfflineOfUid uid: UInt, reason: AgoraUserOfflineReason) {
        //On remote user leaving the RTC channel
        consoleLogInfo("rtcEngine didOfflineOfUid: \(uid) reason: \(reason.rawValue)", type: .debug)
        self.rtcThrottler.clearUserPendings(with: uid)
        DispatchQueue.main.async {
            if let call = self.callInfo,!call.callId.isEmpty {
                if call.type == .groupCall {
                    if let currentVC = UIViewController.currentController as? CallMultiViewController {
                        if let item = self.itemsCache.first(where: { $0.value.uid == UInt32(uid) })?.value,item.userId != ChatClient.shared().currentUsername ?? "" {
                            let userId = item.userId
                            for listener in self.listeners.allObjects {
                                listener.remoteUserDidLeft?(userId: userId, channelName: call.channelName, type: call.type)
                            }
                            currentVC.callView.updateWithItems([userId])  // 先更新UI
                            self.itemsCache.removeValue(forKey: userId)   // 后清理缓存
                            self.canvasCache[userId]?.removeFromSuperview()
                            self.canvasCache.removeValue(forKey: userId)
                            currentVC.callView.updateWithItems([userId]) 
                            consoleLogInfo("rtcEngine didOfflineOfUid: \(uid) userId:\(userId) reason: \(reason.rawValue)", type: .debug)
                        }
                        
                    } else {
                        if let item = self.itemsCache.first(where: { $0.value.uid == UInt32(uid) })?.value ,item.userId != ChatClient.shared().currentUsername ?? "" {
                            let userId = item.userId
                            for listener in self.listeners.allObjects {
                                listener.remoteUserDidLeft?(userId: item.userId, channelName: call.channelName, type: call.type)
                            }
                            (self.callVC as? CallMultiViewController)?.callView.updateWithItems([userId])
                            self.itemsCache.removeValue(forKey: userId)
                            self.canvasCache[userId]?.removeFromSuperview()
                            self.canvasCache.removeValue(forKey: userId)
                            (self.callVC as? CallMultiViewController)?.callView.updateWithItems([userId])
                            consoleLogInfo("rtcEngine didOfflineOfUid: \(uid) userId:\(userId) reason: \(reason.rawValue)", type: .debug)
                        }
                    }
                } else {
                    switch reason {
                    case .dropped:
                        self.updateCallEndReason(.abnormalEnd)
                        //TODO: - 是否发送信令消息给对方告知通话异常结束(用户如果需要，可以自行改造信令流程)
                    case .quit:
                        self.updateCallEndReason(.hangup)
                    default:
                        break
                    }
                }
            }
        }
        
    }
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, remoteVideoStateChangedOfUid uid: UInt, state: AgoraVideoRemoteState, reason: AgoraVideoRemoteReason, elapsed: Int) {
        consoleLogInfo("rtcEngine remoteVideoStateChangedOfUid: \(uid) state: \(state.rawValue) reason: \(reason.rawValue) elapsed: \(elapsed)", type: .debug)
        // Handle remote video state changes with proper uid and reason
        if let call = self.callInfo,!call.callId.isEmpty {
            if call.type == .groupCall {
                self.rtcThrottler.addVideoState(uid: uid, state: state, reason: reason, elapsed: elapsed) { [weak self] infos in
                    guard let `self` = self else { return }
                    let rtcUids = infos.map { NSNumber(value: $0.uid ) }
                    ChatClient.shared().getUserId(byRTCUIds: rtcUids) { [weak self] relations, error in
                        guard let `self` = self else { return }
                        if let error = error {
                            for listener in self.listeners.allObjects {
                                listener.didOccurError?(error: CallError(CallError.IM(error: error), module: .im))
                            }
                            consoleLogInfo("Failed to get userId by RTC UIDs: \(error.errorDescription ?? "Unknown error")", type: .error)
                            return
                        }
                        for info in infos {
                            let uidKey = NSNumber(value: info.uid)
                            let userId = relations?[uidKey] ?? ""
                            var userIdNotFound = false
                            if let streamView = self.canvasCache[userId],let item = self.itemsCache[userId]  {
                                item.uid = UInt32(truncating: uidKey)
                                item.waiting = false
                                streamView.updateUserInfo(newItem: item)
                            } else {
                                userIdNotFound = true
                            }
                            var uidNotFound = false
                            if self.itemsCache.values.first(where: { $0.uid == UInt32(truncating: uidKey) }) == nil {
                                uidNotFound = true
                            }
                            let videoState = info.state
                            switch videoState {// Handle different states of remote video.Starting&unmute, stopped&mute
                            case .starting,.decoding:
                                if uidNotFound,userIdNotFound {
                                    let item = CallStreamItem(userId: userId, index: self.itemsCache.count+1, isExpanded: false)
                                    item.waiting = false
                                    item.uid = UInt32(truncating: uidKey)
                                    self.itemsCache[userId] = item
                                    let view = CallStreamView(item: item)
                                    self.canvasCache[userId] = view
                                    if let currentVC = UIViewController.currentController as? CallMultiViewController {
                                        currentVC.callView.updateWithItems()
                                    } else {
                                        if let controller = self.callVC as? CallMultiViewController {
                                            controller.callView.updateWithItems()
                                        }
                                    }
                                }
                                if let streamView = self.canvasCache[userId],let item = self.itemsCache[userId] {
                                    item.videoMuted = false
                                    item.uid = UInt32(truncating: uidKey)
                                    streamView.updateItem(item)
                                    self.setupRemoteVideoView(userId: userId, uid: uidKey.uintValue)
                                }
                                consoleLogInfo("remoteVideoStateChangedOfUid: \(uidKey.uintValue) userId:\(userId) state: starting", type: .debug)
                                
                            case .stopped:
                                let videoReason = info.reason
                                if let streamView = self.canvasCache[userId],let item = self.itemsCache[userId] {
                                    if videoReason == .remoteMuted {// Remote video muted
                                        item.videoMuted = true
                                    }
                                    item.uid = UInt32(truncating: uidKey)
                                    streamView.updateItem(item)
                                }
                                consoleLogInfo("remoteVideoStateChangedOfUid: \(uid) userId:\(userId) state: stop", type: .debug)
                            default:
                                break
                            }
                        }
                    }
                }
            }
            if call.type == .singleVideo {
                switch state {
                case .starting,.decoding:
                    if reason == .remoteUnmuted {//Remote video unmuted
                        if call.type == .singleVideo {
                            if let controller = UIViewController.currentController as? Call1v1VideoViewController {
                                if !controller.firstRemoteVideoAppeared {
                                    controller.floatViewClicked(dragView: controller.floatView)
                                    controller.firstRemoteVideoAppeared = true
                                }
                                controller.floatView.updateVideoState(false)
                            } else {
                                if let controller = self.callVC as? Call1v1VideoViewController {
                                    controller.floatView.updateVideoState(false)
                                }
                            }
                        }
                    }
                    consoleLogInfo("remoteVideoStateChangedOfUid: \(uid) state: starting", type: .debug)
                case .stopped:
                    if reason == .remoteMuted {// Remote video muted
                        if let controller = UIViewController.currentController as? Call1v1VideoViewController {
                            controller.floatView.updateVideoState(true)
                        } else {
                            if let controller = self.callVC as? Call1v1VideoViewController {
                                controller.floatView.updateVideoState(true)
                            }
                        }
                    }
                    consoleLogInfo("remoteVideoStateChangedOfUid: \(uid) state: stop", type: .debug)
                default:
                    break
                }
            }
        }
        
    }
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, didAudioMuted muted: Bool, byUid uid: UInt) {//On remote user muting or unmuting audio
        //Get mirror for the userId by uid
        if let call = self.callInfo,!call.callId.isEmpty {
            if call.type == .groupCall {//Update audio state in multi call
                self.rtcThrottler.addAudioMute(uid: uid, muted: muted) { [weak self] infos in
                    guard let `self` = self else { return }
                    ChatClient.shared().getUserId(byRTCUIds: infos.map { NSNumber(value: $0.uid ) }) { [weak self] relations, error in
                        guard let `self` = self else { return }
                        for info in infos {
                            let uidKey = NSNumber(value: info.uid)
                            let user = relations?[uidKey] ?? ""
                            let mute = info.muted
                            if let streamView = self.canvasCache[user],let item = self.itemsCache[user] {
                                item.uid = uidKey.uint32Value
                                item.userId = user
                                item.audioMuted = mute
                                streamView.updateItem(item)
                            } else {
                                let item = CallStreamItem(userId: user, index: self.itemsCache.count + 1, isExpanded: false)
                                item.audioMuted = mute
                                item.uid = uidKey.uint32Value
                                self.itemsCache[user] = item
                                let view = CallStreamView(item: item)
                                self.canvasCache[user] = view
                                for listener in self.listeners.allObjects {
                                    listener.remoteUserDidJoined?(userId: user, channelName: call.channelName, type: call.type)
                                }
                                if let currentVC = UIViewController.currentController as? CallMultiViewController {
                                    currentVC.callView.updateWithItems()
                                } else {
                                    if let controller = self.callVC as? CallMultiViewController {
                                        controller.callView.updateWithItems()
                                    }
                                }
                            }
                            consoleLogInfo("rtcEngine didAudioMuted: \(muted) byUid: \(uidKey) userId:\(user)", type: .debug)
                        }
                        
                    }
                }
                
            }
            if call.type == .singleVideo {//Update audio state in single video call
                if let controller = UIViewController.currentController as? Call1v1VideoViewController {// If current controller is Call1v1VideoViewController
                    controller.callView.micView.isHidden = true
                    if self.isVideoExchanged {// If video is exchanged, update mic view visibility
                        if muted {
                            controller.floatView.updateAudioState(!muted)
                        } else {
                            controller.floatView.updateAudioState(muted)
                        }
                    } else {
                        controller.floatView.updateAudioState(muted)
                    }
                } else {// If current controller is not Call1v1VideoViewController
                    if let controller = self.callVC as? Call1v1VideoViewController {
                        controller.callView.micView.isHidden = true
                        if self.isVideoExchanged {// If video is exchanged, update mic view visibility and audio state
                            if muted {
                                controller.floatView.updateAudioState(!muted)
                            } else {
                                controller.floatView.updateAudioState(muted)
                            }
                        } else {// If video is not exchanged, hide mic view and update audio state
                            controller.floatView.updateAudioState(muted)
                        }
                    }
                }
            }
        }
        
        
    }
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, reportAudioVolumeIndicationOfSpeakers speakers: [AgoraRtcAudioVolumeInfo], totalVolume: Int) {//On audio volume indication change of speakers
        DispatchQueue.main.async {
            if let call = self.callInfo {
                if call.type == .groupCall {// Only handle audio volume indication in multi call
                    for speaker in speakers {
                        if let item = self.itemsCache.values.first(where: { $0.uid == speaker.uid }) {
                            let streamView = self.canvasCache[item.userId]
                            if item.uid == speaker.uid {
                                streamView?.updateAudioVolume(speaker.volume)
                            }
                        }
                    }
                }
            }
        }
    }
    
    public func rtcEngine(_ engine: AgoraRtcEngineKit, didAudioRouteChanged routing: AgoraAudioOutputRouting) {
//        switch routing {
//        case .headset,.earpiece,.headsetNoMic:
//        case .speakerphone,.loudspeaker:
//        default:
//            break
//        }
    }
    
    private func providerFetchUsersInfo(_ userIds: [String]) {

        var unknownInfoIds = [String]()
        for userId in userIds {
            if let profile = CallKitManager.shared.usersCache[userId] {
                if profile.nickname.isEmpty {
                    unknownInfoIds.append(userId)
                }
            } else {
                unknownInfoIds.append(userId)
            }
        }
        
        if CallKitManager.shared.profileProvider != nil,CallKitManager.shared.profileProviderOC == nil {
            Task {
                if let profiles = await CallKitManager.shared.profileProvider?.fetchUserProfiles(profileIds: unknownInfoIds) {
                    for profile in profiles {
                        if let user = CallKitManager.shared.usersCache[profile.id] {
                            user.nickname = profile.nickname
                            user.avatarURL = profile.avatarURL
                        }
                        if let cacheUser = CallKitManager.shared.usersCache[profile.id] {
                            cacheUser.nickname = profile.nickname
                            cacheUser.avatarURL = profile.avatarURL
                        } else {
                            let user = CallUserProfile()
                            user.id = profile.id
                            user.nickname = profile.nickname
                            user.avatarURL = profile.avatarURL
                            user.selected = profile.selected
                            CallKitManager.shared.usersCache[profile.id] = user
                        }
                    }
                }
                let ids = unknownInfoIds
                DispatchQueue.main.async {
                    if let controller = UIViewController.currentController as? CallMultiViewController {
                        controller.callView.updateUsersInfo(ids)
                    } else {
                        if let controller = self.callVC as? CallMultiViewController {
                            controller.callView.updateUsersInfo(ids)
                        }
                    }
                }
            }
        } else {
            DispatchQueue.global().async {
                CallKitManager.shared.profileProviderOC?.fetchProfiles(profileIds: unknownInfoIds,completion: { [weak self] profiles in
                    guard let `self` = self else { return }
                    for profile in profiles {
                        if let user = CallKitManager.shared.usersCache[profile.id] {
                            user.nickname = profile.nickname
                            user.avatarURL = profile.avatarURL
                        }
                        if let cacheUser = CallKitManager.shared.usersCache[profile.id] {
                            cacheUser.nickname = profile.nickname
                            cacheUser.avatarURL = profile.avatarURL
                        } else {
                            let user = CallUserProfile()
                            user.id = profile.id
                            user.nickname = profile.nickname
                            user.avatarURL = profile.avatarURL
                            user.selected = profile.selected
                            CallKitManager.shared.usersCache[profile.id] = user
                        }
                    }
                    DispatchQueue.main.async {
                        if let controller = UIViewController.currentController as? CallMultiViewController {
                            controller.callView.updateUsersInfo(unknownInfoIds)
                        } else {
                            if let controller = self.callVC as? CallMultiViewController {
                                controller.callView.updateUsersInfo(unknownInfoIds)
                            }
                        }
                    }
                })
            }
        }
    }
    
}

extension CallKitManager: AgoraVideoFrameDelegate {
    public func onCapture(_ videoFrame: AgoraOutputVideoFrame, sourceType: AgoraVideoSourceType) -> Bool {// This method is called when local video frame is captured.
        if let call = self.callInfo {
            // 处理群组通话预览（仅前台且当前显示的页面）
            if call.type == .groupCall {
                // 只处理当前正在显示的 CallMultiViewController
                if let controller = UIViewController.currentController as? CallMultiViewController {
                    // 未连接状态且开启了摄像头预览
                    if controller.isCameraPreviewEnabled, let previewView = controller.localPreviewView {
                        if let pixelBuffer = videoFrame.pixelBuffer {
                            previewView.renderVideoPixelBuffer(pixelBuffer: pixelBuffer, width: videoFrame.width, height: videoFrame.height)
                        } else {
                            previewView.renderFromVideoFrameData(videoData: videoFrame)
                        }
                        return true
                    }
                }
                // 群组通话在后台或缩小时不处理预览，直接返回
                return true
            }

            // 原有逻辑：处理1v1视频通话
            if call.type == .singleVideo {
                if let controller = UIViewController.currentController as? Call1v1VideoViewController {
                    if let pixelBuffer = videoFrame.pixelBuffer {
                        controller.callView.renderVideoPixelBuffer(pixelBuffer: pixelBuffer, width: videoFrame.width, height: videoFrame.height)
                    } else {
                        controller.callView.renderFromVideoFrameData(videoData: videoFrame)
                    }
                }
            }
        }
        return true
    }
    
    public func onRenderVideoFrame(_ videoFrame: AgoraOutputVideoFrame, uid: UInt, channelId: String) -> Bool {// This method is called when remote video frame is rendered.
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = true
        }
        if let call = self.callInfo {
            if call.type == .singleVideo {
                if let controller = UIViewController.currentController as? Call1v1VideoViewController{
                    if let pixelBuffer = videoFrame.pixelBuffer {
                        DispatchQueue.main.async {
                            controller.floatView.updateVideoState(false)
                        }
                        controller.floatView.renderVideoPixelBuffer(pixelBuffer: pixelBuffer, width: videoFrame.width, height: videoFrame.height)
                    } else {
                        DispatchQueue.main.async {
                            controller.floatView.updateVideoState(false)
                        }
                        controller.floatView.renderFromVideoFrameData(videoData: videoFrame)
                    }
                } else {
                    if let controller = self.callVC as? Call1v1VideoViewController {
                        if let pixelBuffer = videoFrame.pixelBuffer {
                            DispatchQueue.main.async {
                                controller.floatView.updateVideoState(false)
                            }
                            controller.floatView.renderVideoPixelBuffer(pixelBuffer: pixelBuffer, width: videoFrame.width, height: videoFrame.height)
                        } else {
                            DispatchQueue.main.async {
                                controller.floatView.updateVideoState(false)
                            }
                            controller.floatView.renderFromVideoFrameData(videoData: videoFrame)
                        }
                    }
                }
            }
        }
        return true
    }
    
    public func exchangeVideoFrame() -> Bool {
        // 防止重复操作
        guard UIViewController.currentController is Call1v1VideoViewController else {
            return false
        }
        
        // 切换状态
        isVideoExchanged.toggle()
        return true
    }
    
    // 重置到默认状态
    public func resetVideoExchange() {
        if isVideoExchanged {
            _ = exchangeVideoFrame()
        }
    }

}
