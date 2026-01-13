//
//  LiveCommunicationManager.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/29/25.
//

import Foundation
import PushKit
import AVFAudio
#if canImport(LiveCommunicationKit)
import LiveCommunicationKit
#endif

enum LiveCommunicationKitActionType: String {
    case join = "join"
    case end = "end"
    case mute = "mute"
}

@available(iOS 17.4, *)
class LiveCommunicationManager: NSObject {
    // 添加单例
    static let shared = LiveCommunicationManager()
    
    // PushKit相关
    private var pushRegistry: PKPushRegistry?
    
    var manager: ConversationManager?
    
    private var uuid: UUID?
    
    var currentUserMute: Bool = false // 当前用户是否静音
    
    // 私有化初始化方法，确保单例
    private override init() {
        super.init()
    }
    
    // MARK: - PushKit Setup
    public func setupPushKit() {
        if !CallKitManager.shared.config.enableVOIP {
            consoleLogInfo("[LiveCommunicationManager] PushKit is not enabled", type: .debug)
            return
        }
        if pushRegistry == nil {
            pushRegistry = PKPushRegistry(queue: DispatchQueue.main)
            pushRegistry?.delegate = self
            pushRegistry?.desiredPushTypes = [.voIP]
        }
    }
    
    func createConversationManager(){
        if manager != nil {
            return
        }
        let config = ConversationManager.Configuration(
            ringtoneName: nil,
            iconTemplateImageData: UIImage(named: "AppIcon")?.pngData(),
            maximumConversationGroups: CallKitManager.shared.config.maximumConversationGroups,
            maximumConversationsPerConversationGroup: CallKitManager.shared.config.maximumConversationsPerConversationGroup,
            includesConversationInRecents: false,
            supportsVideo: true,
            supportedHandleTypes: [.generic]
        )
        manager = ConversationManager(configuration: config)
        manager?.delegate = self
    }
         
    func reportIncomingCall(uuid: UUID, callerName: String, call type: CallType) {
        let local = Handle(type: .generic, value: callerName, displayName: callerName)
        var capabilities: Conversation.Capabilities? = []
        if type != .singleAudio {
            capabilities = [.video]
        }
        let update = Conversation.Update(localMember: local,members: [local],activeRemoteMembers: [local],capabilities: capabilities)
         
        Task {
            do {
                try await manager?.reportNewIncomingConversation(uuid: uuid, update: update)
                consoleLogInfo("[LiveCommunicationManager] successfully reported new incoming call: \(callerName) uuid: \(uuid.uuidString) type: \(type.rawValue)", type: .debug)
                CallKitManager.shared.callInfo?.state = .ringing
                self.uuid = uuid
                DispatchQueue.main.async {
                    for listener in CallKitManager.shared.listeners.allObjects {
                        listener.onReceivedCall?(callType: type, userId: CallKitManager.shared.callInfo?.callerId ?? "", extensionInfo: CallKitManager.shared.callInfo?.extensionInfo)
                    }
                }
            } catch {
                consoleLogInfo("[LiveCommunicationManager] failed to report new incoming call: \(error.localizedDescription)", type: .error)
            }
        }
    }
     
    func endCall(){
        self.manager?.invalidate()
        self.manager = nil
        DispatchQueue.main.async {
            if UIApplication.shared.applicationState == .background {
                ChatClient.shared().applicationDidEnterBackground(UIApplication.shared)
            }
        }
        consoleLogInfo("[LiveCommunicationManager] destroy ConversationManager", type: .debug)
    }
}

// MARK: - PKPushRegistryDelegate
@available(iOS 17.4, *)
extension LiveCommunicationManager: PKPushRegistryDelegate {
    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        consoleLogInfo("[LiveCommunicationManager] PushKit token updated", type: .debug)
        ChatClient.shared().bindPushKitToken(pushCredentials.token)
    }
    
    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
        consoleLogInfo("[LiveCommunicationManager] didReceiveIncomingPushWith payload: \(payload.dictionaryPayload)", type: .debug)
        ChatClient.shared().applicationWillEnterForeground(UIApplication.shared)
        // 处理呼叫到来的逻辑
        handleIncomingCall(payload: payload)
        Thread.sleep(forTimeInterval: 0.05)
        completion()
    }
    
    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        consoleLogInfo("[LiveCommunicationManager] PushKit token invalidated", type: .debug)
    }
    
    // MARK: - 处理呼叫到来
    private func handleIncomingCall(payload: PKPushPayload) {
        let custom = payload.dictionaryPayload["e"] as? Dictionary<String, Any>
        print("payload dictionary: \(String(describing: custom))")
        var callId = ""
        if let id = custom?[kCallId] as? String {
            callId = id
        }
        let callerID = payload.dictionaryPayload["f"] as? String ?? ""
        let callerDeviceId = custom?[kCallerDevId] as? String ?? ""
        let calleeDeviceId = custom?[kCalleeDevId] as? String ?? ""
        let calleeID = ChatClient.shared().currentUsername ?? ""
        var callerNickname = ""
        if let nickname = custom?["callerNickname"] as? String {
            callerNickname = nickname
        }
        var channelName = ""
        if let channel = custom?[kChannelName] as? String {
            channelName = channel
        }
        var callType = CallType.singleAudio
        if let type = custom?[kCallType] as? UInt {
            callType = CallType(rawValue: type) ?? callType
        }
        var groupId = ""
        var groupName = ""
        var groupAvatar = ""
        if let group = custom?[kCallKitGroupExt] as? [String:Any] {
            groupId = group["groupId"] as? String ?? ""
            groupName = group["groupName"] as? String ?? ""
            groupAvatar = group["groupAvatar"] as? String ?? ""
        }
        if let userJson = custom?[kUserInfo] as? [String: Any] {//解析携带的用户信息
            let profile = CallUserProfile()
            profile.setValuesForKeys(userJson)
            if profile.id.isEmpty {
                profile.id = callerID
            }
            if CallKitManager.shared.usersCache[profile.id] == nil {
                CallKitManager.shared.usersCache[profile.id] = profile
            } else {
                CallKitManager.shared.usersCache[profile.id]?.nickname = profile.nickname
                CallKitManager.shared.usersCache[profile.id]?.avatarURL = profile.avatarURL
            }
        }
        if let group = payload.dictionaryPayload["g"] as? String {
            groupId = group
        }
        CallKitManager.shared.callInfo = CallInfo(callId: callId, callerId: callerID, callerDeviceId: callerDeviceId, channelName: channelName, type: callType)
        CallKitManager.shared.callInfo?.calleeDeviceId = ChatClient.shared().getDeviceConfig(nil).deviceUUID ?? ""
        CallKitManager.shared.callInfo?.groupId = groupId
        CallKitManager.shared.callInfo?.groupName = groupName
        CallKitManager.shared.callInfo?.groupAvatar = groupAvatar
        CallKitManager.shared.callInfo?.calleeId = calleeID
        CallKitManager.shared.callInfo?.state = .ringing
        CallKitManager.shared.callInfo?.extensionInfo = custom?[kUserInfo] as? [String: Any]
        if let msgId = payload.dictionaryPayload["m"] as? String {
            CallKitManager.shared.callInfo?.inviteMessageId = msgId
        }

        consoleLogInfo("[LiveCommunicationManager] incoming call:  (\(callerID))", type: .debug)
        LiveCommunicationManager.shared.createConversationManager()
        var uuid = UUID(uuidString: callId)
        if uuid == nil {
            uuid = UUID()
            consoleLogInfo("[LiveCommunicationManager] generated new UUID: \(uuid!.uuidString) callId: \(callId)", type: .debug)
        } else {
            consoleLogInfo("[LiveCommunicationManager] reuse UUID: \(uuid!.uuidString)", type: .debug)
        }
        LiveCommunicationManager.shared.reportIncomingCall(uuid: uuid!, callerName: callerNickname.isEmpty ? callerID:callerNickname,call: callType)
    }
    
    func performAction(type: LiveCommunicationKitActionType) {
        guard let uuid = self.uuid else {
            consoleLogInfo("[LiveCommunicationManager] performAction failed: uuid is nil", type: .error)
            return
        }
        var conversationAction: ConversationAction?
        switch type {
        case .join:
            conversationAction = JoinConversationAction(conversationUUID: uuid)
        case .mute:
            conversationAction = MuteConversationAction(conversationUUID: uuid, isMuted: self.currentUserMute)
        case .end:
            conversationAction = EndConversationAction(conversationUUID: uuid)
        }
        if let action = conversationAction {
            Task {
                do {
                    try await manager?.perform([action])
                    consoleLogInfo("[LiveCommunicationManager] successfully performAction: \(type.rawValue)", type: .debug)
                } catch {
                    consoleLogInfo("[LiveCommunicationManager] failed to performAction: \(error.localizedDescription)", type: .error)
                }
            }
        }
    }
}

@available(iOS 17.4, *)
extension LiveCommunicationManager: ConversationManagerDelegate
{
    func conversationManager(_ manager: ConversationManager, conversationChanged conversation: Conversation) {
        consoleLogInfo("[LiveCommunicationManager] conversationChanged: uuid=\(conversation.uuid.uuidString),state=\(conversation.state),localMember:\(String(describing: conversation.localMember))",type: .debug)
    }
    
    func conversationManagerDidBegin(_ manager: ConversationManager) {
        consoleLogInfo("[LiveCommunicationManager] conversationManagerDidBegin",type: .debug)
    }
    
    func conversationManagerDidReset(_ manager: ConversationManager) {
        consoleLogInfo("[LiveCommunicationManager] conversationManagerDidReset",type: .debug)
    }
    
    func conversationManager(_ manager: ConversationManager, perform action: ConversationAction) {
        consoleLogInfo("[LiveCommunicationManager] perform action:\(action)",type: .debug)
        switch action.self {
        case let action as LiveCommunicationKit.JoinConversationAction:
            self.joinAction(action: action)
            break
        case let action as LiveCommunicationKit.EndConversationAction:
            self.endAction(action: action)
            break
        case let action as LiveCommunicationKit.MuteConversationAction:
            self.muteAction(action: action)
            break
        default:
            break
        }
    }
    
    private func joinAction(action: JoinConversationAction) {
        if let call = CallKitManager.shared.callInfo,!call.callId.isEmpty,call.state == .ringing {
            DispatchQueue.main.async {
                if let currentVC = UIViewController.currentController {
                    if !(currentVC is Call1v1AudioViewController || currentVC is Call1v1VideoViewController || currentVC is CallMultiViewController) {
                        UIViewController.currentController?.showCallToast(toast: "Connecting".call.localize)
                    }
                }
            }
            
            CallKitManager.shared.accept()
            action.fulfill()
        } else {
            consoleLogInfo("[LiveCommunicationManager] do not have call info", type: .error)
            action.fail()
        }
    }
    
    private func muteAction(action: MuteConversationAction) {
        // 静音操作
        if let call = CallKitManager.shared.callInfo {
            if call.state == .answering {
                if UIApplication.shared.applicationState == .background || UIApplication.shared.applicationState == .inactive {
                    CallKitManager.shared.enableLocalAudio(!action.isMuted)
                }
                action.fulfill()
            } else {
                consoleLogInfo("[LiveCommunicationManager] call is not answering", type: .error)
                action.fail()
            }
        } else {
            consoleLogInfo("[LiveCommunicationManager] do not have call info", type: .error)
            action.fail()
        }
    }
    
    private func endAction(action: EndConversationAction) {
        consoleLogInfo("[LiveCommunicationManager] perform endAction:",type: .debug)
        CallKitManager.shared.hangup()
        action.fulfill()
    }
    
    func conversationManager(_ manager: ConversationManager, timedOutPerforming action: ConversationAction) {
        // 会话超时
        consoleLogInfo("[LiveCommunicationManager] perform timedOutPerforming:\(action)",type: .debug)
        CallKitManager.shared.hangup()
    }
    
    func conversationManager(_ manager: ConversationManager, didActivate audioSession: AVAudioSession) {
        // 会话激活了
        consoleLogInfo("[LiveCommunicationManager] perform didActivate:",type: .debug)
    }
    
    func conversationManager(_ manager: ConversationManager, didDeactivate audioSession: AVAudioSession) {
        //会话失效了
        consoleLogInfo("[LiveCommunicationManager] perform didDeactivate:",type: .debug)
        CallKitManager.shared.hangup()
    }
}

