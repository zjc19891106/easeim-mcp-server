package com.hyphenate.callkit.base

import android.Manifest
import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.annotation.ColorInt
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.viewbinding.ViewBinding
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.bean.Constant
import com.hyphenate.callkit.service.CallForegroundService
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.PermissionHelper
import com.hyphenate.callkit.viewmodel.SingleCallViewModel

/**
 * \~chinese
 * 通话基类Activity
 *
 * \~english
 * Base call activity
 */
abstract class BaseCallActivity<T : ViewBinding> : AppCompatActivity() {

    private val TAG = "Callkit BaseCallActivity"
    lateinit var binding: T
    private var loadingDialog: AlertDialog? = null
    lateinit var mContext: Activity
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        private const val BATTERY_OPTIMIZATION_REQUEST_CODE = 200
        private const val REQUEST_OVERLAY_PERMISSION = 201
        private const val REQUEST_NOTIFICATION_PERMISSION = 202

        /**
         * 创建适用于锁屏显示的 Intent
         * 从后台 Service 启动 Activity 时使用此方法
         */
        fun createLockScreenIntent(
            context: Context,
            activityClass: Class<out BaseCallActivity<*>>
        ): Intent {
            return Intent(context, activityClass).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // Android 8.0+ 从后台启动 Activity 需要额外的标志
                    addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                }
                ChatLog.d(
                    "BaseCallActivity",
                    "Created lockscreen intent with flags: ${flags.toString(16)}"
                )
            }
        }

    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        mContext = this

        // 设置锁屏显示相关配置
        setupLockScreenDisplay()

        beforeSetContentView()
        val binding = getViewBinding(layoutInflater)
        if (binding == null) {
            ChatLog.e(TAG, "$this binding is null.")
            finish()
            return
        } else {
            this.binding = binding
            setContentView(this.binding.root)
        }

        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, 0, systemBars.right, systemBars.bottom)
            insets
        }
        initPermissions(savedInstanceState)
    }

    /**
     * 设置锁屏显示相关配置
     */
    private fun setupLockScreenDisplay() {
        ChatLog.d(TAG, "Setting up lockscreen display for Android ${Build.VERSION.SDK_INT}")

        when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1 -> {
                // Android 8.1+ 使用新API
                setShowWhenLocked(true)
                setTurnScreenOn(true)
                ChatLog.d(TAG, "Using Android 8.1+ lockscreen APIs")
            }

            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O -> {
                // Android 8.0
                window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
                window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
                window.addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
                ChatLog.d(TAG, "Using Android 8.0 lockscreen flags")
            }

            else -> {
                // Android 8.0以下
                window.addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                )
                ChatLog.d(TAG, "Using legacy Android lockscreen flags")
            }
        }


        // 请求解锁键盘锁 - 但不要强制解锁，否则会造成显示在锁屏上方失败
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // 对于锁屏通话，我们不强制解锁，而是在锁屏上显示
            if (!keyguardManager.isKeyguardSecure) {
                // 只有在没有安全锁屏时才请求解锁
                keyguardManager.requestDismissKeyguard(
                    this,
                    object : KeyguardManager.KeyguardDismissCallback() {
                        override fun onDismissSucceeded() {
                            super.onDismissSucceeded()
                            ChatLog.d(TAG, "Keyguard dismissed successfully")
                        }

                        override fun onDismissError() {
                            super.onDismissError()
                            ChatLog.e(TAG, "Failed to dismiss keyguard - showing on lockscreen")
                        }
                    })
            } else {
                ChatLog.d(TAG, "Secure keyguard detected - showing on lockscreen without unlock")
            }

        }

        // 获取唤醒锁
        acquireWakeLock()

        // 检查系统窗口权限（Android 6.0+）
        checkSystemWindowPermission()

    }

    /**
     * 获取唤醒锁
     */
    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "CallKit::WakeLock"
        )
        wakeLock?.acquire(10 * 60 * 1000L) // 10分钟超时
    }

    /**
     * 检查系统窗口权限
     */
    private fun checkSystemWindowPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                ChatLog.d(TAG, "System overlay permission not granted")
                // 可以选择是否要求用户授权，这里暂时不强制要求
            }
        }
    }

    private fun initPermissions(savedInstanceState: Bundle?) {

        // 如果已经授权，则初始化 RtcEngine 并加入频道
        if (!checkPermissions()) {
            ActivityCompat.requestPermissions(
                this,
                getRequiredPermissions(),
                Constant.PERMISSION_REQ_ID
            )
        } else {
            init(savedInstanceState)
        }
    }

    private fun init(savedInstanceState: Bundle?) {
        initView(savedInstanceState)
        initData()
        initListener()

        // 检查电池优化设置
//        checkBatteryOptimization()
    }

    private fun checkPermissions(): Boolean {
        for (permission in getRequiredPermissions()) {
            val permissionCheck = ContextCompat.checkSelfPermission(this, permission)
            if (permissionCheck != PackageManager.PERMISSION_GRANTED) {
                return false
            }
        }
        return true
    }

    // 获取体验实时音视频互动所需的录音、摄像头等权限
    private fun getRequiredPermissions(): Array<String> {
        var basePermission = arrayOf(
            Manifest.permission.RECORD_AUDIO,  // 录音权限
            Manifest.permission.CAMERA,  // 摄像头权限
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            basePermission += arrayOf(
                Manifest.permission.READ_PHONE_STATE,  // 读取电话状态权限
                Manifest.permission.BLUETOOTH_CONNECT, // 蓝牙连接权限
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU){
            basePermission += arrayOf(
                Manifest.permission.POST_NOTIFICATIONS //通知权限
            )
        }
        return basePermission
    }

    open fun initView(savedInstanceState: Bundle?) {}

    open fun initData() {}

    open fun initListener() {}


    open fun beforeSetContentView() {}

    protected abstract fun getViewBinding(inflater: LayoutInflater): T?

    fun <T : ViewModel> getViewModel(viewModelClass: Class<T>, owner: ViewModelStoreOwner): T {
        return ViewModelProvider(owner).get(viewModelClass)
    }

    open fun showLoading(cancelable: Boolean) {
        if (loadingDialog == null) {
            loadingDialog =
                AlertDialog.Builder(this).setView(R.layout.callkit_view_base_loading).create()
                    .apply {
                        // Change to background to transparent
                        window?.decorView?.setBackgroundColor(Color.TRANSPARENT)
                    }
        }
        loadingDialog?.setCancelable(cancelable)
        loadingDialog?.show()
    }

    open fun dismissLoading() {
        loadingDialog?.dismiss()
    }

    fun hideKeyboard() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        if (window.attributes.softInputMode != WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN) {
            if (currentFocus != null) {
                imm.hideSoftInputFromWindow(
                    currentFocus?.windowToken,
                    InputMethodManager.HIDE_NOT_ALWAYS
                )
            }
        }
    }

    open fun showKeyboard(editText: EditText) {
        Looper.myLooper()?.let {
            Handler(it).postDelayed({
                val imm =
                    editText.context.getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                imm.showSoftInput(editText, 0)
            }, 500)
        }
    }

    /**
     * 处理UI事件
     */
    protected fun handleUiEvent(event: BaseViewModel.CallUiEvent) {
        when (event) {
            is BaseViewModel.CallUiEvent.FloatWindowPermissionRequired -> {
                // 需要悬浮窗权限
                requestFloatWindowPermission()
            }

            is BaseViewModel.CallUiEvent.FloatWindowShown -> {
                // 悬浮窗显示成功，关闭当前Activity
                finish()
            }

            else -> {
                Log.d(TAG, "Unhandled UI event: $event")
            }
        }
    }

    /**
     * 显示Toast消息
     */
    protected fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    override fun onBackPressed() {
        if (!PermissionHelper.hasFloatWindowPermission(this)) {
            requestFloatWindowPermission {
                handleRequestFloatWindowPermissionCancel()
                super.onBackPressed()
            }
        } else {
            super.onBackPressed()
        }
    }

    open internal fun handleRequestFloatWindowPermissionCancel() {}

    /**
     * 请求悬浮窗权限
     */
    protected fun requestFloatWindowPermission(cancelAction: () -> Unit = {}) {
        PermissionHelper.showPermissionExplanationDialog(
            this,
            onConfirm = {
                PermissionHelper.requestFloatWindowPermission(
                    this,
                    Constant.FLOAT_WINDOW_PERMISSION_REQUEST_CODE
                )
            },
            onCancel = {
                cancelAction()
            }
        )
    }

    /**
     * 检查电池优化设置
     */
    private fun checkBatteryOptimization() {
        if (!PermissionHelper.isIgnoringBatteryOptimizations(this)) {
            // 延迟检查，避免在通话刚开始时打断用户
            Handler(Looper.getMainLooper()).postDelayed({
                if (!isFinishing) {
                    PermissionHelper.showBatteryOptimizationExplanationDialog(
                        this,
                        onConfirm = {
                            PermissionHelper.requestIgnoreBatteryOptimizations(
                                this,
                                BATTERY_OPTIMIZATION_REQUEST_CODE
                            )
                        }
                    )
                }
            }, 3000) // 3秒后显示
        }
    }

    override fun onResume() {
        super.onResume()
        ChatLog.d(TAG, "onResume called")

        // 当Activity回到前台时，检查悬浮窗是否显示，如果是则隐藏
        if (CallKitClient.floatWindow.isFloatWindowShowing()) {
            CallKitClient.floatWindow.hideFloatWindow()
        }

        // 当Activity回到前台时，停止前台服务（如果运行中）
        // 因为前台界面已经可以保持摄像头权限
        CallForegroundService.Companion.stopService(this)

        // 启用前台模式，恢复正常视频质量
        CallKitClient.rtcManager.enableForegroundMode()
    }

    override fun onPause() {
        super.onPause()
        ChatLog.d(TAG, "onPause called")
        // 当Activity进入后台时，需要同时处理悬浮窗和前台服务
        if (CallKitClient.callState.value != CallState.CALL_IDLE) {
            // 1. 启用后台模式，降低视频质量节省资源
            CallKitClient.rtcManager.enableBackgroundMode()

            // 2. 启动前台服务保持摄像头权限
            ChatLog.d(TAG, "Starting foreground service to maintain camera permission")
            CallForegroundService.Companion.startService(this)

            // 3. 检查权限并显示悬浮窗
            if (PermissionHelper.hasFloatWindowPermission(this)) {
                CallKitClient.floatWindow.showFloatWindow()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        ChatLog.d(TAG, "onDestroy called")

        // 释放唤醒锁
        releaseWakeLock()

        // Activity销毁时，如果通话状态不是空闲且没有其他通话Activity，则显示悬浮窗和启动前台服务
        if (CallKitClient.callState.value != CallState.CALL_IDLE) {
            // 1. 启动前台服务保持摄像头权限
            ChatLog.d(TAG, "Starting foreground service due to activity destruction")
            CallForegroundService.Companion.startService(this)

            // 2. 显示悬浮窗
            if (PermissionHelper.hasFloatWindowPermission(this)) {
                CallKitClient.floatWindow.showFloatWindow()
            }
        }
    }

    /**
     * 处理悬浮窗权限请求结果
     */
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            Constant.FLOAT_WINDOW_PERMISSION_REQUEST_CODE -> {
                if (PermissionHelper.hasFloatWindowPermission(this)) {
                    // 权限获取成功，显示悬浮窗
                    CallKitClient.floatWindow.showFloatWindow()
                    finish()
                } else {
                    // 权限获取失败，继续留在当前Activity
                    ChatLog.e(TAG, "Float window permission denied")
                }
            }

            BATTERY_OPTIMIZATION_REQUEST_CODE -> {
                if (PermissionHelper.isIgnoringBatteryOptimizations(this)) {
                    ChatLog.d(TAG, "Battery optimization whitelist granted")
                    showToast("已加入电池优化白名单，通话质量将得到保障")
                } else {
                    ChatLog.d(TAG, "Battery optimization whitelist denied")
                    showToast("建议加入电池优化白名单以获得更好的通话体验")
                }
            }
        }
    }

    /**
     * 释放唤醒锁
     */
    private fun releaseWakeLock() {
        wakeLock?.let { lock ->
            if (lock.isHeld) {
                lock.release()
                ChatLog.d(TAG, "WakeLock released")
            }
        }
        wakeLock = null
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String?>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        when (requestCode) {
            Constant.PERMISSION_REQ_ID -> {
                // 系统权限申请回调
                if (!checkPermissions()) {
                    ChatLog.e(TAG, "Permissions not granted, finishing activity.")
                    finish()
                    if (CallKitClient.isComingCall){
                        CallKitClient.signalingManager.refuseCall()
                    }else{
                        CallKitClient.signalingManager.cancelCall(CallKitClient.callType.value)
                    }
                    showToast("RTC Permissions not granted")
                } else {
                    ChatLog.d(TAG, "Permissions granted, initializing activity.")
                    init(null)
                }
            }
        }
    }
}