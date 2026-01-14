package com.hyphenate.callkit.manager

import android.content.Context
import android.content.Context.AUDIO_SERVICE
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.AudioPlaybackConfiguration
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.utils.ChatLog
import java.io.IOException


/**
 * \~chinese
 * 音频控制管理器
 * 负责音频播放、铃声管理
 *
 * \~english
 * Audio controller
 * Responsible for audio playback, ringtone management
 */
class AudioController {

    internal enum class RingType {
        OUTGOING,  // 外呼铃声
        INCOMING,  // 来电铃声
        DING    // 结束警告铃声 ding
    }

    private  val TAG = "CallKit AudioController"
    private var ringtone: Ringtone? = null
    private var mediaPlayer: MediaPlayer? = null
    private lateinit var mContext: Context
    private lateinit var audioManager: AudioManager
    private var isPlayDing = false
    
    // AudioFocus 相关
    private var audioFocusRequest: AudioFocusRequest? = null
    private var hasAudioFocus = false
    

    // 记录开始播放铃声前是否有其他音频在播放
    private var wasOtherAudioPlaying = false
    
    // AudioFocus 变化监听器
    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_GAIN -> hasAudioFocus = true
            AudioManager.AUDIOFOCUS_LOSS -> {
                hasAudioFocus = false
                stopPlayRing()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> hasAudioFocus = false
        }
    }


    /**
     * 初始化音频控制器
     */
    internal fun init(context: Context) {
        this.mContext = context.applicationContext
        audioManager = mContext.getSystemService(AUDIO_SERVICE) as AudioManager
        // 开始振铃设置
        val ringUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        audioManager.setMode(AudioManager.MODE_RINGTONE)
        if (ringUri != null) {
            ringtone = RingtoneManager.getRingtone(mContext, ringUri)
        }
        mediaPlayer=MediaPlayer()
    }

    /**
     * 检测当前是否有其他音频在播放
     */
    private fun isOtherAudioPlaying(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                audioManager.activePlaybackConfigurations.any { config ->
                    config.audioAttributes.usage == AudioAttributes.USAGE_MEDIA
                }
            } catch (e: Exception) {
                false
            }
        } else {
            // 对于旧版本 Android，保守假设可能有音频播放
            audioManager.getStreamVolume(AudioManager.STREAM_MUSIC) > 0
        }
    }

    /**
     * 主动停止其他应用的音频播放
     */
    private fun stopOtherAudioPlayers() {
        try {
            audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PAUSE))
            audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PAUSE))
        } catch (e: Exception) {
            ChatLog.e(TAG, "stopOtherAudioPlayers error: ${e.message}" )
        }
    }
    
    /**
     * 恢复其他应用的音频播放
     */
    private fun resumeOtherAudioPlayers() {
        if (!wasOtherAudioPlaying) {
            return
        }
        
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PLAY))
                audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PLAY))
            } catch (e: Exception) {
                ChatLog.e(TAG, "resumeOtherAudioPlayers error: ${e.message}" )
            }
            wasOtherAudioPlaying = false
        }, 500)
    }

    /**
     * 请求音频焦点
     */
    private fun requestAudioFocus(): Boolean {
        val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(audioAttributes)
                .setOnAudioFocusChangeListener(audioFocusChangeListener)
                .build()
            
            audioManager.requestAudioFocus(audioFocusRequest!!)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_RING,
                AudioManager.AUDIOFOCUS_GAIN
            )
        }
        
        hasAudioFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        return hasAudioFocus
    }
    
    /**
     * 释放音频焦点
     */
    private fun releaseAudioFocus() {
        if (hasAudioFocus) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest!!)
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(audioFocusChangeListener)
            }
            hasAudioFocus = false
        }
        resumeOtherAudioPlayers()
    }

    /**
     * 播放铃声
     */
    @Synchronized
    internal fun playRing(ringType: RingType?=null) {
        val ringerMode: Int = audioManager.ringerMode
        if (ringerMode == AudioManager.RINGER_MODE_NORMAL) {
            // 检测并记录当前音频状态，不记录通话时挂断场景
            if (CallKitClient.callState.value != CallState.CALL_ANSWERED && ringType!= RingType.DING){
                wasOtherAudioPlaying = isOtherAudioPlaying()
            }

            stopOtherAudioPlayers()

            if (!requestAudioFocus()) {
                return
            }
            ChatLog.e(TAG, "playRing start ringtone, ringType: $ringType")
            val ringFile: String? = when(ringType){
                RingType.OUTGOING -> CallKitClient.callKitConfig.outgoingRingFile
                RingType.INCOMING -> CallKitClient.callKitConfig.incomingRingFile
                RingType.DING -> CallKitClient.callKitConfig.dingRingFile
                else -> null
            }
            if (ringFile != null) {
                isPlayDing = if (ringType == RingType.DING) true else false
                // 确保 MediaPlayer 处于正确状态
                try {
                    mediaPlayer?.reset()
                } catch (e: Exception) {
                    ChatLog.e(TAG, "Error resetting MediaPlayer: ${e.message}")
                }
                mediaPlayer = MediaPlayer()
                try {
                    mediaPlayer?.apply {
                        when {
                            ringFile.startsWith("assets://") -> {
                                // 处理assets文件
                                val assetFileName = ringFile.substring(9) // 移除 "assets://" 前缀
                                val assetFileDescriptor = mContext.assets.openFd(assetFileName)
                                setDataSource(
                                    assetFileDescriptor.fileDescriptor,
                                    assetFileDescriptor.startOffset,
                                    assetFileDescriptor.length
                                )
                                assetFileDescriptor.close()
                            }

                            ringFile.startsWith("raw://") -> {
                                // 处理res/raw资源文件
                                val resourceName = ringFile.substring(6) // 移除 "raw://" 前缀
                                val resourceId = mContext.resources.getIdentifier(
                                    resourceName.substringBeforeLast('.'), // 移除文件扩展名
                                    "raw",
                                    mContext.packageName
                                )
                                if (resourceId != 0) {
                                    val rawFileDescriptor =
                                        mContext.resources.openRawResourceFd(resourceId)
                                    setDataSource(
                                        rawFileDescriptor.fileDescriptor,
                                        rawFileDescriptor.startOffset,
                                        rawFileDescriptor.length
                                    )
                                    rawFileDescriptor.close()
                                } else {
                                    throw IOException("Raw resource not found: $resourceName")
                                }
                            }

                            else -> {
                                // 处理普通文件路径
                                setDataSource(ringFile)
                            }
                        }

                        setOnCompletionListener {
                            ChatLog.d(TAG, "playRing completed: ${ringFile}")
                            //除ding铃声外，其他铃声播放完毕后自动循环
                           if (ringType!= RingType.DING ){
                               start()
                           } else {
                               // DING 播放完成，可以释放资源
                               isPlayDing = false
                               releaseMediaPlayer()
                           }
                        }
                        setOnErrorListener { mp, what, extra ->
                            isPlayDing=false
                            ChatLog.e(TAG, "playRing error: what=$what, extra=$extra")
                            true
                        }
                        if (!isPlaying) {
                            prepare()
                            start()
                            ChatLog.e(TAG, "playRing play file: $ringFile")
                        }
                    }
                } catch (e: Exception) {
                    releaseMediaPlayer()
                    ChatLog.e(TAG, "playRing error: ${e.message}")
                    // 如果自定义铃声播放失败，回退到系统铃声
                    if (ringType!= RingType.DING){
                        ringtone?.play()
                    }
                }
            } else {
                if (ringType!= RingType.DING){
                    ringtone?.play()
                }
                ChatLog.e(TAG, "playRing play ringtone")
            }
        }
    }

    @Synchronized
    internal fun stopPlayRingAndPlayDing(){
        stopPlayRing()
        playRing(RingType.DING)
    }

    /**
     * 停止播放铃声
     */
    @Synchronized
    internal fun stopPlayRing() {
        try {
            ChatLog.d(TAG, "stopPlayRing")
            mediaPlayer?.let { player ->
                if (player.isPlaying) {
                    player.stop()
                }
            }
            ringtone?.stop()
        } catch (e:Exception){
            ChatLog.e(TAG, "stopPlayRing error: ${e.message}")
        }
    }

    private fun releaseMediaPlayer() {
        try {
            ChatLog.d(TAG, "releaseMediaPlayer")
            // 确保释放音频焦点（这会自动调用resumeOtherAudioPlayers）
            releaseAudioFocus()
            stopPlayRing()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e:Exception){
            ChatLog.e(TAG, "releaseMediaPlayer error: ${e.message}")
        }
    }
    /**
     * 释放资源
     */
    internal fun exitCall() {
        ChatLog.d(TAG, "exitCall")
        //播放ding的时候让ding播放完后自己去处理释放
        if (isPlayDing) {
            releaseAudioFocus()
        } else {
            releaseMediaPlayer()
        }
    }
}