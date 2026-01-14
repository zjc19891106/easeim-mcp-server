package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction

/**
 * \~chinese
 * 确认振铃事件
 * @property valid 是否有效
 *
 * \~english
 * Confirm ring event
 * @property valid whether valid
 */
class ConfirmRingEvent : BaseEvent() {
    var valid: Boolean? = null
    
    init {
        callAction = CallAction.CALL_CONFIRM_RING
    }
} 