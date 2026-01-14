package com.hyphenate.callkit.viewmodel

import androidx.lifecycle.viewModelScope
import com.hyphenate.callkit.base.BaseViewModel
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.interfaces.IGroupRequest
import com.hyphenate.callkit.repo.ChatCallKitGroupRepository
import com.hyphenate.callkit.utils.ChatClient
import com.hyphenate.callkit.utils.ChatGroupManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.stateIn

/**
 * \~chinese
 * 群组ViewModel，用于管理群组相关操作
 *
 * \~english
 * Group ViewModel, used to manage group related operations
 */
open class CallKitGroupViewModel(
    private val groupManager: ChatGroupManager = ChatClient.getInstance().groupManager(),
    private val stopTimeoutMillis: Long = 5000
) : BaseViewModel(), IGroupRequest {

    companion object {
        const val pageSize: Int = 20
        const val needMemberCount: Boolean = false
        const val needRole: Boolean = false
    }

    private val repository: ChatCallKitGroupRepository = ChatCallKitGroupRepository(groupManager)

    override suspend fun fetchGroupMemberFromService(groupId: String) =
        flow {
            val result = repository.fetGroupMemberFromServer(groupId, null, true)
            emit(result.first)
        }
            .flowOn(Dispatchers.IO)
            .stateIn(
                viewModelScope,
                SharingStarted.WhileSubscribed(stopTimeoutMillis),
                mutableListOf()
            )

    override suspend fun fetchGroupMemberFromService(
        groupId: String,
        cursor: String?,
        isFirstPage: Boolean
    ) = flow {
            val result = repository.fetGroupMemberFromServer(groupId, cursor, isFirstPage)
            emit(result)
        }.flowOn(Dispatchers.IO)


    override suspend fun loadLocalMember(groupId: String) = flow {
        emit(repository.loadLocalMember(groupId))
    }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(stopTimeoutMillis),
            mutableListOf()
        )

}