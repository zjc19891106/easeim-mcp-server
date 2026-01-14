package com.hyphenate.callkit.interfaces

import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.bean.CallEndReason
import com.hyphenate.callkit.bean.CallInfo
import com.hyphenate.callkit.bean.CallType
import io.agora.rtc2.RtcEngine
import org.json.JSONObject

/**
 * \~chinese
 * 通话事件监听接口，用于接收通话相关的事件回调
 *
 * \~english
 * Call event listener interface, used to receive callbacks for call-related events
 */
interface CallKitListener {

    /**
     * \~chinese
     * 通话结束
     * @param reason 通话结束原因
     * @param callInfo 通话信息
     *
     * \~english
     * Call ended
     * @param reason Call end reason
     * @param callInfo Call Info
     */
    fun onEndCallWithReason(reason: CallEndReason,callInfo: CallInfo?){}


    /**
     * \~chinese
     * 通话错误回调
     * @param errorType 错误类型
     * @param errorCode 错误码
     * @param description 错误描述
     *
     * \~english
     * Call error callback
     * @param errorType Error type
     * @param errorCode Error code
     * @param description Error description
     */
    fun onCallError(errorType: CallKitClient.CallErrorType,errorCode: Int, description: String?=null){}

    /**
     * \~chinese
     * 收到通话邀请回调
     *
     * @param userId 邀请方userId
     * @param callType 通话类型
     * @param ext 自定义扩展字段
     *
     * \~english
     * Received call invitation callback
     * @param userId Inviter user ID
     * @param callType Call type
     * @param ext Custom extension fields
     */
    fun onReceivedCall(userId: String,callType: CallType, ext: JSONObject?){}

    /**
     * \~chinese
     * 远端用户加入通话回调
     *
     * @param userId 远端用户ID
     * @param callType 通话类型
     * @param channelName 频道名称
     *
     * \~english
     * Remote user joined call callback
     * @param userId Remote user ID
     * @param callType Call type
     * @param channelName Channel name
     */
    fun onRemoteUserJoined( userId: String, callType: CallType, channelName: String){}

    /**
     * \~chinese
     * 远端用户离开通话回调
     *
     * @param userId 远端用户ID
     * @param callType 通话类型
     * @param channelName 频道名称
     *
     * \~english
     * Remote user left call callback
     * @param userId Remote user ID
     * @param callType Call type
     * @param channelName Channel name
     */
    fun onRemoteUserLeft( userId: String, callType: CallType, channelName: String){}


    /**
     * \~chinese
     * RTC引擎创建后的回调，用户可以在这里添加自己的一些配置，例如私有化部署
     *
     * 私有化部署示例：
     * ```kotlin
     * override fun onRtcEngineCreated(engine: RtcEngine) {
     *     val configuration = LocalAccessPointConfiguration().apply {
     *         // 设置你的私有化地址
     *         ipList = arrayListOf<String>().apply { add("111.111.111.111") }
     *         verifyDomainName = "ap.955011.agora.local"
     *         mode = LOCAL_RPOXY_LOCAL_ONLY
     *     }
     *     engine.setLocalAccessPoint(configuration)
     * }
     * ```
     * @param engine RTC引擎
     *
     * \~english
     * RTC engine created callback, users can add their own configurations here, such as private deployment
     *
     * Private deployment example:
     * ```kotlin
     * override fun onRtcEngineCreated(engine: RtcEngine?) {
     *     val configuration = LocalAccessPointConfiguration().apply {
     *         // Set your private address
     *         ipList = arrayListOf<String>().apply { add("111.111.111.111") }
     *         verifyDomainName = "ap.955011.agora.local"
     *         mode = LOCAL_RPOXY_LOCAL_ONLY
     *     }
     *     engine.setLocalAccessPoint(configuration)
     * }
     * ```
     * @param engine RTC engine
     */
    fun onRtcEngineCreated(engine: RtcEngine) {}
    
}