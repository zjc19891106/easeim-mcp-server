package com.hyphenate.callkit.utils

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.FlowCollector
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.catch

/**
 * \~chinese
 * 捕获ChatException
 *
 * \~english
 * Catch ChatException
 */
fun <T> Flow<T>.catchChatException(action: suspend FlowCollector<T>.(ChatException) -> Unit): Flow<T> {
    return this.catch { e ->
        if (e is ChatException) {
            action.invoke(this, e)
        } else {
            ChatLog.e("catchChatException", "catchChatException: ${e.message}")
        }
    }
}

/**
 * \~chinese
 * 检查错误码
 *
 * \~english
 * Check error code
 */
suspend fun <T> SharedFlow<T>.collectWithCheckErrorCode(checked: (T) -> Unit): Nothing {
    collect {
        if (it is Int && it == ChatError.EM_NO_ERROR) {
            checked.invoke(it)
        }
    }
}
