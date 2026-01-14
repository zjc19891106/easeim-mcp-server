package com.hyphenate.callkit.bean

import android.content.Context
import com.hyphenate.callkit.R
import com.hyphenate.callkit.utils.TimerUtils.timeFormat

/**
 * \~chinese
 * 通话结束原因枚举
 *
 * \~english
 * Call end reason enumeration
 */
enum class CallEndReason(val code: Int) {
    /**
     * \~chinese
     * 正常挂断
     *
     * \~english
     * Normal hangup
     */
    CallEndReasonHangup(0),           
    /**
     * \~chinese
     * 自己取消通话
     *
     * \~english
     * Self cancel
     */
    CallEndReasonCancel(1),          
    /**
     * \~chinese
     * 对方取消通话
     *
     * \~english
     * Remote cancel
     */
    CallEndReasonRemoteCancel(2),     
    /**
     * \~chinese
     * 自己拒绝接听
     *
     * \~english
     * self refuse
     */
    CallEndReasonRefuse(3),
    /**
     * \~chinese
     * 对方拒绝接听
     *
     * \~english
     * Remote refuse
     */
    CallEndReasonRemoteRefuse(4),
    /**
     * \~chinese
     * 忙线中
     *
     * \~english
     * Busy
     */
    CallEndReasonBusy(5),
    /**
     * \~chinese
     * 自己无响应
     *
     * \~english
     * Self no response
     */
    CallEndReasonNoResponse(6),
    /**
     * \~chinese
     * 对端无响应
     *
     * \~english
     * Remote no response
     */
    CallEndReasonRemoteNoResponse(7),
    /**
     * \~chinese
     * 在其他设备接听
     *
     * \~english
     * Handle on other device
     */
    CallEndReasonHandleOnOtherDevice(8), 

    /**
     * \~chinese
     * 通话中断
     *
     * \~english
     * Remote drop
     */
    CallEndReasonRemoteDrop(9);

    /**
     * \~chinese
     * 根据code获取CallEndReason
     *
     * \~english
     * Get CallEndReason from code
     */
    companion object {
        fun getfrom(code: Int): CallEndReason {
            return when (code) {
                0 -> CallEndReasonHangup
                1 -> CallEndReasonCancel
                2 -> CallEndReasonRemoteCancel
                3 -> CallEndReasonRefuse
                4 -> CallEndReasonRemoteRefuse
                5 -> CallEndReasonBusy
                6 -> CallEndReasonNoResponse
                7 -> CallEndReasonRemoteNoResponse
                8 -> CallEndReasonHandleOnOtherDevice
                9 -> CallEndReasonRemoteDrop
                else -> CallEndReasonHangup
            }
        }
        
        
    }

    fun getStringByCallEndReason(context: Context, callDuration: Long?=0 ): String = when (this) {
        // 正常挂断
        CallEndReasonHangup -> context.getString(R.string.callkit_call_duration, callDuration?.timeFormat())
        // 自己取消通话
        CallEndReasonCancel -> context.getString(R.string.callkit_self_cancel)
        // 对方取消通话
        CallEndReasonRemoteCancel -> context.getString(R.string.callkit_remote_cancel)
        // 自己拒绝接听
        CallEndReasonRefuse -> context.getString(R.string.callkit_self_refused)
        // 对方拒绝接听
        CallEndReasonRemoteRefuse -> context.getString(R.string.callkit_remote_refused)
        // 忙线中
        CallEndReasonBusy -> context.getString(R.string.callkit_remote_busy)
        // 自己无响应
        CallEndReasonNoResponse -> context.getString(R.string.callkit_self_no_response)
        // 对端无响应
        CallEndReasonRemoteNoResponse -> context.getString(R.string.callkit_remote_no_response)
        // 在其他设备处理
        CallEndReasonHandleOnOtherDevice -> context.getString(R.string.callkit_handle_on_other_device)
        //通话中断
        CallEndReasonRemoteDrop -> context.getString(R.string.callkit_remote_drop)
    }
} 