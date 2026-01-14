package com.hyphenate.callkit.utils

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.annotation.RequiresPermission
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.hyphenate.callkit.R
import com.hyphenate.util.EMLog
import com.hyphenate.util.EasyUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * \~chinese
 * 通知管理器，用于处理通知相关逻辑
 *
 * \~english
 * Notification manager, used to handle notification related logic
 */
class CallKitNotifier(private val context: Context) {
    
    companion object {
        private const val TAG = "EaseCallKitNotifier"
        private const val NOTIFY_ID = 341
        private const val CHANNEL_ID = "call_kit_notification"
        private const val CHANNEL_NAME = "Call Kit Notifications"
        private const val CHANNEL_DESCRIPTION = "Notifications for call kit messages"
        private val VIBRATION_PATTERN = longArrayOf(0, 180, 80, 120)
        private const val RINGTONE_STOP_DELAY = 3000L
        private const val MIN_NOTIFICATION_INTERVAL = 1000L
    }
    
    private val appContext: Context = context.applicationContext
    private val notificationManager: NotificationManager by lazy {
        appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }
    private val notificationManagerCompat: NotificationManagerCompat by lazy {
        NotificationManagerCompat.from(appContext)
    }
    private val audioManager: AudioManager by lazy {
        appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = appContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            appContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }
    
    private val packageName: String = appContext.packageName
    private val defaultMessage: String by lazy {
        appContext.getString(R.string.contact_send_message)
    }
    
    // 使用线程安全的集合和原子变量
    private val fromUsers = mutableSetOf<String>()
    private val notificationCount = AtomicLong(0)
    private val lastNotifyTime = AtomicLong(0)
    private val isRingtoneActive = AtomicBoolean(false)
    
    private var ringtone: Ringtone? = null
    private var notificationInfoProvider: EaseNotificationInfoProvider? = null
    private var ringtoneStopJob: Job? = null
    
    // 协程作用域
    private val notificationScope = CoroutineScope(Dispatchers.Main + Job())
    
    init {
        createNotificationChannel()
    }
    
    /**
     * 创建通知渠道（Android 8.0+）
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                vibrationPattern = VIBRATION_PATTERN
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    /**
     * \~chinese
     * 检查通知权限
     *
     * \~english
     * Check notification permission
     */
    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            notificationManagerCompat.areNotificationsEnabled()
        }
    }
    
    /**
     * \~chinese
     * 重置通知状态
     *
     * \~english
     * Reset notification state
     */
    fun reset() {
        resetNotificationCount()
        cancelNotification()
        stopRingtone()
    }
    
    /**
     * \~chinese
     * 重置通知计数
     *
     * \~english
     * Reset notification count
     */
    fun resetNotificationCount() {
        synchronized(fromUsers) {
            notificationCount.set(0)
            fromUsers.clear()
        }
    }
    
    /**
     * \~chinese
     * 取消通知
     *
     * \~english
     * Cancel notification
     */
    fun cancelNotification() {
        notificationManagerCompat.cancel(NOTIFY_ID)
    }
    
    /**
     * \~chinese
     * 发送单个消息通知
     *
     * \~english
     * Send single message notification
     */
    @Synchronized
    fun notify(message: ChatMessage) {
        if (shouldShowNotification()) {
            EMLog.d(TAG, "App is running in background, showing notification")
            
            synchronized(fromUsers) {
                notificationCount.incrementAndGet()
                fromUsers.add(message.from)
            }
            
            handleMessage(message)
        }
    }
    
    /**
     * \~chinese
     * 发送多个消息通知
     *
     * \~english
     * Send multiple message notifications
     */
    @Synchronized
    fun notify(messages: List<ChatMessage>) {
        if (shouldShowNotification() && messages.isNotEmpty()) {
            EMLog.d(TAG, "App is running in background, showing notification for ${messages.size} messages")
            
            synchronized(fromUsers) {
                messages.forEach { message ->
                    notificationCount.incrementAndGet()
                    fromUsers.add(message.from)
                }
            }
            
            handleMessage(messages.last())
        }
    }
    
    /**
     * \~chinese
     * 发送简单文本通知
     *
     * \~english
     * Send simple text notification
     */
    @RequiresPermission(Manifest.permission.POST_NOTIFICATIONS)
    @Synchronized
    fun notify(content: String?) {
        if (shouldShowNotification()) {
            try {
                val notification = generateBaseBuilder(content).build()
                notificationManagerCompat.notify(NOTIFY_ID, notification)
            } catch (e: Exception) {
                EMLog.e(TAG, "Error showing notification"+e.message)
            }
        }
    }
    
    /**
     * \~chinese
     * 发送全屏Intent通知（适用于Android 10+的后台启动Activity限制）
     *
     * \~english
     * Send full screen intent notification (suitable for background activity startup limit of Android 10+)
     */
    @RequiresPermission(Manifest.permission.POST_NOTIFICATIONS)
    @Synchronized
    fun notify(fullScreenIntent: Intent?, title: String?, content: String?) {
        if (shouldShowNotification()) {
            try {
                val builder = generateBaseFullIntentBuilder(fullScreenIntent, content)
                if (!title.isNullOrEmpty()) {
                    builder.setContentTitle(title)
                }
                val notification = builder.build()
                notificationManagerCompat.notify(NOTIFY_ID, notification)
            } catch (e: Exception) {
                EMLog.e(TAG, "Error showing full screen notification"+e.message)
            }
        }
    }
    
    /**
     * \~chinese
     * 设置通知信息提供者
     *
     * \~english
     * Set notification info provider
     */
    fun setNotificationInfoProvider(provider: EaseNotificationInfoProvider?) {
        this.notificationInfoProvider = provider
    }
    
    /**
     * \~chinese
     * 判断是否应该显示通知
     *
     * \~english
     * Check if should show notification
     */
    private fun shouldShowNotification(): Boolean {
        return !EasyUtils.isAppRunningForeground(appContext) && hasNotificationPermission()
    }
    
    /**
     * \~chinese
     * 处理消息通知
     *
     * \~english
     * Handle message notification
     */
    private fun handleMessage(message: ChatMessage?) {
        try {
            val fromUsersCount: Int
            synchronized(fromUsers) {
                fromUsersCount = fromUsers.size
            }
            val messageCount = notificationCount.get()
            
            var notifyText = String.format(defaultMessage, fromUsersCount, messageCount)
            
            val builder = generateBaseBuilder(notifyText)
            
            // 应用自定义通知信息
            notificationInfoProvider?.let { provider ->
                provider.getTitle(message)?.let { title ->
                    builder.setContentTitle(title)
                }
                
                provider.getDisplayedText(message)?.let { displayText ->
                    builder.setTicker(displayText)
                }
                
                provider.getLaunchIntent(message)?.let { intent ->
                    val pendingIntent = createPendingIntent(intent)
                    builder.setContentIntent(pendingIntent)
                }
                
                provider.getLatestText(message, fromUsersCount, messageCount.toInt())?.let { latestText ->
                    builder.setContentText(latestText)
                    notifyText = latestText
                }
                
                val smallIcon = provider.getSmallIcon(message)
                if (smallIcon != 0) {
                    builder.setSmallIcon(smallIcon)
                }
            }
            
            val notification = builder.build()
            if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED){
                notificationManagerCompat.notify(NOTIFY_ID, notification)
            }else{
                EMLog.e(TAG, "Lack of POST_NOTIFICATIONS permission, cannot show notification")
            }

            // 播放铃声和震动（Android 8.0以下）
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                vibrateAndPlayTone(message)
            }
            
        } catch (e: Exception) {
            EMLog.e(TAG, "Error handling message notification"+e.message)
        }
    }
    
    /**
     * \~chinese
     * 生成基础通知构建器
     *
     * \~english
     * Generate base notification builder
     */
    private fun generateBaseBuilder(content: String?): NotificationCompat.Builder {
        val pm = appContext.packageManager
        val title = pm.getApplicationLabel(appContext.applicationInfo).toString()
        val launchIntent = pm.getLaunchIntentForPackage(packageName)
        val pendingIntent = createPendingIntent(launchIntent)
        
        return NotificationCompat.Builder(appContext, CHANNEL_ID)
            .setSmallIcon(getDefaultIcon())
            .setContentTitle(title)
            .setTicker(content)
            .setContentText(content)
            .setWhen(System.currentTimeMillis())
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
    }
    
    /**
     * \~chinese
     * 生成全屏Intent通知构建器
     *
     * \~english
     * Generate full screen intent notification builder
     */
    private fun generateBaseFullIntentBuilder(
        fullScreenIntent: Intent?,
        content: String?
    ): NotificationCompat.Builder {
        val pm = appContext.packageManager
        val title = pm.getApplicationLabel(appContext.applicationInfo).toString()
        val fullScreenPendingIntent = createPendingIntent(fullScreenIntent)
        
        return NotificationCompat.Builder(appContext, CHANNEL_ID)
            .setSmallIcon(getDefaultIcon())
            .setContentTitle(title)
            .setTicker(content)
            .setContentText(content)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setWhen(System.currentTimeMillis())
            .setAutoCancel(true)
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
    }
    
    /**
     * \~chinese
     * 创建PendingIntent，处理不同Android版本的FLAG
     *
     * \~english
     * Create PendingIntent, handle different Android version flags
     */
    private fun createPendingIntent(intent: Intent?): PendingIntent? {
        return intent?.let {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            PendingIntent.getActivity(appContext, NOTIFY_ID, it, flags)
        }
    }
    
    /**
     * \~chinese
     * 获取默认图标
     *
     * \~english
     * Get default icon
     */
    private fun getDefaultIcon(): Int {
        return appContext.applicationInfo.icon
    }
    
    /**
     * \~chinese
     * 播放铃声和震动
     *
     * \~english
     * Play ringtone and vibrate
     */
    private fun vibrateAndPlayTone(message: ChatMessage?) {
        // 检查时间间隔，避免频繁播放
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastNotifyTime.get() < MIN_NOTIFICATION_INTERVAL) {
            return
        }
        
        lastNotifyTime.set(currentTime)
        
        // 检查静音模式
        if (audioManager.ringerMode == AudioManager.RINGER_MODE_SILENT) {
            EMLog.d(TAG, "Device is in silent mode, skipping ringtone")
            return
        }
        
        // 播放铃声
        playRingtone()
        
        // 震动
        vibrate()
    }
    
    /**
     * \~chinese
     * 播放铃声
     *
     * \~english
     * Play ringtone
     */
    private fun playRingtone() {
        if (isRingtoneActive.get()) {
            return
        }
        
        try {
            if (ringtone == null) {
                val notificationUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                ringtone = RingtoneManager.getRingtone(appContext, notificationUri)
                
                if (ringtone == null) {
                    EMLog.d(TAG, "Cannot find ringtone at: ${notificationUri.path}")
                    return
                }
            }
            
            ringtone?.let { tone ->
                if (!tone.isPlaying) {
                    isRingtoneActive.set(true)
                    tone.play()
                    
                    // 为Samsung设备特殊处理，避免铃声持续播放
                    if (Build.MANUFACTURER.lowercase(Locale.getDefault()).contains("samsung")) {
                        scheduleRingtoneStop()
                    }
                }
            }
        } catch (e: Exception) {
            EMLog.e(TAG, "Error playing ringtone"+e.message)
        }
    }
    
    /**
     * \~chinese
     * 安排铃声停止
     *
     * \~english
     * Schedule ringtone stop
     */
    private fun scheduleRingtoneStop() {
        ringtoneStopJob?.cancel()
        ringtoneStopJob = notificationScope.launch {
            delay(RINGTONE_STOP_DELAY)
            stopRingtone()
        }
    }
    
    /**
     * \~chinese
     * 停止铃声
     *
     * \~english
     * Stop ringtone
     */
    private fun stopRingtone() {
        try {
            ringtone?.let { tone ->
                if (tone.isPlaying) {
                    tone.stop()
                }
            }
        } catch (e: Exception) {
            EMLog.e(TAG, "Error stopping ringtone"+e.message)
        } finally {
            isRingtoneActive.set(false)
            ringtoneStopJob?.cancel()
        }
    }
    
    /**
     * \~chinese
     * 震动
     *
     * \~english
     * Vibrate
     */
    private fun vibrate() {
        vibrator?.let { vib ->
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val vibrationEffect = VibrationEffect.createWaveform(VIBRATION_PATTERN, -1)
                    vib.vibrate(vibrationEffect)
                } else {
                    @Suppress("DEPRECATION")
                    vib.vibrate(VIBRATION_PATTERN, -1)
                }
            } catch (e: Exception) {
                EMLog.e(TAG, "Error vibrating"+e.message)
            }
        }
    }
    
    /**
     * \~chinese
     * 清理资源
     *
     * \~english
     * Clean up resources
     */
    fun cleanup() {
        stopRingtone()
        ringtoneStopJob?.cancel()
        ringtone = null
    }
    
    /**
     * \~chinese
     * 通知信息提供者接口
     *
     * \~english
     * Notification info provider interface
     */
    interface EaseNotificationInfoProvider {
        /**
         * 设置通知内容，例如 "you received a new image from xxx"
         */
        fun getDisplayedText(message: ChatMessage?): String?
        
        /**
         * 设置通知内容，例如 "you received 5 message from 2 contacts"
         */
        fun getLatestText(message: ChatMessage?, fromUsersNum: Int, messageNum: Int): String?
        
        /**
         * 设置通知标题
         */
        fun getTitle(message: ChatMessage?): String?
        
        /**
         * 设置小图标
         */
        fun getSmallIcon(message: ChatMessage?): Int
        
        /**
         * 设置点击通知时的Intent
         */
        fun getLaunchIntent(message: ChatMessage?): Intent?
    }
}