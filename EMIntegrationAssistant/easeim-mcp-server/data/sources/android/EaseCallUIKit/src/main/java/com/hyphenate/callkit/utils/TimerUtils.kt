package com.hyphenate.callkit.utils

import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.Constant
import com.hyphenate.util.EMLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * \~chinese
 * 计时器工具类
 *
 * \~english
 * Timer utility class
 */
object TimerUtils {
    private const val TAG = "TimerUtils"

    // 协程相关
    private val callKitScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /**
     * \~chinese
     * 计时器类型
     *
     * \~english
     * Timer type
     */
    enum class TimerType(val timeout: Int, val logPrefix: String) {
        COMMON(CallKitClient.callKitConfig.callTimeout, "common"),
        ALERT(Constant.CALL_INVITED_INTERVAL, "alert"),
    }

    /**
     * \~chinese
     * 启动一个计时器，超时后回调
     *
     * \~english
     * Start a timer, callback when timeout
     */
    fun startTimer(timerType: TimerType, onTimeout: () -> Unit): Job {
        val dateFormat = SimpleDateFormat("HH:mm:ss").apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        return callKitScope.launch {
            var timePassed = 0

            while (true) {
                delay(1000)
                timePassed++

                val time = dateFormat.format(timePassed * 1000L)
                EMLog.d(TAG, "${timerType.logPrefix} timer tick: $timePassed, time: $time")

                if (timePassed  == timerType.timeout) {
                    EMLog.d(TAG, "${timerType.logPrefix} call timeout reached")
                    onTimeout()
                    break
                }
            }
        }
    }

    /**
     * \~chinese
     * 启动一个计时器，回调每秒的时间
     *
     * \~english
     * Start a timer, callback every second
     */
    fun startTimer( onTimeCallback: (Int) -> Unit): Job {
        return callKitScope.launch {
            var timePassed = 0
            while (true) {
                delay(1000)
                timePassed++
                onTimeCallback(timePassed)
            }
        }
    }

    /**
     * \~chinese
     * 停止指定计时器
     *
     * \~english
     * Stop the specified timer
     */
    fun stopTimer(timerJob: Job?) {
        timerJob?.cancel()
    }

    /**
     * \~chinese
     * 将秒转换成"HH:mm:ss"时间格式
     *
     * \~english
     * Convert seconds to "HH:mm:ss" time format
     */
    fun Long.timeFormat(): String {
        return SimpleDateFormat("HH:mm:ss", Locale.getDefault()).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(this * 1000L)
    }
}