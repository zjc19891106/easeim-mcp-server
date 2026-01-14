package com.hyphenate.callkit.repo

import com.hyphenate.callkit.interfaces.ValueCallbackImpl
import com.hyphenate.callkit.utils.ChatCursorResult
import com.hyphenate.callkit.utils.ChatGroupManager
import com.hyphenate.callkit.utils.ChatException
import com.hyphenate.callkit.utils.ChatGroup
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine



suspend fun ChatGroupManager.fetchChatGroupMembers(
    groupId:String,
    cursor:String?,
    pageSize:Int,
): ChatCursorResult<String> {
    return suspendCoroutine{ continuation ->
        asyncFetchGroupMembers(groupId,cursor,pageSize, ValueCallbackImpl(
            onSuccess = {
                continuation.resume(it)
            },
            onError = { code, message ->
                continuation.resumeWithException(
                    ChatException(
                        code,
                        message
                    )
                )
            }
        ))
    }
}
suspend fun ChatGroupManager.fetchChatGroup(groupId:String): ChatGroup{
    return suspendCoroutine{ continuation ->
        asyncGetGroupFromServer(groupId, ValueCallbackImpl(
            onSuccess = {
                continuation.resume(it)
            },
            onError = { code, message ->
                continuation.resumeWithException(
                    ChatException(
                        code,
                        message
                    )
                )
            }
        ))
    }
}


