package com.hyphenate.callkit.viewmodel

import android.view.TextureView
import androidx.lifecycle.viewModelScope
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.base.BaseViewModel
import com.hyphenate.callkit.bean.CallKitGroupInfo
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.PermissionHelper
import com.hyphenate.callkit.viewmodel.SingleCallViewModel.CallUIState
import kotlinx.coroutines.flow.*
import org.json.JSONObject

/**
 * \~chinese
 * 多人通话ViewModel，用于管理多人通话相关操作
 *
 * \~english
 * Multiple call ViewModel, used to manage multiple call related operations
 */
class MultipleCallViewModel : BaseViewModel() {

    private val TAG: String = MultipleCallViewModel::class.java.simpleName

    private val rtcManager = CallKitClient.rtcManager
    private val signalingManager = CallKitClient.signalingManager
    private  var floatWindow = CallKitClient.floatWindow

    // 通话状态
    private val _callState = CallKitClient.callState
    val callState: StateFlow<CallState> = _callState.asStateFlow()

    // 通话类型
    private val _callType = CallKitClient.callType
    val callType: StateFlow<CallType> = _callType.asStateFlow()

    // 参与者列表
    val participants: StateFlow<List<CallKitUserInfo>> =rtcManager.participants

    // 本地用户状态 - 直接从RtcManager获取
    val localMicEnabled: StateFlow<Boolean> = rtcManager.localMicMute.map { !it }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(), true)

    val localVideoEnabled: StateFlow<Boolean> = rtcManager.localVideoMute.map { !it }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(), true)

    val isSpeakerOn: StateFlow<Boolean> = rtcManager.isSpeakerOn

    val isFrontCamera: StateFlow<Boolean> = rtcManager.isFrontCamera

    // 通话时长（秒）
    val callDuration: StateFlow<Long> = rtcManager
        .connectedTime
        .filter { callState.value!= CallState.CALL_ALERTING }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(), 0L)

    // 扩展信息
    private val _inviteExt = MutableStateFlow<JSONObject?>(null)
    val inviteExt: StateFlow<JSONObject?> = _inviteExt.asStateFlow()

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

    init {
        rtcManager.initializeEngine()
    }

    /**
     * 设置本地视频视图
     */
    fun setupLocalVideo(textureView: TextureView, uid: Int = 0) {
        rtcManager.setupLocalVideo(textureView, uid)
    }

    /**
     * 设置远程视频视图
     */
    fun setupRemoteVideo(textureView: TextureView, uid: Int) {
        rtcManager.setupRemoteVideo(textureView, uid)
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
        signalingManager.endCall(CallType.GROUP_CALL)
    }
    /**
     * 发送应答消息
     */
    fun answerCall() {
        signalingManager.answerCall()
    }

    /**
     * 发送拒绝消息
     */
    fun refuseCall() {
        signalingManager.refuseCall()
    }

    override  fun handleRequestFloatWindowPermissionCancel() {
        when(CallKitClient.callState.value){
            CallState.CALL_OUTGOING->{
                endCall()
            }
            CallState.CALL_ALERTING -> {
                refuseCall()
            }
            CallState.CALL_ANSWERED -> {
                endCall()
            }
            CallState.CALL_IDLE ->{
                ChatLog.e(TAG, "onBackPressed: callState is CALL_IDLE, no action taken")
            }
        }
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

    override fun onCleared() {
        super.onCleared()
        // 清理资源
    }

    fun getCallingGroupInfo()= flow{
        CallKitClient.getCache().getGroupInfoById(CallKitClient.groupId)?.let {
            emit(CallKitGroupInfo(it.groupID,it.groupName,it.groupAvatar))
        }
    }

    fun inviteMembers(selectedMembers: ArrayList<String>) {
        // 直接发送邀请消息
        CallKitClient.inviteeUsers.addAll(selectedMembers)
        //此时作为主叫
        CallKitClient.isComingCall=false
        signalingManager.sendInviteMsg(selectedMembers, CallType.GROUP_CALL)
    }
}