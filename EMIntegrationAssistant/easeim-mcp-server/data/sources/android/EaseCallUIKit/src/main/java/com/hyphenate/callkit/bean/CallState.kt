package com.hyphenate.callkit.bean

/**
 *
 * \~chinese
 * 通话状态枚举
 *
 * \~english
 * Call state enumeration
 *
 */
enum class CallState(val code: Int) {
    /**
     * \~chinese
     * 初始状态
     *
     * \~english
     * Idle state
     */
    CALL_IDLE(0),     
    /**
     * \~chinese
     * 拨打电话状态
     *
     * \~english
     * Outgoing call state
     */
    CALL_OUTGOING(1),  

    /**
     * \~chinese
     * 振铃状态
     *
     * \~english
     * Alerting state
     */
    CALL_ALERTING(2),  
    /**
     * \~chinese
     * 接通通话状态
     *
     * \~english
     * Answered state
     */
    CALL_ANSWERED(3);  

    companion object {
        fun getfrom(code: Int): CallState {
            return when (code) {
                0 -> CALL_IDLE
                1 -> CALL_OUTGOING
                2 -> CALL_ALERTING
                3 -> CALL_ANSWERED
                else -> CALL_IDLE
            }
        }
    }
}