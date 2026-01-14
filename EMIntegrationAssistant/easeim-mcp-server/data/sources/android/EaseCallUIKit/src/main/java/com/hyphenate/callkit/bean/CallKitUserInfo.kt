package com.hyphenate.callkit.bean

import com.hyphenate.callkit.utils.ChatLog

/**
 * \~chinese
 * CallKit用户信息数据类
 * @property nickName 用户昵称
 * @property avatar 用户头像（为本地绝对路径或者url）
 * @property userId 用户ID
 * @property uid agora uid
 * @property isVideoEnabled 视频是否开启
 * @property isMicEnabled 麦克风是否开启
 * @property isSpeaking 是否正在说话
 * @property networkQuality 网络质量
 * @property connected 连接状态，默认为false，自己设置为true，远端用户加入时设置为true
 *
 * \~english
 * CallKit user information data class
 * @property nickName user nickname
 * @property avatar user avatar (local absolute path or url)
 * @property userId user ID
 * @property uid agora uid
 * @property isVideoEnabled whether video is enabled
 * @property isMicEnabled whether microphone is enabled
 * @property isSpeaking whether user is speaking
 * @property networkQuality network quality
 * @property connected connection status, default is false, set to true when the user joins
 */
data class CallKitUserInfo(
    var userId: String,
    var nickName: String? = null,
    var avatar: String? = null,
    internal var uid: Int = -1,
    internal var isVideoEnabled: Boolean = true,
    internal var isMicEnabled: Boolean = true,
    internal var isSpeaking: Boolean = false,
    internal var networkQuality: NetworkQuality = NetworkQuality.GOOD,
    internal var connected: Boolean = false
) {
    fun getName(): String {
        var name=if (nickName.isNullOrEmpty()) userId else nickName?:""
        ChatLog.d("CallKitUserInfo", "getName: $name")
        return name
    }
}