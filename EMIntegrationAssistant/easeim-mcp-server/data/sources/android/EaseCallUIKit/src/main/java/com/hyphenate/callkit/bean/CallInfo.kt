package com.hyphenate.callkit.bean

import com.hyphenate.callkit.utils.ChatMessage
import org.json.JSONObject

/**
 * \~chinese
 * 通话信息数据类
 * @property channelName 频道名称
 * @property fromUser 来电用户
 * @property isComming 是否为来电
 * @property callerDevId 主叫设备ID
 * @property callId 通话ID
 * @property callKitType 通话类型
 * @property ext 扩展信息
 * @property inviteMessage 邀请消息
 * @property callTime 通话时间
 *
 * \~english
 * Call information data class
 * @property channelName channel name
 * @property fromUser caller user
 * @property isComming whether it is a incoming call
 * @property callerDevId caller device ID
 * @property callId call ID
 * @property callKitType call type
 * @property ext extension information
 * @property inviteMessage invite message
 * @property callTime call time
 *
 */
data class CallInfo(
    var channelName: String? = null,
    var fromUser: String ,
    var isComming: Boolean = false,
    var callerDevId: String,
    var callId: String,
    var callKitType: CallType,
    var ext: JSONObject? = null,
    var inviteMessage: ChatMessage?=null,
    var callTime: Long=0
) 