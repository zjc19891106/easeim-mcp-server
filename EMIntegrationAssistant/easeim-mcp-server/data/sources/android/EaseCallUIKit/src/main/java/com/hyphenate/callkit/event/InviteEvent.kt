package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction
import com.hyphenate.callkit.bean.CallType

/**
 * \~chinese
 * 邀请事件
 * @property type 通话类型
 *
 * \~english
 * Invite event
 * @property type call type
 */
class InviteEvent : BaseEvent() {
    var type: CallType? = null
    
    init {
        callAction = CallAction.CALL_INVITE
    }
} 