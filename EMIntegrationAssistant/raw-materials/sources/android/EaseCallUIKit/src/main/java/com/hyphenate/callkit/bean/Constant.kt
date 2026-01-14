package com.hyphenate.callkit.bean

/**
 * \~chinese
 * CallKit常量类，包含CallKit的各项常量
 *
 * \~english
 * CallKit constant class, contains various constants of CallKit
 */
object Constant {
    /**
     * \~chinese
     * 多人音视频通话最大人数
     * 默认值为16人
     *
     * \~english
     * Maximum number of participants in a multi-person audio and video call
     * Default value is 16 people
     */
    const val MAX_NUMBER_OF_CHANNEL=16
    const val PERMISSION_REQ_ID: Int = 22
    const val FLOAT_WINDOW_PERMISSION_REQUEST_CODE = 100
    const val CALL_ACTION = "action"
    const val CALL_CHANNELNAME = "channelName"
    const val CALL_TYPE = "type"
    const val CALL_DEVICE_ID = "callerDevId"
    const val CALLED_DEVICE_ID = "calleeDevId"
    const val CALLED_TRANSE_VOICE = "videoToVoice"

    const val CLL_ID = "callId"
    const val CLL_TIMESTRAMEP = "ts"
    const val CALL_MSG_TYPE = "msgType"
    const val CALL_STATUS = "status"
    const val CALL_RESULT = "result"
    const val CALL_MSG_INFO = "rtcCallWithAgora"

    const val CALL_ANSWER_BUSY = "busy"
    const val CALL_ANSWER_ACCEPT = "accept"
    const val CALL_ANSWER_REFUSE = "refuse"

    const val CALL_INVITE_EXT = "ext"
    const val CALL_GROUPINFO = "callkitGroupInfo"

    const val CALL_CALLER_NICKNAME = "callerNickname"

    const val CALL_GROUP_ID = "groupId"
    const val CALL_GROUP_NAME = "groupName"
    const val CALL_GROUP_AVATAR = "groupAvatar"

    const val MESSAGE_EXT_USER_INFO_KEY = "ease_chat_uikit_user_info"

    const val MESSAGE_EXT_USER_INFO_NICKNAME_KEY = "nickname"

    const val MESSAGE_EXT_USER_INFO_AVATAR_KEY = "avatarURL"

    const val EXTRA_CONVERSATION_ID = "conversationId"

    const val EM_PUSH_EXT = "em_push_ext"

    const val EM_APNS_EXT = "em_apns_ext"

    const val CALL_INVITE_INTERVAL = 30   // 主叫超时时间(秒)
    const val CALL_INVITED_INTERVAL = 10   // 被叫超时时间(秒)
}