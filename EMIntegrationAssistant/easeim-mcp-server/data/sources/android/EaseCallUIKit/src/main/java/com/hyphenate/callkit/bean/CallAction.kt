package com.hyphenate.callkit.bean

/**
 * \~chinese
 * 通话信令Action枚举
 *
 * \~english
 * Call action enumeration
 */
enum class CallAction(val state: String) {
    CALL_INVITE("invite"),
    CALL_ALERT("alert"),
    CALL_CONFIRM_RING("confirmRing"),
    CALL_CANCEL("cancelCall"),
    CALL_ANSWER("answerCall"),
    CALL_CONFIRM_CALLEE("confirmCallee"),
    CALL_VIDEO_TO_VOICE("videoToVoice"),
    CALL_END("leaveCall");

    companion object {
        fun getfrom(state: String): CallAction {
            return when (state) {
                "invite" -> CallAction.CALL_INVITE
                "alert" -> CallAction.CALL_ALERT
                "confirmRing" -> CallAction.CALL_CONFIRM_RING
                "cancelCall" -> CallAction.CALL_CANCEL
                "answerCall" -> CallAction.CALL_ANSWER
                "confirmCallee" -> CallAction.CALL_CONFIRM_CALLEE
                "videoToVoice" -> CallAction.CALL_VIDEO_TO_VOICE
                "leaveCall" -> CallAction.CALL_END
                else -> CallAction.CALL_INVITE
            }
        }
    }
}