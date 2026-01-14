package com.hyphenate.callkit.utils

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.hyphenate.callkit.telecom.TelecomHelper

/**
 * \~chinese
 * 权限管理工具类
 * 主要用于悬浮窗权限的检查和申请
 *
 * \~english
 * Permission management tool class, mainly used for checking and requesting floating window permissions
 */
object PermissionHelper {
    
    private const val TAG = "Callkit PermissionHelper"
    
    /**
     * \~chinese
     * 检查是否有悬浮窗权限
     *
     * \~english
     * Check if there is floating window permission
     */
    fun hasFloatWindowPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true // Android 6.0以下默认有权限
        }
    }
    
    /**
     * \~chinese
     * 请求悬浮窗权限
     *
     * \~english
     * Request floating window permission
     */
    fun requestFloatWindowPermission(activity: Activity, requestCode: Int = 100) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            activity.startActivityForResult(intent, requestCode)
        }
    }

    /**
     * \~chinese
     * 显示权限说明对话框
     *
     * \~english
     * Show permission explanation dialog
     */
    fun showPermissionExplanationDialog(
        activity: Activity,
        onConfirm: () -> Unit,
        onCancel: () -> Unit = {}
    ) {
        AlertDialog.Builder(activity)
            .setTitle("需要悬浮窗权限")
            .setMessage("为了在后台显示通话悬浮窗，需要开启悬浮窗权限。请在设置中允许此应用显示在其他应用上层。")
            .setPositiveButton("去设置") { _, _ ->
                onConfirm()
            }
            .setNegativeButton("取消") { _, _ ->
                onCancel()
            }
            .setCancelable(false)
            .show()
    }
    
    /**
     * \~chinese
     * 检查是否在电池优化白名单中
     *
     * \~english
     * Check if it is in the battery optimization whitelist
     */
    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            powerManager.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true // Android 6.0以下默认没有电池优化限制
        }
    }
    
    /**
     * \~chinese
     * 请求加入电池优化白名单
     *
     * \~english
     * Request to join the battery optimization whitelist
     */
    fun requestIgnoreBatteryOptimizations(activity: Activity, requestCode: Int = 200) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            try {
                activity.startActivityForResult(intent, requestCode)
            } catch (e: Exception) {
                // 如果设备不支持直接跳转，则跳转到电池优化设置页面
                val fallbackIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                activity.startActivityForResult(fallbackIntent, requestCode)
            }
        }
    }
    
    /**
     * \~chinese
     * 显示电池优化说明对话框
     *
     * \~english
     * Show battery optimization explanation dialog
     */
    fun showBatteryOptimizationExplanationDialog(
        activity: Activity,
        onConfirm: () -> Unit,
        onCancel: () -> Unit = {}
    ) {
        AlertDialog.Builder(activity)
            .setTitle("电池优化设置")
            .setMessage("为了确保通话质量，建议将应用加入电池优化白名单。这样可以避免系统在后台限制应用的运行，确保视频通话的稳定性。")
            .setPositiveButton("去设置") { _, _ ->
                onConfirm()
            }
            .setNegativeButton("取消") { _, _ ->
                onCancel()
            }
            .setCancelable(false)
            .show()
    }

    /**
     * \~chinese
     * 检查是否有READ_PHONE_STATE权限
     *
     * \~english
     * Check if READ_PHONE_STATE permission is granted
     */
    fun hasReadPhoneStatePermission(context: Context): Boolean {
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            ChatLog.w(TAG, "READ_PHONE_STATE permission not granted")
        }

        return hasPermission
    }
} 