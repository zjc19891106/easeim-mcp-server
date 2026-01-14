package com.hyphenate.callkit.telecom

import android.annotation.SuppressLint
import android.content.Context
import android.content.Context.TELECOM_SERVICE
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.TelecomManager
import androidx.core.net.toUri
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.telecom.PhoneAccountHelper.getPhoneAccountHandle
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.PermissionHelper.hasReadPhoneStatePermission

/**
 * \~chinese
 * TelecomHelper 辅助类，用于处理来电弹出系统来电界面相关逻辑
 *
 * \~english
 * TelecomHelper helper class,used to handle incoming call related logic
 */
object TelecomHelper {
    private const val TAG = "Callkit TelecomHelper"
    
    /**
     * \~chinese
     * 立即启动来电的静态方法，无延时
     *
     * @param context 上下文
     * @param callerId 来电号码
     * @param callerName 来电者姓名
     *
     * \~english
     * Start call immediately, no delay
     * @param context context
     * @param callerId caller id
     * @param callerName caller name
     */
    fun startCallImmediately(
        context: Context,
        callerId: String = "calling",
        callerName: String = "CallKit Call" ,
        callId: String? = "call_${System.currentTimeMillis()}"
    ) {
        ChatLog.d(TAG, "startCallImmediately called with callerId: $callerId, callerName: $callerName, callId: $callId")
        try {
            // 通过IncomingCallService处理来电
            IncomingCallService.startService(context, callerId, callerName,callId?:"call_${System.currentTimeMillis()}")
        } catch (e: Exception) {
            ChatLog.e(TAG, "Failed to start service: ${e.message}")
            // 如果启动服务失败，尝试直接处理来电
            handleIncomingCallDirectly(context, callerId, callerName)
        }
    }
    
    /**
     * \~chinese
     * 停止来电服务
     *
     * \~english
     * Stop incoming call service
     */
    fun stopService(context: Context) {
        try {
            IncomingCallService.stopService(context)
            ChatLog.d(TAG, "Service stopped successfully")
        } catch (e: Exception) {
            ChatLog.e(TAG, "Failed to stop service: ${e.message}")
        }
    }

    /**
     * \~chinese
     * 处理来电
     *
     * \~english
     * Handle incoming call
     */
    fun handleIncomingCall(context: Context,callerId: String, callerName: String, callId: String) {
        // 检查设备兼容性
        val status = PhoneAccountHelper.getPhoneAccountStatus(context)
        if (!status.isSupported or !status.isRegistered or !status.isEnabled) {
            ChatLog.e(TAG,"Phone account is not supported or not registered or not enabled: ${status.message}")
            // 如果PhoneAccount未启用，直接启动自定义来电界面
            startCustomIncomingCallActivity(callerId, callerName, callId)
            return
        }

        // 创建来电参数
        val extras = Bundle().apply {
            val uri = "tel:$callerId".toUri()
            putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, uri)
            putString(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, callerName)
            putString("call_id", callId)
            putBoolean(TelecomManager.EXTRA_START_CALL_WITH_SPEAKERPHONE, false)
            putString(TelecomManager.EXTRA_CALL_SUBJECT, callerName)
        }

        // 触发系统来电界面
        try {
            val telecomManager = context.getSystemService(TELECOM_SERVICE) as TelecomManager
            ChatLog.d(TAG, "Attempting to add incoming call with extras: $extras")
            telecomManager.addNewIncomingCall(getPhoneAccountHandle(context), extras)
            ChatLog.d(
                TAG,
                "Incoming call added successfully: $callerName ($callerId), Call ID: $callId"
            )
        } catch (e: Exception) {
            ChatLog.e(TAG, "Failed to add incoming call: ${e.message}")
            startCustomIncomingCallActivity(callerId, callerName, callId)
        }
    }

    private fun startCustomIncomingCallActivity(
        callerId: String,
        callerName: String,
        callId: String
    ) {
        ChatLog.d(TAG, "Starting custom incoming call activity as fallback")
        CallKitClient.signalingManager.startSendEvent()
    }



    /**
     * \~chinese
     * 结束指定的Telecom通话
     *
     * @param context 上下文
     * @param callId 通话ID
     *
     * \~english
     * End specific Telecom call
     * @param context context
     * @param callId call id
     */
    fun endCall(context: Context, callId: String? = null) {
        // 检查权限后再检查活跃通话
        if (!hasActiveCalls(context)){
            ChatLog.d(TAG, "No active calls or phone state permission to end.")
            return
        }
        try {
            // 优先尝试直接调用VoipConnectionService
            val voipService = VoipConnectionService.getCurrentInstance()
            if (voipService != null) {
                ChatLog.d(TAG, "Found active VoipConnectionService, calling endTelecom directly")
                voipService.endTelecom()
            }
            stopService(context)
            ChatLog.d(TAG, "Call ended : $callId")
        } catch (e: Exception) {
            ChatLog.e(TAG, "Failed to end call $callId: ${e.message}")
        }
    }


    /**
     * \~chinese
     * 直接处理来电的备用方案,启动callkit默认来电页面
     *
     * \~english
     * Directly handle incoming call as a fallback, start the default incoming call page of callkit
     */
    private fun handleIncomingCallDirectly(context: Context, callerId: String, callerName: String) {
        CallKitClient.signalingManager.startSendEvent()
    }

    /**
     * \~chinese
     * 启动来电，支持延时
     *
     * @param context 上下文
     * @param callerId 来电号码，
     * @param callerName 来电者姓名
     * @param delaySeconds 延时秒数，默认为 4 秒
     *
     * \~english
     * Start incoming call, support delay
     * @param context context
     * @param callerId caller id
     * @param callerName caller name
     * @param delaySeconds delay seconds, default is 4 seconds
     */
    fun startCall(
        context: Context,
        callerId: String = "calling",
        callerName: String = "CallKit Call",
        delaySeconds: Int = 4
    ) {
        val delayMillis = delaySeconds * 1000L
        ChatLog.d(TAG,"startCall called, will trigger incoming call in $delaySeconds seconds...")
        // 延时后触发来电
        Handler(Looper.getMainLooper()).postDelayed({
            startCallImmediately(context, callerId, callerName)
        }, delayMillis)
    }

    /**
     * \~chinese
     * 检查是否有活跃的Telecom通话
     *
     * \~english
     * Check if there are active Telecom calls
     */
    @SuppressLint("MissingPermission")
    fun hasActiveCalls(context: Context): Boolean {
        return try {
            if (hasReadPhoneStatePermission(context)) {
                val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
                if (telecomManager == null) {
                    ChatLog.e(TAG, "TelecomManager not available")
                    return false
                }
                val isInCall = telecomManager.isInCall
                ChatLog.d(TAG, "TelecomManager.isInCall: $isInCall")
                isInCall
            }else{
                return false
            }
        } catch (e: Exception) {
            ChatLog.e(TAG, "Failed to check active calls: ${e.message}")
            false
        }
    }
}