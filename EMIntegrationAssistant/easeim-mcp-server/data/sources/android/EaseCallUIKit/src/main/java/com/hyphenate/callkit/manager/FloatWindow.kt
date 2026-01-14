package com.hyphenate.callkit.manager

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.media.midi.MidiDevice
import android.os.Build
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.TextureView
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import coil.load
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.CallKitClient.callState
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.extension.dpToPx
import com.hyphenate.callkit.ui.MultiCallActivity
import com.hyphenate.callkit.ui.SingleCallActivity
import com.hyphenate.callkit.utils.CallKitUtils.setBgRadius
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.PermissionHelper
import com.hyphenate.callkit.service.CallForegroundService
import com.hyphenate.callkit.utils.TimerUtils.timeFormat
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import com.hyphenate.callkit.base.BaseCallActivity

/**
 * \~chinese
 * 悬浮窗管理类
 * 负责显示、隐藏和管理通话悬浮窗
 *
 * \~english
 * Float window manager
 * Responsible for displaying, hiding, and managing the call floating window
 */
class FloatWindow {

    companion object {
        private const val TAG = "Callkit FloatWindow"
    }

    private var mContext: Context? = null
    private var windowManager: WindowManager? = null
    private var floatView: View? = null
    private var isShowing = false
    private var observeJob: Job? = null
    private var currentLayoutParams: WindowManager.LayoutParams? = null

    // 拖拽相关变量
    private var lastX = 0f
    private var lastY = 0f
    private var startX = 0f
    private var startY = 0f
    private var isDragging = false
    private var tvDuration: TextView? = null

    fun init(context: Context) {
        this.mContext = context.applicationContext
        this.windowManager = mContext?.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
    }

    /**
     * 显示悬浮窗
     */
    fun showFloatWindow(): Boolean {
        if (mContext == null) {
            ChatLog.e(TAG, "Context is null")
            return false
        }
        // 防止重复调用
        if (isShowing && floatView != null) {
            ChatLog.d(TAG, "FloatWindow already showing, skipping")
            return true
        }

        // 检查权限
        if (!PermissionHelper.hasFloatWindowPermission(mContext!!)) {
            ChatLog.e(TAG, "No float window permission")
            CallKitClient.callKitListener?.onCallError(
                CallKitClient.CallErrorType.BUSINESS_ERROR,
                CallKitClient.CALL_BUSINESS_ERROR.CALL_PARAM_ERROR.code,
                "Float window permission required",
            )
            return false
        }

        // 如果已经在显示，先隐藏
        if (isShowing) {
            ChatLog.d(TAG, "FloatWindow already showing, hiding first")
            hideFloatWindow()
        }

        try {
            val callType = CallKitClient.callType.value
            ChatLog.d(TAG, "Creating float view for callType: $callType")

            // 1. 先创建悬浮窗视图（但不添加到WindowManager）
            floatView = createFloatView(callType)

            floatView?.let { view ->
                setupTouchListener(view)

                // 2. 预先设置视频内容（在显示前）
                prepareVideoContent(view, callType)

                // 3. 创建窗口参数
                val windowLayoutParams = createLayoutParams(mContext!!, callType)

                // 4. 直接显示悬浮窗（已经预设置了内容）
                windowManager?.addView(view, windowLayoutParams)
                isShowing = true
                currentLayoutParams = windowLayoutParams // 保存当前的layoutParams

                // 开始观察状态变化
                startObserving()

                ChatLog.d(TAG, "Float window shown successfully")
                return true
            }
        } catch (e: Exception) {
            ChatLog.e(TAG, "Error creating float window: ${e.message}")
            return false
        }
        ChatLog.e(TAG, "Failed to create float view")
        return false
    }

    /**
     * 隐藏悬浮窗
     */
    fun hideFloatWindow() {
        ChatLog.d(TAG, "hideFloatWindow called, isShowing: $isShowing")

        if (isShowing && floatView != null) {
            windowManager?.removeView(floatView)
            ChatLog.d(TAG, "Float window hidden successfully")
        }
        stopObserving()
        floatView = null
        isShowing = false
        tvDuration = null
        currentLayoutParams = null // 清除当前的layoutParams
    }

    /**
     * 检查悬浮窗是否正在显示
     */
    fun isFloatWindowShowing(): Boolean = isShowing

    /**
     * 创建悬浮窗视图
     */
    private fun createFloatView(callType: CallType): View {
        val context = mContext ?: throw IllegalStateException("Context is null")

        return when (callType) {
            CallType.SINGLE_VIDEO_CALL -> {
                createVideoFloatView(context)
            }

            CallType.SINGLE_VOICE_CALL, CallType.GROUP_CALL -> {
                createVoiceFloatView(context)
            }
        }
    }

    /**
     * 创建视频通话悬浮窗
     */
    private fun createVideoFloatView(context: Context): View {
        val view = LayoutInflater.from(context).inflate(R.layout.callkit_float_window_video, null)
        mContext?.apply {
            setBgRadius(view, 12.dpToPx(this))
        }
        // 初始化视频显示
        setupVideoDisplay(view)
        return view
    }

    /**
     * 创建语音通话悬浮窗
     */
    private fun createVoiceFloatView(context: Context): View {
        val view = LayoutInflater.from(context).inflate(R.layout.callkit_float_window_voice, null)
        tvDuration = view.findViewById<TextView>(R.id.tvCallDuration)
        return view
    }

    /**
     * 设置视频显示
     */
    private fun setupVideoDisplay(view: View) {
        val videoContainer = view.findViewById<FrameLayout>(R.id.flVideoContainer)
        val callState = CallKitClient.callState.value

        when (callState) {
            CallState.CALL_ANSWERED -> {
                // 通话中，显示对方视频
                setupRemoteVideo(videoContainer)
            }

            CallState.CALL_OUTGOING, CallState.CALL_ALERTING -> {
                // 拨打中或振铃中，显示自己的视频
                setupLocalVideo(videoContainer)
            }

            else -> {
                // 其他状态显示头像
                setupUserAvatar(videoContainer)
            }
        }
    }

    /**
     * 设置本地视频
     */
    private fun setupLocalVideo(container: FrameLayout) {
        val context = mContext ?: return

        // 检查是否已经有TextureView，避免重复创建
        val existingTextureView = container.getChildAt(0) as? TextureView
        if (existingTextureView != null) {
            val localUid = CallKitClient.rtcManager.localUid.value
            CallKitClient.rtcManager.setupLocalVideo(existingTextureView, localUid)
            return
        }

        val textureView = TextureView(context).apply {
            // 设置TextureView的属性
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            // 确保TextureView可见
            alpha = 1.0f
            visibility = View.VISIBLE
        }

        container.removeAllViews()
        container.addView(textureView)

        // 立即设置视频渲染
        val localUid = CallKitClient.rtcManager.localUid.value
        CallKitClient.rtcManager.setupLocalVideo(textureView, localUid)
    }

    /**
     * 设置远程视频
     */
    private fun setupRemoteVideo(container: FrameLayout) {
        val context = mContext ?: return

        if (CallKitClient.rtcManager.remoteVideoMute.value) {
            // 对方关闭了视频，显示头像
            ChatLog.d(TAG, "Remote video muted, showing avatar")
            setupUserAvatar(container)
        } else {
            // 检查是否已经有TextureView，避免重复创建
            val existingTextureView = container.getChildAt(0) as? TextureView
            if (existingTextureView != null) {
                val remoteUid = CallKitClient.rtcManager.remoteUid.value
                CallKitClient.rtcManager.setupRemoteVideo(existingTextureView, remoteUid)
                ChatLog.d(TAG, "Reusing existing TextureView for remote video, uid: $remoteUid")
                return
            }

            // 显示对方视频
            val textureView = TextureView(context).apply {
                // 设置TextureView的属性
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
                // 确保TextureView可见
                alpha = 1.0f
                visibility = View.VISIBLE
            }

            container.removeAllViews()
            container.addView(textureView)

            // 立即设置视频渲染
            val remoteUid = CallKitClient.rtcManager.remoteUid.value
            CallKitClient.rtcManager.setupRemoteVideo(textureView, remoteUid)
            ChatLog.d(TAG, "Created new TextureView for remote video, uid: $remoteUid")
        }
    }

    /**
     * 设置用户头像
     */
    private fun setupUserAvatar(container: FrameLayout) {
        val context = mContext ?: return

        // 检查是否已经是ImageView，避免重复创建
        val existingImageView = container.getChildAt(0) as? ImageView
        if (existingImageView != null) {
            return
        }
        // 使用协程调用suspend函数，确保UI更新在主线程
        CallKitClient.callKitScope.launch {
            withContext(Dispatchers.Main) {
                // 先在主线程清除容器和创建ImageView
                container.removeAllViews()

                val imageView = ImageView(context).apply {
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    layoutParams = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                }

                // 先添加ImageView到容器，显示默认头像
                container.addView(imageView)
                imageView.load(R.drawable.callkit_default_avatar)

                // 获取用户信息并加载头像
                val userInfo = if (CallKitClient.callState.value == CallState.CALL_OUTGOING) {
                    CallKitClient.getCurrentUserInfo()
                } else {
                    CallKitClient.getCache().getUserInfoById(CallKitClient.fromUserId)
                }

                imageView.load(userInfo?.avatar) {
                    placeholder(R.drawable.callkit_default_avatar)
                    error(R.drawable.callkit_default_avatar)
                    crossfade(true)
                }
            }
        }
    }

    /**
     * 设置触摸监听器（拖拽功能）
     */
    @SuppressLint("ClickableViewAccessibility")
    private fun setupTouchListener(view: View) {
        view.setOnTouchListener { _, event ->
            val layoutParams = currentLayoutParams ?: return@setOnTouchListener false

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startX = event.rawX
                    startY = event.rawY
                    lastX = layoutParams.x.toFloat()
                    lastY = layoutParams.y.toFloat()
                    isDragging = false
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val deltaX = event.rawX - startX
                    val deltaY = event.rawY - startY

                    // 判断是否开始拖拽
                    if (!isDragging && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
                        isDragging = true
                        ChatLog.d(TAG, "Start dragging float window")
                    }

                    if (isDragging) {
                        layoutParams.x = (lastX + deltaX).toInt()
                        layoutParams.y = (lastY + deltaY).toInt()

                        // 边界检查
                        val screenWidth = mContext?.resources?.displayMetrics?.widthPixels ?: 0
                        val screenHeight = mContext?.resources?.displayMetrics?.heightPixels ?: 0

                        layoutParams.x = layoutParams.x.coerceIn(0, screenWidth - view.width)
                        layoutParams.y = layoutParams.y.coerceIn(0, screenHeight - view.height)

                        windowManager?.updateViewLayout(view, layoutParams)
                    }
                    true
                }

                MotionEvent.ACTION_UP -> {
                    if (isDragging) {
                        // 拖拽结束，执行吸边效果
                        snapToEdge(view)
                        isDragging = false
                        ChatLog.d(TAG, "Dragging ended, snapped to edge")
                        true
                    } else {
                        // 点击事件 - 直接处理
                        ChatLog.d(TAG, "Float window clicked")
                        val callType = CallKitClient.callType.value
                        returnToCallActivity(callType)
                        true // 消费事件
                    }
                }

                else -> false
            }
        }
    }

    /**
     * 吸边效果
     */
    private fun snapToEdge(view: View) {
        val layoutParams = currentLayoutParams ?: return
        val screenWidth = mContext?.resources?.displayMetrics?.widthPixels ?: 0
        val centerX = layoutParams.x + view.width / 2

        // 判断靠近哪一边
        if (centerX < screenWidth / 2) {
            // 靠近左边
            layoutParams.x = 12.dpToPx(view.context)
        } else {
            // 靠近右边
            layoutParams.x = screenWidth - view.width - 12.dpToPx(view.context)
        }

        windowManager?.updateViewLayout(view, layoutParams)
    }

    /**
     * 返回通话界面
     */
    private fun returnToCallActivity(callType: CallType) {
        val context = mContext ?: return

        ChatLog.d(TAG, "Returning to call activity for callType: $callType")

        try {
            val intent = when (callType) {
                CallType.SINGLE_VIDEO_CALL, CallType.SINGLE_VOICE_CALL -> {
                    BaseCallActivity.createLockScreenIntent(context, SingleCallActivity::class.java)
                }

                CallType.GROUP_CALL -> {
                    BaseCallActivity.createLockScreenIntent(context, MultiCallActivity::class.java)
                }
            }

            // 启动Activity前先启用前台模式
            CallKitClient.rtcManager.enableForegroundMode()

            // 停止前台服务，因为将要回到前台Activity
            CallForegroundService.stopService(context)

            context.startActivity(intent)
            hideFloatWindow()

            ChatLog.d(TAG, "Successfully returned to call activity")

        } catch (e: Exception) {
            ChatLog.e(TAG, "Failed to return to call activity: ${e.message}")
        }
    }

    /**
     * 开始观察状态变化
     */
    private fun startObserving() {
        val callKitScope = CallKitClient.callKitScope

        ChatLog.d(TAG, "Start observing float window state changes")

        // 观察关键状态变化（不包括时间）
        observeJob = callKitScope.launch {
            launch {
                // 观察通话状态和视频状态变化
                combine(
                    CallKitClient.callState,
                    CallKitClient.callType,
                    CallKitClient.rtcManager.remoteVideoMute,
                    CallKitClient.rtcManager.localVideoMute
                ) { callState, callType, remoteVideoMute, localVideoMute ->
                    FloatWindowState(callState, callType, 0L, remoteVideoMute, localVideoMute)
                }.collect { state ->
                    withContext(Dispatchers.Main) {
                        if (state.callState != CallState.CALL_ANSWERED ||
                            state.remoteVideoMute != CallKitClient.rtcManager.remoteVideoMute.value
                        ) {
                            ChatLog.d(TAG, "Float window state changed: $state")
                        }
                        updateFloatWindowContent(state)
                    }
                }
            }

            launch {
                combine(
                    CallKitClient.callState,
                    CallKitClient.rtcManager.connectedTime
                ) { callState, duration ->
                    DurationState(callState, duration)
                }
                    .collect { state ->
                        withContext(Dispatchers.Main) {
                            updateDurationOnly(state)
                        }
                    }
            }
        }
    }

    /**
     * 停止观察状态变化
     */
    private fun stopObserving() {
        observeJob?.cancel()
        observeJob = null
        ChatLog.d(TAG, "Stop observing float window state changes")
    }

    /**
     * 更新悬浮窗内容（不包括时间）
     */
    private fun updateFloatWindowContent(state: FloatWindowState) {
        val view = floatView ?: return
        // 检查是否需要关闭悬浮窗
        if (shouldCloseFloatWindow(state)) {
            ChatLog.d(TAG, "Should close float window due to state: $state")
            hideFloatWindow()
            return
        }
        // 更新视频显示和状态
        if (state.callType == CallType.SINGLE_VIDEO_CALL) {
            updateVideoDisplay(view, state)
        }
    }

    /**
     * 仅更新时间显示
     */
    private fun updateDurationOnly(duration: DurationState) {
        val view = floatView ?: return
        updateDuration(view, duration)
    }

    /**
     * 判断是否应该关闭悬浮窗
     */
    private fun shouldCloseFloatWindow(state: FloatWindowState): Boolean {
        return when {
            state.callState == CallState.CALL_IDLE -> true
            state.callType == CallType.GROUP_CALL
                    && CallKitClient.rtcManager.participants.value.size == 0
                    && callState.value != CallState.CALL_ALERTING -> true

            else -> false
        }
    }

    /**
     * 更新通话时长显示
     */
    private fun updateDuration(view: View, state: DurationState) {
        tvDuration?.let {
            when (state.callState) {
                CallState.CALL_ANSWERED -> {
                    it.text = state.duration.timeFormat()
                }

                CallState.CALL_ALERTING -> {
                    it.text = mContext?.getString(R.string.callkit_waiting)
                }

                CallState.CALL_OUTGOING -> {
                    it.text = mContext?.getString(R.string.callkit_calling)
                }

                else -> {
                    // 其他状态不显示时长
                    it.text = ""
                }
            }

        }
    }

    /**
     * 更新视频显示
     */
    private fun updateVideoDisplay(view: View, state: FloatWindowState) {
        val videoContainer = view.findViewById<FrameLayout>(R.id.flVideoContainer) ?: return

        ChatLog.d(
            TAG,
            "updateVideoDisplay: callState=${state.callState}, remoteVideoMute=${state.remoteVideoMute}"
        )

        when (state.callState) {
            CallState.CALL_ANSWERED -> {
                // 通话已接通，显示远程视频
                if (state.remoteVideoMute) {
                    setupUserAvatar(videoContainer)
                } else {
                    setupRemoteVideo(videoContainer)
                }
            }

            CallState.CALL_OUTGOING, CallState.CALL_ALERTING -> {
                // 拨出电话或响铃中，显示本地视频
                if (state.localVideoMute) {
                    setupUserAvatar(videoContainer)
                } else {
                    setupLocalVideo(videoContainer)
                }
            }

            else -> {
                setupUserAvatar(videoContainer)
            }
        }
    }

    /**
     * 预先准备视频内容（在显示悬浮窗前）
     */
    private fun prepareVideoContent(view: View, callType: CallType) {
        if (callType == CallType.SINGLE_VIDEO_CALL) {
            val currentState = FloatWindowState(
                callState = CallKitClient.callState.value,
                callType = callType,
                duration = 0L,
                remoteVideoMute = CallKitClient.rtcManager.remoteVideoMute.value,
                localVideoMute = CallKitClient.rtcManager.localVideoMute.value
            )
            updateVideoDisplay(view, currentState)
        }
    }

    /**
     * 释放资源
     */
    fun exitCall() {
        hideFloatWindow()
    }

    /**
     * 悬浮窗状态数据类
     */
    private data class FloatWindowState(
        val callState: CallState,
        val callType: CallType,
        val duration: Long,
        val remoteVideoMute: Boolean,
        val localVideoMute: Boolean
    )

    /**
     * 悬浮窗状态数据类
     */
    private data class DurationState(
        val callState: CallState,
        val duration: Long,
    )

    /**
     * 创建窗口参数
     */
    private fun createLayoutParams(
        context: Context,
        callType: CallType
    ): WindowManager.LayoutParams {

        return WindowManager.LayoutParams().apply {
            // 根据通话类型设置尺寸
            when (callType) {
                CallType.SINGLE_VIDEO_CALL -> {
                    width = 108.dpToPx(context)
                    height = 192.dpToPx(context)
                }

                CallType.SINGLE_VOICE_CALL, CallType.GROUP_CALL -> {
                    width = 69.dpToPx(context)
                    height = 64.dpToPx(context)
                }
            }

            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            format = PixelFormat.TRANSLUCENT
            gravity = Gravity.TOP or Gravity.START  // 使用START表示绝对坐标系统
            val screenWidth = mContext?.resources?.displayMetrics?.widthPixels ?: 0
            x = screenWidth - width - 12.dpToPx(context)  // 绝对坐标：距离左边缘的距离
            y = 200
        }
    }
}