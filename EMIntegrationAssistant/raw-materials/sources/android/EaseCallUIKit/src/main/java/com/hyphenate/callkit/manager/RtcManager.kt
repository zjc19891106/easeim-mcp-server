package com.hyphenate.callkit.manager

import android.content.Context
import android.text.TextUtils
import android.view.TextureView
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.CallKitClient.CallErrorType
import com.hyphenate.callkit.CallKitClient.callKitListener
import com.hyphenate.callkit.CallKitClient.callType
import com.hyphenate.callkit.CallKitClient.channelName
import com.hyphenate.callkit.CallKitClient.getCurrentUserID
import com.hyphenate.callkit.CallKitClient.getRtcAppID
import com.hyphenate.callkit.CallKitClient.getRtcToken
import com.hyphenate.callkit.CallKitClient.getUserIdByUid
import com.hyphenate.callkit.CallKitClient.rtcConfigProvider
import com.hyphenate.callkit.CallKitClient.signalingManager
import com.hyphenate.callkit.bean.CallEndReason
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.bean.NetworkQuality
import com.hyphenate.callkit.interfaces.getRtcToken
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.TimerUtils.startTimer
import com.hyphenate.callkit.utils.TimerUtils.stopTimer
import com.hyphenate.chat.EMRTCTokenInfo
import io.agora.rtc2.ChannelMediaOptions
import io.agora.rtc2.Constants
import io.agora.rtc2.IRtcEngineEventHandler
import io.agora.rtc2.RtcEngine
import io.agora.rtc2.video.VideoCanvas
import io.agora.rtc2.video.VideoEncoderConfiguration
import io.agora.rtc2.video.VideoEncoderConfiguration.VD_1280x720
import io.agora.rtc2.video.VideoEncoderConfiguration.VideoDimensions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext


/**
 * \~chinese
 * RTC引擎管理器
 * 统一管理Agora RTC引擎，包括加入频道、离开频道、视频管理、音频管理、网络质量、频道成员管理等
 *
 * \~english
 * RTC engine manager
 * Manage Agora RTC engine, including joining channels, leaving channels, video management, audio management, network quality, channel member management, etc.
 */
class RtcManager {

    companion object {
        private const val TAG = "Callkit RtcManager"
    }

    private lateinit var mContext: Context
    // RTC引擎实例，对外只读
    var rtcEngine: RtcEngine? = null
        private set
    // 远程用户ID
    private val _remoteUid = MutableStateFlow<Int>(0)
    val remoteUid: StateFlow<Int> = _remoteUid.asStateFlow()

    // 本地用户ID
    private val _localUid = MutableStateFlow<Int>(0)
    val localUid: StateFlow<Int> = _localUid.asStateFlow()

    // 远程用户摄像头是否关闭
    private val _remoteVideoMute = MutableStateFlow<Boolean>(true)
    val remoteVideoMute: StateFlow<Boolean> = _remoteVideoMute.asStateFlow()

    // 本地用户摄像头是否关闭
    private val _localVideoMute = MutableStateFlow<Boolean>(false)
    val localVideoMute: StateFlow<Boolean> = _localVideoMute.asStateFlow()

    // 本地麦克风是否静音
    private val _localMicMute = MutableStateFlow(false)
    val localMicMute: StateFlow<Boolean> = _localMicMute.asStateFlow()

    // 远端麦克风是否静音
    private val _remoteMicMute = MutableStateFlow(false)
    val remoteMicMute: StateFlow<Boolean> = _remoteMicMute.asStateFlow()

    // 是否前置摄像头
    private val _isFrontCamera = MutableStateFlow(true)
    val isFrontCamera: StateFlow<Boolean> = _isFrontCamera.asStateFlow()

    // 是否开启扬声器
    private val _isSpeakerOn = MutableStateFlow<Boolean>(true)
    val isSpeakerOn: StateFlow<Boolean> = _isSpeakerOn.asStateFlow()

    // 通话时间
    private val _connectedTime = MutableStateFlow(0L)
    val connectedTime: StateFlow<Long> = _connectedTime.asStateFlow()

    // 视频窗口正反状态 true:本地视频显示在大窗口，远程视频显示在小窗口 false:反之
    private val _isLocalShowInBigView = MutableStateFlow(true)
    val isLocalShowInBigView: StateFlow<Boolean> = _isLocalShowInBigView.asStateFlow()

    // 参与者列表
    private val _participants = MutableStateFlow<List<CallKitUserInfo>>(emptyList())
    val participants: StateFlow<List<CallKitUserInfo>> = _participants.asStateFlow()

    // RTC引擎事件处理器
    private val rtcEventHandler = object : IRtcEngineEventHandler() {
        override fun onError(err: Int) {
            super.onError(err)
            ChatLog.d(TAG, "IRtcEngineEventHandler onError:" + err)
            callKitListener?.onCallError(CallErrorType.RTC_ERROR,err,"RTC error")
            CallKitClient.exitCall()
        }

        override fun onJoinChannelSuccess(channel: String?, uid: Int, elapsed: Int) {
            super.onJoinChannelSuccess(channel, uid, elapsed)
            ChatLog.d(TAG, "onJoinChannelSuccess: channel=$channel, uid=$uid")
            _localUid.value=uid

            if (callType.value == CallType.GROUP_CALL){
                startAnsweringTimer()
            }
            setEnableSpeakerphone(true)

            // 添加本地用户到参与者列表
            addLocalUserToParticipants(uid)
        }

        override fun onUserJoined(uid: Int, elapsed: Int) {
            super.onUserJoined(uid, elapsed)
            ChatLog.d(TAG, "User joined: uid=$uid")
            // 添加远程用户到参与者列表
            addRemoteUserToParticipants(uid)
            if (callType.value != CallType.GROUP_CALL){
                _isLocalShowInBigView.value = false
                startAnsweringTimer()
            }
        }

        override fun onUserOffline(uid: Int, reason: Int) {
            super.onUserOffline(uid, reason)
            ChatLog.d(TAG, "User offline: uid=$uid, reason=$reason")
            onUserOfflineCallBack(uid,reason)
        }

        override fun onRemoteVideoStateChanged(uid: Int, state: Int, reason: Int, elapsed: Int) {
            super.onRemoteVideoStateChanged(uid, state, reason, elapsed)
            _remoteUid.value = uid

            val videoEnabled = when (state) {
                Constants.REMOTE_VIDEO_STATE_STOPPED -> false
                Constants.REMOTE_VIDEO_STATE_DECODING, Constants.REMOTE_VIDEO_STATE_STARTING -> true
                else -> true
            }

            // 更新参与者的视频状态
            updateParticipantVideoState(uid, videoEnabled)

            if (callType.value!= CallType.GROUP_CALL) {
                _remoteVideoMute.value = !videoEnabled
            }

            ChatLog.d(TAG, "Remote video state changed: uid=$uid, state=$state, reason=$reason"+ ", videoEnabled=$videoEnabled")
        }

        override fun onUserMuteVideo(uid: Int, muted: Boolean) {
            super.onUserMuteVideo(uid, muted)
            // 更新参与者的视频状态
            updateParticipantVideoState(uid, !muted)
            ChatLog.d(TAG, "Remote video state changed: uid=$uid, muted=$muted")
        }

        override fun onRemoteAudioStateChanged(uid: Int, state: Int, reason: Int, elapsed: Int) {
            super.onRemoteAudioStateChanged(uid, state, reason, elapsed)
            _remoteUid.value = uid

            val audioEnabled = when (state) {
                Constants.REMOTE_AUDIO_STATE_STOPPED -> false
                Constants.REMOTE_AUDIO_STATE_DECODING, Constants.REMOTE_AUDIO_STATE_STARTING -> true
                else -> false
            }

            // 更新参与者的音频状态
            updateParticipantAudioState(uid, audioEnabled)

            ChatLog.d(TAG, "Remote audio state changed: uid=$uid, state=$state, reason=$reason")
        }

        override fun onUserMuteAudio(uid: Int, muted: Boolean) {
            super.onUserMuteAudio(uid, muted)
            if (callType.value!= CallType.GROUP_CALL) {
                ChatLog.d(TAG,"_remoteMicMute.value="+_remoteMicMute.value+",onUserMuteAudio muted=$muted")
                _remoteMicMute.value = muted
            }
        }

        override fun onLeaveChannel(stats: RtcStats?) {
            super.onLeaveChannel(stats)
            ChatLog.d(TAG, "Leave channel")
            // 清空参与者列表
            clearParticipants()
        }


        override fun onNetworkQuality(uid: Int, txQuality: Int, rxQuality: Int) {
            super.onNetworkQuality(uid, txQuality, rxQuality)

            // 将Agora的网络质量转换为我们的枚举
            val quality = when (Math.max(txQuality, rxQuality)) {
                0 -> NetworkQuality.UNKNOWN    // 未知
                1, 2 -> NetworkQuality.GOOD    // 优秀、良好
                3 -> NetworkQuality.POOR    // 较差
                4 -> NetworkQuality.WORSE    // 比较差
                else -> NetworkQuality.NONE     // 极差、网络断开
            }
            // 更新参与者的网络质量
            updateParticipantNetworkQuality(uid, quality)

        }

        override fun onAudioVolumeIndication(speakers: Array<out AudioVolumeInfo>?, totalVolume: Int) {
            super.onAudioVolumeIndication(speakers, totalVolume)
            speakers?.forEach { speaker ->
                val isSpeaking = speaker.volume > 10 // 音量阈值，可根据需要调整
                //如果speak uid ==0,表明是本地用户，则取 localUid
                val speakerUid = if (speaker.uid == 0) localUid.value else speaker.uid
                updateParticipantSpeakingState(speakerUid, isSpeaking)
            }
        }

        override fun onRequestToken() {
            super.onRequestToken()
            //token已经过期
            CallKitClient.callKitScope.launch {
                CallKitClient.getCache().rtcTokenInfo.remove(getCurrentUserID())
                getToken()?.let {
                    rtcEngine?.renewToken(it.rtcToken)
                    ChatLog.d(TAG, "onRequestToken:Token renewed successfully")
                } ?: run {
                    ChatLog.e(TAG, "onRequestToken:Failed to renew token")
                    callKitListener?.onCallError(CallErrorType.RTC_ERROR, 0, "Failed to renew token")
                    CallKitClient.exitCall()
                }
            }
        }

        override fun onTokenPrivilegeWillExpire(token: String?) {
            super.onTokenPrivilegeWillExpire(token)
            //token即将过期
            CallKitClient.callKitScope.launch {
                CallKitClient.getCache().rtcTokenInfo.remove(getCurrentUserID())
                getToken()?.let {
                    rtcEngine?.renewToken(it.rtcToken)
                    ChatLog.d(TAG, "onTokenPrivilegeWillExpire:Token renewed successfully")
                } ?: run {
                    ChatLog.e(TAG, "onTokenPrivilegeWillExpire:Failed to renew token")
                }
            }
        }
    }

    internal fun init(context: Context){
        this.mContext = context.applicationContext
        //上滑顶部悬浮窗后显示小窗
        CallKitClient.callKitScope.launch {
            CallKitClient.incomingCallTopWindow.dismissEventFlow.collect {
                withContext(Dispatchers.Main){
                    CallKitClient.floatWindow.showFloatWindow()
                }
            }
        }
    }
    @Synchronized
    private fun doAddRemoteUserToParticipants(userInfo: CallKitUserInfo) {
        callKitListener?.onRemoteUserJoined(userInfo.userId, callType.value, channelName ?: "")
        val currentParticipants = _participants.value.toMutableList()
        // 检查是否已存在，避免重复添加
        val existingIndex = currentParticipants.indexOfFirst { it.userId == userInfo.userId }
        if (existingIndex >= 0) {
            currentParticipants[existingIndex] = userInfo
        } else {
            currentParticipants.add(userInfo)
        }
        _participants.value = currentParticipants
        ChatLog.d(TAG, "Added remote user to participants:$userInfo")
    }

    @Synchronized
    internal fun onUserOfflineCallBack(uid: Int, reason: Int) {
        // 从参与者列表中移除用户
        if(!removeUserFromParticipants(uid)){
            return
        }
        if (callType.value == CallType.GROUP_CALL) {
            val userId = CallKitClient.cache.getUser(uid)?.userId
            if (TextUtils.isEmpty(userId)){
                ChatLog.e(TAG, "onUserOfflineCallBack: userId is null for uid=$uid")
                return
            }
            callKitListener?.onRemoteUserLeft(userId?:"", callType.value, channelName?:"")

        } else {
            // 1v1通话，对方离开就结束通话
            val reasonVar=if (reason== Constants.USER_OFFLINE_DROPPED) {
                CallEndReason.CallEndReasonRemoteDrop
            } else {
                CallEndReason.CallEndReasonHangup
            }
            signalingManager.updateMessage(connectedTime.value,  reasonVar)
            callKitListener?.onEndCallWithReason(
                reasonVar,
                signalingManager.callInfo
            )
            CallKitClient.exitCall()
        }
    }

    /**
     * 添加本地用户到参与者列表
     */
    private fun addLocalUserToParticipants(uid: Int) {
        CallKitClient.callKitScope.launch {
            // 尝试从缓存或用户提供者获取用户信息
            val localUserInfo = CallKitClient.getCache().getUserInfoById(getCurrentUserID())
            localUserInfo.uid = uid
            localUserInfo.isVideoEnabled = !localVideoMute.value // 默认开启
            localUserInfo.isMicEnabled = !localMicMute.value   // 默认开启
            localUserInfo.connected = true      // 远端用户加入频道成功时设置为true
            localUserInfo.networkQuality= NetworkQuality.GOOD
            doAddLocalUserToParticipants(localUserInfo)
        }
    }
    @Synchronized
    private fun doAddLocalUserToParticipants(localUserInfo: CallKitUserInfo){
        val currentParticipants = _participants.value.toMutableList()
        // 检查是否已存在，避免重复添加
        val existingIndex = currentParticipants.indexOfFirst { it.uid == localUserInfo.uid || it.uid == 0 }
        if (existingIndex >= 0) {
            currentParticipants[existingIndex] = localUserInfo
        } else {
            currentParticipants.add(localUserInfo)
        }
        _participants.value = currentParticipants
        ChatLog.d(TAG, "Added local user to participants: uid=${localUserInfo.uid}, userId=${localUserInfo.userId}")
    }

    /**
     * 添加远程用户到参与者列表
     */
    private fun addRemoteUserToParticipants(uid: Int=0) {
        CallKitClient.callKitScope.launch {
            val userId = getUserIdByUid(uid)
            if (userId != null) {
                // 尝试从缓存或用户提供者获取用户信息
                val userInfo = CallKitClient.getCache().getUserInfoById(userId)
                userInfo.uid = uid
                userInfo.isVideoEnabled = if (callType.value == CallType.GROUP_CALL) false else true
                userInfo.isMicEnabled = true   // 默认开启
                userInfo.connected = true      // 远端用户加入频道成功时设置为true
                doAddRemoteUserToParticipants(userInfo)
            }else{
                ChatLog.e(TAG,"addRemoteUserToParticipants userId = null")
            }
        }
    }

    /**
     * 从参与者列表中移除用户
     */
    @Synchronized
    internal fun removeUserFromParticipants(uid: Int) : Boolean{
        val currentParticipants = _participants.value.toMutableList()
        val removedUser = currentParticipants.find { it.uid == uid }
        if (removedUser == null) {
            ChatLog.e(TAG, "User to remove not found in participants: uid=$uid")
            return false
        }
        currentParticipants.removeAll { it.uid == uid }
        _participants.value = currentParticipants
        ChatLog.d(TAG, "Removed user from participants: uid=$uid, userId=${removedUser?.userId}")
        return true
    }

    /**
     * 更新参与者的视频状态
     */
    private fun updateParticipantVideoState(uid: Int, enabled: Boolean) {
        ChatLog.d(TAG, "updateParticipantVideoState: uid=$uid, enabled=$enabled")
        CallKitClient.callKitScope.launch {
            val userId = getUserIdByUid(uid)
            doUpdateParticipantVideoState(userId,uid,enabled)
        }
    }
    @Synchronized
    private fun doUpdateParticipantVideoState(userId:String?,uid: Int, enabled: Boolean){
        val currentParticipants = _participants.value.toMutableList()
        ChatLog.d(TAG, "Current participants before update: ${currentParticipants}")
        val index = currentParticipants.indexOfFirst { it.userId == userId }
        if (index >= 0) {
            currentParticipants[index] = currentParticipants[index].copy(isVideoEnabled = enabled, uid = uid, connected = true)
            _participants.value = currentParticipants
            ChatLog.d(TAG, "Current participants after update: ${currentParticipants}")
        }
    }

    /**
     * 更新参与者的音频状态
     */
    @Synchronized
    private fun updateParticipantAudioState(uid: Int, enabled: Boolean) {
        val currentParticipants = _participants.value.toMutableList()
        val index = currentParticipants.indexOfFirst { it.uid == uid }
        if (index >= 0) {
            currentParticipants[index] = currentParticipants[index].copy(isMicEnabled = enabled)
            if (!enabled){
                currentParticipants[index].isSpeaking=false
            }
            _participants.value = currentParticipants
            ChatLog.d(TAG, "Updated audio state for uid=$uid, enabled=$enabled")
        }
    }

    /**
     * 更新参与者的说话状态
     */
    @Synchronized
    private fun updateParticipantSpeakingState(uid: Int, speaking: Boolean) {
        val currentParticipants = _participants.value.toMutableList()
        val index = currentParticipants.indexOfFirst { it.uid == uid }
        if (index >= 0) {
            currentParticipants[index] = currentParticipants[index].copy(isSpeaking = speaking)
            _participants.value = currentParticipants
//            ChatLog.v(TAG, "Updated speaking state for uid=$uid, speaking=$speaking")
        }
    }

    /**
     * 更新参与者的网络质量
     */
    @Synchronized
    private fun updateParticipantNetworkQuality(uid: Int, quality: NetworkQuality) {
        val currentParticipants = _participants.value.toMutableList()
        val index = currentParticipants.indexOfFirst { it.uid == uid }
        if (index >= 0) {
            currentParticipants[index] = currentParticipants[index].copy(networkQuality = quality)
            _participants.value = currentParticipants
        }
    }

    /**
     * 更新本地用户的视频状态
     */
    private fun updateLocalVideoState(enabled: Boolean) {
        val localUid = _localUid.value
        updateParticipantVideoState(localUid, enabled)
    }

    /**
     * 更新本地用户的音频状态
     */
    private fun updateLocalAudioState(enabled: Boolean) {
        val localUid = _localUid.value
        if (localUid != 0) {
            updateParticipantAudioState(localUid, enabled)
        }
    }

    private var answeringTimerJob: Job? = null

    internal fun startAnsweringTimer() {
        answeringTimerJob?.cancel()
        answeringTimerJob = startTimer {time->
            _connectedTime.value= time.toLong()
            signalingManager.callInfo?.callTime= time.toLong()
        }
    }

    internal fun stopAnsweringTimer() {
        stopTimer(answeringTimerJob)
        answeringTimerJob = null
    }


    /**
     * \~chinese
     * 初始化RTC引擎
     *
     * \~english
     * Initialize RTC engine
     */
    @Synchronized
    internal fun initializeEngine(): Boolean{

        if (rtcEngine!=null){
            return true
        }
        var agoraAppId = rtcConfigProvider?.onSyncGetAppId()
        if (agoraAppId.isNullOrEmpty()){
            agoraAppId =getRtcAppID()
        }
        if (agoraAppId.isNullOrEmpty()){
            ChatLog.e(TAG, "Agora App ID is null or empty")
            callKitListener?.onCallError(CallErrorType.IM_ERROR, 0, "Agora App ID is null or empty")
            CallKitClient.exitCall()
            return false
        }
        rtcEngine = RtcEngine.create(mContext.applicationContext, agoraAppId, rtcEventHandler)
        // 设置为直播模式，角色为主播
        rtcEngine?.setChannelProfile(Constants.CHANNEL_PROFILE_LIVE_BROADCASTING)
        rtcEngine?.setClientRole(Constants.CLIENT_ROLE_BROADCASTER)
        rtcEngine?.enableInEarMonitoring(true)
        rtcEngine?.adjustRecordingSignalVolume(200)
        callKitListener?.onRtcEngineCreated(rtcEngine!!)
        //避免音频状态时部分机型摄像头弹起
        if (callType.value != CallType.SINGLE_VOICE_CALL){
            // 启用视频模块
            rtcEngine?.enableVideo()
            // 开启本地预览
            rtcEngine?.startPreview()
            if (callType.value== CallType.SINGLE_VIDEO_CALL){
                setLocalVideoMute(false)
            }else{
                setLocalVideoMute(true)
                // 启用音量指示器（用于多人通话）
                rtcEngine?.enableAudioVolumeIndication(500, 3, false)
            }
            //配置
            val configuration=  VideoEncoderConfiguration()
            configuration.orientationMode=VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_FIXED_PORTRAIT
            configuration.dimensions= VD_1280x720
            configuration.frameRate = VideoEncoderConfiguration.FRAME_RATE.FRAME_RATE_FPS_30.value
            rtcEngine?.setVideoEncoderConfiguration(configuration)
        }
        ChatLog.d(TAG, "RTC engine initialized successfully")
        return true
    }

    /**
     * \~chinese
     * 设置本地视频
     *
     * \~english
     * Setup local video
     */
    fun setupLocalVideo(surfaceView: TextureView?,uid: Int = 0) {
        rtcEngine?.let { engine ->
            surfaceView?.let { view ->
                val videoCanvas = VideoCanvas(view, VideoCanvas.RENDER_MODE_HIDDEN, uid)
                engine.setupLocalVideo(videoCanvas)
                ChatLog.d(TAG, "setupLocalVideo: $uid")
            }
        }?: run {
            ChatLog.e(TAG, "RTC engine is not initialized")
        }
    }

    /**
     * \~chinese
     * 设置远程视频
     *
     * \~english
     * Setup remote video
     */
    fun setupRemoteVideo(surfaceView: TextureView?,uid: Int = 0) {
        rtcEngine?.let { engine ->
            surfaceView?.let { view ->
                val videoCanvas = VideoCanvas(view, VideoCanvas.RENDER_MODE_HIDDEN, uid)
                engine.setupRemoteVideo(videoCanvas)
                ChatLog.d(TAG, "setupRemoteVideo: $uid")
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
    @Synchronized
    fun joinChannel(channelName: String, userAccount: String? = null) {
        if (!initializeEngine()){
            ChatLog.e(TAG,"initializeEngine() failed")
            return
        }
        CallKitClient.callKitScope.launch {
                getToken()?.let {
                    rtcEngine?.let { engine ->
                        val result = when {
                            !userAccount.isNullOrEmpty() -> engine.joinChannelWithUserAccount(
                                it.rtcToken,
                                channelName,
                                userAccount
                            )
                            else -> {
                                if (CallKitClient.callKitConfig.disableRTCTokenValidation){
                                    ChatLog.d(TAG, "joinChannel disableRTCTokenValidation is true, joinChannel without token")
                                    engine.joinChannel(null, channelName, null, it.uid)
                                }else{
                                    engine.joinChannel(it.rtcToken, channelName, null, it.uid)
                                }
                            }
                        }
                        ChatLog.d(TAG, "Joining channel: $channelName" + ", userAccount=$userAccount, uid=${it.uid},result=$result")

                    }?:run{
                        ChatLog.e(TAG, "joinChannel rtcEngine is null")
                    }
                }?:run {
                ChatLog.e(TAG, "Failed to get RTC token for channel: $channelName")
                callKitListener?.onCallError(CallErrorType.RTC_ERROR,0, "Failed to get RTC token")
                CallKitClient.exitCall()
                return@launch
            }
        }
    }

    /**
     * \~chinese
     * 获取RTC Token
     *
     * \~english
     * Get RTC Token
     */
    private suspend fun getToken(): EMRTCTokenInfo? {
        return rtcConfigProvider?.getRtcToken(channelName)?:getRtcToken(null)
    }

    /**
     * \~chinese
     * 切换摄像头
     *
     * \~english
     * Switch camera
     */
    fun switchCamera() {
        if (localVideoMute.value){
            ChatLog.e(TAG, "switchCamera: local video is muted, cannot switch camera")
            return
        }
        _isFrontCamera.value = !_isFrontCamera.value
        rtcEngine?.switchCamera()
    }

    /**
     * \~chinese
     * 设置扬声器
     *
     * \~english
     * Set speakerphone
     */
    fun setEnableSpeakerphone(enabled: Boolean) {
        if (_isSpeakerOn.value == enabled) return
        rtcEngine?.setEnableSpeakerphone(enabled)
        _isSpeakerOn.value = enabled
    }


    /**
     * \~chinese
     * 设置后台模式,对应配置rtc engine 的参数
     * 在应用进入后台时调用，优化性能和资源使用
     *
     * \~english
     * Set background mode, corresponding to the parameters of rtc engine
     * Call when the application enters the background to optimize performance and resource usage
     */
    fun enableBackgroundMode() {
        try {
            rtcEngine?.let { engine ->
                ChatLog.d(TAG, "Enabling background mode")

                // 对于视频通话，在后台时降低视频质量以节省资源
                if (callType.value == CallType.SINGLE_VIDEO_CALL ||
                    callType.value == CallType.GROUP_CALL) {

                    //  设置非常低的视频编码配置以节省CPU和网络
                    engine.setVideoEncoderConfiguration(
                        VideoEncoderConfiguration(
                            VideoEncoderConfiguration.VD_640x480,
                            VideoEncoderConfiguration.FRAME_RATE.FRAME_RATE_FPS_15,
                            VideoEncoderConfiguration.STANDARD_BITRATE,
                            VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_FIXED_PORTRAIT
                        )
                    )
                    ChatLog.d(TAG, "Applied aggressive optimization for background video mode")
                } else {
                    ChatLog.d(TAG, "Applied optimization for background voice mode")
                }

                engine.setParameters("{\"che.audio.enable.agc\":false}")  // 关闭自动增益控制节省CPU

                ChatLog.d(TAG, "Background mode enabled successfully")
            }
        } catch (e: Exception) {
            ChatLog.e(TAG, "Error enabling background mode: ${e.message}")
        }
    }

    /**
     * \~chinese
     * 设置前台模式,对应配置rtc engine 的参数
     * 在应用回到前台时调用，恢复正常质量
     *
     * \~english
     * Set foreground mode, corresponding to the parameters of rtc engine
     * Call when the application returns to the foreground to restore normal quality
     */
    fun enableForegroundMode() {
        try {
            rtcEngine?.let { engine ->
                ChatLog.d(TAG, "Enabling foreground mode")

                // 对于视频通话，恢复正常视频质量
                if (callType.value != CallType.SINGLE_VOICE_CALL) {
                    // 1. 配置
                    val configuration=  VideoEncoderConfiguration()
                    configuration.orientationMode=VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_FIXED_PORTRAIT
                    configuration.dimensions= VD_1280x720
                    configuration.frameRate = VideoEncoderConfiguration.FRAME_RATE.FRAME_RATE_FPS_30.value
                    rtcEngine?.setVideoEncoderConfiguration(configuration)
                    // 2. 恢复高质量流订阅
                    if (callType.value== CallType.SINGLE_VIDEO_CALL){
                        engine.setDualStreamMode(Constants.SimulcastStreamMode.AUTO_SIMULCAST_STREAM)
                        engine.setRemoteVideoStreamType(_remoteUid.value, Constants.VideoStreamType.VIDEO_STREAM_HIGH)
                    }else{
                        engine.setDualStreamMode(Constants.SimulcastStreamMode.ENABLE_SIMULCAST_STREAM)
                        participants.value.filter { it.userId!= getCurrentUserID() }.forEach {
                            engine.setRemoteVideoStreamType(it.uid, Constants.VideoStreamType.VIDEO_STREAM_LOW)

                        }
                    }

                    ChatLog.d(TAG, "Restored high quality for foreground video mode")
                } else {
                    ChatLog.d(TAG, "Restored high quality for foreground voice mode")
                }
                // 4. 重新启用自动增益控制
                engine.setParameters("{\"che.audio.enable.agc\":true}")

                ChatLog.d(TAG, "Foreground mode enabled successfully")
            }
        } catch (e: Exception) {
            ChatLog.e(TAG, "Error enabling foreground mode: ${e.message}")
        }
    }
    /**
     * \~chinese
     * 更改摄像头状态。开启->关闭，关闭->开启。
     * 根据本地视频状态切换摄像头
     *
     * \~english
     * Switch camera status. Open -> Close, Close -> Open.
     * Switch camera based on the local video status
     */
    fun changeCameraStatus() {
        ChatLog.d(TAG, "changeCameraStatus: muteLocalVideoStream ${localVideoMute.value}")
        if (localVideoMute.value) {
            // 如果本地视频是关闭状态，则开启
            rtcEngine?.enableLocalVideo(true)
            val mediaOptions = ChannelMediaOptions().apply {
                publishCameraTrack = true
            }
            rtcEngine?.updateChannelMediaOptions(mediaOptions)
        } else {
            // 如果本地视频是开启状态，则关闭
            rtcEngine?.enableLocalVideo(false)
        }
        // 移除手动设置状态，只依赖 onLocalVideoStateChanged 回调来更新状态
         _localVideoMute.value = !_localVideoMute.value
         // 更新participants中本地用户的视频状态
         updateLocalVideoState(!_localVideoMute.value)
    }

    /**
     * \~chinese
     * 设置本地视频是否开启
     *
     * \~english
     * Set local video mute
     */
    fun setLocalVideoMute(mute: Boolean) {
        if (mute == localVideoMute.value) return
        rtcEngine?.enableLocalVideo(!mute)
        _localVideoMute.value = mute
        // 更新participants中本地用户的视频状态
        updateLocalVideoState(!mute)
        ChatLog.d(TAG, "setLocalVideoMute: $mute")
    }

    /**
     * \~chinese
     * 切换麦克风状态
     *
     * \~english
     * Switch microphone status
     */
    fun changeMicStatus() {
        ChatLog.e(TAG, "changeMicStatus: muteLocalAudioStream ${_localMicMute.value}")
        rtcEngine?.enableLocalAudio(localMicMute.value)
        _localMicMute.value = !_localMicMute.value
        // 更新participants中本地用户的音频状态
        updateLocalAudioState(!_localMicMute.value)
    }

    /**
     * \~chinese
     * 切换视频布局，本地视频是否显示在大窗口
     *
     * \~english
     * Switch the video layout, whether the local video is displayed in the big window
     */
    fun switchVideoLayout() {
        _isLocalShowInBigView.value= !_isLocalShowInBigView.value
    }

    /**
     * \~chinese
     * 设置参与者列表
     *
     * \~english
     * Set participants list
     */
    @Synchronized
    fun setParticipants(participants: List<CallKitUserInfo>) {
        _participants.value = participants
        ChatLog.d(TAG, "Set participants: $participants")
    }

    /**
     * \~chinese
     * 移除参与者
     *
     * \~english
     * Remove participant
     */
    @Synchronized
    fun removeParticipant(userId: String?) {
        val currentParticipants = _participants.value.toMutableList()
        currentParticipants.removeAll { it.userId == userId }
        _participants.value = currentParticipants
    }

    @Synchronized
    private fun clearParticipants() {
        _participants.value = emptyList()
    }


    /**
     * \~chinese
     * 销毁RTC引擎
     *
     * \~english
     * Destroy RTC engine
     */
    @Synchronized
    fun destroyEngine() {
        CallKitClient.callKitScope.launch {
            try {
                rtcEngine?.let {
                    ChatLog.d(TAG, "RTC engine destroyed")
                    rtcEngine = null
                    it.leaveChannel()
                    RtcEngine.destroy()
                }
            } catch (e: Exception) {
                ChatLog.e(TAG, "Error destroying RTC engine "+e.message)
            }
        }
    }

    /**
     * \~chinese
     * 退出通话，重置相关状态、资源等
     *
     * \~english
     * Exit call, reset related status, resources, etc.
     */
    internal fun exitCall() {
        stopAnsweringTimer()
        destroyEngine()
        _localVideoMute.value=false
        _localMicMute.value=false
        _remoteUid.value=0
        _localUid.value=0
        _isLocalShowInBigView.value=true
        _remoteVideoMute.value=true
        _remoteMicMute.value=false
        _isFrontCamera.value = true
        _isSpeakerOn.value =true
        _connectedTime.value=0L
        clearParticipants()
    }
}