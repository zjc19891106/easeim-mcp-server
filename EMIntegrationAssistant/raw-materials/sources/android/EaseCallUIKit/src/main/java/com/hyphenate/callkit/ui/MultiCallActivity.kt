package com.hyphenate.callkit.ui

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.TextureView
import android.view.View
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import coil.load
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.CallType
import com.hyphenate.callkit.databinding.ActivityMultiVideoCallBinding
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.viewmodel.MultipleCallViewModel
import com.hyphenate.callkit.viewmodel.SingleCallViewModel
import com.hyphenate.callkit.widget.MultiVideoCallGridLayout
import com.hyphenate.callkit.widget.MultiVideoCallMemberView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.core.view.isNotEmpty
import com.hyphenate.callkit.base.BaseCallActivity
import com.hyphenate.callkit.bean.CallKitGroupInfo
import com.hyphenate.callkit.utils.ChatClient
import com.hyphenate.callkit.utils.TimerUtils.timeFormat
import io.agora.utils2.internal.Connectivity.isConnected

/**
 * \~chinese
 * 群组视频通话Activity
 * 使用MultiVideoCallGridLayout展示多个视频画面
 * 支持网格模式和聚焦模式切换
 *
 * \~english
 * Multi-person video call activity
 * Use MultiVideoCallGridLayout to display multiple video screens
 * Support grid mode and focus mode switching
 */
open class MultiCallActivity : BaseCallActivity<ActivityMultiVideoCallBinding>() {

    private val TAG = "Callkit MultiCallActivity"
    private lateinit var viewModel: MultipleCallViewModel
    private lateinit var gridLayout: MultiVideoCallGridLayout
    private var rootIds = mutableListOf<View>()
    private var participants: List<CallKitUserInfo>? = null

    // 存储用户视图的映射
    private val userViewMap = mutableMapOf<String, MultiVideoCallMemberView>()

    override fun getViewBinding(inflater: LayoutInflater): ActivityMultiVideoCallBinding {
        return ActivityMultiVideoCallBinding.inflate(inflater)
    }

    override fun initView(savedInstanceState: Bundle?) {
        // 初始化网格布局
        gridLayout = binding.videoGridLayout
        setupGridLayout()
    }

    override fun initData() {
        rootIds.clear()
        rootIds.addAll(
            listOf(
                binding.controlPanelIncomming.root,
                binding.controlPanelConnectedAndOutgoing.root,
                binding.callkitTitlebarView.ivAdd
            )
        )
        viewModel = getViewModel(MultipleCallViewModel::class.java, this)
        observeViewModel()
    }

    override fun initListener() {
        binding.callkitTitlebarView.ivAdd.setOnClickListener {
            // 使用startActivityForResult启动邀请成员页面
            val intent = SelectGroupMembersActivity.actionStart(
                this,
                CallKitClient.groupId,
                ArrayList(participants?.map { it.userId } ?: listOf()))
            startActivityForResult(intent, SelectGroupMembersActivity.REQUEST_CODE_INVITE_MEMBERS)
        }

        binding.callkitTitlebarView.ivFloat.setOnClickListener {
            //权限检查
            viewModel.showFloatWindow()
        }

        //视频来电页面
        binding.controlPanelIncomming.ivIncomingVideoAccept.setOnClickListener {
            viewModel.answerCall()
        }
        binding.controlPanelIncomming.ivIncomingVideoDecline.setOnClickListener {
            viewModel.refuseCall()
            finish()
        }
        binding.controlPanelIncomming.ivIncomingVideoCamera.setOnClickListener {
            // 开关摄像头
            viewModel.changeCameraStatus()
        }
        binding.controlPanelIncomming.ivIncomingVideoSpeaker.setOnClickListener {
            // 切换扬声器
            viewModel.toggleSpeaker()
        }
        binding.controlPanelIncomming.ivIncomingVideoMic.setOnClickListener {
            // 切换麦克风静音状态
            viewModel.changeMicStatus()
        }
        binding.controlPanelIncomming.ivIncomingVideoFlip.setOnClickListener {
            // 切换前后摄像头
            viewModel.toggleCamera()
        }


        //视频通话页面
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoEnd.setOnClickListener {
            //leaveChannel
            viewModel.endCall()
            finish()
        }
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoCamera.setOnClickListener {
            // 开关摄像头
            viewModel.changeCameraStatus()
        }
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoSpeaker.setOnClickListener {
            // 切换扬声器
            viewModel.toggleSpeaker()
        }
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoMic.setOnClickListener {
            // 切换麦克风静音状态
            viewModel.changeMicStatus()
        }
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoFlip.setOnClickListener {
            // 切换前后摄像头
            viewModel.toggleCamera()
        }
    }

    private fun setupGridLayout() {
        // 设置网格布局的点击监听器
        gridLayout.setOnItemClickListener(object : MultiVideoCallGridLayout.OnItemClickListener {
            override fun onItemClick(view: View, position: Int) {
                if (view is MultiVideoCallMemberView) {
                    ChatLog.d(TAG, "gridLayout onItemClick: position=$position, userId=${view.getUserInfo()?.userId}")
                    handleMemberViewClick(view)
                }
            }
        })

        // 设置间距
        gridLayout.setSpacing(8, 8)
    }

    /**
     * 处理成员视图点击事件
     */
    private fun handleMemberViewClick(memberView: MultiVideoCallMemberView) {
        when {
            gridLayout.isFocusMode() -> {
                // 如果是聚焦模式，点击大视图回到网格模式
                // 点击底部小视图切换聚焦
                if (memberView == gridLayout.getFocusedView()) {
                    gridLayout.switchToGridMode()
                } else {
                    // 这种情况在底部滚动视图中的点击已经在GridLayout中处理了
                    ChatLog.d(TAG, "handleMemberViewClick: memberView != gridLayout.getFocusedView() memberView=$memberView")
                }
            }

            else -> {
                // 网格模式，切换到聚焦模式
                gridLayout.switchToFocusMode(memberView)
            }
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
                    // 观察UI事件
                    viewModel.uiEvent.collect { event ->
                        withContext(Dispatchers.Main) {
                            handleUiEvent(event)
                        }
                    }
                }

                // 观察参与者列表变化
                launch {
                    viewModel.participants.collect { participants ->
                        withContext(Dispatchers.Main) {
                            ChatLog.d(TAG, "updateParticipants: $participants")
                            updateParticipants(participants)
                        }
                    }
                }
                // 观察通话时长变化
                launch {
                    viewModel.callDuration.collect { duration ->
                        withContext(Dispatchers.Main) {
                            updateCallDuration(duration)
                        }

                    }
                }
                //观察是否本地关闭摄像头
                launch {
                    viewModel.localVideoEnabled.collect { it ->
                        withContext(Dispatchers.Main) {
                            ChatLog.d(TAG, "localVideoEnabled: $it")
                            updateCameraButton(it)
                        }
                    }
                }

                launch {
                    // 观察静音状态
                    viewModel.localMicEnabled.collect { it ->
                        withContext(Dispatchers.Main) {
                            ChatLog.d(TAG, "localMicEnabled: $it")
                            updateMuteButton(it)
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

                //观察是否本地前置摄像头
                launch {
                    viewModel.isFrontCamera.collect { it ->
                        withContext(Dispatchers.Main) {
                            ChatLog.d(TAG, "isFrontCamera: $it")
                            updataFlipButton(it)
                        }
                    }
                }

                launch {
                    viewModel.getCallingGroupInfo().collect { it ->
                        withContext(Dispatchers.Main) {
                            ChatLog.d(TAG, "getCallingGroupInfo: $it")
                            updataGroupViews(it)
                        }
                    }
                }
            }
        }
    }

    private fun updataGroupViews(groupInfo: CallKitGroupInfo) {
        binding.callkitTitlebarView.tvUsername.text =
            if (groupInfo.groupName.isNullOrEmpty()) groupInfo.groupID else groupInfo.groupName
        binding.callkitTitlebarView.ivAvatar.load(groupInfo.groupAvatar) {
            placeholder(R.drawable.callkit_default_group_avatar)
            error(R.drawable.callkit_default_group_avatar)
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

    private fun showConnectedCallUI(callType: CallType) {
        binding.callkitTitlebarView.ivAdd.visibility = View.VISIBLE
        binding.controlPanelConnectedAndOutgoing.root.visibility = View.VISIBLE
        binding.flBig.removeAllViews()
    }

    private fun showOutgoingCallUI(callType: CallType) {
        binding.callkitTitlebarView.ivAdd.visibility = View.VISIBLE
        binding.controlPanelConnectedAndOutgoing.root.visibility = View.VISIBLE
        binding.flBig.removeAllViews()
    }

    private fun showIncomingCallUI(callType: CallType) {
        binding.controlPanelIncomming.root.visibility = View.VISIBLE
        binding.callkitTitlebarView.tvTime.text =
            getString(R.string.callkit_inviting_you_to_a_group_call)
        binding.flBig.visibility = View.VISIBLE
        if (binding.flBig.isNotEmpty()) {
            viewModel.setupLocalVideo(binding.flBig.getChildAt(0) as TextureView, 0)
        } else {
            // 如果本地视频视图不存在，创建一个新的TextureView
            val textureView = TextureView(this)
            binding.flBig.addView(textureView)
            viewModel.setupLocalVideo(textureView, 0)
        }

    }

    /**
     * 更新静音按钮
     */
    private fun updateMuteButton(enabled: Boolean) {
        binding.controlPanelIncomming.ivIncomingVideoMic.apply {
            setImageResource(if (enabled) R.drawable.callkit_mic_on else R.drawable.callkit_mic_off)
            setBackgroundResource(if (enabled) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.controlPanelIncomming.tvIncomingVideoMic.text =
            if (enabled) getString(R.string.callkit_mike_on) else getString(R.string.callkit_mike_off)
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoMic.apply {
            setImageResource(if (enabled) R.drawable.callkit_mic_on else R.drawable.callkit_mic_off)
            setBackgroundResource(if (enabled) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.controlPanelConnectedAndOutgoing.tvConnectedVideoMic.text =
            if (enabled) getString(R.string.callkit_mike_on) else getString(R.string.callkit_mike_off)
    }

    /**
     * 更新扬声器按钮
     */
    private fun updateSpeakerButton(isSpeakerOn: Boolean) {
        binding.controlPanelIncomming.ivIncomingVideoSpeaker.apply {
            setImageResource(if (isSpeakerOn) R.drawable.callkit_speaker_on else R.drawable.callkit_speaker_off)
            setBackgroundResource(if (isSpeakerOn) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.controlPanelIncomming.tvIncomingVideoSpeaker.text =
            if (isSpeakerOn) getString(R.string.callkit_speaker_on) else getString(R.string.callkit_speaker_off)
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoSpeaker.apply {
            setImageResource(if (isSpeakerOn) R.drawable.callkit_speaker_on else R.drawable.callkit_speaker_off)
            setBackgroundResource(if (isSpeakerOn) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.controlPanelConnectedAndOutgoing.tvConnectedVideoSpeaker.text =
            if (isSpeakerOn) getString(R.string.callkit_speaker_on) else getString(R.string.callkit_speaker_off)
    }

    /**
     * 更新翻转摄像头按钮
     */
    private fun updataFlipButton(isFrontCamera: Boolean) {
        binding.controlPanelIncomming.ivIncomingVideoFlip.apply {
            setImageResource(if (isFrontCamera) R.drawable.callkit_camera_front else R.drawable.callkit_camera_back)
            setBackgroundResource(if (isFrontCamera) R.color.callkit_button_off_background else R.color.callkit_button_on_background)
        }
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoFlip.apply {
            setImageResource(if (isFrontCamera) R.drawable.callkit_camera_front else R.drawable.callkit_camera_back)
            setBackgroundResource(if (isFrontCamera) R.color.callkit_button_off_background else R.color.callkit_button_on_background)
        }
    }

    /**
     * 更新摄像头按钮
     */
    private fun updateCameraButton(enabled: Boolean) {
        if (binding.flBig.isNotEmpty()){
            binding.flBig.getChildAt(0).visibility= if (enabled) View.VISIBLE else View.GONE
        }
        binding.controlPanelIncomming.ivIncomingVideoCamera.apply {
            setImageResource(if (enabled) R.drawable.callkit_video_camera_on else R.drawable.callkit_video_camera_off)
            setBackgroundResource(if (enabled) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.controlPanelIncomming.tvIncomingVideoCamera.text =
            if (enabled) getString(R.string.callkit_camera_on) else getString(R.string.callkit_camera_off)
        binding.controlPanelConnectedAndOutgoing.ivConnectedVideoCamera.apply {
            setImageResource(if (enabled) R.drawable.callkit_video_camera_on else R.drawable.callkit_video_camera_off)
            setBackgroundResource(if (enabled) R.color.callkit_button_on_background else R.color.callkit_button_off_background)
        }
        binding.controlPanelConnectedAndOutgoing.tvConnectedVideoCamera.text =
            if (enabled) getString(R.string.callkit_camera_on) else getString(R.string.callkit_camera_off)
    }

    /**
     * 更新参与者列表
     */
    private fun updateParticipants(participants: List<CallKitUserInfo>) {
        this.participants = participants
        // 移除不再存在的参与者
        val currentUserIds = participants.map { it.userId }.toSet()
        val toRemove = userViewMap.keys.filter { it !in currentUserIds }
        toRemove.forEach { userId ->
            userViewMap[userId]?.let { view ->
                gridLayout.removeVideoView(view)
                userViewMap.remove(userId)
            }
        }

        // 添加新的参与者或更新现有参与者的状态
        participants.forEach { userInfo ->
            var memberView = userViewMap[userInfo.userId]
            if (memberView == null) {
                // 创建新的参与者视图
                memberView = MultiVideoCallMemberView(this)
                memberView.setUserInfo(userInfo)
                userViewMap[userInfo.userId] = memberView
                gridLayout.addVideoView(memberView)
            } else {
                val visible= memberView.cslConnecting.visibility
                // 更新现有参与者的状态
                memberView.setVideoEnabled(userInfo.isVideoEnabled)
                memberView.setMicEnabled(userInfo.isMicEnabled)
                memberView.setSpeaking(userInfo.isSpeaking)
                memberView.setNetworkQuality(userInfo.networkQuality)
                memberView.setConnected(userInfo.connected)
                //有变化时才刷新顺序
                if (visible!=memberView.cslConnecting.visibility){
                    gridLayout.refreshSequence(memberView)
                }
            }

            // 设置视频视图
            if (userInfo.uid >= 0) {
                memberView.setVideoView { textureView ->
                    if (userInfo.uid == 0 || userInfo.userId == ChatClient.getInstance().currentUser) {
                        // 本地视频
                        viewModel.setupLocalVideo(textureView, userInfo.uid)
                    } else {
                        // 远程视频
                        viewModel.setupRemoteVideo(textureView, userInfo.uid)
                    }
                }
            }
        }

        // 如果当前聚焦的视图被移除，回到网格模式
        gridLayout.getFocusedView()?.let { focusedView ->
            if (focusedView is MultiVideoCallMemberView) {
                val focusedUserId = focusedView.getUserInfo()?.userId
                if (focusedUserId != null && focusedUserId !in currentUserIds) {
                    gridLayout.switchToGridMode()
                }
            }
        }
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


    /**
     * 处理返回键
     */
    override fun onBackPressed() {
        when {
            gridLayout.isFocusMode() -> {
                // 退出聚焦模式，回到网格模式
                gridLayout.switchToGridMode()
            }

            else -> {
                // 正常退出
                super.onBackPressed()
            }
        }
    }

    override fun handleRequestFloatWindowPermissionCancel() {
        viewModel.handleRequestFloatWindowPermissionCancel()
    }

    override fun onDestroy() {
        super.onDestroy()
        // 清理资源
        gridLayout.clearAllViews()
        userViewMap.clear()
    }

    /**
     * 处理Activity返回结果
     */
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == SelectGroupMembersActivity.REQUEST_CODE_INVITE_MEMBERS && resultCode == RESULT_OK) {
            data?.let { intent ->
                val selectedMembers =
                    intent.getStringArrayListExtra(SelectGroupMembersActivity.EXTRA_SELECTED_MEMBERS)
                selectedMembers?.let { members ->
                    // 处理选中的成员列表
                    handleSelectedMembers(members)
                }
            }
        }
    }

    /**
     * 处理选中的成员列表
     */
    private fun handleSelectedMembers(selectedMembers: ArrayList<String>) {
        ChatLog.d(TAG, "Selected members: $selectedMembers")
        viewModel.inviteMembers(selectedMembers)
    }
}