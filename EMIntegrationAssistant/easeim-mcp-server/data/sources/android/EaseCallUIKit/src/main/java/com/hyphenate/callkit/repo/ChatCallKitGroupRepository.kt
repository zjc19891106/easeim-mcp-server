package com.hyphenate.callkit.repo

import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.interfaces.getSyncUser
import com.hyphenate.callkit.utils.ChatClient
import com.hyphenate.callkit.utils.ChatGroupManager
import com.hyphenate.callkit.utils.ChatLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ChatCallKitGroupRepository(
    private val groupManager: ChatGroupManager = ChatClient.getInstance().groupManager()
) {
    private var Max: Int = 1000


    companion object {
        private const val TAG = "GroupRep"
        private const val LIMIT = 20
    }

    suspend fun loadLocalMember(groupId: String): MutableList<CallKitUserInfo> =
        withContext(Dispatchers.IO) {
            val data = mutableListOf<CallKitUserInfo>()
            val currentGroup = ChatClient.getInstance().groupManager().getGroup(groupId)
            val members = mutableListOf<String>()
            currentGroup?.members?.forEach {
                members.add( it)
            }
            currentGroup?.owner?.let {
                members.add(it)
            }
            currentGroup?.adminList?.forEach {
                members.add( it)
            }
            members.let {
                for (userId in it) {
                    CallKitClient.callInfoProvider?.getSyncUser(userId)?.let { info ->
                        data.add(info)
                    } ?: run {
                        data.add(CallKitUserInfo(userId=userId))
                    }
                }
            }
            data.toMutableList()
        }

    @Throws(Exception::class)
    suspend fun fetGroupMemberFromServer(
        groupId: String,
        cursor: String? = null,
        isFirstPage: Boolean = false
    ): Pair<MutableList<CallKitUserInfo>, String?> = withContext(Dispatchers.IO) {
        try {
            val groupMemberList = mutableListOf<CallKitUserInfo>()
            val result = groupManager.fetchChatGroupMembers(groupId, cursor, LIMIT)
            val data = CallKitClient.getCache().getUserInfosByIds(result.data)
            groupMemberList.addAll(data)
            
            // 只在第一页时添加管理员和群主
            if (isFirstPage) {
                val group = groupManager.getGroup(groupId) ?: groupManager.fetchChatGroup(groupId)
                group.owner?.let {
                    val ownerInfo = CallKitClient.getCache().getUserInfoById(it)
                    groupMemberList.add(0, ownerInfo) // 群主放在最前面
                }
                group.adminList?.let {
                    val infos = CallKitClient.getCache().getUserInfosByIds(it)
                    groupMemberList.addAll(1, infos) // 管理员放在群主后面
                }
            }
            ChatLog.d(TAG, "Fetched ${groupMemberList.size} members from server for group $groupId, currentCursor: $cursor, next cursor: ${result.cursor}, isFirstPage: $isFirstPage")
            Pair(groupMemberList, result.cursor)
        } catch (e: Exception) {
            ChatLog.e(TAG, "Unexpected error while fetching group members: ${e.message}")
            throw e
        }
    }
}