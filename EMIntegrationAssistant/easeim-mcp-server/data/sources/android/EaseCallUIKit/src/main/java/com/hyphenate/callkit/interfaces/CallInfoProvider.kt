package com.hyphenate.callkit.interfaces

import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.CallKitGroupInfo
import com.hyphenate.callkit.bean.CallKitUserInfo
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * \~chinese
 * 用户信息提供者
 *
 * \~english
 * User info provider
 */
interface CallInfoProvider {

    /**
     * \~chinese
     * 异步方式根据userID列表给callkit提供用户信息，结果通过onValueSuccess回传给callkit。
     * @param userIds 用户列表
     * @param onValueSuccess 成功回调
     *
     * \~english
     * Asynchronously provide user information to CallKit based on a list of user IDs,the result is passed back to callkit through onValueSuccess.
     * @param userIds The user list
     * @param onValueSuccess The callback of success called by user.
     */
    fun asyncFetchUsers(userIds: List<String>, onValueSuccess: OnValueSuccess<List<CallKitUserInfo>>)

    /**
     * \~chinese
     * 异步方式根据groupID给callkit提供群信息，结果通过onValueSuccess回传给callkit。
     * @param groupId 群ID
     * @param onValueSuccess 成功回调
     *
     * \~english
     * Asynchronously provide group information to CallKit based on a group ID,the result is passed back to callkit through onValueSuccess.
     * @param groupId The group ID
     * @param onValueSuccess The callback of success called by user.
     */
    fun asyncFetchGroupInfo(groupId: String, onValueSuccess: OnValueSuccess<CallKitGroupInfo>)


}

/**
 * \~chinese
 * 挂起函数 异步获取用户信息
 * @param userIds 用户列表
 * @return 用户信息
 *
 * \~english
 * Suspended function for async fetching user information.
 * @param userIds user list
 * @return user info
 */
suspend fun CallInfoProvider.fetchUsersBySuspend(userIds: List<String>?): List<CallKitUserInfo> {
    return suspendCoroutine { continuation ->
        userIds?.let {
            asyncFetchUsers(it, onValueSuccess = { map ->
                continuation.resume(map)
            })
        }
    }
}
/**
 * \~chinese
 * 挂起函数 异步获取群组信息
 * @param groupID 群组ID
 * @return 群组对象
 *
 * \~english
 * Suspended function for async fetching group information.
 * @param groupID group ID
 * @return group object
 */
suspend fun CallInfoProvider.fetchChatGroupBySuspend(groupID: String?): CallKitGroupInfo {
    return suspendCoroutine { continuation ->
        groupID?.let {
            asyncFetchGroupInfo(it, onValueSuccess = { map ->
                continuation.resume(map)
            })
        }
    }
}

/**
 * \~chinese
 * 从缓存或用户提供的方法同步获取用户信息
 * @param userId 用户ID
 * @return 用户信息
 *
 * \~english
 * Sync get CallKitUserInfo by cache or sync method provided by user.
 * @param userId user ID
 * @return CallKitUserInfo
 */
fun CallInfoProvider.getSyncUser(userId: String?): CallKitUserInfo? {
    return CallKitClient.getCache().getUser(userId)
}