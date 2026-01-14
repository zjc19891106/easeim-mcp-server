package com.hyphenate.callkit.extension

import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.Constant
import com.hyphenate.callkit.bean.Constant.MESSAGE_EXT_USER_INFO_AVATAR_KEY
import com.hyphenate.callkit.bean.Constant.MESSAGE_EXT_USER_INFO_NICKNAME_KEY
import com.hyphenate.callkit.interfaces.CallbackImpl
import com.hyphenate.callkit.interfaces.OnError
import com.hyphenate.callkit.interfaces.OnProgress
import com.hyphenate.callkit.interfaces.OnSuccess
import com.hyphenate.callkit.interfaces.getSyncUser
import com.hyphenate.callkit.utils.ChatClient
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.ChatMessage
import com.hyphenate.callkit.utils.ChatMessageStatus
import org.json.JSONObject


/**
 * \~chinese
 * 发送消息
 * @param onSuccess 发送成功回调
 * @param onError 发送失败回调
 * @param onProgress 发送进度回调
 *
 * \~english
 * Send message
 * @param onSuccess success callback
 * @param onError error callback
 * @param onProgress progress callback
 */
fun ChatMessage.send(onSuccess: OnSuccess = {}
                     , onError: OnError = { _, _ ->}
                     , onProgress: OnProgress = {}) {
    // Set the message status callback by ChatMessage.
    // Should set callback before send message.
    setMessageStatusCallback(CallbackImpl(onSuccess, onError, onProgress))
    ChatClient.getInstance().chatManager().sendMessage(this)
}

/**
 * \~chinese
 * 添加用户信息到消息中
 * 
 * @param nickname 昵称
 * @param avatarUrl 头像URL
 * @param remark 备注

 * \~english
 * Add userinfo to message when sending message.
 * @param nickname nickname
 * @param avatarUrl avatar URL
 * @param remark remark
 */
internal fun ChatMessage.addUserInfo(nickname: String?, avatarUrl: String?) {
    if (nickname.isNullOrEmpty() && avatarUrl.isNullOrEmpty()) {
        return
    }
    val info = JSONObject()
    if (!nickname.isNullOrEmpty()) info.put(MESSAGE_EXT_USER_INFO_NICKNAME_KEY, nickname)
    if (!avatarUrl.isNullOrEmpty()) info.put(MESSAGE_EXT_USER_INFO_AVATAR_KEY, avatarUrl)
    setAttribute(Constant.MESSAGE_EXT_USER_INFO_KEY, info)
}

/**
 * \~chinese
 * 解析消息中的用户信息
 * @return 用户信息
 *
 * \~english
 * Parse userinfo from message when receiving a message.
 * @return user info
 */
internal fun ChatMessage.getUserInfo(): CallKitUserInfo? {
    CallKitClient.callInfoProvider?.getSyncUser(from)?.let {
        return it
    }
    var userInfo = CallKitUserInfo(from)
    try {
        getJSONObjectAttribute(Constant.MESSAGE_EXT_USER_INFO_KEY)?.let { info ->
            userInfo = CallKitUserInfo(
                userId = from,
                nickName = info.optString(MESSAGE_EXT_USER_INFO_NICKNAME_KEY),
                avatar = info.optString(MESSAGE_EXT_USER_INFO_AVATAR_KEY),
            )
        }
    }catch (e: Exception){
        ChatLog.e("ChatMessage", "Error parsing user info from message:) ${e.message}")
    }

    return userInfo
}


internal fun ChatMessage.isSuccess(): Boolean {
    return status() == ChatMessageStatus.SUCCESS
}

internal fun ChatMessage.isFail(): Boolean {
    return status() == ChatMessageStatus.FAIL
}

internal fun ChatMessage.inProgress(): Boolean {
    return status() == ChatMessageStatus.INPROGRESS
}





