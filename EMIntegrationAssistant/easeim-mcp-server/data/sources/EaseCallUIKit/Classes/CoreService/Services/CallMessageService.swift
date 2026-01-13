//
//  CallService.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/24/25.
//

import Foundation
import AgoraRtcKit

@objc public enum CallType: UInt {
    case singleAudio// 单音频通话
    case singleVideo// 单视频通话
    case groupCall// 群组音频视频通话
}

@objc public enum CallState: UInt {
    case idle // 空闲状态
    case dialing //拨号中
    case ringing // 振铃呼叫中
    case answering // 接听中
}

@objc public enum CallEndReason: UInt {
    case hangup // 挂断通话
    case cancel // 取消呼叫
    case remoteCancel // 对方取消呼叫
    case refuse // 对方拒绝呼叫
    case remoteRefuse // 对方拒绝呼叫
    case busy // 忙碌
    case noResponse // 无响应
    case remoteNoResponse // 对方无响应
    case handleOnOtherDevice // 已在其他设备处理
    case abnormalEnd // 异常结束
}


@objc public class CallInfo: NSObject,@unchecked Sendable {
    @objc public var callId: String // 通话ID
    @objc public var callerId: String // 呼叫者ID
    @objc public var calleeId: String = "" // 被呼叫者ID（可选）
    @objc public var callerDeviceId: String // 呼叫者设备ID（可选）
    @objc public var calleeDeviceId: String = "" // 被呼叫者设备ID（可选）
    @objc public var channelName: String
    @objc public var type: CallType // 通话类型
    @objc public var state: CallState = .idle // 通话状态，默认为空闲
    @objc public var extensionInfo: [String: Any]? // 附加信息
    @objc public var groupId: String? // 群组ID（如果是群组通话）
    @objc public var groupName: String? // 群组名称（如果是群组通话）
    @objc public var groupAvatar: String? // 群组头像（如果是群组通话）
    @objc public var duration: UInt = 0 // 通话时长，默认为0
    @objc public var inviteMessageId: String = "" // 邀请通话时的消息ID  消息对象
    @objc public var inviteUsers: [String] = [] // 邀请的用户列表 群组通话单次邀请用户
    
    @objc public init(callId: String, callerId: String, callerDeviceId: String, channelName: String, type: CallType, startMessageId: String = "", extensionInfo: [String: Any]? = nil) {
        self.callId = callId
        self.callerId = callerId
        self.callerDeviceId = callerDeviceId
        self.channelName = channelName
        self.type = type
        self.extensionInfo = extensionInfo
    }
}

@objc public protocol CallMessageService: NSObjectProtocol {
    
    /// Adds a listener to receive call-related events.
    /// - Parameter listener: An object conforming to the ``CallServiceListener`` protocol that will receive call events.
    func addListener(_ listener: CallServiceListener)
    
    /// Removes a previously added listener from receiving call-related events.
    /// - Parameter listener: An object conforming to the ``CallServiceListener`` protocol that will no longer receive call events.
    func removeListener(_ listener: CallServiceListener)
    
    /// Initiates a call with the specified user ID and call type.
    /// - Parameters:
    ///   - userId: The ID of the user to call.
    ///   - type: The type of call to initiate (multiAudio or multiVideo).``CallType``
    ///   - extensionInfo: Optional additional information to include with the call, such as custom data or metadata.
    func call(with userId: String, type: CallType, extensionInfo: [String: Any]?)
    
    
    /// Initiates a multi-user call with the specified user IDs and group ID.
    /// - Parameters:
    ///   - groupId: The ID of the group to call.
    ///   - extensionInfo: Optional additional information to include with the call, such as custom data or metadata.
    func groupCall(groupId: String, extensionInfo: [String : Any]?)
    
    /// Hangs up the current call.
    @objc func hangup()
    
    /// Accepts an incoming call.
    /// This method is called when the user decides to answer an incoming call.
    @objc func accept()
}

@objc protocol CallActionService: NSObjectProtocol {
    
    /// Switches the camera for video calls.
    /// This method is typically used to toggle between the front and rear cameras during a video call.
    @objc func switchCamera()
    
    /// Rejects an incoming call.
    @objc func turnSpeakerOn(on: Bool)
    
    /// Enables or disables local audio for the call.
    /// - Parameter enable: A Boolean value indicating whether to enable (`true`) or disable (`false`) local audio.
    @objc func enableLocalAudio(_ enable: Bool)
    
    /// Enables or disables local video for the call.
    /// - Parameter enable: A Boolean value indicating whether to enable (`true`) or disable (`false`) local video.
    @objc func enableLocalVideo(_ enable: Bool)
}

@objc public protocol CallServiceListener: NSObjectProtocol {
    
    /// Called when a call is received.
    /// - Parameter error: An optional error object providing additional information about the call, if applicable.``CallError``
    @objc optional func didOccurError(error: CallError)
    
    /// Called when a remote user joins the call.
    /// - Parameters:
    ///   - userId: The ID of the remote user who joined the call.
    ///   - channelName: The name of the channel where the call is taking place.
    ///   - type: The type of call that the remote user joined, such as single audio or single video.``CallType``
    @objc optional func remoteUserDidJoined(userId: String, channelName: String, type: CallType)
    
    /// Called when a remote user leaves the call.
    /// - Parameters:
    ///   - userId: The ID of the remote user who left the call.
    ///   - channelName: The name of the channel where the call is taking place.
    ///   - type: The type of call that the remote user left, such as single audio or single video.``CallType``
    @objc optional func remoteUserDidLeft(userId: String, channelName: String, type: CallType)
    
    /// Called when a call is ended.
    /// - Parameter reason: The reason for ending the call, such as hangup, cancel, or remote cancel.``CallEndReason``
    /// - Parameter info: Additional information about the call, such as the call ID, caller ID, and channel name.``CallInfo``
    @objc optional func didUpdateCallEndReason(reason: CallEndReason,info: CallInfo)
    
    /// Called when a call is connected.
    /// - Parameter engine: The AgoraRtcEngineKit instance used for the call.
    @objc optional func onRtcEngineCreated(engine: AgoraRtcEngineKit)
    
    /// Called when a call is received.
    /// - Parameters:
    ///   - callType: The type of call that was received, such as single audio or single video.``CallType``
    ///   - userId: The ID of the user who initiated the call.
    ///   - extensionInfo: Optional additional information about the call, such as custom data or metadata.
    @objc optional func onReceivedCall(callType: CallType, userId: String, extensionInfo: [String:Any]?)
    
}

@objc public protocol TimerServiceListener: NSObjectProtocol {
    
    /// Called when the time interval for a timer changes.
    /// - Parameters:
    ///   - timerIdentify: The identify of the timer that has changed.
    ///   - seconds: The new time interval in seconds for the timer.
    func timeChanged(_ timerIdentify: String, interval seconds: UInt)
}

@objc public protocol TimerService: NSObjectProtocol {
    
    /// Replaces an existing timer with a new one.
    /// - Parameters:
    ///   - listener: An object conforming to the ``TimerServiceListener`` protocol that will receive timer events.
    ///   - timerIdentify: A unique identifier for the timer, used to distinguish between different timers.
    func replaceTimer(_ listener: TimerServiceListener,timerIdentify: String)
    
    /// Adds a listener to receive timer-related events.
    /// - Parameter listener: An object conforming to the ``TimerServiceListener`` protocol that will receive timer events.
    /// - Parameter timerIdentify: A unique identifier for the timer, used to distinguish between different timers.
    func registerListener(_ listener: TimerServiceListener,timerIdentify: String)
    
    /// Removes a previously added listener from receiving timer-related events.
    /// - Parameter listener: An object conforming to the ``TimerServiceListener`` protocol that will no longer receive timer events.
    /// - Parameter timerIdentify: A unique identifier for the timer, used to distinguish between different timers. 
    func removeListener(_ listener: TimerServiceListener, timerIdentify: String)
    
}






