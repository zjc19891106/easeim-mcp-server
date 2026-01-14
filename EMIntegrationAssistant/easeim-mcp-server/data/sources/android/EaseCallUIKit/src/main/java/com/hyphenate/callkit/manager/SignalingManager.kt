package com.hyphenate.callkit.manager

import android.text.TextUtils
import android.util.Log
import com.hyphenate.EMCallBack
import com.hyphenate.EMConnectionListener
import com.hyphenate.EMMessageListener
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.CallKitClient.CallErrorType
import com.hyphenate.callkit.CallKitClient.audioController
import com.hyphenate.callkit.CallKitClient.callID
import com.hyphenate.callkit.CallKitClient.callKitListener
import com.hyphenate.callkit.CallKitClient.callKitScope
import com.hyphenate.callkit.CallKitClient.callState
import com.hyphenate.callkit.CallKitClient.callType
import com.hyphenate.callkit.CallKitClient.callerDevId
import com.hyphenate.callkit.CallKitClient.channelName
import com.hyphenate.callkit.CallKitClient.deviceId
import com.hyphenate.callkit.CallKitClient.fromUserId
import com.hyphenate.callkit.CallKitClient.groupId
import com.hyphenate.callkit.CallKitClient.inviteExt
import com.hyphenate.callkit.CallKitClient.isComingCall
import com.hyphenate.callkit.CallKitClient.mContext
import com.hyphenate.callkit.CallKitClient.rtcManager
import com.hyphenate.callkit.CallKitClient.signalingManager
import com.hyphenate.callkit.CallKitClient.startCallActivity
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.CallAction
import com.hyphenate.callkit.bean.CallEndReason
import com.hyphenate.callkit.bean.CallInfo
import com.hyphenate.callkit.bean.CallKitGroupInfo
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.bean.Constant
import com.hyphenate.callkit.bean.Constant.CALL_INVITE_EXT
import com.hyphenate.callkit.bean.NetworkQuality
import com.hyphenate.callkit.event.AlertEvent
import com.hyphenate.callkit.event.AnswerEvent
import com.hyphenate.callkit.event.BaseEvent
import com.hyphenate.callkit.event.CallCancelEvent
import com.hyphenate.callkit.event.ConfirmCallEvent
import com.hyphenate.callkit.event.ConfirmRingEvent
import com.hyphenate.callkit.event.LeaveEvent
import com.hyphenate.callkit.extension.addUserInfo
import com.hyphenate.callkit.extension.getUserInfo
import com.hyphenate.callkit.telecom.TelecomHelper
import com.hyphenate.callkit.utils.CallKitUtils
import com.hyphenate.callkit.utils.CallKitUtils.isAppRunningForeground
import com.hyphenate.callkit.utils.ChatClient
import com.hyphenate.callkit.utils.ChatConnectionListener
import com.hyphenate.callkit.utils.ChatConversationType
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.ChatMessage
import com.hyphenate.callkit.utils.ChatMessageListener
import com.hyphenate.callkit.utils.ChatMessageType
import com.hyphenate.callkit.utils.ChatTextMessageBody
import com.hyphenate.callkit.utils.ChatType
import com.hyphenate.callkit.utils.PermissionHelper.hasFloatWindowPermission
import com.hyphenate.callkit.utils.TimerUtils
import com.hyphenate.callkit.utils.TimerUtils.startTimer
import com.hyphenate.callkit.utils.TimerUtils.stopTimer
import com.hyphenate.chat.EMCmdMessageBody
import com.hyphenate.chat.EMLoginExtensionInfo
import com.hyphenate.chat.EMMessage
import com.hyphenate.exceptions.HyphenateException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.Volatile


/**
 * \~chinese
 * 协议管理器
 * 独立管理Callkit信令
 *
 * \~english
 * Signaling manager
 * Independently manage Callkit signaling
 */
class SignalingManager {

    companion object {
        private const val TAG = "Callkit SignalingManager"
    }
    private var messageListener: ChatMessageListener? = null
    private var connectionListener: ChatConnectionListener? = null
    private var isListening = false
    @Volatile
    private var mConfirm_ring = false
    //存储邀请用户的超时时间戳
    private val inViteUserMap = ConcurrentHashMap<String, Long>()
    private var commonTimerJob: Job? = null
    private var alertTimerJob: Job? = null
    private var eventJob: Job? = null
    internal var callInfo: CallInfo? = null

    /**
     * \~chinese
     * 发送启动Activity事件 - 使用协程替代Handler消息
     *
     * \~english
     * Send start activity event - use coroutine instead of Handler message
     */
    internal fun startSendEvent(delay: Long=500) {
        eventJob?.cancel()
        eventJob = callKitScope.launch {
            stopAlertTimer()
            //从通知栏点击进来会出现callactivity被MainActivity覆盖的问题,加个延时
            delay(delay)
            // 切换到主线程执行UI操作
            withContext(Dispatchers.Main) {
                startCallActivity()
            }
        }
    }

    /**
     * \~chinese
     * 开始通用定时器
     *
     * \~english
     * Start common timer
     */
    internal fun startCommonTimer(timeout :Int = CallKitClient.callKitConfig.callTimeout) {
        commonTimerJob?.cancel()
        commonTimerJob = startTimer {timePassed ->

            if (callType.value == CallType.GROUP_CALL){
                //多人视频
                if (!isComingCall) { //如果是主叫
                    val totalMilliSeconds = System.currentTimeMillis()
                    val it_user: MutableIterator<String?> = inViteUserMap.keys.iterator()
                    while (it_user.hasNext()) {
                        val userId = it_user.next()
                        //判断当前时间是否超时
                        if (totalMilliSeconds >= inViteUserMap.get(userId)!!) {
                            //发送取消事件
                            val cancelEvent = CallCancelEvent()
                            sendCmdMsg(cancelEvent, userId)
                            it_user.remove()
                            rtcManager.removeParticipant(userId)
                        }
                    }
                    if (inViteUserMap.size == 0) {
                        stopCommonTimer()
                        audioController.stopPlayRing()
                    }
                } else {
                    if (timePassed  == timeout) {
                        //被叫等待仲裁消息超时
                        //对方回复超时
                        updateMessage(0,CallEndReason.CallEndReasonRemoteNoResponse)
                        callKitListener?.onEndCallWithReason(CallEndReason.CallEndReasonRemoteNoResponse, callInfo)
                        stopCommonTimer()
                        audioController.stopPlayRingAndPlayDing()
                        exitChannel()
                    }
                }

            }else{
                if (timePassed  == timeout) {
                    audioController.stopPlayRingAndPlayDing()
                    //单人视频或语音通话
                    if (!isComingCall) {
                        //呼出
                        val cancelEvent = CallCancelEvent()
                        cancelEvent.cancel = false
                        cancelEvent.remoteTimeout = true
                        //对方超时未接通,发送取消
                        sendCmdMsg(cancelEvent, fromUserId)
                    } else {
                        //呼入
                        //被叫等待仲裁消息超时
                        updateMessage(0,if (timeout == Constant.CALL_INVITE_INTERVAL) CallEndReason.CallEndReasonNoResponse else CallEndReason.CallEndReasonRemoteNoResponse)
                        //对方接通超时
                        callKitListener?.onEndCallWithReason(
                            CallEndReason.CallEndReasonNoResponse,
                            callInfo
                        )
                        exitChannel()
                    }
                    stopCommonTimer()
                }
            }
        }
    }

    /**
     * \~chinese
     * 开始警报定时器
     *
     * \~english
     * Start alert timer
     */
    internal fun startAlertTimer() {
        alertTimerJob?.cancel()
        alertTimerJob = startTimer(TimerUtils.TimerType.ALERT) {
            callState.value = CallState.CALL_IDLE
            updateMessage(0,CallEndReason.CallEndReasonRemoteNoResponse)
            // 可以在这里添加自动拒绝呼入的逻辑
            callKitListener?.onCallError(
                CallErrorType.BUSINESS_ERROR,
                CallKitClient.CALL_BUSINESS_ERROR.CALL_SIGNALING_ERROR.code,
                "incoming call timeout"
            )
            stopAlertTimer()
        }
    }

    internal fun stopCommonTimer() {
        stopTimer(commonTimerJob)
        commonTimerJob = null
    }

    internal fun stopAlertTimer() {
        stopTimer(alertTimerJob)
        alertTimerJob = null
    }

    /**
     * 停止所有计时器
     */
    internal fun stopAllTimers() {
        stopCommonTimer()
        stopAlertTimer()
        eventJob?.cancel()
        eventJob = null
    }

    /**
     * \~chinese
     * 开始监听消息
     *
     * \~english
     * Start listening to messages
     */
    fun startListening() {
        if (isListening) {
            ChatLog.d(TAG, "Already listening to messages")
            return
        }

        messageListener = createMessageListener()
        connectionListener=createConnectionListener()
        ChatClient.getInstance().chatManager().addMessageListener(messageListener)
        ChatClient.getInstance().addConnectionListener(connectionListener)
        isListening = true
        ChatLog.d(TAG, "Started listening to messages")
    }

    private fun createConnectionListener(): ChatConnectionListener? {
        return object : ChatConnectionListener{
            override fun onConnected() {

            }

            override fun onDisconnected(p0: Int) {

            }

            override fun onLogout(errorCode: Int, info: EMLoginExtensionInfo?) {
                super.onLogout(errorCode, info)
                CallKitClient.endCall()
            }

        }
    }

    /**
     * \~chinese
     * 停止监听消息
     *
     * \~english
     * Stop listening to messages
     */
    fun stopListening() {
        if (!isListening) {
            ChatLog.d(TAG, "Not listening to messages")
            return
        }
        messageListener?.let { listener ->
            ChatClient.getInstance().chatManager().removeMessageListener(listener)
        }
        connectionListener?.let { listener->
            ChatClient.getInstance().removeConnectionListener(listener)
        }
        messageListener = null
        connectionListener = null
        isListening = false
        ChatLog.d(TAG, "Stopped listening to messages")
    }

    /**
     * 创建消息监听器
     */
    private fun createMessageListener(): EMMessageListener {
        return object : EMMessageListener {
            override fun onMessageReceived(messages: List<ChatMessage>) {
                messages.forEach { message ->
                    handleCallMessage(message)
                }

            }

            override fun onCmdMessageReceived(messages: List<ChatMessage>) {
                messages.forEach { message ->
                    handleCallCmdMessage(message)
                }
            }
        }
    }

    /**
     * 处理通话消息
     */
    private  fun handleCallMessage(message: ChatMessage) {
        val messageType = message.getStringAttribute(Constant.CALL_MSG_TYPE, "")
        ChatLog.d(TAG, "Received message: ${message.msgId} from: ${message.from} messageType: $messageType")

        if (TextUtils.equals(messageType, Constant.CALL_MSG_INFO) &&
            !TextUtils.equals(message.from, ChatClient.getInstance().currentUser)
        ) {

            val action = message.getStringAttribute(Constant.CALL_ACTION, "")
            val callerDevId = message.getStringAttribute(Constant.CALL_DEVICE_ID, "")
            val fromCallId = message.getStringAttribute(Constant.CLL_ID, "")
            val fromUser = message.from
            val channel = message.getStringAttribute(Constant.CALL_CHANNELNAME, "")

            var ext: JSONObject? = null
            try {
                ext = message.getJSONObjectAttribute(CALL_INVITE_EXT)
            } catch (e: HyphenateException) {
                ChatLog.e(TAG, "Error getting invite ext" + e.message)
            }

            if (action.isNullOrEmpty() || callerDevId.isNullOrEmpty() ||
                fromCallId.isNullOrEmpty() || fromUser.isNullOrEmpty() ||
                channel.isNullOrEmpty()
            ) {
                ChatLog.e(TAG, "Invalid call message parameters")
                callKitListener?.onCallError(
                    CallErrorType.BUSINESS_ERROR,
                    CallKitClient.CALL_BUSINESS_ERROR.CALL_SIGNALING_ERROR.code,
                    "receive message error"
                )
                return
            }

            val callAction = CallAction.getfrom(action)
            when (callAction) {
                CallAction.CALL_INVITE -> {
                    if (fromUser == CallKitClient.getCurrentUserID()){
                        //不处理自己多设备的信令
                        return
                    }
                    val calltype = message.getIntAttribute(Constant.CALL_TYPE, 0)
                    val callkitType = CallType.getfrom(calltype)
                    if (callState.value != CallState.CALL_IDLE) {
                        //发送忙碌状态
                        val callEvent = AnswerEvent()
                        callEvent.result = Constant.CALL_ANSWER_BUSY
                        callEvent.callerDevId = callerDevId
                        callEvent.callId = fromCallId
                        callEvent.calleeDevId = deviceId
                        sendCmdMsg(callEvent, fromUser)
                    } else {
                         callInfo = CallInfo(
                            channel,
                            fromUser,
                            true,
                            callerDevId,
                            fromCallId,
                            callkitType,
                            ext,
                            message
                        )

                        //获取对方信息
                        val userInfo = message.getUserInfo()
                        CallKitClient.getCache().insertUser(userInfo)

                        //获取群组信息
                        if (callkitType == CallType.GROUP_CALL){
                            //多人视频
                            try {
                                val groupInfoJson = message.getJSONObjectAttribute(Constant.CALL_GROUPINFO)
                                groupId = groupInfoJson.optString(Constant.CALL_GROUP_ID, "")
                                val groupName = groupInfoJson.optString(Constant.CALL_GROUP_NAME, "")
                                val groupAvatar = groupInfoJson.optString(Constant.CALL_GROUP_AVATAR, "")
                                CallKitClient.getCache().insertGroup(groupId,CallKitGroupInfo(groupId,groupName,groupAvatar))
                            } catch (e: Exception) {
                                ChatLog.e(TAG, "Error getting invite ext" + e.message)
                            }
                        }

                        //发送alert消息
                        val callEvent = AlertEvent()
                        callEvent.callerDevId = callerDevId
                        callEvent.callId = fromCallId
                        callEvent.calleeDevId = deviceId
                        sendCmdMsg(callEvent, fromUser)

                        //启动定时器
                        startAlertTimer()
                    }
                }
                else -> {
                    ChatLog.e(TAG, "Received non-critical call action: $action")
                }
            }
        }
    }

    /**
     * 处理通话命令消息
     */
    private fun handleCallCmdMessage(message: ChatMessage) {
        val messageType = message.getStringAttribute(Constant.CALL_MSG_TYPE, "")
        ChatLog.d(TAG, "Received cmd message: ${message.msgId} from: ${message.from} messageType: $messageType")

        if (TextUtils.equals(messageType, Constant.CALL_MSG_INFO) &&
            !TextUtils.equals(message.from, ChatClient.getInstance().currentUser)
        ) {
            val action = message.getStringAttribute(Constant.CALL_ACTION, "")
            val callerDevId = message.getStringAttribute(Constant.CALL_DEVICE_ID, "")
            val fromCallId = message.getStringAttribute(Constant.CLL_ID, "")
            val fromUser = message.from
            val callAction = CallAction.getfrom(action)
            when (callAction) {
                CallAction.CALL_CANCEL -> {

                    if (fromCallId != callID || callState.value != CallState.CALL_ALERTING){
                        ChatLog.e(TAG, "Received CALL_CANCEL, but callId does not match or callState is not ALERTING, ignoring。fromCallId:$fromCallId, callID:$callID, callState:${callState.value}")
                        return
                    }

                    if (callState.value == CallState.CALL_IDLE) {
                        stopAlertTimer()
                        // 隐藏顶部悬浮窗
                        CallKitClient.incomingCallTopWindow.hideIncomingCallTopWindow()
                    } else {
                        audioController.stopPlayRingAndPlayDing()
                        val event = CallCancelEvent()
                        event.callerDevId = callerDevId
                        event.callId = fromCallId
                        event.userId = fromUser
                        if (TextUtils.equals(callID, fromCallId)) {
                            callState.value = CallState.CALL_IDLE
                        }
//                        notifier.reset()
                        if (!isComingCall) {
                            //停止仲裁定时器
                            stopCommonTimer()
                        }
                        //对方取消
                        updateMessage(0,CallEndReason.CallEndReasonRemoteCancel)
                        callKitListener?.onEndCallWithReason(CallEndReason.CallEndReasonRemoteCancel, callInfo)
                        //取消通话
                        exitChannel()
                        // 隐藏顶部悬浮窗
                        CallKitClient.incomingCallTopWindow.hideIncomingCallTopWindow()
                    }
                }

                CallAction.CALL_ALERT -> {
                    if (callerDevId!=deviceId){
                        ChatLog.e(TAG,"receive cmd alert, callerDevId: $callerDevId not equals to self deviceId: $deviceId,ignore")
                        return
                    }
                    val calleedDeviceId = message.getStringAttribute(Constant.CALLED_DEVICE_ID, "")

                    //判断会话是否有效
                    val ringEvent = ConfirmRingEvent()
                    if (callType.value== CallType.GROUP_CALL){
                        //多人视频
                        if (TextUtils.equals(fromCallId, callID)
                            && inViteUserMap.containsKey(fromUser)
                        ) {
                            //发送会话有效消息
                            ringEvent.calleeDevId = calleedDeviceId
                            ringEvent.valid = true
                            ringEvent.callId = fromCallId
                            ringEvent.userId = fromUser
                            sendCmdMsg(ringEvent, fromUser)
                        } else {
                            //发送会话无效消息
                            ringEvent.calleeDevId = calleedDeviceId
                            ringEvent.valid = false
                            ringEvent.callId = fromCallId
                            sendCmdMsg(ringEvent, fromUser)
                        }
                    }else{
                        //单人视频
                        if (TextUtils.equals(fromCallId, callID)
                            && callState.value != CallState.CALL_ANSWERED
                        ) {
                            //发送会话有效消息
                            ringEvent.calleeDevId = calleedDeviceId
                            ringEvent.callId = fromCallId
                            ringEvent.valid = true
                            sendCmdMsg(ringEvent, fromUserId)
                        } else {
                            //发送会话无效消息
                            ringEvent.calleeDevId = calleedDeviceId
                            ringEvent.callId = fromCallId
                            ringEvent.valid = false
                            sendCmdMsg(ringEvent, fromUserId)
                        }
                    }
                    //已经发送过会话确认消息
                    mConfirm_ring = true
                }

                CallAction.CALL_CONFIRM_RING -> {
                    //收到callId 是否有效
                    val calledDvId = message.getStringAttribute(Constant.CALLED_DEVICE_ID, "")
                    val vaild = message.getBooleanAttribute(Constant.CALL_STATUS, false)
                    //多端设备时候用于区别哪个DrviceId,
                    // 被叫处理自己设备Id的CALL_CONFIRM_RING
                    if (TextUtils.equals(calledDvId, deviceId)) {
                        stopAlertTimer()
                        if (vaild){
                            startCommonTimer()
                            //收到callId 有效
                            if (callState.value == CallState.CALL_IDLE) {
                                callState.value = CallState.CALL_ALERTING
                                //对方主叫的设备信息
                                CallKitClient.callerDevId = callerDevId
                                callID = fromCallId
                                callInfo?.let { info->
                                    channelName = info.channelName
                                    callType.value = info.callKitType
                                    fromUserId = info.fromUser
                                    inviteExt = info.ext
                                }
                                //收到有效的呼叫map邀请信息
                                isComingCall=true
                                val appRunningForeground = isAppRunningForeground(mContext)
                                val hasFloatWindowPermission = hasFloatWindowPermission(mContext)
                                ChatLog.d(TAG, "App running foreground: $appRunningForeground, isScreenLocked: ${CallKitUtils.isScreenLocked(mContext)} ,hasFloatWindowPermission: $hasFloatWindowPermission")
                                // 锁屏 or 在后台时没有悬浮窗权限走telecom
                                if (CallKitUtils.isScreenLocked(mContext) || (!appRunningForeground && !hasFloatWindowPermission)) {
                                    ChatLog.d(TAG, "Screen is locked or app is in background, using telecom to show incoming call")
                                   //使用telecom显示接听界面
                                    TelecomHelper.startCallImmediately(
                                        mContext,
                                        CallKitClient.cache.getUser(fromUserId)?.getName()?:fromUserId,
                                        CallKitClient.cache.getUser(fromUserId)?.getName()?:fromUserId,
                                        callID
                                    )
                                }else{
                                    // 开始播放铃声
                                    audioController.playRing(AudioController.RingType.INCOMING)
                                    ChatLog.d(TAG, "Playing incoming call ring")
                                    //非锁屏状态
                                    //检查是否有悬浮窗权限
                                    if(hasFloatWindowPermission){
                                        //弹出顶部通知，并响铃
                                        CallKitClient.incomingCallTopWindow.showIncomingCallTopWindow()
                                        ChatLog.d(TAG, "Incoming call top window shown ")
                                    }else{
                                        startSendEvent()
                                    }
                                }
                                // 通话邀请回调
                                callKitListener?.onReceivedCall(fromUserId,callType.value,  inviteExt)
                            } else {
                                //通话无效
                                ChatLog.e(TAG, "Received CALL_CONFIRM_RING ,but callState is not idle, ignoring")
                            }
                        }else{
                            ChatLog.e(TAG, "Received invalid call confirmation, ignoring")
                        }
                    }
                }

                CallAction.CALL_CONFIRM_CALLEE -> {
                    val result = message.getStringAttribute(Constant.CALL_RESULT, "")
                    val calledDevId = message.getStringAttribute(Constant.CALLED_DEVICE_ID, "")

                    stopCommonTimer()
                    //收到的仲裁为自己设备
                    if (TextUtils.equals(calledDevId, deviceId)) {
                        //收到的仲裁为接听
                        if (TextUtils.equals(result, Constant.CALL_ANSWER_ACCEPT)) {
                            callState.value=CallState.CALL_ANSWERED
                            //加入频道
                            joinChannel()
                           } else if (TextUtils.equals(result, Constant.CALL_ANSWER_REFUSE)) {
                            updateMessage(0,CallEndReason.CallEndReasonRefuse)
                            callKitListener?.onEndCallWithReason(CallEndReason.CallEndReasonRefuse, callInfo)
                            //退出通话
                            exitChannel()
                        }
                    } else {
                        //提示已在其他设备处理
                        if (TextUtils.equals(result, Constant.CALL_ANSWER_ACCEPT)) {
                            //已经在其他设备接听
                            updateMessage(0,CallEndReason.CallEndReasonHandleOnOtherDevice)
                            //已经在其他设备处理
                            callKitListener?.onEndCallWithReason(
                                CallEndReason.CallEndReasonHandleOnOtherDevice,
                                callInfo
                            )
                        } else if (TextUtils.equals(result, Constant.CALL_ANSWER_REFUSE)) {
                            //已经在其他设备拒绝
                            updateMessage(0,CallEndReason.CallEndReasonHandleOnOtherDevice)
                            //已经在其他设备处理
                            callKitListener?.onEndCallWithReason(
                                CallEndReason.CallEndReasonHandleOnOtherDevice,
                                callInfo
                            )
                        }
                        exitChannel() // 再退出CallKit
                    }
                }

                CallAction.CALL_ANSWER -> {

                    if (callerDevId!=deviceId){
                        ChatLog.e(TAG,"receive cmd answerCall, callerDevId: $callerDevId not equals to self deviceId: $deviceId,ignore")
                        return
                    }

                    val result1 = message.getStringAttribute(Constant.CALL_RESULT, "")
                    val calledDevId1 = message.getStringAttribute(Constant.CALLED_DEVICE_ID, "")
//                    val transVoice = message.getBooleanAttribute(Constant.CALLED_TRANSE_VOICE, false)
                    //判断不是被叫另外一台设备的漫游消息
                    //或者是主叫收到的
                    if (callType.value != CallType.GROUP_CALL) {
                        if (!isComingCall || TextUtils.equals(calledDevId1, deviceId)) {
                            stopCommonTimer()
                            val callEvent = ConfirmCallEvent()
                            callEvent.calleeDevId = calledDevId1
                            callEvent.callerDevId = callerDevId
                            callEvent.result = result1
                            callEvent.callId = fromCallId
                            if (TextUtils.equals(result1, Constant.CALL_ANSWER_BUSY)) {
                                audioController.stopPlayRingAndPlayDing()
                                if (!mConfirm_ring) {
                                    //比如对方空闲端网慢，还没有回复过来alert
                                    //退出频道
                                    // 提示对方正在忙碌中
                                    //退出通话
                                    updateMessage(0,CallEndReason.CallEndReasonBusy)
                                    //对方正在忙碌中
                                    callKitListener?.onEndCallWithReason(
                                        CallEndReason.CallEndReasonBusy,
                                        callInfo
                                    )
                                    //过一秒再关闭页面
                                    callKitScope.launch {
                                        delay(1000)
                                        exitChannel()
                                    }
                                } else {
                                    //让对方空闲端挂断，因为对方多端正在通话
                                    sendCmdMsg(callEvent, fromUserId)
                                }
                            } else if (TextUtils.equals(result1, Constant.CALL_ANSWER_ACCEPT)) {
                                audioController.stopPlayRing()
                                //设置为接听
                                callState.value = CallState.CALL_ANSWERED
                                sendCmdMsg(callEvent, fromUserId)
                            } else if (TextUtils.equals(result1, Constant.CALL_ANSWER_REFUSE)) {
                                audioController.stopPlayRingAndPlayDing()
                                sendCmdMsg(callEvent, fromUserId)
                            }
                        }else{
                            ChatLog.e(TAG, "Received CALL_ANSWER, but not for this device, ignoring")
                        }
                    } else {
                        if (!TextUtils.equals(fromUser, ChatClient.getInstance().currentUser)) {

                            val callEvent = ConfirmCallEvent()
                            callEvent.calleeDevId = calledDevId1
                            callEvent.result = result1
                            callEvent.callerDevId = callerDevId
                            callEvent.callId = fromCallId

                            //删除超时机制
                            inViteUserMap.remove(fromUser)

                            if (TextUtils.equals(result1, Constant.CALL_ANSWER_BUSY)) {
                                if (!mConfirm_ring) {
                                    //提示对方正在忙碌中
                                    //删除占位符
                                    rtcManager.removeParticipant(fromUser)
                                    ChatLog.d(TAG, "$fromUser is busy")
                                } else {
                                    sendCmdMsg(callEvent, fromUser)
                                }
                            } else if (TextUtils.equals(result1, Constant.CALL_ANSWER_ACCEPT)) {
                                audioController.stopPlayRing()
                                //设置为接听
                                callState.value = CallState.CALL_ANSWERED
                                sendCmdMsg(callEvent, fromUser)
                            } else if (TextUtils.equals(result1, Constant.CALL_ANSWER_REFUSE)) {
                                sendCmdMsg(callEvent, fromUser)
                                //删除占位符
                                rtcManager.removeParticipant(fromUser)
                                ChatLog.d(TAG, "$fromUser  refused the call")
                            }
                        }else{
                            ChatLog.e(TAG, "Received CALL_ANSWER, but not for this device, ignoring")
                        }
                    }
                }

                CallAction.CALL_END -> {
                    //有人挂断
                    if ( fromCallId!=callID || callState.value!= CallState.CALL_ANSWERED){
                        ChatLog.e(TAG, "Received CALL_LEAVE_CALL, but callId does not match  or callState is not ANSWERED, ignoring")
                        return
                    }
                    CallKitClient.cache.getUser(fromUser)?.uid?.let {
                        rtcManager.onUserOfflineCallBack(it,0)
                    }?:run{
                        ChatLog.e(TAG, "handleCallCmdMessage: CallAction.CALL_LEAVE_CALL->user not found for $fromUser")
                    }
                }

                else -> {
                    ChatLog.d(TAG, "Received non-critical call action: $action")
                }
            }
        }
    }
    /**
     * \~chinese
     * 加入频道
     *
     * \~english
     * Join channel
     */
    internal fun joinChannel() {
        channelName?.let {
            rtcManager.joinChannel(it)
        } ?: run {
            ChatLog.e(TAG, "Channel name is null, cannot join channel")
        }
    }
    /**
     * \~chinese
     * 群定向cmd消息
     *
     * \~english
     * Group-oriented cmd messages
     */
    internal fun sendCmdMsg(event: BaseEvent, groupId: String, receiverList: MutableList<String>) {
        val message = ChatMessage.createSendMessage(ChatMessageType.CMD)
        message.chatType= ChatType.GroupChat
        message.setReceiverList(receiverList)
        message.to=groupId
        processSendCmdMsg(event,message)
    }
    /**
     * \~chinese
     * 单聊cmd消息
     *
     * \~english
     * Single chat cmd messages
     */
    internal fun sendCmdMsg(event: BaseEvent, toID: String?) {
        val message = ChatMessage.createSendMessage(ChatMessageType.CMD)
        message.to = toID
        processSendCmdMsg(event,message)
    }
    private fun processSendCmdMsg(event: BaseEvent,message: ChatMessage){
        val action = "rtcCall"
        val cmdBody = EMCmdMessageBody(action)
        message.addBody(cmdBody)
        if (event.callAction == CallAction.CALL_CONFIRM_RING
            || event.callAction == CallAction.CALL_CANCEL
            || event.callAction == CallAction.CALL_CONFIRM_CALLEE) {
            cmdBody.deliverOnlineOnly(false)
        } else {
            cmdBody.deliverOnlineOnly(true)
        }

        message.setAttribute(Constant.CALL_ACTION, event.callAction!!.state)
        message.setAttribute(Constant.CALL_DEVICE_ID, deviceId)
        message.setAttribute(Constant.CLL_ID, event.callId)//多人视频这里不同 EaseCallKit.getInstance().getCallID()
        message.setAttribute(Constant.CLL_TIMESTRAMEP, System.currentTimeMillis())
        message.setAttribute(Constant.CALL_MSG_TYPE, Constant.CALL_MSG_INFO)
        message.setAttribute(Constant.CALLED_DEVICE_ID, event.calleeDevId)
        if (event.callAction == CallAction.CALL_CONFIRM_RING) {
            message.setAttribute(Constant.CALL_STATUS, (event as ConfirmRingEvent).valid!!)
        } else if (event.callAction == CallAction.CALL_CONFIRM_CALLEE) {
            message.setAttribute(Constant.CALL_RESULT, (event as ConfirmCallEvent).result)
        } else if (event.callAction == CallAction.CALL_ANSWER) {
            message.setAttribute(Constant.CALL_RESULT, (event as AnswerEvent).result)
            message.setAttribute(Constant.CALL_DEVICE_ID, event.callerDevId)
            message.setAttribute(Constant.CALLED_TRANSE_VOICE, event.transVoice)
        } else if (event.callAction == CallAction.CALL_ALERT) {
            message.setAttribute(Constant.CALL_DEVICE_ID, event.callerDevId)
        }
        message.setMessageStatusCallback(object : EMCallBack {
            override fun onSuccess() {
                cmdMessageCallbackOnSuccess(event)
            }

            override fun onError(code: Int, error: String?) {
                cmdMessageCallbackOnError(event, code, error)
            }
        })
        ChatClient.getInstance().chatManager().sendMessage(message)
    }


    private fun cmdMessageCallbackOnSuccess(event: BaseEvent) {
        ChatLog.d(TAG, "${event.callAction?.state} send success")
        if (event.callAction == CallAction.CALL_CANCEL) {
            if (callType.value != CallType.GROUP_CALL){
                val cancel = (event as CallCancelEvent).cancel
                if (cancel) {
                    updateMessage(0,CallEndReason.CallEndReasonCancel)
                    //取消通话
                    callKitListener?.onEndCallWithReason(CallEndReason.CallEndReasonCancel, callInfo)
                } else {
                    updateMessage(0,CallEndReason.CallEndReasonRemoteNoResponse)
                    //对方无响应
                    callKitListener?.onEndCallWithReason(CallEndReason.CallEndReasonRemoteNoResponse, callInfo)
                }
                exitChannel()
            }
        } else if (event.callAction == CallAction.CALL_CONFIRM_CALLEE) {
            if (callType.value!= CallType.GROUP_CALL){
                //不为接通状态 退出频道
                if (!TextUtils.equals((event as ConfirmCallEvent).result, Constant.CALL_ANSWER_ACCEPT)) {
                    //对方拒绝通话
                    if (TextUtils.equals(event.result, Constant.CALL_ANSWER_REFUSE)) {
                        updateMessage(0,CallEndReason.CallEndReasonRemoteRefuse)
                        callKitListener?.onEndCallWithReason( CallEndReason.CallEndReasonRemoteRefuse, callInfo)
                    }
                    exitChannel()
                }
            }
        } else if (event.callAction == CallAction.CALL_ANSWER) {
            //被第三方打扰时不启动定时器
            if ((event as? AnswerEvent)?.result!= Constant.CALL_ANSWER_BUSY){
                //回复以后启动定时器，等待仲裁超时
                startCommonTimer(Constant.CALL_INVITED_INTERVAL)
            }
        }
    }
    private fun cmdMessageCallbackOnError(event: BaseEvent, code: Int, error: String?) {
        ChatLog.e(TAG, "cmd ${event.callAction?.state} error code:" + code + ",error: " + error)
        callKitListener?.onCallError(CallErrorType.IM_ERROR,code, error)
        if (event.callAction == CallAction.CALL_CANCEL) {
            //退出频道
            exitChannel()
        } else if (event.callAction == CallAction.CALL_CONFIRM_CALLEE) {

            //不为接通状态 退出频道
            if (!TextUtils.equals((event as ConfirmCallEvent).result, Constant.CALL_ANSWER_ACCEPT)) {
                exitChannel()
            }
        }
    }

    fun sendAnswerMessage() {
        //发送接听消息
        val event = AnswerEvent()
        event.result = Constant.CALL_ANSWER_ACCEPT
        event.callId = callID
        event.callerDevId = callerDevId
        event.calleeDevId = deviceId
        sendCmdMsg(event, fromUserId)
    }

    fun sendRefuseMessage() {
        //发送拒绝消息
        val event = AnswerEvent()
        event.result = Constant.CALL_ANSWER_REFUSE
        event.callId = callID
        event.callerDevId = callerDevId
        event.calleeDevId = deviceId
        sendCmdMsg(event, fromUserId)
    }

    fun sendCancelMessage(callType: CallType) {
        val cancelEvent = CallCancelEvent()
        cancelEvent.callId = callID
        if (callType == CallType.GROUP_CALL){
            ChatLog.d(TAG, "sendCancelMessage: group call, sending cancel to all invitees,inViteUserMap:$inViteUserMap")
            sendCmdMsg(cancelEvent, groupId, inViteUserMap.keys.toMutableList())
        }else{
            sendCmdMsg(cancelEvent,  fromUserId)
        }
    }

    /**
     * \~chinese
     * 发送通话邀请信息
     * @param userlist 用户列表
     * @param callType 通话类型
     *
     * \~english
     * Send call invite message
     * @param userlist user list
     * @param callType call type
     */
    internal fun sendInviteMsg(userlist: MutableList<String>, callType: CallType) {
        ChatLog.d(TAG, "sendInviteMsg Sending call invite to users: $userlist with callType: $callType")
        if (userlist.isEmpty()) {
            return
        }
        //开始定时器
        signalingManager.startCommonTimer()
        mConfirm_ring = false
        callKitScope.launch {
            var groupInfo: CallKitGroupInfo? =null
            val currentUserInfo=CallKitClient.getCache().getUserInfoById(ChatClient.getInstance().currentUser).apply {
                isVideoEnabled = (callType == CallType.SINGLE_VIDEO_CALL)
                connected=true
                if (uid==-1) uid=0
            }
            ChatLog.d(TAG, "sendInviteMsg Current user info: $currentUserInfo")
            if (callType== CallType.GROUP_CALL){
                //这次加入的新成员
                val allUseInfos = mutableListOf<CallKitUserInfo>()
                val userInfos = CallKitClient.getCache().getUserInfosByIds(userlist)
                userInfos.forEach {
                    it.uid=-1
                    it.connected=false
                    it.isVideoEnabled=false
                    it.isMicEnabled=true
                    it.isSpeaking=false
                    it.networkQuality= NetworkQuality.UNKNOWN
                }
                allUseInfos.addAll(userInfos)
                ChatLog.d(TAG, "sendInviteMsg Fetched user infos for invitees: $userInfos")
                //在邀请成员加入场景下还得加入已存在成员
                val existingParticipants = rtcManager.participants.value
                existingParticipants.forEach { existingUser ->
                    // 检查是否已存在，基于userId去重
                    val isDuplicate = allUseInfos.any { it.userId == existingUser.userId }
                    if (!isDuplicate) {
                        allUseInfos.add(0,existingUser)
                    }
                }
                //自己
                val exist =allUseInfos.any { it.userId == currentUserInfo.userId }
                if (!exist) {
                    allUseInfos.add(0,currentUserInfo)
                }

                rtcManager.setParticipants(allUseInfos)
                groupInfo = CallKitClient.getCache().getGroupInfoById(groupId)
                ChatLog.d(TAG, "sendInviteMsg Compiled complete groupInfo: $groupInfo")
            }

            var content: String= mContext.getString(R.string.callkit_inviting_you_to_a_group_call)
            if (callType== CallType.SINGLE_VIDEO_CALL){
                content = mContext.getString(R.string.callkit_inviting_you_to_a_video_call)
            }else if (callType== CallType.SINGLE_VOICE_CALL){
                content = mContext.getString(R.string.callkit_inviting_you_to_a_voice_call)
            }

            lateinit var message:ChatMessage
            if (callType == CallType.GROUP_CALL){
                //使用定向消息解决群视频产生单聊会话的问题
                message = ChatMessage.createTextSendMessage(content, groupId)
                message.chatType= ChatType.GroupChat
            }else{
                message = ChatMessage.createTextSendMessage(content, userlist[0])
            }
            message.setAttribute(Constant.CALL_ACTION, CallAction.CALL_INVITE.state)
            message.setAttribute(Constant.CALL_CHANNELNAME, channelName)
            message.setAttribute(Constant.CALL_TYPE, callType.code)
            message.setAttribute(Constant.CALL_DEVICE_ID,deviceId)
            message.setAttribute(CALL_INVITE_EXT, inviteExt?:JSONObject())

            callID = callID ?: CallKitUtils.getRandomString(10)
            message.setAttribute(Constant.CLL_ID, callID)
            message.setAttribute(Constant.CLL_TIMESTRAMEP, System.currentTimeMillis())
            message.setAttribute(Constant.CALL_MSG_TYPE, Constant.CALL_MSG_INFO)

            if (callType== CallType.GROUP_CALL){
                try {
                    //多人视频
                    val groupInfoJson = JSONObject()
                    groupInfoJson.putOpt(Constant.CALL_GROUP_ID, groupInfo?.groupID ?: "")
                    groupInfoJson.putOpt(Constant.CALL_GROUP_NAME, groupInfo?.groupName ?: "")
                    groupInfoJson.putOpt(Constant.CALL_GROUP_AVATAR, groupInfo?.groupAvatar ?: "")
                    message.setAttribute(Constant.CALL_GROUPINFO, groupInfoJson)
                } catch (e: Exception){
                    ChatLog.e(TAG, "sendInviteMsg Error setting group info: ${e.message}")
                }
            }

            message.addUserInfo(currentUserInfo.nickName, currentUserInfo.avatar)

            message.setMessageStatusCallback(object : EMCallBack {
                override fun onSuccess() {
                    ChatLog.d(TAG, "sendInviteMsg Invite call success send to:" + message.to)
                    if (callState.value!= CallState.CALL_ANSWERED){
                        //从邀请页面进来不用再响铃
                        audioController.playRing(AudioController.RingType.OUTGOING)
                        //发送邀请信令成功再joinchannel
                        signalingManager.joinChannel()
                    }
                }
                override fun onError(code: Int, error: String?) {
                    ChatLog.e(TAG, "sendInviteMsg Invite call error code:" + code + ",error:" + error + ",to:" + message.to)
                    callKitListener?.onCallError(CallErrorType.IM_ERROR,code, error)
                }
            })
            val receiverList=arrayListOf<String>()
            //开始定时器
            for (userID in userlist) {
                //放入超时时间
                var totalMilliSeconds = System.currentTimeMillis()
                val intervalTime: Long= CallKitClient.callKitConfig.callTimeout*1000L
                totalMilliSeconds += intervalTime
                //放进userMap里面
                inViteUserMap.put(userID, totalMilliSeconds)
                //使用定向消息解决群视频产生单聊会话的问题
                receiverList.add(userID)
            }
            if (callType== CallType.GROUP_CALL){
                //使用定向消息解决群视频产生单聊会话的问题
                message.setReceiverList(receiverList)
            }
            //apple push
            try {
                val pushExt = JSONObject().putOpt("type", "call")
                val customExt = JSONObject()
                addInviteInfoToCustomExt(customExt,callType,message)
                customExt.putOpt(Constant.CALL_CALLER_NICKNAME, currentUserInfo.nickName)
                pushExt.putOpt("custom", customExt)
                val apnsExt = JSONObject().putOpt("em_push_type", "voip")
                message.setAttribute(Constant.EM_PUSH_EXT,pushExt)
                message.setAttribute(Constant.EM_APNS_EXT,apnsExt)
            } catch (e: Exception){
                ChatLog.e(TAG, "sendInviteMsg Error setting push attributes: ${e.message}")
            }
            ChatClient.getInstance().chatManager().sendMessage(message)
            //这里是发起方callInfo
            callInfo = CallInfo(channelName, fromUserId, false, deviceId, callID!!, callType, inviteExt, message)
            CallKitClient.inviteeUsers.clear()
        }
    }
    @Throws(Exception::class)
    private fun addInviteInfoToCustomExt(customExt: JSONObject,callType: CallType,message: ChatMessage) {
        try {
            customExt.putOpt(Constant.CALL_ACTION, message.getStringAttribute(Constant.CALL_ACTION))
            customExt.putOpt(Constant.CALL_CHANNELNAME, message.getStringAttribute(Constant.CALL_CHANNELNAME))
            customExt.putOpt(Constant.CALL_TYPE, callType.code)
            customExt.putOpt(Constant.CALL_DEVICE_ID,message.getStringAttribute(Constant.CALL_DEVICE_ID))
            customExt.putOpt(CALL_INVITE_EXT, message.getJSONObjectAttribute(CALL_INVITE_EXT))

            customExt.putOpt(Constant.CLL_ID, message.getStringAttribute(Constant.CLL_ID))
            customExt.putOpt(Constant.CLL_TIMESTRAMEP, message.getLongAttribute(Constant.CLL_TIMESTRAMEP))
            customExt.putOpt(Constant.CALL_MSG_TYPE, message.getStringAttribute(Constant.CALL_MSG_TYPE))

            if (callType== CallType.GROUP_CALL){
                    //多人视频
                customExt.putOpt(Constant.CALL_GROUPINFO, message.getJSONObjectAttribute(Constant.CALL_GROUPINFO))
            }

            try{
                customExt.putOpt(Constant.MESSAGE_EXT_USER_INFO_KEY, message.getJSONObjectAttribute(Constant.MESSAGE_EXT_USER_INFO_KEY))
            }catch (e: Exception){
                ChatLog.e(TAG, "addInviteInfoToCustomExt Error getting group info from message: ${e.message}")
            }

        } catch (e: Exception) {
            ChatLog.e(TAG, "addInviteInfoToCustomExt Error adding invite info to custom ext: ${e.message}")
            // 抛出异常让调用方处理
            throw Exception("addInviteInfoToCustomExt Failed to create invite custom extension", e)
        }
    }

    internal fun updateMessage( callDuration: Long?=0, reason: CallEndReason) {
//        ChatLog.e(TAG, Log.getStackTraceString(Throwable())) //打印堆栈信息
        ChatLog.e(TAG, "updateMessage outer callMessage: ${callInfo?.inviteMessage} ,callDuration: $callDuration reason: $reason")
        callInfo?.inviteMessage?.let {
            val conversation = ChatClient.getInstance().chatManager().getConversation(
                it.conversationId(),
                if (it.chatType == ChatType.Chat) ChatConversationType.Chat else ChatConversationType.GroupChat,
                true
            )
            (it.body as ChatTextMessageBody).message=reason.getStringByCallEndReason(mContext,callDuration)
            conversation.updateMessage(it)
            ChatLog.e(TAG, "updateMessage: ${it.msgId} callDuration: $callDuration reason: $reason")
        }
    }

    fun refuseCall() {
        updateMessage(reason = CallEndReason.CallEndReasonRefuse)
        audioController.stopPlayRingAndPlayDing()
        sendRefuseMessage()
        CallKitClient.exitCall()
    }

    fun answerCall() {
        audioController.stopPlayRing()
        sendAnswerMessage()
    }

    fun endCall(calltype:CallType) {
        audioController.stopPlayRingAndPlayDing()
        updateMessage(rtcManager.connectedTime.value, CallEndReason.CallEndReasonHangup)
        callKitListener?.onEndCallWithReason(
            CallEndReason.CallEndReasonHangup,
            callInfo
        )
        //群聊可能还有些人处于呼叫中状态，需要发送cancel信令取消呼叫
        if (calltype == CallType.GROUP_CALL){
            sendCancelMessage(CallType.GROUP_CALL)
        }
        sendLeaveCallMessage()
        CallKitClient.exitCall()
    }

    private fun sendLeaveCallMessage() {
        if (callState.value== CallState.CALL_ANSWERED){
            val event = LeaveEvent()
            event.callId = callID
            event.callerDevId = callerDevId
            event.calleeDevId = deviceId
            event.callAction= CallAction.CALL_END
            if (callType.value == CallType.GROUP_CALL){
                //群聊可能还有些人处于呼叫中状态，需要发送cancel信令取消呼叫
                val receiveList =
                    rtcManager.participants.value.filter { it.userId != ChatClient.getInstance().currentUser }
                        .map { it.userId }
                sendCmdMsg(event,  groupId,receiveList.toMutableList())
            }else {
                sendCmdMsg(event, fromUserId)
            }
        }
    }

    fun cancelCall(calltyp: CallType) {
        audioController.stopPlayRingAndPlayDing()
        updateMessage(0, CallEndReason.CallEndReasonCancel)
        sendCancelMessage(calltyp)
        CallKitClient.exitCall()
    }

    private fun exitChannel() {
        CallKitClient.exitCall()
    }
    /**
     * \~chinese
     * 退出通话，重置相关状态、资源等
     *
     * \~english
     * Exit call, reset related status, resources, etc.
     */
    internal fun exitCall(){
        stopAllTimers()
        inViteUserMap.clear()
        TelecomHelper.stopService(mContext)
    }
}