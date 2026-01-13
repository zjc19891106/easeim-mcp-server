//
//  ChatMessage+CallInfo.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/31/25.
//

import Foundation

public extension ChatMessage {
    var callInfo: CallInfo? {
        if let ext = self.ext as? [String: Any] {
            guard let msgType = ext[kMsgType] as? String,
                  let callId = ext[kCallId] as? String,
                  let callerDevId = ext[kCallerDevId] as? String
                   else {
                consoleLogInfo("Invalid call info in message id:\(messageId) : \(String(describing: ext))", type: .error)
                return nil
            }
            let defaultCalleeId = ChatClient.shared().getDeviceConfig(nil).deviceUUID ?? ""
            let calleeDevId = ext[kCalleeDevId] as? String ?? defaultCalleeId
            let callTypeRawValue = ext[kCallType] as? UInt ?? 0
            let callType = CallType(rawValue: callTypeRawValue) ?? .singleAudio
            let channelName = ext[kChannelName] as? String ?? ""
            let isValid = ext[kCallStatus] as? Bool ?? false//呼叫的离线消息是否有效
            let result = ext[kCallResult] as? String ?? ""
            let callExtension: [String: Any] = ext[kExt] as? [String: Any] ?? [:]
            let groupExtension: [String: Any] = ext[kCallKitGroupExt] as? [String: Any] ?? [:]
            // 解析群组信息
            let groupId = groupExtension["groupId"] as? String ?? ""
            let groupName = groupExtension["groupName"] as? String ?? ""
            let groupAvatar = groupExtension["groupAvatar"] as? String ?? ""
            
            if let userJson = ext[kUserInfo] as? [String: Any] {//解析携带的用户信息
                let profile = CallUserProfile()
                profile.setValuesForKeys(userJson)
                if profile.id.isEmpty {
                    profile.id = from
                }
                if CallKitManager.shared.usersCache[profile.id] == nil {
                    CallKitManager.shared.usersCache[profile.id] = profile
                } else {
                    CallKitManager.shared.usersCache[profile.id]?.nickname = profile.nickname
                    CallKitManager.shared.usersCache[profile.id]?.avatarURL = profile.avatarURL
                }
            }
            let callInfo = CallInfo(callId: callId, callerId: from, callerDeviceId: callerDevId, channelName: channelName, type: callType)
            callInfo.state = isValid ? .ringing : .idle
            callInfo.extensionInfo = callExtension
            callInfo.groupId = groupId
            callInfo.groupName = groupName
            callInfo.groupAvatar = groupAvatar
            callInfo.duration = ext[kCallDuration] as? UInt ?? 0
            return callInfo
        }
        return nil
    }
    
}
