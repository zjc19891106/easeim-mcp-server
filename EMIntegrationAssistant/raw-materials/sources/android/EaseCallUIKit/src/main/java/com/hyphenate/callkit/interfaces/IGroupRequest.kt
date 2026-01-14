package com.hyphenate.callkit.interfaces

import com.hyphenate.callkit.bean.CallKitUserInfo
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

/**
 * \~chinese
 * 群组请求接口
 *
 * \~english
 * Group request interface
 */
interface IGroupRequest  {
    /**
     * \~chinese
     * 从服务获取群成员
     * @param groupId 群组ID
     *
     * \~english
     * Get Group Member
     * @param groupId group ID
     */
    suspend fun fetchGroupMemberFromService(groupId:String): Flow<MutableList<CallKitUserInfo>>
    /**
     * \~chinese
     * 从服务获取群成员，分页
     * @param groupId 群组ID
     * @param cursor 游标，为null时表示第一页
     * @param isFirstPage 是否是第一页
     *
     * \~english
     * Get Group Member with pagination
     * @param groupId group ID
     * @param cursor cursor, null means first page
     * @param isFirstPage whether it is the first page
     */
    suspend fun fetchGroupMemberFromService(groupId: String, cursor: String?, isFirstPage: Boolean = false): Flow<Pair<MutableList<CallKitUserInfo>, String?>>

    /**
     * \~chinese
     * 加载本地成员
     * @param groupId 群组ID
     *
     * \~english
     * Load local member
     * @param groupId group ID
     */
    suspend fun loadLocalMember(groupId:String): Flow<MutableList<CallKitUserInfo>>

}