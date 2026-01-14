package com.hyphenate.callkit

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.text.TextUtils
import com.hyphenate.EMValueCallBack
import com.hyphenate.callkit.interfaces.CallKitListener
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.interfaces.CallInfoProvider
import com.hyphenate.callkit.manager.AudioController
import com.hyphenate.callkit.manager.FloatWindow
import com.hyphenate.callkit.manager.IncomingCallTopWindow
import com.hyphenate.callkit.manager.SignalingManager
import com.hyphenate.callkit.manager.RtcManager
import com.hyphenate.callkit.base.BaseCallActivity
import com.hyphenate.callkit.global.CallKitActivityLifecycleCallback
import com.hyphenate.callkit.interfaces.RTCConfigProvider
import com.hyphenate.callkit.telecom.TelecomHelper
import com.hyphenate.callkit.ui.SelectGroupMembersActivity
import com.hyphenate.callkit.ui.MultiCallActivity
import com.hyphenate.callkit.ui.SingleCallActivity
import com.hyphenate.callkit.utils.CallKitNotifier
import com.hyphenate.callkit.utils.CallKitUtils
import com.hyphenate.callkit.utils.CallKitUtils.getPhoneSign
import com.hyphenate.callkit.utils.CallKitUtils.isAppRunningForeground
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.CallKitCache
import com.hyphenate.callkit.utils.ChatClient
import com.hyphenate.callkit.utils.ChatError
import com.hyphenate.callkit.utils.RTCTokenInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.jvm.java
import kotlin.lazy

/**
 * \~chinese
 *
 * CallKitClient 是 CallKit 的核心类，负责初始化、管理对外入口、通话状态、资源回收等。
 * 内部主要包含：
 * RtcManager 管理具体音视频
 * SignalingManager 管理信令交互
 * AudioController 管理铃声
 * FloatWindow和IncomingCallTopWindow 管理悬浮窗
 * CallKitCache 管理缓存
 * CallKitNotifier 管理通知
 *
 * \~english
 *
 * CallKitClient is the core class of CallKit, responsible for initializing, managing external entry points, call state, and resource recycling.
 * The internal mainly includes:
 * RtcManager manages audio and video
 * SignalingManager manages signaling interaction
 * AudioController manages ringtones
 * FloatWindow and IncomingCallTopWindow manage floating windows
 * CallKitCache manages cache
 * CallKitNotifier manages notifications
*/
@SuppressLint("StaticFieldLeak")
object CallKitClient {

    /**
     * \~chinese
     * 通话错误类型
     *
     * \~english
     * Call error type
     */
    enum class CallErrorType {
        /**
         * \~chinese
         * 业务逻辑异常
         *
         * \~english
         * Business logic exception
         */
        BUSINESS_ERROR,
        /**
         * \~chinese
         * 音视频异常
         *
         * \~english
         * Audio and video exception
         */
        RTC_ERROR,
        /**
         * \~chinese
         * IM异常
         *
         * \~english
         * IM exception
         */
        IM_ERROR
    }

    /**
     * \~chinese
     * 业务错误类型
     *
     * \~english
     * Business error type
     */
    enum class CALL_BUSINESS_ERROR(val code: Int) {
        /**
         * \~chinese
         * 状态错误
         *
         * \~english
         * Call state error
         */
        CALL_STATE_BUSY_ERROR(0),
        /**
         * \~chinese
         * 参数错误
         *
         * \~english
         * Call parameter error
         */
        CALL_PARAM_ERROR(1),
        /**
         * \~chinese
         * 信令错误
         *
         * \~english
         * Signaling error
         */
        CALL_SIGNALING_ERROR(2)
    }
    /**
     * \~chinese
     * 通话监听器
     *
     * \~english
     * Call listener
     */
    var callKitListener: CallKitListener? = null
    /**
     * \~chinese
     * 用户信息提供者,开发者可自定义实现，用户callkit获取用户信息
     *
     * \~english
     * User information provider, developers can customize the implementation, and the callkit will get user information through this provider
     */
    var callInfoProvider: CallInfoProvider? = null

    private val TAG = "Callkit CallKitClient"
    private lateinit var notifier: CallKitNotifier
    private var isInitialized = false
    internal var isComingCall = true
    internal var channelName: String? = null
    internal var inviteExt: JSONObject? = null
    //对方id
    internal var fromUserId: String = ""
    //邀请的用户列表
    internal val inviteeUsers by lazy { mutableListOf<String>() }
    internal var deviceId: String = "android_"
    internal var callerDevId: String? = null
    internal var callID: String? = null
    internal lateinit var mContext: Context
    val signalingManager by lazy { SignalingManager() }
    internal val rtcManager by lazy { RtcManager() }
    internal val audioController by lazy { AudioController() }
    internal val floatWindow by lazy { FloatWindow() }
    internal val incomingCallTopWindow by lazy { IncomingCallTopWindow() }
    internal val cache: CallKitCache by lazy {CallKitCache()}
    internal val callKitConfig by lazy{ CallKitConfig() }
    internal var callType = MutableStateFlow(CallType.SINGLE_VIDEO_CALL)
    internal var callState = MutableStateFlow(CallState.CALL_IDLE)
    var rtcConfigProvider: RTCConfigProvider? = null
    // 协程相关
    internal val callKitScope by lazy{ CoroutineScope(SupervisorJob() + Dispatchers.Default)}
    internal var groupId: String = ""


    /**
     * \~chinese
     * CallKitClient 初始化
     *
     * @param context 上下文
     * @param config CallKit配置项
     * @return 是否初始化成功
     *
     *  \~english
     *  Initialize CallKitClient
     *  @param context environment context
     *  @param config CallKit configuration
     *  @return whether initialization is successful
     *
     */
    @Synchronized
    fun init(context: Context, config: CallKitConfig): Boolean {
        if (isInitialized) {
            ChatLog.e(TAG, "CallKitClient is already initialized")
            return true
        }
        this.mContext = context.applicationContext
        if (!CallKitUtils.isMainProcess(mContext)) {
            ChatLog.e(TAG, "the callkit needs main process!")
            return false
        }
        //设置callkit配置项
        callKitConfig.copyFrom(config)
        //获取设备序列号
        deviceId += getPhoneSign()

        signalingManager.startListening()

        notifier = CallKitNotifier(mContext)
        audioController.init(mContext)
        incomingCallTopWindow.init(mContext)
        rtcManager.init(mContext)
        floatWindow.init(mContext)
        cache.init()
        (context.applicationContext as Application).registerActivityLifecycleCallbacks(
            CallKitActivityLifecycleCallback()
        )
        isInitialized = true
        return true
    }

    /**
     * \~chinese
     * 启动通话Activity的实现
     *
     * \~english
     * The implementation of starting the call activity
     */
    internal suspend fun startCallActivity() {
        ChatLog.d(
            TAG,
            "suspend startCallActivity: callType=${callType.value}, callState=${callState.value}, isComingCall=$isComingCall"
        )
        val info: String
        val userName = cache.getUserInfoById(fromUserId).getName()
        isComingCall = true
        if (callType.value != CallType.GROUP_CALL) {
            // 启动单人通话activity
            val intent = BaseCallActivity.createLockScreenIntent(mContext, SingleCallActivity::class.java)
            mContext.startActivity(intent)

            if (!isAppRunningForeground(mContext)) {
                info = when (callType.value) {
                    CallType.SINGLE_VIDEO_CALL ->
                        mContext.getString(R.string.alert_request_video, userName)

                    else ->
                        mContext.getString(R.string.alert_request_voice, userName)
                }
                ChatLog.e(TAG, "notifier.notify: $info")
                notifier.notify(info)
            }
        } else {
            // 启动多人通话界面

            val intent = BaseCallActivity.createLockScreenIntent(mContext, MultiCallActivity::class.java)
            mContext.startActivity(intent)

            if (!isAppRunningForeground(mContext)) {
                info = mContext.getString(R.string.alert_request_multiple_video, userName)
                notifier.notify(info)
            }
        }
    }


    /**
     * \~chinese
     * 开始1v1通话
     *
     * \~english
     * Start 1v1 call
     */
    fun startSingleCall(type: CallType, userID: String, ext: JSONObject? = null) {

        if (!ChatClient.getInstance().isLoggedIn){
            val msg = "startSingleCall user not login, please login first"
            ChatLog.e(TAG, msg)
            callKitListener?.onCallError(CallErrorType.IM_ERROR,ChatError.USER_NOT_LOGIN,msg)
            return
        }
        if (callState.value != CallState.CALL_IDLE) {
            val msg = "startSingleCall current state: ${callState.value} is busy"
            ChatLog.e(TAG, msg)
            callKitListener?.onCallError(
                CallErrorType.BUSINESS_ERROR,
                CALL_BUSINESS_ERROR.CALL_STATE_BUSY_ERROR.code,
                msg
            )
            return
        }

        if (type == CallType.GROUP_CALL) {
            val msg = "startSingleCall call type:$type is error "
            ChatLog.e(TAG, msg)
            callKitListener?.onCallError(
                CallErrorType.BUSINESS_ERROR,
                CALL_BUSINESS_ERROR.CALL_PARAM_ERROR.code,
                msg
            )
            return
        }

        if (userID.isEmpty()) {
            val msg = "startSingleCall userID is empty"
            ChatLog.e(TAG, msg)
            callKitListener?.onCallError(
                CallErrorType.BUSINESS_ERROR,
                CALL_BUSINESS_ERROR.CALL_PARAM_ERROR.code,
                msg
            )
            return
        }

        callType.value = type
        callState.value = CallState.CALL_OUTGOING
        fromUserId = userID

        inviteExt = ext

        isComingCall = false
        channelName = CallKitUtils.getRandomString(10)

        sendInviteMsg()
        // 开始1V1通话
        val intent = BaseCallActivity.createLockScreenIntent(mContext, SingleCallActivity::class.java)
        mContext.startActivity(intent)
        ChatLog.d(TAG, "startSingleCall startSingleCallActivity complete")
    }

    internal fun sendInviteMsg() {
        //发送邀请信息
        val array = mutableListOf<String>()
        if (callType.value == CallType.GROUP_CALL){
            array.addAll(inviteeUsers)
        } else{
            array.add(fromUserId)
        }
        signalingManager.sendInviteMsg(array,callType.value)
    }

    /**
     * \~chinese
     * 开始群通话，由callkit内部拉起群成员页面供选择成员后发起群通话
     *
     * \~english
     * Start group call, the callkit will internally launch the group member page to select members before starting the group call
     */
    fun startGroupCall(groupId: String, ext: JSONObject? = null) {

        if (!ChatClient.getInstance().isLoggedIn){
            val msg = "startGroupCall user not login, please login first"
            ChatLog.e(TAG, msg)
            callKitListener?.onCallError(
                CallErrorType.IM_ERROR,
                ChatError.USER_NOT_LOGIN,
                msg
            )
            return
        }

        if (callState.value != CallState.CALL_IDLE ) {
            val msg = "startGroupCall current state: ${callState.value} is busy"
            ChatLog.e(TAG, msg)
            callKitListener?.onCallError(
                CallErrorType.BUSINESS_ERROR,
                CALL_BUSINESS_ERROR.CALL_STATE_BUSY_ERROR.code,
                msg
            )
            return
        }

        if (groupId.isEmpty()) {
            val msg = "startGroupCall groupId is empty"
            ChatLog.e(TAG, msg)
            callKitListener?.onCallError(
                CallErrorType.BUSINESS_ERROR,
                CALL_BUSINESS_ERROR.CALL_PARAM_ERROR.code,
                msg
            )
            return
        }
        // 还没有加入群视频
        callType.value = CallType.GROUP_CALL
        isComingCall = false
        this.groupId = groupId
        inviteExt =ext
        callState.value = CallState.CALL_OUTGOING
        if (TextUtils.isEmpty(channelName)) {
            channelName = CallKitUtils.getRandomString(10)
            ChatLog.d(TAG, "CallKitUtils.getRandomString: $channelName")
        }
        SelectGroupMembersActivity.actionStart(mContext, CallKitClient.groupId).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            mContext.startActivity(this)
        }
        ChatLog.d(TAG, "startGroupCall startGroupCallActivity complete")
    }

    /**
     * \~chinese
     * 获取缓存
     *
     * \~english
     * Get cache
     */
    fun getCache(): CallKitCache {
        return cache
    }

    internal fun getCurrentUserInfo(): CallKitUserInfo? {
        return cache.getUser(getCurrentUserID())
    }

    internal fun getCurrentUserID(): String {
        return ChatClient.getInstance().currentUser
    }

    internal fun getRtcAppID(): String? {
        val options = ChatClient.getInstance().options
        if (options==null){
            ChatLog.e(TAG, "getRtcAppID() options is null,was sdk inited?")
           return null
        }
        return options.appId
    }

    internal suspend fun getRtcToken(channelName_p: String?): RTCTokenInfo? {
        return suspendCoroutine { continuation ->
            val tokenInfo = cache.rtcTokenInfo.get(getCurrentUserID())
            if ( tokenInfo!= null) {
                continuation.resume(tokenInfo)
            } else {
                ChatClient.getInstance().asyncGetRTCTokenInfoWithChannelName(channelName_p, object :
                    EMValueCallBack<RTCTokenInfo> {
                    override fun onSuccess(value: RTCTokenInfo) {
                        cache.rtcTokenInfo .put(getCurrentUserID(),value)
                        continuation.resume(value)
                    }

                    override fun onError(error: Int, errorMsg: String?) {
                        ChatLog.e(TAG, "getRtcToken error: $error, $errorMsg")
                        continuation.resume(null)
                    }
                })
            }
        }
    }

    internal suspend fun getUserIdByUid(uid: Int): String? {
        return suspendCoroutine { continuation ->
            ChatClient.getInstance().asyncGetUserIdsWithRTCUids(listOf(uid), object :
                EMValueCallBack<Map<Int, String>> {
                override fun onSuccess(value: Map<Int, String>) {
                    if (value.isNotEmpty()) {
                        continuation.resume(value[uid])
                    } else {
                        continuation.resume(null)
                    }
                }

                override fun onError(error: Int, errorMsg: String?) {
                    ChatLog.e(TAG, "getUserIdByUid error: $error, $errorMsg")
                    continuation.resume(null)
                }
            })
        }
    }

    /**
     * \~chinese
     * 退出通话
     *
     * \~english
     * Exit call
     */
    internal fun exitCall() {
        if (isComingCall){
            TelecomHelper.endCall(mContext) // 先处理Telecom连接
        }
        signalingManager.exitCall()
        rtcManager.exitCall()
        floatWindow.exitCall()
        incomingCallTopWindow.exitCall()
        audioController.exitCall()
        callState.value = CallState.CALL_IDLE
        callID = null
        callerDevId = null
        fromUserId = ""
        channelName = null
        groupId = ""
        isComingCall = true
        inviteExt=null
        cache.resetData()
        inviteeUsers.clear()
        notifier.reset()
    }

    /**
     * \~chinese
     * 结束通话
     *
     * \~english
     * End call
     */
    fun endCall(){
        if (callState.value == CallState.CALL_OUTGOING){
            signalingManager.cancelCall(callType.value)
        }else if (callState.value == CallState.CALL_ANSWERED){
            signalingManager.endCall(callType.value)
        }else if (callState.value == CallState.CALL_ALERTING) {
            signalingManager.refuseCall()
        }else{
            ChatLog.e(TAG, "endCall: callState is ${callState.value}, no action taken")
        }
    }

    /**
     * \~chinese
     * 清理所有资源,调用完该方法后，如需重新使用CallKit相关功能，请重新调用init方法
     *
     * \~english
     * Clean up all resources, after calling this method, if you need to use CallKit again, please call the init method again
     */
    fun cleanUp() {
        exitCall()
        cache.cleanUp()
        signalingManager.stopListening()
        callKitScope.cancel()
        isInitialized=false
    }
}