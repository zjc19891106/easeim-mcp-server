package com.hyphenate.callkit.utils

import android.util.Log
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.CallKitGroupInfo
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.NetworkQuality
import com.hyphenate.callkit.interfaces.fetchChatGroupBySuspend
import com.hyphenate.callkit.interfaces.fetchUsersBySuspend
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap
import kotlin.collections.isNotEmpty
import kotlin.coroutines.resume

/**
 * \~chinese
 * 通话缓存
 * 用于缓存通话相关信息，包括用户信息、群组信息、rtcTokenInfo等
 *
 * \~english
 * Call cache
 * Used to cache call related information, including user information, group information, rtcTokenInfo, etc.
 */
class CallKitCache {
    companion object {
        private const val TAG = "ChatUIKitCache"
    }
    internal val userInfoMap: ConcurrentMap<String, CallKitUserInfo> = ConcurrentHashMap()
    // Cache the group info. The key is the groupId, the value is the group info.
    internal val groupInfoMap: ConcurrentMap<String, CallKitGroupInfo> = ConcurrentHashMap()

    internal var rtcTokenInfo: ConcurrentMap<String,RTCTokenInfo> = ConcurrentHashMap()
    /**
     * \~chinese
     * 初始化缓存
     *
     * \~english
     * Initialize cache
     */
    fun init() {
        cleanUp()
    }

    /**
     * \~chinese
     * 插入用户信息
     *
     * \~english
     * Insert user information
     */
    fun insertUser(user: CallKitUserInfo?) {
        user?.let{
            userInfoMap[it.userId] = it
        }

    }

    /**
     * \~chinese
     * 插入群组信息
     *
     * \~english
     * Insert group information
     */
    fun insertGroup(groupId: String?, groupInfo: CallKitGroupInfo?) {
        if (groupId.isNullOrEmpty()) {
            ChatLog.e(TAG, "insertGroup: groupId is null or empty")
            return
        }
        groupInfoMap[groupId] = groupInfo
    }
    /**
     * \~chinese
     * 根据用户ID从缓存中获取用户信息
     *
     * \~english
     * Get user information by user id from cache
     */
    fun getUser(userId: String?): CallKitUserInfo? {
        if (userId.isNullOrEmpty()) {
            return null
        }
        return userInfoMap[userId]
    }
    /**
     * \~chinese
     * 根据用户ID从缓存中获取用户信息
     *
     * \~english
     * Get user information by user id from cache
     */
    fun getUser(uid: Int): CallKitUserInfo? {
        val map = userInfoMap.filter { it.value.uid == uid }
        return map.values.firstOrNull()
    }

    /**
     * \~chinese
     * 根据群组ID从缓存中获取群组信息
     *
     * \~english
     * Get group information by group id from cache
     */
    private fun getGroup(groupId: String?): CallKitGroupInfo? {
        if (groupId.isNullOrEmpty()) {
            return null
        }
        return groupInfoMap[groupId]
    }

    /**
     * \~chinese
     * 更新群组信息
     *
     * \~english
     * Update group information
     */
    fun updateGroup(groups: List<CallKitGroupInfo>) {
        if (groups.isNotEmpty()) {
            groups.forEach {
                groupInfoMap[it.groupID] = it
            }
        }
    }

    /**
     * \~chinese
     * 更新缓存中用户信息
     *
     * \~english
     * Update user information in cache
     */
    fun updateUserInfo(userInfos: List<CallKitUserInfo>) {
        if (userInfos.isNotEmpty()) {
            userInfos.forEach {
                userInfoMap[it.userId] = it
            }
        }
    }

    /**
     * \~chinese
     * 挂起函数，根据用户ID获取用户信息
     * 先从缓存中获取，获取到返回数据。
     * 如果没有获取到，就从 ChatUIKitUserProfileProvider 异步方法中获取，获取到返回数据。
     * 如果没有获取到，就返回一个 CallKitUserInfo 对象，用户ID为传入的参数。
     *
     * \~english
     * Suspend function, get CallKitUserInfo by user id
     * 1. Get data from cache first, if get data return data.
     * 2. If not get data, get data from ChatUIKitUserProfileProvider#asyncfetchUsers, if get data return data.
     * 3. If not get data, return a CallKitUserInfo object with the user id.
     */
    suspend fun getUserInfoById(userID: String): CallKitUserInfo {
        if (userID.isEmpty()) {
            ChatLog.e(TAG, "getUserInfoById: userID is empty"+ Log.getStackTraceString(Throwable()))
            return CallKitUserInfo(userID)
        }
        
        // 1. 先从缓存获取
        val cachedUser = getUser(userID)
        if (cachedUser != null) {
            return cachedUser
        }
        
        // 2. 从callInfoProvider获取
        val fetchedUser = getUserInfoFromProvider(userID)
        if (fetchedUser != null) {
            insertUser(fetchedUser)
            return fetchedUser
        }
        val callKitUserInfo = CallKitUserInfo(userID)
        insertUser(callKitUserInfo)
        return callKitUserInfo
    }
    
    /**
     * \~chinese
     * 挂起函数，根据用户ID从 ChatUIKitUserProfileProvider#asyncfetchUsers 异步函数中获取用户信息
     *
     * \~english
     * Suspend function, get CallKitUserInfo by user id from ChatUIKitUserProfileProvider#asyncfetchUsers
     */
    suspend fun getUserInfoFromProvider(userId: String): CallKitUserInfo? {
        return CallKitClient.callInfoProvider?.fetchUsersBySuspend(listOf(userId))?.firstOrNull()
    }

    /**
     * \~chinese
     * 挂起函数，根据用户ID列表批量获取用户信息
     * 先从缓存中获取，获取到返回数据。
     * 如果没有获取到，就从 ChatUIKitUserProfileProvider 异步方法中获取，获取到返回数据。
     * 如果没有获取到，就返回一个 CallKitUserInfo 对象，用户ID为传入的参数。
     *
     * \~english
     * Suspend function, get CallKitUserInfo by user ids
     * 1. Get data from cache first, if get data return data.
     * 2. If not get data, get data from ChatUIKitUserProfileProvider#asyncfetchUsers, if get data return data.
     * 3. If not get data, return a CallKitUserInfo object with the user id.
     */
    suspend fun getUserInfosByIds(userIds: List<String>): List<CallKitUserInfo> {
        val userInfos = mutableListOf<CallKitUserInfo>()
        val needFetchUserIds = mutableListOf<String>()
        
        userIds.forEach { id ->
            // 1. 先从缓存获取
            val cachedUser = getUser(id)
            if (cachedUser != null) {
                userInfos.add(cachedUser)
                return@forEach
            }
            // 2. 记录需要批量获取的用户ID
            needFetchUserIds.add(id)
        }
        
        // 3. 批量获取未处理的用户
        if (needFetchUserIds.isNotEmpty()) {
            val fetchedUsers = CallKitClient.callInfoProvider?.fetchUsersBySuspend(needFetchUserIds)
            if (fetchedUsers != null) {
                fetchedUsers.forEach {
                    insertUser(it)
                    userInfos.add(it)
                }
                // 移除已获取到的用户ID
                fetchedUsers.forEach { fetchedUser ->
                    needFetchUserIds.remove(fetchedUser.userId)
                }
            }
            // 4. 为剩余未获取到的用户创建兜底对象
            needFetchUserIds.forEach { userId ->
                val callKitUserInfo = CallKitUserInfo(userId)
                insertUser(callKitUserInfo)
                userInfos.add(callKitUserInfo)
            }
        }
        return userInfos
    }


    /**
     * \~chinese
     * 挂起函数，根据群组ID获取群组信息
     * 先从缓存中获取，获取到返回数据。
     * 如果没有获取到，就从callInfoProvider获取，获取到返回数据。
     * 如果没有获取到，就调用 EMGroupManager#getGroup 从本地获取，获取到返回数据。
     * 如果没有获取到，就调用 EMGroupManager.asyncGetGroupFromServer 从服务端获取，获取到返回数据。
     * 如果没有获取到，就返回null
     *
     * \~english
     * Suspend function, get CallKitGroupInfo by group id
     * Gets data from cache first, if get data return data.
     * If not get data, get data by callInfoProvider, if get data return data.
     * If not get data, get data by EMGroupManager#getGroup from local, if get data return data.
     * If not get data, get data by EMGroupManager#asyncGetGroupFromServer from server, if get data return data.
     * If not get data, return null.
     */
    suspend fun getGroupInfoById(groupId: String): CallKitGroupInfo?{
        if (groupId.isEmpty()) {
            return null
        }

        // 1. 先从缓存获取
        val cachedGroup = getGroup(groupId)
        if (cachedGroup != null) {
            return cachedGroup
        }
        // 2.从callInfoProvider获取
        val fetchedGroup = CallKitClient.callInfoProvider?.fetchChatGroupBySuspend(groupId)
        if (fetchedGroup != null) {
            insertGroup(groupId, fetchedGroup)
            return fetchedGroup
        }
        // 3. 从本地获取
        val localGroup = ChatClient.getInstance().groupManager().getGroup(groupId)
        if (localGroup != null) {
            // 更新缓存
            var callkitInfo=CallKitGroupInfo(localGroup.groupId,localGroup.groupName,localGroup.groupAvatar)
            insertGroup(groupId,callkitInfo )
            return callkitInfo
        }

        // 4. 从服务器拉取
        val serverGroup = getGroupFromServer(groupId)
        if (serverGroup != null) {
            insertGroup(groupId, serverGroup)
            return serverGroup
        }
        return null
    }
    
    /**
     * \~chinese
     * 从服务器获取群组信息的挂起函数
     *
     * \~english
     * Suspend function, get CallKitGroupInfo by group id from server
     */
    private suspend fun getGroupFromServer(groupId: String): CallKitGroupInfo? {
        return suspendCancellableCoroutine { continuation ->
            ChatClient.getInstance().groupManager().asyncGetGroupFromServer(
                groupId,
                object : ChatValueCallback<ChatGroup> {
                    override fun onSuccess(group: ChatGroup?) {
                        if (group!=null){
                            continuation.resume(CallKitGroupInfo(group.groupId,group.groupName,group.groupAvatar))
                        }else{
                            continuation.resume(null)
                        }
                    }
                    override fun onError(error: Int, errorMsg: String?) {
                        ChatLog.e(TAG, "Error getting group from server: $errorMsg")
                        continuation.resume(null)
                    }
                }
            )
        }
    }

    /**
     * \~chinese
     * 重置数据状态，用于通话结束时重置数据
     *
     * \~english
     * Reset data
     */
    fun resetData(){
//        userInfoMap.values.forEach {
//            it.connected=false
//            it.isVideoEnabled=false
//            it.isMicEnabled=true
//            it.isSpeaking=false
//            it.networkQuality= NetworkQuality.UNKNOWN
//            it.uid=-1
//        }
        userInfoMap.clear()
    }

    /**
     * \~chinese
     * 清除数据,用于切换账号或者退出应用时清除数据
     *
     * \~english
     * Clear data, used to clear data when switching accounts or exiting the application
     */
    fun cleanUp() {
        userInfoMap.clear()
        groupInfoMap.clear()
        rtcTokenInfo.clear()
    }
}