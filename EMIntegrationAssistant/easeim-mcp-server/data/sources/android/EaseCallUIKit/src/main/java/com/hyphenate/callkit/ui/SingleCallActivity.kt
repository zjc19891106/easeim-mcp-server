package com.hyphenate.callkit.ui

import android.R.attr.duration
import android.os.Bundle
import android.provider.SyncStateContract.Helpers.update
import android.view.LayoutInflater
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import coil.load
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.databinding.ActivitySingleCallBinding
import com.hyphenate.callkit.extension.dpToPx
import com.hyphenate.callkit.utils.CallKitUtils.setBgRadius
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.viewmodel.SingleCallViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.hyphenate.callkit.base.BaseCallActivity
import com.hyphenate.callkit.utils.TimerUtils.timeFormat

/**
 * \~chinese
 * 单人视频通话Activity
 *
 * \~english
 * Single-person video call activity
 */
open class SingleCallActivity : BaseCallActivity<ActivitySingleCallBinding>() {
    private var TAG = "Callkit SingleCallActivity"
    private lateinit var viewModel: SingleCallViewModel
    private var rootIds = mutableListOf<View>()

    override fun getViewBinding(inflater: LayoutInflater): ActivitySingleCallBinding? {
        return ActivitySingleCallBinding.inflate(inflater)
    }

    override fun initView(savedInstanceState: Bundle?) {
        setBgRadius(binding.flSmall, 12.dpToPx(mContext))
    }

    override fun initData() {
        rootIds.clear()
        rootIds.addAll(
            listOf(
                binding.viewOutgoingVoice.root,
                binding.viewOutgoingVideo.root,
                binding.viewIncomingVoice.root,
                binding.viewIncomingVideo.root,
                binding.viewConnectedVoice.root,
                binding.viewConnectedVideo.root,
                binding.flBig,
                binding.cslSmallContainer,
                binding.ivTopRemoteMicMute,
                binding.viewConnectedVideo.llBottomRemoteMicMute
            )
        )
        viewModel = getViewModel(SingleCallViewModel::class.java, this)
        observeViewModel()
    }

    override fun initListener() {
        binding.flBig.setOnClickListener {
            viewModel.setScreenCleanState(!viewModel.screenCleanState.value)
        }
        //音频来电页面
        binding.viewIncomingVoice.ivIncomingVoiceAccept.setOnClickListener {
            viewModel.answerCall()
        }
        binding.viewIncomingVoice.ivIncomingVoiceDecline.setOnClickListener {
            viewModel.refuseCall()
            finish()
        }

        //视频来电页面
        binding.viewIncomingVideo.ivIncomingVideoAccept.setOnClickListener {
            viewModel.answerCall()
        }
        binding.viewIncomingVideo.ivIncomingVideoDecline.setOnClickListener {
            viewModel.refuseCall()
            finish()
        }
        binding.viewIncomingVideo.ivIncomingVideoCamera.setOnClickListener {
            // 开关摄像头
            viewModel.changeCameraStatus()
        }
        binding.viewIncomingVideo.ivIncomingVideoSpeaker.setOnClickListener {
            // 切换扬声器
            viewModel.toggleSpeaker()
        }
        binding.viewIncomingVideo.ivIncomingVideoMic.setOnClickListener {
            // 切换麦克风静音状态
            viewModel.changeMicStatus()
        }
        binding.viewIncomingVideo.ivIncomingVideoFlip.setOnClickListener {
            // 切换前后摄像头
            viewModel.toggleCamera()
        }

        //视频拨打电话页面
        binding.viewOutgoingVideo.ivOutgoingVideoEnd.setOnClickListener {
            // 结束通话
            viewModel.cancelCall(CallType.SINGLE_VIDEO_CALL)
            finish()
        }
        binding.viewOutgoingVideo.ivOutgoingVideoCamera.setOnClickListener {
            // 开关摄像头
            viewModel.changeCameraStatus()
        }
        binding.viewOutgoingVideo.ivOutgoingVideoSpeaker.setOnClickListener {
            // 切换扬声器
            viewModel.toggleSpeaker()
        }
        binding.viewOutgoingVideo.ivOutgoingVideoMic.setOnClickListener {
            // 切换麦克风静音状态
            viewModel.changeMicStatus()
        }
        binding.viewOutgoingVideo.ivOutgoingVideoFlip.setOnClickListener {
            // 切换前后摄像头
            viewModel.toggleCamera()
        }

        //语音拨打电话页面
        binding.viewOutgoingVoice.ivOutgoingVoiceSpeaker.setOnClickListener {
            // 切换扬声器
            viewModel.toggleSpeaker()
        }
        binding.viewOutgoingVoice.ivOutgoingVoiceMic.setOnClickListener {
            // 切换麦克风静音状态
            viewModel.changeMicStatus()
        }
        binding.viewOutgoingVoice.ivOutgoingVoiceDecline.setOnClickListener {
            // 拒绝通话
            viewModel.cancelCall(CallType.SINGLE_VOICE_CALL)
            finish()
        }

        //视频通话页面
        binding.viewConnectedVideo.ivConnectedVideoEnd.setOnClickListener {
            viewModel.endCall()
            finish()
        }
        binding.viewConnectedVideo.ivConnectedVideoCamera.setOnClickListener {
            // 开关摄像头
            viewModel.changeCameraStatus()
        }
        binding.viewConnectedVideo.ivConnectedVideoSpeaker.setOnClickListener {
            // 切换扬声器
            viewModel.toggleSpeaker()
        }
        binding.viewConnectedVideo.ivConnectedVideoMic.setOnClickListener {
            // 切换麦克风静音状态
            viewModel.changeMicStatus()
        }
        binding.viewConnectedVideo.ivConnectedVideoFlip.setOnClickListener {
            // 切换前后摄像头
            viewModel.toggleCamera()
        }

        //语音通话页面
        binding.viewConnectedVoice.ivConnectedVoiceSpeaker.setOnClickListener {
            // 切换扬声器
            viewModel.toggleSpeaker()
        }
        binding.viewConnectedVoice.ivConnectedVoiceMic.setOnClickListener {
            // 切换麦克风静音状态
            viewModel.changeMicStatus()
        }
        binding.viewConnectedVoice.ivConnectedVoiceDecline.setOnClickListener {
            // 挂断通话
            viewModel.endCall()
            finish()
        }

        binding.cslSmallContainer.setOnClickListener {
            //视频窗口切换
            viewModel.switchVideoLayout()
        }

        binding.callkitTitlebarView.ivFloat.setOnClickListener {
            //权限检查
            viewModel.showFloatWindow()
        }
    }

    private fun observeViewModel() {

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.uiState.flowOn(Dispatchers.Main).collect { uiState ->
                        updateUI(uiState)
                    }
                }
                launch {
                    viewModel.getCallingUserInfo().flowOn(Dispatchers.Main).collect {
                        binding.callkitTitlebarView.tvUsername.text = it.getName()
                        binding.callkitTitlebarView.ivAvatar.load(it.avatar) {
                            placeholder(R.drawable.callkit_default_avatar)
                            error(R.drawable.callkit_default_avatar)
                        }
                    }
                }
                //观察是否本地关闭摄像头
                launch {
                    viewModel.localVideoMute.collect { it ->
                        withContext(Dispatchers.Main) {
                            ChatLog.d(TAG, "setupLocalVideo: $it")
                            updateCameraButton(it.localMute)
                            if (it.isLocalShowInBigView) {
                                setupLocalVideo(it.localMute, it.localUid, it.isLocalShowInBigView)
                            } else {
                                setupRemoteVideo(it.localMute, it.localUid, it.isLocalShowInBigView)
                            }
                        }
                    }
                }
                //观察是否本地前置摄像头
                launch {
                    viewModel.isFrontCamera.collect { it ->
                        withContext(Dispatchers.Main) {
                            ChatLog.d(TAG, "isFrontCamera: $it")
                            updataFlipButton(it)
                        }
                    }
                }
                //观察远端是否关闭摄像头
                launch {
                    viewModel.remoteVideoMute.collect {
                        withContext(Dispatchers.Main) {
                            ChatLog.d(TAG, "setupRemoteVideo: $it")
                            if (it.isLocalShowInBigView) {
                                setupRemoteVideo(
                                    it.remoteVideoMute,
                                    it.remoteUid,
                                    it.isLocalShowInBigView
                                )
                            } else {
                                setupLocalVideo(
                                    it.remoteVideoMute,
                                    it.remoteUid,
                                    it.isLocalShowInBigView
                                )
                            }
                        }
                    }
                }

                launch {
                    // 观察UI事件
                    viewModel.uiEvent.collect { event ->
                        withContext(Dispatchers.Main) {
                            handleUiEvent(event)
                        }
                    }
                }

                launch {
                    // 观察远端静音状态
                    viewModel.remoteMicMute.collect {
                        withContext(Dispatchers.Main) {
//                            updateRemoteMicMuteButton(it)
                        }
                    }
                }

                launch {
                    // 观察自己静音状态
                    viewModel.localMicMute.collect { isMuted ->
                        withContext(Dispatchers.Main) {
                            updateMuteButton(isMuted)
                        }
                    }
                }

                launch {
                    // 观察扬声器状态
                    viewModel.isSpeakerOn.collect { isSpeakerOn ->
                        withContext(Dispatchers.Main) {
                            updateSpeakerButton(isSpeakerOn)
                        }
                    }
                }

                launch {
                    // 观察通话时长
                    viewModel.callDuration.collect { duration ->
                        withContext(Dispatchers.Main) {
                            updateCallDuration(duration)
                        }
                    }
                }
                launch {
                    // 是否清屏
                    viewModel.screenCleanState.collect { isScreenClean ->
                        withContext(Dispatchers.Main) {
                           updateScreenCleanUI(isScreenClean)
                        }
                    }
                }
            }
        }
    }
    private fun updateScreenCleanUI(isScreenClean: Boolean){
        ChatLog.d(TAG,"updateScreenCleanUI isScreenClean=$isScreenClean")
        if (isScreenClean){
            binding.callkitTitlebarView.root.visibility = View.GONE
            binding.viewConnectedVideo.root.visibility = View.GONE
        }else{
            binding.callkitTitlebarView.root.visibility = View.VISIBLE
            binding.viewConnectedVideo.root.visibility = View.VISIBLE
        }
    }

    private fun updateRemoteMicMuteButton(info: SingleCallViewModel.VideoLayoutInfo){
        ChatLog.d(TAG,"updateRemoteMicMuteButton info=$info")
        if (info.isLocalShowInBigView){
            if (info.remoteMicMute){
                binding.ivTopRemoteMicMute.visibility = View.VISIBLE
            }else{
                binding.ivTopRemoteMicMute.visibility = View.GONE
            }
        }else{
            if (info.remoteMicMute){
                binding.viewConnectedVideo.llBottomRemoteMicMute.visibility = View.VISIBLE
            }else{
                binding.viewConnectedVideo.llBottomRemoteMicMute.visibility = View.GONE
            }
        }
    }

    private suspend fun setupUserAvatar(container: ViewGroup, uid: Int) {
        container.removeAllViews()
        viewModel.getUserInfoByUid(uid).flowOn(Dispatchers.Main).collect { userInfo ->
            // 使用 ImageView 显示用户头像
            val imageView = ImageView(applicationContext).apply {
                scaleType = ImageView.ScaleType.CENTER_CROP
            }
            // 使用 Coil 加载头像
            imageView.load(userInfo.avatar) {
                placeholder(R.drawable.callkit_video_default)
                error(R.drawable.callkit_video_default)
                crossfade(true)
            }
            container.addView(imageView,0)
        }
    }

    /**
     * 设置本地视频
     */
    private suspend fun setupLocalVideo(
        localMute: Boolean,
        uid: Int,
        isLocalShowInBigView: Boolean = true
    ) {
        if (localMute) {
            setupUserAvatar(binding.flBig, uid)
        } else {
            withContext(Dispatchers.Main){
                TextureView(applicationContext).apply {
                    if (isLocalShowInBigView) {
                        viewModel.setupLocalVideo(this, uid)
                    } else {
                        viewModel.setupRemoteVideo(this, uid)
                    }
                    binding.flBig.addView(this, 0)
                    binding.flBig.removeViews(1, binding.flBig.childCount - 1)
                }
            }
        }
    }

    /**
     * 设置远程视频
     */
    private suspend fun setupRemoteVideo(
        remoteMute: Boolean,
        uid: Int = 0,
        isLocalShowInBigView: Boolean = true
    ) {
        if (remoteMute) {
            setupUserAvatar(binding.flSmall, uid)
        } else {
            withContext(Dispatchers.Main){
                TextureView(applicationContext).apply {
                    if (isLocalShowInBigView) {
                        viewModel.setupRemoteVideo(this, uid)
                    } else {
                        viewModel.setupLocalVideo(this, uid)
                    }
                    binding.flSmall.addView(this, 0)
                    binding.flSmall.removeViews(1, binding.flSmall.childCount - 1)
                }
            }
        }
    }

    /**
     * 根据UI状态更新界面
     * @param uiState UI状态
     */
    private fun updateUI(uiState: SingleCallViewModel.CallUIState) {
        ChatLog.e(TAG, "updateUI: $uiState")

        resetRootUI(View.GONE)
        // 根据UI状态更新界面
        when {
            uiState.isIncoming -> {
                // 来电界面
                showIncomingCallUI(uiState.callType)
            }

            uiState.isOutgoing -> {
                // 拨打电话界面
                showOutgoingCallUI(uiState.callType)
            }

            uiState.isConnected -> {
                // 通话中界面
                showConnectedCallUI(uiState.callType)
            }

            else -> {
                // 空闲状态
                finish()
                CallKitClient.exitCall()
            }
        }
    }

    private fun showIncomingCallUI(callType: CallType) {
        // 显示来电界面
        when (callType) {
            CallType.SINGLE_VIDEO_CALL -> {
                binding.viewIncomingVideo.root.visibility = View.VISIBLE
                binding.flBig.visibility = View.VISIBLE
                binding.callkitTitlebarView.tvTime.text =
                    getString(R.string.callkit_inviting_you_to_a_video_call)
            }

            CallType.SINGLE_VOICE_CALL -> {
                binding.viewIncomingVoice.root.visibility = View.VISIBLE
                binding.callkitTitlebarView.tvTime.text =
                    getString(R.string.callkit_inviting_you_to_a_voice_call)
            }

            else -> {
                ChatLog.e(TAG, "Unsupported call type: $callType")
            }
        }

    }

    private fun showOutgoingCallUI(callType: CallType) {
        // 显示拨打电话界面
        when (callType) {
            CallType.SINGLE_VIDEO_CALL -> {
                binding.viewOutgoingVideo.root.visibility = View.VISIBLE
                binding.flBig.visibility = View.VISIBLE
            }

            CallType.SINGLE_VOICE_CALL -> {
                binding.viewOutgoingVoice.root.visibility = View.VISIBLE
            }

            else -> {
                ChatLog.e(TAG, "Unsupported call type: $callType")
            }
        }
        binding.callkitTitlebarView.tvTime.text = getString(R.string.callkit_connecting)
    }

    private fun showConnectedCallUI(callType: CallType) {
        // 显示通话中界面
        when (callType) {
            CallType.SINGLE_VIDEO_CALL -> {
                binding.flBig.visibility = View.VISIBLE
                binding.cslSmallContainer.visibility = View.VISIBLE
                if (!viewModel.screenCleanState.value){
                    binding.viewConnectedVideo.root.visibility = View.VISIBLE
                }
            }

            CallType.SINGLE_VOICE_CALL -> {
                binding.viewConnectedVoice.root.visibility = View.VISIBLE
            }

            else -> {
                ChatLog.e(TAG, "Unsupported call type: $callType")
            }
        }
    }


    /**
     * 更新静音按钮
     */
    private fun updateMuteButton(isMuted: Boolean) {
        binding.viewIncomingVideo.ivIncomingVideoMic.apply {
            setImageResource(if (!isMuted) R.drawable.callkit_mic_on else R.drawable.callkit_mic_off)
            setBackgroundResource(if (!isMuted) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewIncomingVideo.tvIncomingVideoMic.text =
            if (!isMuted) getString(R.string.callkit_mike_on) else getString(R.string.callkit_mike_off)
        binding.viewOutgoingVideo.ivOutgoingVideoMic.apply {
            setImageResource(if (!isMuted) R.drawable.callkit_mic_on else R.drawable.callkit_mic_off)
            setBackgroundResource(if (!isMuted) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewOutgoingVideo.tvOutgoingVideoMic.text =
            if (!isMuted) getString(R.string.callkit_mike_on) else getString(R.string.callkit_mike_off)
        binding.viewOutgoingVoice.ivOutgoingVoiceMic.apply {
            setImageResource(if (!isMuted) R.drawable.callkit_mic_on else R.drawable.callkit_mic_off)
            setBackgroundResource(if (!isMuted) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewOutgoingVoice.tvOutgoingVoiceMic.text =
            if (!isMuted) getString(R.string.callkit_mike_on) else getString(R.string.callkit_mike_off)
        binding.viewConnectedVideo.ivConnectedVideoMic.apply {
            setImageResource(if (!isMuted) R.drawable.callkit_mic_on else R.drawable.callkit_mic_off)
            setBackgroundResource(if (!isMuted) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewConnectedVideo.tvConnectedVideoMic.text =
            if (!isMuted) getString(R.string.callkit_mike_on) else getString(R.string.callkit_mike_off)
        binding.viewConnectedVoice.ivConnectedVoiceMic.apply {
            setImageResource(if (!isMuted) R.drawable.callkit_mic_on else R.drawable.callkit_mic_off)
            setBackgroundResource(if (!isMuted) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewConnectedVoice.tvConnectedVoiceMic.text =
            if (!isMuted) getString(R.string.callkit_mike_on) else getString(R.string.callkit_mike_off)
    }

    /**
     * 更新扬声器按钮
     */
    private fun updateSpeakerButton(isSpeakerOn: Boolean) {
        binding.viewIncomingVideo.ivIncomingVideoSpeaker.apply {
            setImageResource(if (isSpeakerOn) R.drawable.callkit_speaker_on else R.drawable.callkit_speaker_off)
            setBackgroundResource(if (isSpeakerOn) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewIncomingVideo.tvIncomingVideoSpeaker.text =
            if (isSpeakerOn) getString(R.string.callkit_speaker_on) else getString(R.string.callkit_speaker_off)
        binding.viewOutgoingVideo.ivOutgoingVideoSpeaker.apply {
            setImageResource(if (isSpeakerOn) R.drawable.callkit_speaker_on else R.drawable.callkit_speaker_off)
            setBackgroundResource(if (isSpeakerOn) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewOutgoingVideo.tvOutgoingVideoSpeaker.text =
            if (isSpeakerOn) getString(R.string.callkit_speaker_on) else getString(R.string.callkit_speaker_off)
        binding.viewOutgoingVoice.ivOutgoingVoiceSpeaker.apply {
            setImageResource(if (isSpeakerOn) R.drawable.callkit_speaker_on else R.drawable.callkit_speaker_off)
            setBackgroundResource(if (isSpeakerOn) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewOutgoingVoice.tvOutgoingVoiceSpeaker.text =
            if (isSpeakerOn) getString(R.string.callkit_speaker_on) else getString(R.string.callkit_speaker_off)
        binding.viewConnectedVideo.ivConnectedVideoSpeaker.apply {
            setImageResource(if (isSpeakerOn) R.drawable.callkit_speaker_on else R.drawable.callkit_speaker_off)
            setBackgroundResource(if (isSpeakerOn) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewConnectedVideo.tvConnectedVideoSpeaker.text =
            if (isSpeakerOn) getString(R.string.callkit_speaker_on) else getString(R.string.callkit_speaker_off)
        binding.viewConnectedVoice.ivConnectedVoiceSpeaker.apply {
            setImageResource(if (isSpeakerOn) R.drawable.callkit_speaker_on else R.drawable.callkit_speaker_off)
            setBackgroundResource(if (isSpeakerOn) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.viewConnectedVoice.tvConnectedVoiceSpeaker.text =
            if (isSpeakerOn) getString(R.string.callkit_speaker_on) else getString(R.string.callkit_speaker_off)
    }

    /**
     * 更新翻转摄像头按钮
     */
    private fun updataFlipButton(isFrontCamera: Boolean) {
        binding.viewIncomingVideo.ivIncomingVideoFlip.apply {
            setImageResource(if (isFrontCamera) R.drawable.callkit_camera_front else R.drawable.callkit_camera_back)
            setBackgroundResource(if (isFrontCamera) R.color.callkit_button_off_background else R.color.callkit_button_on_background)
        }
        binding.viewOutgoingVideo.ivOutgoingVideoFlip.apply {
            setImageResource(if (isFrontCamera) R.drawable.callkit_camera_front else R.drawable.callkit_camera_back)
            setBackgroundResource(if (isFrontCamera) R.color.callkit_button_off_background else R.color.callkit_button_on_background)
        }
        binding.viewConnectedVideo.ivConnectedVideoFlip.apply {
            setImageResource(if (isFrontCamera) R.drawable.callkit_camera_front else R.drawable.callkit_camera_back)
            setBackgroundResource(if (isFrontCamera) R.color.callkit_button_off_background else R.color.callkit_button_on_background)
        }
    }

    /**
     * 更新摄像头按钮
     */
    private fun updateCameraButton(mute: Boolean) {
        binding.viewIncomingVideo.ivIncomingVideoCamera.apply {
            setImageResource(if (mute) R.drawable.callkit_video_camera_off else R.drawable.callkit_video_camera_on)
            setBackgroundResource(if (mute) R.color.callkit_button_off_background else R.color.callkit_button_on_background)
        }
        binding.viewIncomingVideo.tvIncomingVideoCamera.text =
            if (mute) getString(R.string.callkit_camera_off) else getString(R.string.callkit_camera_on)
        binding.viewOutgoingVideo.ivOutgoingVideoCamera.apply {
            setImageResource(if (mute) R.drawable.callkit_video_camera_off else R.drawable.callkit_video_camera_on)
            setBackgroundResource(if (mute) R.color.callkit_button_off_background else R.color.callkit_button_on_background)
        }
        binding.viewOutgoingVideo.tvOutgoingVideoCamera.text =
            if (mute) getString(R.string.callkit_camera_off) else getString(R.string.callkit_camera_on)
        binding.viewConnectedVideo.ivConnectedVideoCamera.apply {
            setImageResource(if (mute) R.drawable.callkit_video_camera_off else R.drawable.callkit_video_camera_on)
            setBackgroundResource(if (mute) R.color.callkit_button_off_background else R.color.callkit_button_on_background)
        }
        binding.viewConnectedVideo.tvConnectedVideoCamera.text =
            if (mute) getString(R.string.callkit_camera_off) else getString(R.string.callkit_camera_on)
    }

    /**
     * 更新通话时长
     */
    private fun updateCallDuration(duration: Long) {
        binding.callkitTitlebarView.tvTime.text = duration.timeFormat()
    }

    private fun resetRootUI(visibility: Int) {
        // 重置UI状态
        rootIds.forEach { it.visibility = visibility }
    }

    override fun handleRequestFloatWindowPermissionCancel() {
        viewModel.handleRequestFloatWindowPermissionCancel()
    }

}