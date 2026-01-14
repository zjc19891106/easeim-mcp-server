package com.hyphenate.callkit.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.R
import com.hyphenate.callkit.base.BaseCallActivity
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.ui.MultiCallActivity
import com.hyphenate.callkit.ui.SingleCallActivity
import com.hyphenate.callkit.utils.ChatLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch


/**
 * \~chinese
 * 通话前台服务
 * 用于在应用后台时保持摄像头和麦克风权限，确保视频通话正常进行
 *
 * \~english
 * Call foreground service
 * Used to keep the camera and microphone permissions when the application is in the background, ensuring normal video calls
 */
class CallForegroundService : Service() {

    companion object {
        private const val TAG = "CallForegroundService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "call_foreground_service"
        private const val CHANNEL_NAME = "通话服务"

        /**
         * \~chinese
         * 启动前台服务
         *
         * \~english
         * Start foreground service
         */
        fun startService(context: Context) {
            try {
                // 检查是否真的在通话中
                if (CallKitClient.callState.value == CallState.CALL_IDLE) {
                    ChatLog.d(TAG, "Not in call, skipping foreground service start")
                    return
                }

                val intent = Intent(context, CallForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                ChatLog.e(TAG, "Failed to start foreground service: ${e.message}")
            }
        }

        /**
         * \~chinese
         * 停止前台服务
         *
         * \~english
         * Stop foreground service
         */
        fun stopService(context: Context) {
            val intent = Intent(context, CallForegroundService::class.java)
            context.stopService(intent)
        }
    }

    private var serviceScope: CoroutineScope? = null
    private var observeJob: Job? = null

    override fun onCreate() {
        super.onCreate()

        // 创建通知渠道
        createNotificationChannel()

        // 立即启动前台服务以避免超时异常（必须在5秒内调用）
        val notification = createNotification()

        try {
            // 根据 Android 版本，选择合适的方式处理前台服务
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // 对于 Android 11 及以上版本，启动前台服务并指定多种服务类型
                val serviceTypes = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                this.startForeground(NOTIFICATION_ID, notification, serviceTypes)
            } else {
                // 对于 Android 11 以下版本，无需指定服务类型，简单地启动前台服务即可
                this.startForeground(NOTIFICATION_ID, notification)
            }
            ChatLog.d(TAG, "successful startForeground")
        } catch (ex: java.lang.Exception) {
            ChatLog.e(TAG, "Error starting foreground service:" + ex)
        }
        // 检查权限（在启动前台服务之后）
        checkRequiredPermissions()

        // 检查电池优化状态
        checkBatteryOptimization()

        // 创建服务协程作用域
        serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

        // 开始观察通话状态
        startObservingCallState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        // 处理特殊动作
        when (intent?.action) {
            "END_CALL" -> {
                // 结束通话
                CallKitClient.exitCall()
                stopSelf()
                return START_NOT_STICKY
            }
        }

        // 更新通知内容（如果需要）
        updateNotification()

        return START_STICKY // 服务被杀死后自动重启
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onDestroy() {
        super.onDestroy()

        // 取消观察
        observeJob?.cancel()

        // 取消协程作用域
        serviceScope?.cancel()
    }

    /**
     * 检查必需权限
     */
    private fun checkRequiredPermissions(): Boolean {
        val requiredPermissions = arrayOf(
            android.Manifest.permission.RECORD_AUDIO,
            android.Manifest.permission.CAMERA
        )

        for (permission in requiredPermissions) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    permission
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ChatLog.e(TAG, "Missing permission: $permission")
                return false
            }
        }
        return true
    }

    /**
     * 创建通知渠道
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "用于保持通话服务在后台运行"
                setShowBadge(false)
                setSound(null, null)
            }

            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * 创建前台服务通知
     */
    private fun createNotification(): Notification {
        // 安全获取通话状态信息，避免在初始化时出现异常
        val callState = try {
            CallKitClient.callState.value
        } catch (e: Exception) {
            ChatLog.w(TAG, "Failed to get call state: ${e.message}")
            CallState.CALL_IDLE
        }

        val callType = try {
            CallKitClient.callType.value
        } catch (e: Exception) {
            ChatLog.w(TAG, "Failed to get call type: ${e.message}")
            CallType.SINGLE_VIDEO_CALL
        }

        val duration = try {
            CallKitClient.rtcManager.connectedTime.value
        } catch (e: Exception) {
            0L
        }

        // 根据通话类型创建合适的Intent
        val intent = when (callType) {
            CallType.GROUP_CALL -> BaseCallActivity.createLockScreenIntent(
                this,
                MultiCallActivity::class.java
            )

            else -> BaseCallActivity.createLockScreenIntent(this, SingleCallActivity::class.java)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = when (callState) {
            CallState.CALL_ANSWERED -> {
                val minutes = duration / 60
                val seconds = duration % 60
                "通话中 ${String.format("%02d:%02d", minutes, seconds)}"
            }

            CallState.CALL_OUTGOING -> "拨打中"
            CallState.CALL_ALERTING -> "响铃中"
            else -> "通话服务"
        }

        val content = when (callType) {
            CallType.SINGLE_VIDEO_CALL -> "视频通话 • 点击返回通话界面"
            CallType.SINGLE_VOICE_CALL -> "语音通话 • 点击返回通话界面"
            CallType.GROUP_CALL -> "多人通话 • 点击返回通话界面"
        }

        // 添加操作按钮
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(R.drawable.callkit_phone_pick)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // 不可滑动删除
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_HIGH) // 提高优先级
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(true)
            .setUsesChronometer(callState == CallState.CALL_ANSWERED) // 通话中显示计时器

        // 如果是通话中状态，添加结束通话按钮
        if (callState == CallState.CALL_ANSWERED) {
            val endCallIntent = Intent(this, CallForegroundService::class.java).apply {
                action = "END_CALL"
            }
            val endCallPendingIntent = PendingIntent.getService(
                this,
                1,
                endCallIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            builder.addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "结束通话",
                endCallPendingIntent
            )
        }

        return builder.build()
    }

    /**
     * \~chinese
     * 开始观察通话状态
     *
     * \~english
     * Start observing call state
     */
    private fun startObservingCallState() {
        observeJob = serviceScope?.launch {
            try {
                CallKitClient.callState.collect { callState ->

                    when (callState) {
                        CallState.CALL_IDLE -> {
                            // 通话结束，停止服务
                            stopSelf()
                        }

                        else -> {
                            // 更新通知
                            updateNotification()
                        }
                    }
                }
            } catch (e: Exception) {
                ChatLog.e(TAG, "Error observing call state: ${e.message}")
            }
        }
    }

    /**
     * \~chinese
     * 更新通知
     *
     * \~english
     * Update notification
     */
    private fun updateNotification() {
        val notification = createNotification()
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    /**
     * \~chinese
     * 检查电池优化状态
     *
     * \~english
     * Check battery optimization status
     */
    private fun checkBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoringBatteryOptimizations =
                powerManager.isIgnoringBatteryOptimizations(packageName)

            if (!isIgnoringBatteryOptimizations) {
                ChatLog.w(TAG, "App is not in battery optimization whitelist")
            }
        }
    }
} 