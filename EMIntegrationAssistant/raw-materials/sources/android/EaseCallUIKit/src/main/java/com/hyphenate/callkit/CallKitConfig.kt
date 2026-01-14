package com.hyphenate.callkit

import com.hyphenate.callkit.bean.Constant

/**
 * \~chinese
 * CallKit配置类，用于配置CallKit的各项参数
 * 包括铃声、呼叫超时时间等
 *
 * \~english
 * CallKit configuration class, used to configure the parameters of CallKit
 * Including ringtones, call timeout, etc.
 */
class CallKitConfig {
    /**
     * \~chinese
     * 来电铃声文件路径
     * 如果为null，则使用默认铃声
     *
     * \~english
     * Incoming call ringtone file path
     * If it is null, the default ringtone will be used
     */
    var incomingRingFile: String? = null
    /**
     * \~chinese
     * 呼叫铃声文件路径
     * 如果为null，则使用默认铃声
     *
     * \~english
     * Outgoing call ringtone file path
     * If it is null, the default ringtone will be used
     */
    var outgoingRingFile: String? = null
    /**
     * \~chinese
     * 结束铃声文件路径
     * 如果为null，则使用默认铃声
     *
     * \~english
     * end call ring file path
     * If it is null, the default ringtone will be used
     */
    var dingRingFile: String? = null
    /**
     * \~chinese
     * 呼叫超时时间，单位为秒
     * 默认值为Constant.CALL_INVITE_INTERVAL
     *
     * \~english
     * Call timeout, in seconds
     * The default value is Constant.CALL_INVITE_INTERVAL
     */
    var callTimeout: Int = Constant.CALL_INVITE_INTERVAL

    /**
     * \~chinese
     * 是否禁用RTC Token验证
     * 默认值为false，即启用RTC Token验证
     *
     * \~english
     * Whether to disable RTC Token validation
     * The default value is false, that is, RTC Token validation is enabled
     */
    var disableRTCTokenValidation: Boolean = false

    /**
     * \~chinese
     * 复制另一个CallKitConfig对象的所有属性到当前对象
     *
     * \~english
     * Copy all properties of another CallKitConfig object to the current object
     */
    fun copyFrom(other: CallKitConfig) {
        this.incomingRingFile = other.incomingRingFile
        this.outgoingRingFile = other.outgoingRingFile
        this.dingRingFile = other.dingRingFile
        this.callTimeout = other.callTimeout
        this.disableRTCTokenValidation = other.disableRTCTokenValidation
    }
}