package com.hyphenate.callkit.viewmodel

import android.view.TextureView
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.utils.PermissionHelper
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import androidx.lifecycle.viewModelScope
import com.hyphenate.callkit.CallKitClient.rtcManager
import com.hyphenate.callkit.base.BaseViewModel
import com.hyphenate.callkit.utils.ChatLog
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * \~chinese
 * 单人通话ViewModel，用于管理单人通话相关操作
 *
 * \~english
 * Single call ViewModel, used to manage single call related operations
 */
class SingleCallViewModel : BaseViewModel() {

    private val TAG: String = SingleCallViewModel::class.java.simpleName
    private var signalingManager = CallKitClient.signalingManager
    private var rtcManager = CallKitClient.rtcManager
    private var floatWindow = CallKitClient.floatWindow
    private val _callState = CallKitClient.callState
    val callState: StateFlow<CallState> = _callState.asStateFlow()
    private val _callType = CallKitClient.callType
    val callType: StateFlow<CallType> = _callType.asStateFlow()

    private val _screenCleanState = MutableStateFlow(false)
    val screenCleanState: StateFlow<Boolean> = _screenCleanState.asStateFlow()

    //单聊对方麦克风是否静音
    val remoteMicMute: StateFlow<VideoLayoutInfo> = rtcManager.remoteMicMute
        .combine(rtcManager.isLocalShowInBigView){remoteMicMute,isLocalShowInBigView->
            VideoLayoutInfo()
        }
        .filter { callType.value == CallType.SINGLE_VIDEO_CALL && callState.value == CallState.CALL_ANSWERED }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(),
            initialValue = VideoLayoutInfo()
        )
    //本地麦克风是否静音
    val localMicMute: StateFlow<Boolean> = rtcManager.localMicMute

    //远端摄像头是否关闭
    val remoteVideoMute: StateFlow<VideoLayoutInfo> = rtcManager.remoteVideoMute.combine(rtcManager
        .isLocalShowInBigView){localVideoMute, isLocalShowInBigView ->
        VideoLayoutInfo(localMute=localVideoMute, isLocalShowInBigView = isLocalShowInBigView)
    }.filter {
        CallKitClient.callType.value == CallType.SINGLE_VIDEO_CALL && CallKitClient.callState.value == CallState.CALL_ANSWERED
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(),
        initialValue = VideoLayoutInfo(remoteVideoMute = false)
    )

    //本地摄像头是否关闭
    val localVideoMute: StateFlow<VideoLayoutInfo> =
        combine(
            rtcManager.localVideoMute,
            rtcManager.isLocalShowInBigView,
            CallKitClient.rtcManager.localUid
        ){ localVideoMute, isLocalShowInBigView ,localUid->
        VideoLayoutInfo(localMute=localVideoMute, isLocalShowInBigView = isLocalShowInBigView, localUid = localUid) }
            .filter {
        CallKitClient.callType.value == CallType.SINGLE_VIDEO_CALL }
            .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(),
        initialValue = VideoLayoutInfo(localMute = false)
    )

    // 是否开启扬声器
    val isSpeakerOn: StateFlow<Boolean> = rtcManager.isSpeakerOn

    // 是否开启摄像头
    val isCameraOn: StateFlow<Boolean> = rtcManager.localVideoMute

    // 是否前置摄像头
    val isFrontCamera: StateFlow<Boolean> = rtcManager.isFrontCamera

    // 远程用户ID
    val remoteUid: StateFlow<Int?> = rtcManager.remoteUid.filter {
        CallKitClient.callType.value == CallType.SINGLE_VIDEO_CALL
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(),
        initialValue = null
    )

    // 通话时长（秒）
    val callDuration: StateFlow<Long> = rtcManager.connectedTime

    init {
        CallKitClient.rtcManager.initializeEngine()
    }

    fun setupLocalVideo(textureView: TextureView, uid: Int = 0) {
        rtcManager.setupLocalVideo(textureView, uid)
    }

    fun setupRemoteVideo(textureView: TextureView, uid: Int = 0) {
        rtcManager.setupRemoteVideo(textureView, uid)
    }

    fun getUserInfoByUid(uid: Int) = flow {
        CallKitClient.getUserIdByUid(uid)?.let { userId ->
            val userInfo = CallKitClient.getCache().getUserInfoById(userId)
            userInfo.uid = uid
            emit(userInfo)
        } ?: run {
            ChatLog.e(TAG, "getUserInfoByUid: userId is null for uid $uid")
            emit(CallKitUserInfo(userId = "", uid = uid))
        }
    }

    fun changeCameraStatus() {
        rtcManager.changeCameraStatus()
    }

    fun changeMicStatus() {
        rtcManager.changeMicStatus()
    }

    fun toggleSpeaker() {
        rtcManager.setEnableSpeakerphone(!rtcManager.isSpeakerOn.value)
    }

    fun toggleCamera() {
        rtcManager.switchCamera()
    }

    fun endCall() {
        //这里音频、视频都可以共用CallType.SINGLE_VIDEO_CALL
        signalingManager.endCall(CallType.SINGLE_VIDEO_CALL)
    }

    fun answerCall() {
        signalingManager.answerCall()
    }

    fun refuseCall() {
        signalingManager.refuseCall()
    }

    fun cancelCall(calltyp: CallType) {
        signalingManager.cancelCall(calltyp)
    }

    override fun handleRequestFloatWindowPermissionCancel() {
        when (CallKitClient.callState.value) {
            CallState.CALL_OUTGOING -> {
                cancelCall(CallKitClient.callType.value)
            }

            CallState.CALL_ALERTING -> {
                refuseCall()
            }

            CallState.CALL_ANSWERED -> {
                endCall()
            }

            CallState.CALL_IDLE -> {
                ChatLog.e(TAG, "onBackPressed: callState is CALL_IDLE, no action taken")
            }
        }
    }

    fun switchVideoLayout() {
        rtcManager.switchVideoLayout()
    }

    fun getCallingUserInfo() = flow {
        emit(CallKitClient.getCache().getUserInfoById(CallKitClient.fromUserId))
    }

    /**
     * 显示悬浮窗（带权限检查）
     */
    fun showFloatWindow() {
        val context = CallKitClient.mContext
        if (PermissionHelper.hasFloatWindowPermission(context)) {
            val success = floatWindow.showFloatWindow()
            if (success) {
                // 悬浮窗显示成功，发送finish Activity事件
                sendUiEvent(CallUiEvent.FloatWindowShown)
            } else {
                ChatLog.e(TAG, "showFloatWindow failed, maybe the float window is already showing")
            }
        } else {
            // 发送权限请求事件
            sendUiEvent(CallUiEvent.FloatWindowPermissionRequired)
        }
    }

    /**
     * 隐藏悬浮窗
     */
    fun hideFloatWindow() {
        floatWindow.hideFloatWindow()
    }

    /**
     * 检查悬浮窗是否显示
     */
    fun isFloatWindowShowing(): Boolean {
        return floatWindow.isFloatWindowShowing()
    }

    fun setScreenCleanState(isClean: Boolean) {
        _screenCleanState.value = isClean
    }
    /**
     * UI状态流，包含所有UI需要的状态信息
     */
    val uiState = callState.combine(callType) { state, type ->
        CallUIState(
            callType = type,
            isIncoming = state == CallState.CALL_ALERTING,
            isConnected = state == CallState.CALL_ANSWERED,
            isOutgoing = state == CallState.CALL_OUTGOING
        )
    }

    /**
     * UI状态数据类，包含UI层需要的所有状态信息
     */
    data class CallUIState(
        val callType: CallType,
        val isIncoming: Boolean,
        val isConnected: Boolean,
        val isOutgoing: Boolean
    )

    /**
     * 视频布局状态数据类，包含视频窗口正反状态和远程用户ID
     */
    data class VideoLayoutInfo(
        val isLocalShowInBigView: Boolean = rtcManager.isLocalShowInBigView.value,
        val localUid: Int = rtcManager.localUid.value,
        val remoteUid: Int = rtcManager.remoteUid.value,
        val localMute: Boolean = rtcManager.localVideoMute.value,
        val remoteVideoMute: Boolean = rtcManager.remoteVideoMute.value,
        val remoteMicMute: Boolean = rtcManager.remoteMicMute.value
    )
}