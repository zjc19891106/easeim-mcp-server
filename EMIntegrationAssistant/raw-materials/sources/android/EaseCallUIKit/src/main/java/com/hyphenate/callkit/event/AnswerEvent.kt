package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction

/**
 * \~chinese
 * 接听事件
 * @property result 结果
 * @property transVoice 是否转换为语音
 *
 * \~english
 * Answer event
 * @property result result
 * @property transVoice whether to convert to voice
 */
class AnswerEvent : BaseEvent() {
    var result: String? = null
    var transVoice: Boolean = false
    
    init {
        callAction = CallAction.CALL_ANSWER
    }
} 