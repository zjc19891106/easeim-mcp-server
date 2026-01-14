package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction

/**
 * \~chinese
 * 取消通话事件
 * @property cancel 是否取消
 * @property remoteTimeout 是否远端超时
 *
 * \~english
 * Call cancel event
 * @property cancel whether to cancel
 * @property remoteTimeout whether remote timeout
 */
class CallCancelEvent : BaseEvent() {
    var cancel: Boolean = true
    var remoteTimeout: Boolean = false
    
    init {
        callAction = CallAction.CALL_CANCEL
    }
} 