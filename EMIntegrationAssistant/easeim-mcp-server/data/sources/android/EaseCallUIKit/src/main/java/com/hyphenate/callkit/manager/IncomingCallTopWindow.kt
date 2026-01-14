package com.hyphenate.callkit.manager

import android.animation.Animator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.widget.TextView
import coil.load
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.extension.dpToPx
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.PermissionHelper
import com.hyphenate.callkit.widget.CallKitImageView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * \~chinese
 * 来电顶部悬浮窗管理类
 * 实现来电时在顶部显示的悬浮窗功能
 *
 * 功能：
 * 1. 显示来电信息（头像、用户名、通话类型）
 * 2. 上滑收起悬浮窗
 * 3. 点击接听/挂断按钮
 * 4. 点击空白区域启动通话界面
 *
 * \~english
 * Incoming call top window manager
 * Implement the function of displaying the incoming call top window
 *
 * Features:
 * 1. Display incoming call information (avatar, username, call type)
 * 2. Slide to hide the floating window
 * 3. Click the accept/decline button
 * 4. Click the blank area to launch the call activity
 */
class IncomingCallTopWindow {

    companion object {
        private const val TAG = "Callkit IncomingCallTopWindow"
        private const val WINDOW_HEIGHT_DP = 80
        private const val SWIPE_UP_THRESHOLD = 60 // 上滑收起的阈值
    }

    private var mContext: Context? = null
    private var windowManager: WindowManager? = null
    private var topWindowView: View? = null
    private var isShowing = false

    // 手势相关
    private var startY = 0f
    private var startX = 0f
    private var isDragging = false
    private var isHiding = false // 添加隐藏状态标志

    // 事件流 - 用于通知收起事件
    private val _dismissEventFlow = MutableSharedFlow<Unit>()
    val dismissEventFlow: SharedFlow<Unit> = _dismissEventFlow.asSharedFlow()

    // 视图引用
    private var ivAvatar: CallKitImageView? = null
    private var tvUsername: TextView? = null
    private var tvDesc: TextView? = null
    private var ivAccept: CallKitImageView? = null
    private var ivDecline: CallKitImageView? = null

    /**
     * \~chinese
     * 初始化
     * @param context 上下文
     *
     * \~english
     * Initialize
     * @param context context
     */
    fun init(context: Context) {
        this.mContext = context.applicationContext
        this.windowManager = mContext?.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
    }

    /**
     * \~chinese
     * 显示来电顶部悬浮窗
     *
     * \~english
     * Show incoming call top window
     */
    fun showIncomingCallTopWindow(): Boolean {
        if (mContext == null) {
            ChatLog.e(TAG, "Context is null")
            return false
        }

        // 防止重复显示
        if (isShowing && topWindowView != null) {
            ChatLog.w(TAG, "Top window already showing")
            return true
        }

        // 检查悬浮窗权限
        if (!PermissionHelper.hasFloatWindowPermission(mContext!!)) {
            ChatLog.e(TAG, "No float window permission")
            return false
        }

        // 使用协程确保所有 UI 操作在主线程执行
        CallKitClient.callKitScope.launch {
            withContext(Dispatchers.Main) {
                try {
                    showTopWindowOnMainThread()
                } catch (e: Exception) {
                    ChatLog.e(TAG, "Error showing top window on main thread: ${e.message}")
                }
            }
        }

        return true
    }

    /**
     * \~chinese
     * 在主线程显示顶部悬浮窗
     *
     * \~english
     * Show top window on main thread
     */
    private fun showTopWindowOnMainThread() {
        try {
            // 重置状态
            isHiding = false

            // 创建顶部悬浮窗视图
            topWindowView = createTopWindowView()
            topWindowView?.let { view ->
                // 设置用户信息（这里会异步加载）
                setupUserInfo()

                // 设置触摸监听
                setupTouchListener(view)

                // 设置点击事件
                setupClickListeners()

                // 创建窗口参数
                val layoutParams = createTopWindowLayoutParams()
                // 添加到窗口管理器
                windowManager?.addView(view, layoutParams)
                isShowing = true

                // 添加显示动画
                createShowAnimation(view)

                ChatLog.d(TAG, "Top window shown successfully on main thread")
            } ?: run {
                ChatLog.e(TAG, "Failed to create top window view")
            }
        } catch (e: Exception) {
            ChatLog.e(TAG, "Error showing top window on main thread: ${e.message}")
        }
    }

    /**
     * 创建显示动画（从上方滑入）
     */
    private fun createShowAnimation(view: View) {
        try {
            // 先清除任何现有的动画
            view.clearAnimation()

            // 设置初始状态
            view.translationY = -view.height.toFloat()
            view.alpha = 0.0f

            // 使用属性动画
            val translationAnimator = ObjectAnimator.ofFloat(
                view, View.TRANSLATION_Y, -view.height.toFloat(), 0f
            ).apply {
                duration = 400 // 动画持续时间400ms
                interpolator = DecelerateInterpolator() // 减速插值器，让动画逐渐减慢
            }

            val alphaAnimator = ObjectAnimator.ofFloat(
                view, View.ALPHA, 0.0f, 1.0f
            ).apply {
                duration = 400
                interpolator = DecelerateInterpolator()
            }
            // 使用AnimatorSet组合动画
            val animatorSet = AnimatorSet().apply {
                playTogether(translationAnimator, alphaAnimator)
            }
            // 启动动画
            animatorSet.start()

        } catch (e: Exception) {
            ChatLog.e(TAG, "Error creating show animation: ${e.message}")
        }
    }

    /**
     * \~chinese
     * 隐藏来电顶部悬浮窗（带向上收起动画）
     * @param shouldNotifyDismiss 是否在动画完成后发送收起事件通知
     *
     * \~english
     * Hide incoming call top window (with upward animation)
     * @param shouldNotifyDismiss whether to send dismiss event notification after animation
     */
    fun hideIncomingCallTopWindow(shouldNotifyDismiss: Boolean = false) {
        // 防止重复调用
        if (isHiding) {
            ChatLog.d(TAG, "Already hiding, ignoring duplicate call")
            return
        }

        ChatLog.d(TAG, "hideIncomingCallTopWindow called, isShowing: $isShowing")

        // 使用协程确保在主线程执行
        CallKitClient.callKitScope.launch {
            withContext(Dispatchers.Main) {
                hideTopWindowOnMainThread(shouldNotifyDismiss)
            }
        }
    }

    /**
     * \~chinese
     * 在主线程隐藏顶部悬浮窗（带向上收起动画）
     * @param shouldNotifyDismiss 是否在动画完成后发送收起事件通知
     *
     * \~english
     * Hide top window on main thread (with upward animation)
     * @param shouldNotifyDismiss whether to send dismiss event notification after animation
     */
    private fun hideTopWindowOnMainThread(shouldNotifyDismiss: Boolean = false) {
        if (isShowing && topWindowView != null && !isHiding) {
            isHiding = true // 设置隐藏状态
            // 创建向上收起动画
            createDismissAnimation {
                // 动画结束后移除视图
                windowManager?.removeView(topWindowView)
                // 清理资源
                cleanup()
                // 如果需要，在动画完成后发送收起事件
                if (shouldNotifyDismiss) {
                    CallKitClient.callKitScope.launch {
                        _dismissEventFlow.emit(Unit)
                    }
                }
            }
        }
    }

    /**
     * 创建向上收起的动画
     */
    private fun createDismissAnimation(onAnimationEnd: () -> Unit) {
        val view = topWindowView
        if (view == null) {
            onAnimationEnd()
            return
        }

        try {
            // 先清除任何现有的动画
            view.clearAnimation()

            // 使用属性动画代替View动画，更可靠
            val translationAnimator = ObjectAnimator.ofFloat(
                view, View.TRANSLATION_Y, 0f, -view.height.toFloat()
            ).apply {
                duration = 300
                interpolator = AccelerateInterpolator()
            }

            val alphaAnimator = ObjectAnimator.ofFloat(
                view, View.ALPHA, 1.0f, 0.0f
            ).apply {
                duration = 300
                interpolator = AccelerateInterpolator()
            }

            // 添加动画完成的标志
            var animationCompleted = false

            // 使用AnimatorSet组合动画
            val animatorSet = AnimatorSet().apply {
                playTogether(translationAnimator, alphaAnimator)
                addListener(object : Animator.AnimatorListener {
                    override fun onAnimationStart(animation: Animator) {
                        // 动画开始
                    }

                    override fun onAnimationEnd(animation: Animator) {
                        view.visibility = View.GONE
                        if (!animationCompleted) {
                            animationCompleted = true
                            // 在动画真正结束后立即隐藏view，避免闪现
                            onAnimationEnd()
                        }
                    }

                    override fun onAnimationCancel(animation: Animator) {
                        view.visibility = View.GONE
                        if (!animationCompleted) {
                            animationCompleted = true
                            // 动画被取消时也要隐藏view
                            onAnimationEnd()
                        }
                    }

                    override fun onAnimationRepeat(animation: Animator) {
                        // 不需要处理
                    }
                })
            }
            // 启动动画
            animatorSet.start()
        } catch (e: Exception) {
            ChatLog.e(TAG, "Error in createDismissAnimation: ${e.message}")
            onAnimationEnd()
        }
    }

    /**
     * \~chinese
     * 检查顶部悬浮窗是否正在显示
     * @return true 如果顶部悬浮窗正在显示，false 否则
     *
     * \~english
     * Check if the top window is showing
     * @return true if the top window is showing, false otherwise
     */
    fun isTopWindowShowing(): Boolean = isShowing

    /**
     * \~chinese
     * 创建顶部悬浮窗视图
     * @return 顶部悬浮窗视图
     *
     * \~english
     * Create the top window view
     * @return the top window view
     */
    private fun createTopWindowView(): View? {
        val context = mContext ?: return null

        val view = LayoutInflater.from(context)
            .inflate(R.layout.callkit_incomimg_call_top_window, null)

        // 获取视图引用
        ivAvatar = view.findViewById(R.id.iv_avatar)
        tvUsername = view.findViewById(R.id.tv_username)
        tvDesc = view.findViewById(R.id.tv_desc)
        ivAccept = view.findViewById(R.id.iv_accept)
        ivDecline = view.findViewById(R.id.iv_decline)

        return view
    }

    /**
     * 设置用户信息
     */
    private fun setupUserInfo() {
        val context = mContext ?: return
        val callType = CallKitClient.callType.value

        // 使用协程获取用户信息
        CallKitClient.callKitScope.launch {
            try {
                // 获取来电用户信息
                val userInfo = CallKitClient.getCache().getUserInfoById(CallKitClient.fromUserId)

                // 在主线程更新UI
                withContext(Dispatchers.Main) {
                    updateUserInfoUI(userInfo, callType, context)
                }
            } catch (e: Exception) {
                ChatLog.e(TAG, "Error setting up user info: ${e.message}")
                // 在出错的情况下设置默认值
                withContext(Dispatchers.Main) {
                    updateUserInfoUI(null, callType, context)
                }
            }
        }
    }

    /**
     * 更新用户信息UI
     */
    private fun updateUserInfoUI(userInfo: CallKitUserInfo?, callType: CallType, context: Context) {
        // 设置用户头像和用户名
        if (userInfo != null) {
            // 设置用户头像
            ivAvatar?.load(userInfo.avatar) {
                placeholder(R.drawable.callkit_default_avatar)
                error(R.drawable.callkit_default_avatar)
            }
            // 设置用户名
            tvUsername?.text = userInfo.getName()
        } else {
            // 默认头像和用户名
            ivAvatar?.load(R.drawable.callkit_default_avatar)
            tvUsername?.text = CallKitClient.fromUserId
        }

        // 设置通话描述
        tvDesc?.text = getCallDescription(callType, context)
    }

    /**
     * 获取通话描述文本
     */
    private fun getCallDescription(callType: CallType, context: Context): String {
        return when (callType) {
            CallType.SINGLE_VIDEO_CALL -> context.getString(R.string.callkit_inviting_you_to_a_video_call)
            CallType.SINGLE_VOICE_CALL -> context.getString(R.string.callkit_inviting_you_to_a_voice_call)
            CallType.GROUP_CALL -> context.getString(R.string.callkit_inviting_you_to_a_group_call)
        }
    }

    /**
     * 设置触摸监听器（实现上滑收起功能）
     */
    @SuppressLint("ClickableViewAccessibility")
    private fun setupTouchListener(view: View) {
        view.setOnTouchListener { v, event ->
            // 检查触摸点是否在按钮区域内
            val acceptButton = ivAccept
            val declineButton = ivDecline

            if (acceptButton != null || declineButton != null) {
                val location = IntArray(2)

                // 检查是否点击在接听按钮上
                acceptButton?.let { button ->
                    button.getLocationOnScreen(location)
                    val buttonLeft = location[0]
                    val buttonTop = location[1]
                    val buttonRight = buttonLeft + button.width
                    val buttonBottom = buttonTop + button.height

                    if (event.rawX >= buttonLeft && event.rawX <= buttonRight &&
                        event.rawY >= buttonTop && event.rawY <= buttonBottom
                    ) {
                        return@setOnTouchListener false // 让按钮处理点击事件
                    }
                }

                // 检查是否点击在挂断按钮上
                declineButton?.let { button ->
                    button.getLocationOnScreen(location)
                    val buttonLeft = location[0]
                    val buttonTop = location[1]
                    val buttonRight = buttonLeft + button.width
                    val buttonBottom = buttonTop + button.height

                    if (event.rawX >= buttonLeft && event.rawX <= buttonRight &&
                        event.rawY >= buttonTop && event.rawY <= buttonBottom
                    ) {
                        return@setOnTouchListener false // 让按钮处理点击事件
                    }
                }
            }

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startY = event.rawY
                    startX = event.rawX
                    isDragging = false
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val deltaY = event.rawY - startY
                    val deltaX = event.rawX - startX

                    // 判断是否开始拖拽（主要是上滑手势）
                    if (!isDragging && (Math.abs(deltaY) > 30 || Math.abs(deltaX) > 30)) {
                        isDragging = true
                    }

                    // 如果是上滑手势且超过阈值，收起悬浮窗（添加防重复检查）
                    if (isDragging && deltaY < -SWIPE_UP_THRESHOLD && !isHiding) {
                        ChatLog.d(TAG, "Swipe up detected, dismissing top window")
                        // 上滑收起时，在动画完成后发送收起事件
                        hideIncomingCallTopWindow(shouldNotifyDismiss = true)
                        return@setOnTouchListener true
                    }
                    true
                }

                MotionEvent.ACTION_UP -> {
                    if (!isDragging) {
                        // 点击空白区域，启动通话界面
                        ChatLog.d(TAG, "Top window clicked, launching call activity")
                        launchCallActivity()
                        hideIncomingCallTopWindow()
                    }
                    isDragging = false
                    true
                }

                MotionEvent.ACTION_CANCEL -> {
                    isDragging = false
                    true
                }

                else -> {
                    false
                }
            }
        }
    }

    /**
     * 设置按钮点击事件
     */
    private fun setupClickListeners() {
        // 接听按钮
        ivAccept?.setOnClickListener {
            handleAcceptCall()
        }

        // 挂断按钮
        ivDecline?.setOnClickListener {
            handleDeclineCall()
        }
    }

    /**
     * 处理接听通话
     */
    private fun handleAcceptCall() {

        // 发送接听消息给对方
        CallKitClient.signalingManager.answerCall()

        // 启动通话界面
        launchCallActivity()

        // 隐藏悬浮窗
        hideIncomingCallTopWindow()
    }

    /**
     * 处理挂断通话
     */
    private fun handleDeclineCall() {
        // 发送拒绝消息给对方
        CallKitClient.signalingManager.refuseCall()

        // 隐藏悬浮窗
        hideIncomingCallTopWindow()
    }

    /**
     * 启动通话界面
     */
    private fun launchCallActivity() {
        // 这里可以启动通话中的界面
        CallKitClient.signalingManager.startSendEvent()
    }

    /**
     * 创建顶部悬浮窗的布局参数
     */
    private fun createTopWindowLayoutParams(): WindowManager.LayoutParams {
        val context = mContext!!
        val screenWidth = context.resources.displayMetrics.widthPixels
        val windowHeight = (WINDOW_HEIGHT_DP * context.resources.displayMetrics.density).toInt()
        val horizontalMargin = 12.dpToPx(context) // 左右各12dp的margin
        val topMargin = 8.dpToPx(context)

        return WindowManager.LayoutParams().apply {
            width = screenWidth - (horizontalMargin * 2) // 减去左右margin
            height = windowHeight - topMargin

            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }

            // 移除FLAG_LAYOUT_IN_SCREEN标志，避免覆盖系统UI
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL

            format = PixelFormat.TRANSLUCENT
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL

            // 定位在状态栏下方，左右居中
            x = 0
            y = 0
        }
    }

    /**
     * 清理资源
     */
    private fun cleanup() {
        isShowing = false
        topWindowView = null
        ivAvatar = null
        tvUsername = null
        tvDesc = null
        ivAccept = null
        ivDecline = null
        isHiding = false // 重置隐藏状态
    }

    /**
     * \~chinese
     * 退出通话,隐藏悬浮窗
     *
     * \~english
     * Exit call, hide the top window
     */
    fun exitCall() {
        hideIncomingCallTopWindow()
    }
}