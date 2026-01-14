package com.hyphenate.callkit.telecom

import android.app.AlertDialog
import android.content.ComponentName
import android.content.Context
import android.content.Context.TELECOM_SERVICE
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import com.hyphenate.callkit.R
import com.hyphenate.callkit.utils.ChatLog

/**
 * \~chinese
 * PhoneAccount助手类，用于管理和检测PhoneAccount状态
 *
 * \~english
 * PhoneAccount helper class, used to manage and detect PhoneAccount status
 */
object PhoneAccountHelper {
    private const val TAG = "Callkit PhoneAccountHelper"

    /**
     * \~chinese
     * 检查PhoneAccount是否已启用
     *
     * \~english
     * Check if PhoneAccount is enabled
     */
    @RequiresApi(Build.VERSION_CODES.M)
    fun isPhoneAccountEnabled(context: Context): Boolean {
        return try {
            val telecomManager =
                context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            if (telecomManager == null) {
                ChatLog.e(TAG, "TelecomManager not available")
                return false
            }

            val phoneAccountHandle = getPhoneAccountHandle(context)
            val phoneAccount = telecomManager.getPhoneAccount(phoneAccountHandle)
            val isEnabled = phoneAccount?.isEnabled == true

            ChatLog.d(TAG, "PhoneAccount enabled: $isEnabled")
            ChatLog.d(TAG, "PhoneAccount details: $phoneAccount")

            isEnabled
        } catch (e: SecurityException) {
            ChatLog.e(TAG, "Security exception checking phone account: ${e.message}")
            false
        } catch (e: Exception) {
            ChatLog.e(TAG, "Exception checking phone account: ${e.message}")
            false
        }
    }

    /**
     * \~chinese
     * 检查Telecom支持
     *
     * \~english
     * Check Telecom support
     */
    fun checkTelecomSupport(context: Context): Boolean {
        return try {
            // 检查是否有 TelecomManager
            val telecomManager = context.getSystemService(TELECOM_SERVICE) as? TelecomManager
            if (telecomManager == null) {
                ChatLog.e(TAG, "TelecomManager not available")
                return false
            }

            // 检查是否支持管理自己的通话
            val hasManageOwnCallsPermission = ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.MANAGE_OWN_CALLS
            ) == PackageManager.PERMISSION_GRANTED

            // 检查设备制造商
            val manufacturer = android.os.Build.MANUFACTURER.lowercase()
            val model = android.os.Build.MODEL
            ChatLog.d(TAG, "Device info - Manufacturer: $manufacturer, Model: $model")

            return hasManageOwnCallsPermission
        } catch (e: Exception) {
            ChatLog.e(TAG, "Error checking telecom support: ${e.message}")
            false
        }
    }

    /**
     * \~chinese
     * 检查PhoneAccount是否已注册
     */
    @RequiresApi(Build.VERSION_CODES.M)
    fun isPhoneAccountRegistered(context: Context): Boolean {
        return try {
            val telecomManager =
                context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            if (telecomManager == null) {
                ChatLog.e(TAG, "TelecomManager not available")
                return false
            }

            val phoneAccountHandle = getPhoneAccountHandle(context)
            val phoneAccount = telecomManager.getPhoneAccount(phoneAccountHandle)
            val isRegistered = phoneAccount != null

            ChatLog.d(TAG, "PhoneAccount registered: $isRegistered")
            isRegistered
        } catch (e: Exception) {
            ChatLog.e(TAG, "Exception checking phone account registration: ${e.message}")
            false
        }
    }
    /**
     * \~chinese
     * 检查PhoneAccount状态
     *
     * \~english
     * Check PhoneAccount status
     */
    fun checkPhoneAccountStatus(context: Context) {
        try {
            val telecomManager =
                context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            val accountHandle = getPhoneAccountHandle(context)
            val phoneAccount = telecomManager?.getPhoneAccount(accountHandle)
            if (phoneAccount == null) {
                ChatLog.w(TAG, "PhoneAccount is null, needs to be registered")
            } else {
                ChatLog.d(TAG, "PhoneAccount details:")
                ChatLog.d(TAG, "  - Label: ${phoneAccount.label}")
                ChatLog.d(TAG, "  - Address: ${phoneAccount.address}")
                ChatLog.d(TAG, "  - Capabilities: ${phoneAccount.capabilities}")
                ChatLog.d(TAG, "  - Enabled: ${phoneAccount.isEnabled}")
                ChatLog.d(TAG, "  - Supported URI schemes: ${phoneAccount.supportedUriSchemes}")
            }

            // 检查是否可以放置通话 - 添加权限检查
            if (ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.READ_PHONE_STATE
                )
                == PackageManager.PERMISSION_GRANTED
            ) {
                val canPlaceCall = telecomManager?.isInCall
                ChatLog.d(TAG, "TelecomManager.isInCall: $canPlaceCall")
            } else {
                ChatLog.w(TAG, "READ_PHONE_STATE permission not granted, cannot check call state")
            }

        } catch (e: Exception) {
            ChatLog.e(TAG, "Error checking PhoneAccount status: ${e.message}")
        }
    }

    /**
     * \~chinese
     * 注册PhoneAccount
     *
     * \~english
     * Register PhoneAccount
     */
    fun registerPhoneAccount(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            ChatLog.e(TAG, "PhoneAccount registration requires API level 23 or higher")
            return false
        }

        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
        if (telecomManager == null) {
            ChatLog.e(TAG, "TelecomManager not available")
            return false
        }

        try {
            val phoneAccountHandle = getPhoneAccountHandle(context)
            val phoneAccount = PhoneAccount.builder(phoneAccountHandle, "CallKit VoIP")
                .setCapabilities(
                    // 使用标准 ConnectionService
                    PhoneAccount.CAPABILITY_CALL_PROVIDER or
                            PhoneAccount.CAPABILITY_CONNECTION_MANAGER or
                            PhoneAccount.CAPABILITY_SUPPORTS_VIDEO_CALLING
                )
                .setHighlightColor(0xFF0000FF.toInt())
                .setShortDescription("VoIP 通话服务")
                .addSupportedUriScheme(PhoneAccount.SCHEME_TEL)
                .addSupportedUriScheme(PhoneAccount.SCHEME_SIP)
                .build()
            telecomManager.registerPhoneAccount(phoneAccount)
            ChatLog.d(TAG, "PhoneAccount registered successfully")
        } catch (e: Exception) {
            ChatLog.e(TAG, "Failed to register PhoneAccount: ${e.message}")
            return false
        }
        return true
    }

    /**
     * \~chinese
     * 获取PhoneAccountHandle
     *
     * \~english
     * Get PhoneAccountHandle
     */
    @RequiresApi(Build.VERSION_CODES.M)
    fun getPhoneAccountHandle(context: Context): PhoneAccountHandle {
        val componentName = ComponentName(context, VoipConnectionService::class.java)
        return PhoneAccountHandle(componentName, "voip_callkit_account")
    }

    /**
     * \~chinese
     * 显示引导对话框，帮助用户启用PhoneAccount
     *
     * \~english
     * Show guide dialog to help user enable PhoneAccount
     */
    fun showPhoneAccountEnableGuide(context: Context, onResult: (enabled: Boolean) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            onResult(false)
            return
        }

        AlertDialog.Builder(context)
            .setTitle(
                R.string.callkit_enable_call_function)
            .setMessage(R.string.callkit_enable_call_function_desc)
            .setPositiveButton(R.string.callkit_set_call_function) { _, _ ->
                openPhoneAccountSettings(context)
                // 延迟检查，给用户时间操作
                Handler(Looper.getMainLooper()).postDelayed({
                    val enabled = isPhoneAccountEnabled(context)
                    onResult(enabled)
                }, 3000) // 3秒后检查
            }
            .setNegativeButton(R.string.callkit_not_set_call_function) { _, _ ->
                onResult(false)
            }
            .setCancelable(false)
            .show()
    }

    /**
     * \~chinese
     * 打开系统的通话账户设置页面
     *
     * \~english
     * Open the phone account settings page of the system
     */
    fun openPhoneAccountSettings(context: Context) {
        try {
            val intent = Intent("android.telecom.action.CHANGE_PHONE_ACCOUNTS")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            ChatLog.d(TAG, "Opened phone account settings")
        } catch (e: Exception) {
            ChatLog.e(TAG, "Failed to open phone account settings: ${e.message}")
            // 备用方案：打开通用设置
            try {
                val intent = Intent(Settings.ACTION_SETTINGS)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                ChatLog.d(TAG, "Opened general settings as fallback")
            } catch (e2: Exception) {
                ChatLog.e(TAG, "Failed to open any settings: ${e2.message}")
            }
        }
    }

    /**
     * \~chinese
     * 获取PhoneAccount状态的详细信息
     *
     * \~english
     * Get the detailed information of PhoneAccount status
     */
    @RequiresApi(Build.VERSION_CODES.M)
    fun getPhoneAccountStatus(context: Context): PhoneAccountStatus {
        var phoneAccount : PhoneAccount ?
        try {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            if (telecomManager == null) {
                return PhoneAccountStatus(false ,false ,false ,"TelecomManager is not available")
            }
            val phoneAccountHandle = getPhoneAccountHandle(context)
            phoneAccount = telecomManager.getPhoneAccount(phoneAccountHandle)
            ChatLog.d(TAG, "PhoneAccount details: $phoneAccount")
            return when {
                phoneAccount == null -> PhoneAccountStatus(true ,false ,false ,"PhoneAccount is supported but not registered")
                !phoneAccount.isEnabled -> PhoneAccountStatus(true ,true ,false ,"PhoneAccount is registered but not enabled")
                else -> PhoneAccountStatus(true ,true ,true ,"PhoneAccount is enabled")
            }
        } catch (e: SecurityException) {
            ChatLog.e(TAG, "Security exception checking phone account: ${e.message}")
            return PhoneAccountStatus(false ,false ,false ,e.message?:"permission not granted")
        } catch (e: Exception) {
            ChatLog.e(TAG, "Exception checking phone account: ${e.message}")
            return PhoneAccountStatus(false ,false ,false ,e.message?:"checking phone account error")
        }
    }

    /**
     * \~chinese
     * PhoneAccount状态数据类
     *
     * \~english
     * PhoneAccount status data class
     */
    data class PhoneAccountStatus(
        val isSupported: Boolean,
        val isRegistered: Boolean,
        val isEnabled: Boolean,
        val message: String
    )
} 