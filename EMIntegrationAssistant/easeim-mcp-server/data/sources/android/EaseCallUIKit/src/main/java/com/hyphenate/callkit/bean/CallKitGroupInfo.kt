package com.hyphenate.callkit.bean

/**
 * \~chinese
 * 群信息
 *
 * \~english
 * Group information
 */
data class CallKitGroupInfo(
    val groupID: String,
    val groupName: String? = null,
    val groupAvatar: String? = null
)
