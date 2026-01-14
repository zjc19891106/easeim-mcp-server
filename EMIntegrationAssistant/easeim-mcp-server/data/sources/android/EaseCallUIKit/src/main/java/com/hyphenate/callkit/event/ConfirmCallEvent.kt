package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction

/**
 * \~chinese
 * 确认通话事件
 * @property result 结果
 *
 * \~english
 * Confirm call event
 * @property result result
 */
class ConfirmCallEvent : BaseEvent() {
    var result: String? = null
    
    init {
        callAction = CallAction.CALL_CONFIRM_CALLEE
    }
} 