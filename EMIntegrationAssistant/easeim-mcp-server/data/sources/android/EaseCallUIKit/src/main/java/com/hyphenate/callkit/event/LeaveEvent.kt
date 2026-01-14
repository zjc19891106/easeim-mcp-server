package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction

/**
 * \~chinese
 * 离开RTC频道事件
 *
 * \~english
 * Leave RTC Channel event
 *
 */
class LeaveEvent : BaseEvent() {
    init {
        callAction = CallAction.CALL_END
    }
}