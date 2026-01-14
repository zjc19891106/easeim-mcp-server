package com.hyphenate.callkit.utils

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Outline
import android.os.Build
import android.text.TextUtils
import android.view.View
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.widget.Toast
import androidx.annotation.RequiresApi
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.Constant
import com.hyphenate.util.EMLog
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.util.Random
import java.util.UUID
import android.app.KeyguardManager

/**
 * \~chinese
 * callkit 工具类，用于处理一些通用的逻辑
 *
 * \~english
 * Callkit utility class, used to handle some common logic
 */
 object CallKitUtils {

    const val TAG = "CallkitUtils"
    private var uuid: String? = null

    /**
     * \~chinese
     * 判断是否为主进程
     *
     * \~english
     * Check if it is the main process
     */
    fun isMainProcess(context: Context): Boolean {
        val processName: String?
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            processName = getProcessNameByApplication()
        } else {
            processName = getProcessNameByReflection()
        }
        return context.getApplicationInfo().packageName == processName
    }

    /**
     * \~chinese
     * 获取进程名
     *
     * \~english
     * Get process name
     */
    @RequiresApi(api = Build.VERSION_CODES.P)
    fun getProcessNameByApplication(): String? {
        return Application.getProcessName()
    }

    /**
     * \~chinese
     * 获取进程名
     *
     * \~english
     * Get process name
     */
    @SuppressLint("PrivateApi")
    fun getProcessNameByReflection(): String? {
        var processName: String? = null
        try {
            val declaredMethod = Class.forName(
                "android.app.ActivityThread",
                false,
                Application::class.java.getClassLoader()
            )
                .getDeclaredMethod("currentProcessName", *arrayOfNulls<Class<*>>(0))
            declaredMethod.setAccessible(true)
            val invoke = declaredMethod.invoke(null, *arrayOfNulls<Any>(0))
            if (invoke is String) {
                processName = invoke
            }
        } catch (e: Throwable) {
        }
        return processName
    }

    /**
     * \~chinese
     * 随机生成指定长度的字符串
     *
     * \~english
     * Generate a random string of a specified length
     */
    fun getRandomString(length: Int): String {
        val str = "abcdefghijklmnopqrstuvwxyz"
        val random = Random()
        val sb = StringBuilder()
        for (i in 0 until length) {
            val number = random.nextInt(26)
            sb.append(str[number])
        }
        return sb.toString()
    }

    /**
     * \~chinese
     * 获取手机唯一标识符
     *
     * \~english
     * Get phone unique identifier
     */
    fun getPhoneSign(): String {
        val deviceId = StringBuilder()
        // 渠道标志
        deviceId.append("a")
        try {
            // 生成一个id：随机码
            val uuid = getUUID()
            if (!TextUtils.isEmpty(uuid)) {
                deviceId.append("id")
                deviceId.append(uuid)
                return deviceId.toString()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            deviceId.append("id").append(getUUID())
        }
        return deviceId.toString()
    }

    /**
     * \~chinese
     * 获取设备ID
     *
     * \~english
     * Get device ID
     */
    private fun getUUID(): String {
        val mShare: SharedPreferences = CallKitClient.mContext
            .getSharedPreferences("uuid", Context.MODE_PRIVATE)
        uuid = mShare.getString("uuid", "")
        if (TextUtils.isEmpty(uuid)) {
            uuid = UUID.randomUUID().toString()
            mShare.edit().putString("uuid", uuid).commit()
        }
        return uuid!!
    }

    /**
     * \~chinese
     * 判断应用是否在前台运行
     *
     * \~english
     * Check if the application is running in the foreground
     */
    fun isAppRunningForeground(ctx: Context): Boolean {
        val activityManager = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.KITKAT_WATCH) {
            val runningProcesses = activityManager.runningAppProcesses ?: return false
            val packageName = ctx.packageName
            for (processInfo in runningProcesses) {
                if (processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                    && processInfo.processName == packageName
                ) {
                    return true
                }
            }
            return false
        } else {
            try {
                val tasks = activityManager.getRunningTasks(1)
                if (tasks.isNullOrEmpty()) {
                    return false
                }
                val isInForeground = ctx.packageName.equals(
                    tasks[0].baseActivity?.packageName, ignoreCase = true
                )
                EMLog.d("utils", "app running in foreground: $isInForeground")
                return isInForeground
            } catch (e: SecurityException) {
                EMLog.d(TAG, "Apk doesn't hold GET_TASKS permission")
                e.printStackTrace()
            }
        }
        return false
    }

    /**
     * \~chinese
     * 将Map转换为JSONObject
     *
     * \~english
     * Convert Map to JSONObject
     */
    fun convertMapToJSONObject(map: Map<String, Any>): JSONObject {
        val obj = JSONObject()
        for ((key, value) in map) {
            val result = when (value) {
                is Map<*, *> -> convertMapToJSONObject(value as Map<String, Any>)
                is List<*> -> {
                    val jsonArray = JSONArray()
                    for (item in value) {
                        jsonArray.put(item)
                    }
                    jsonArray
                }

                is Array<*> -> {
                    val jsonArray = JSONArray()
                    for (item in value) {
                        jsonArray.put(item)
                    }
                    jsonArray
                }

                else -> value
            }
            try {
                obj.put(key, result)
            } catch (e: JSONException) {
                e.printStackTrace()
            }
        }
        return obj
    }

    /**
     * \~chinese
     * 获取支持的窗口类型
     *
     * \~english
     * Get supported window type
     */
    fun getSupportedWindowType(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }
    }

    /**
     * \~chinese
     * 设置圆角
     *
     * \~english
     * Set rounded corners
     */
    fun setBgRadius(view: View, bgRadius: Int) {
        //Set the rounded corner size
        view.setOutlineProvider(object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setRoundRect(
                    0,
                    0,
                    view.getWidth(),
                    view.getHeight(),
                    bgRadius.toFloat()
                )
            }
        })
        //set shadow
//        view.setElevation(10f)
        //set rounded corners Clip
        view.setClipToOutline(true)
    }

    /**
     * \~chinese
     * 检查成员数量是否超过最大限制
     *
     * \~english
     * Check if the number of members exceeds the maximum limit
     */
     fun checkMemberCountLimit(context: Context,memberCount: Int): Boolean {
        if (memberCount > Constant.MAX_NUMBER_OF_CHANNEL) {
            Toast.makeText(context, context.getString(R.string.callkit_over_max_members,Constant.MAX_NUMBER_OF_CHANNEL), Toast.LENGTH_SHORT).show()
            return true
        }
        return false
    }

    /**
     * \~chinese
     * 检查屏幕是否锁定
     *
     * \~english
     * Check if the screen is locked
     */
    fun isScreenLocked(context: Context): Boolean{
        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        return keyguardManager?.isKeyguardLocked == true
    }
}