package com.hyphenate.callkit.global

import android.app.Activity
import android.app.Application
import android.os.Bundle
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.CallState
import com.hyphenate.callkit.ui.MultiCallActivity
import com.hyphenate.callkit.ui.SelectGroupMembersActivity
import com.hyphenate.callkit.ui.SingleCallActivity
import com.hyphenate.callkit.utils.ChatLog

class CallKitActivityLifecycleCallback: Application.ActivityLifecycleCallbacks{
    private val TAG = "CallKit ActivityLifecycle"
    private val resumeActivity = mutableListOf<Activity>()
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
    }

    override fun onActivityStarted(activity: Activity) {

    }

    override fun onActivityResumed(activity: Activity) {
        moveCallKitActivityToFront(activity)
    }

    override fun onActivityPaused(activity: Activity) {

    }

    override fun onActivityStopped(activity: Activity) {
    }


    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {

    }

    override fun onActivityDestroyed(activity: Activity) {
    }

    /**
     * 检查如处于通话状态，且悬浮窗未显示，优先将通话界面移到前台
     */
    private fun moveCallKitActivityToFront(activity: Activity) {
        if (!CallKitClient.floatWindow.isFloatWindowShowing()
            && CallKitClient.callState.value == CallState.CALL_ANSWERED
            && (activity !is SelectGroupMembersActivity)
            && (activity !is SingleCallActivity)
            && (activity !is MultiCallActivity)){
            ChatLog.d(TAG, "moveCallKitActivityToFront: move to front")
            CallKitClient.signalingManager.startSendEvent(0)
        }
    }
}