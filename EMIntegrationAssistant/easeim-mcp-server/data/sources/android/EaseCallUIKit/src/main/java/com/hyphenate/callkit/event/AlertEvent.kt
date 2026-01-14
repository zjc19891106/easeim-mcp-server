package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction

/**
 * \~chinese
 * 振铃事件
 *
 * \~english
 * Alert event
 *
 */
class AlertEvent : BaseEvent() {
    init {
        callAction = CallAction.CALL_ALERT
    }
} 