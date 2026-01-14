package com.hyphenate.callkit.widget

import android.content.Context
import android.util.AttributeSet
import android.util.Log
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.TextureView
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import coil.load
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.NetworkQuality
import com.hyphenate.callkit.extension.dpToPx
import com.hyphenate.callkit.utils.CallKitUtils.setBgRadius
import com.hyphenate.callkit.utils.ChatLog

/**
 * \~chinese
 * 多人视频通话成员视图
 * 支持显示视频画面、用户头像、用户名、麦克风状态、网络状态等
 *
 * \~english
 * Multi-video call member view, supports displaying video view, user avatar, user name, microphone status, network status, etc.
 * After refactoring, directly use the status information in CallKitUserInfo, no longer maintain local status
 */
class MultiVideoCallMemberView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    companion object {
        private const val TAG = "MultiVideoCallMemberView"
    }

    // UI组件
    private lateinit var videoTexture: TextureView
    private lateinit var avatarImageView: ImageView
    private lateinit var userNameTextView: TextView
    private lateinit var micStatusImageView: ImageView
    private lateinit var networkStatusImageView: ImageView
    private lateinit var speakingIndicator: View
    lateinit var cslConnecting: View
    private lateinit var llContainer: View

    // 用户信息 - 包含所有状态
    private var userInfo: CallKitUserInfo? = null
    
    init {
        initView()
    }

    private fun initView() {
        // 加载布局
        LayoutInflater.from(context).inflate(R.layout.view_multi_video_call_member, this, true)
        
        // 初始化UI组件
        videoTexture = findViewById(R.id.texture_view)
        avatarImageView = findViewById(R.id.avatar_image)
        userNameTextView = findViewById(R.id.user_name)
        micStatusImageView = findViewById(R.id.mic_status)
        networkStatusImageView = findViewById(R.id.network_status)
        speakingIndicator = findViewById(R.id.speaking_indicator)
        cslConnecting = findViewById(R.id.csl_connecting)
        llContainer = findViewById(R.id.ll_container)

        setBgRadius( this, 8.dpToPx(context))

        // 设置默认状态
        updateUI()
    }

    /**
     * 拦截触摸事件，防止子视图消费点击
     */
    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        // 在DOWN时开始拦截，后续事件都会交给本View处理
        return true
    }

    /**
     * 设置用户信息 - 这是主要的更新入口
     */
    fun setUserInfo(userInfo: CallKitUserInfo) {
        this.userInfo = userInfo
        // 更新UI
        updateUI()
    }

    /**
     * 设置视频视图
     */
    fun setVideoView(block: (textureView: TextureView) -> Unit) {
        ChatLog.d(TAG, "setVideoView() called, textureView: $videoTexture"+
            ", videoEnabled: ${userInfo?.isVideoEnabled}")
        if (isVideoEnabled()){
            block(videoTexture)
        }
        updateUI()
    }

    /**
     * 兼容性方法 - 设置视频启用状态
     * 注意：这些方法只是为了兼容性，实际状态应该通过setUserInfo更新
     */
    fun setVideoEnabled(enabled: Boolean) {
        ChatLog.d(TAG, "setVideoEnabled() called, enabled: $enabled")
        userInfo?.let { info ->
            info.isVideoEnabled=enabled
            // 更新视频显示
            if (info.isVideoEnabled) {
                videoTexture.visibility = VISIBLE
            } else {
                videoTexture.visibility = GONE
                avatarImageView.visibility = VISIBLE
                avatarImageView.load(userInfo?.avatar){
                    error(R.drawable.callkit_video_default)
                    placeholder(R.drawable.callkit_video_default)
                }
            }
            ChatLog.d(TAG, "setVideoEnabled() uid: ${info.uid},video status changed to: $enabled")
        }
    }

    /**
     * 兼容性方法 - 设置麦克风启用状态
     */
    fun setMicEnabled(enabled: Boolean) {
        userInfo?.let { info ->
            info.isMicEnabled=enabled
            // 更新麦克风状态
            micStatusImageView.visibility = if (info.isMicEnabled) GONE else VISIBLE
            ChatLog.d(TAG, "setMicEnabled() uid: ${info.uid},mic status changed to: $enabled")
        }
    }

    /**
     * 兼容性方法 - 设置说话状态
     */
    fun setSpeaking(speaking: Boolean) {
        userInfo?.let { info ->
            info.isSpeaking=speaking
            // 更新说话指示器
            speakingIndicator.visibility = if (info.isSpeaking) VISIBLE else GONE
            if (speaking){
                micStatusImageView.visibility=GONE
            }
            ChatLog.d(TAG, "setSpeaking() uid: ${info.uid},speaking status changed to: $speaking")
        }
    }

    /**
     * 兼容性方法 - 设置网络质量
     */
    fun setNetworkQuality(quality: NetworkQuality) {
        userInfo?.let { info ->
            info.networkQuality=quality
            updateNetworkStatus(info.networkQuality)
        }
    }

    /**
     * 兼容性方法 - 设置连接状态
     */
    fun setConnected(connected: Boolean) {
        ChatLog.d(TAG, "setConnected() called, connected: $connected")
        userInfo?.let { info ->
            if (info.connected != connected) {
                info.connected = connected
                updateUI()
                ChatLog.d(TAG, "setConnected() uid: ${info.uid}, connection status changed to: $connected")
            }
        }
    }

    /**
     * 更新UI显示 - 基于userInfo中的状态
     */
    private fun updateUI() {
        val info = userInfo
        if (info == null) {
            Log.e(TAG, "updateUI() called but userInfo is null")
            return
        }

        ChatLog.d(TAG, "updateUI() called for user: ${info}")

        // 更新视频显示
        if (info.isVideoEnabled) {
            videoTexture.visibility = VISIBLE
        } else {
            videoTexture.visibility = GONE
            avatarImageView.visibility = VISIBLE
            avatarImageView.load(userInfo?.avatar){
                error(R.drawable.callkit_video_default)
                placeholder(R.drawable.callkit_video_default)
            }
        }
        // 更新连接状态
        cslConnecting.visibility = if (info.connected) GONE else VISIBLE
        
        // 更新麦克风状态
        micStatusImageView.visibility = if (info.isMicEnabled) GONE else VISIBLE

        updateNetworkStatus(info.networkQuality)

        // 更新说话指示器
        speakingIndicator.visibility = if (info.isSpeaking) VISIBLE else GONE
        if (info.isSpeaking){
            micStatusImageView.visibility=GONE
        }

        // 更新用户名显示
        userNameTextView.text= info.getName()

    }

    private fun updateNetworkStatus(networkQuality: NetworkQuality) {
        // 更新网络状态
        when (networkQuality) {
            NetworkQuality.GOOD -> {
                networkStatusImageView.visibility = VISIBLE
                networkStatusImageView.setImageResource(R.drawable.callkit_network_good)
            }
            NetworkQuality.POOR -> {
                networkStatusImageView.visibility = VISIBLE
                networkStatusImageView.setImageResource(R.drawable.callkit_network_poor)
            }
            NetworkQuality.WORSE -> {
                networkStatusImageView.visibility = VISIBLE
                networkStatusImageView.setImageResource(R.drawable.callkit_network_worse)
            }
            NetworkQuality.NONE -> {
                networkStatusImageView.visibility = VISIBLE
                networkStatusImageView.setImageResource(R.drawable.callkit_network_none)
            }
            NetworkQuality.UNKNOWN -> {
                networkStatusImageView.visibility = View.GONE
            }
        }
    }

    /**
     * 获取用户信息
     */
    fun getUserInfo(): CallKitUserInfo? {
        ChatLog.d(TAG, "getUserInfo() called, userInfo: ${userInfo?.userId}")
        return userInfo
    }

    /**
     * 是否启用视频
     */
    fun isVideoEnabled(): Boolean {
        val enabled = userInfo?.isVideoEnabled ?: true
        ChatLog.d(TAG, "isVideoEnabled() called, returning: $enabled")
        return enabled
    }

    /**
     * 是否启用麦克风
     */
    fun isMicEnabled(): Boolean {
        val enabled = userInfo?.isMicEnabled ?: true
        ChatLog.d(TAG, "isMicEnabled() called, returning: $enabled")
        return enabled
    }

    /**
     * 是否正在说话
     */
    fun isSpeaking(): Boolean {
        val speaking = userInfo?.isSpeaking ?: false
        ChatLog.d(TAG, "isSpeaking() called, returning: $speaking")
        return speaking
    }

    /**
     * 获取网络质量
     */
    fun getNetworkQuality(): NetworkQuality {
        val quality = userInfo?.networkQuality ?: NetworkQuality.GOOD
        ChatLog.d(TAG, "getNetworkQuality() called, returning: $quality")
        return quality
    }

    /**
     * 是否已连接
     */
    fun isConnected(): Boolean {
        val connected = userInfo?.connected ?: false
        ChatLog.d(TAG, "isConnected() called, returning: $connected")
        return connected
    }

}