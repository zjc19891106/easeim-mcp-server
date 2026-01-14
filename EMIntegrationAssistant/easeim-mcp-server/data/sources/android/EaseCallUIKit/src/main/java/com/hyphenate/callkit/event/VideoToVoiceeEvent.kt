package com.hyphenate.callkit.event

import com.hyphenate.callkit.bean.CallAction

/**
 * \~chinese
 * 视频转语音事件
 *
 * \~english
 * Video to voice event
 *
 */
class VideoToVoiceeEvent : BaseEvent() {
    init {
        callAction = CallAction.CALL_VIDEO_TO_VOICE
    }
} 