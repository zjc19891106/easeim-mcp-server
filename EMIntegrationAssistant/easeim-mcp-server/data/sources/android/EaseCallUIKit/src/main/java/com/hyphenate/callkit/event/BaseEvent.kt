package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction

/**
 * \~chinese
 * 基础事件类
 *
 * @property callAction 通话动作
 * @property callerDevId 主叫设备ID
 * @property calleeDevId 被叫设备ID
 * @property timeStramp 时间戳
 * @property callId 通话ID
 * @property msgType 消息类型
 * @property userId 用户ID
 *
 * \~english
 * Base event class
 * @property callAction call action
 * @property callerDevId caller device ID
 * @property calleeDevId callee device ID
 * @property timeStramp timestamp
 * @property callId call ID
 * @property msgType message type
 * @property userId user ID
 */
open class BaseEvent(
    var callAction: CallAction? = null,
    var callerDevId: String? = null,
    var calleeDevId: String? = null,
    var timeStramp: Long = 0L,
    var callId: String? = null,
    var msgType: String? = null,
    var userId: String? = null
) 