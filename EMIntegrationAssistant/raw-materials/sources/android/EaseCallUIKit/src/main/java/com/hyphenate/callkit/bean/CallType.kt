package com.hyphenate.callkit.bean

/**
 * \~chinese
 * 通话类型枚举
 *
 * \~english
 * Call type enumeration
 *
 */
enum class CallType(val code: Int) {

    /**
     * \~chinese
     * 1v1语音通话
     *
     * \~english
     * 1v1 voice call
     */
    SINGLE_VOICE_CALL(0), 
    /**
     * \~chinese
     * 1v1视频通话
     *
     * \~english
     * 1v1 video call
     */
    SINGLE_VIDEO_CALL(1), 
    /**
     * \~chinese
     * 群组音视频
     *
     * \~english
     * Group call
     */
    GROUP_CALL(2);

    companion object {
        /**
         * \~chinese
         * 根据code获取CallType
         *
         * \~english
         * Get CallType from code
         */
        fun getfrom(code: Int): CallType {
            return when (code) {
                0 -> SINGLE_VOICE_CALL
                1 -> SINGLE_VIDEO_CALL
                2 -> GROUP_CALL
                else -> SINGLE_VIDEO_CALL
            }
        }
    }
} 