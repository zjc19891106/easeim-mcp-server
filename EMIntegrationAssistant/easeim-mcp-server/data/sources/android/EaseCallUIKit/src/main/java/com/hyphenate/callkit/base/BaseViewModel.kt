package com.hyphenate.callkit.base

import androidx.lifecycle.ViewModel
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.utils.ChatLog
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

/**
 * \~chinese
 * 通话基类ViewModel
 *
 * \~english
 * Base call view model
 */
abstract class BaseViewModel : ViewModel() {

    private val TAG: String = BaseViewModel::class.java.simpleName

    // UI事件
    internal val _uiEvent = MutableSharedFlow<CallUiEvent>()
    val uiEvent: SharedFlow<CallUiEvent> = _uiEvent.asSharedFlow()


    /**
     * 发送UI事件
     */
    internal fun sendUiEvent(event: CallUiEvent) {
        ChatLog.e(TAG, "sendUiEvent: $event")
        CallKitClient.callKitScope.launch {
            _uiEvent.emit(event)
        }
    }

    override fun onCleared() {
        super.onCleared()
    }
    /**
     * \~chinese    
     * 处理请求悬浮窗权限被取消的情况
     * 子类可以重写此方法以处理特定逻辑
     *
     * \~english
     * Handle the case where the request for floating window permission is canceled
     * Subclasses can override this method to handle specific logic
     */
    open fun handleRequestFloatWindowPermissionCancel() {}

    /**
     * \~chinese
     * UI事件
     *
     * \~english
     * UI event
     */
    sealed class CallUiEvent {
        /**
         * \~chinese
         * 请求悬浮窗权限
         *
         * \~english
         * Request floating window permission
         */
        object FloatWindowPermissionRequired : CallUiEvent()
        /**
         * \~chinese
         * 悬浮窗已显示
         *
         * \~english
         * Floating window shown
         */
        object FloatWindowShown : CallUiEvent()
    }

}