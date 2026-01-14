package com.hyphenate.callkit.interfaces

import com.hyphenate.callkit.bean.CallKitUserInfo

interface IUIKitGroupResultView {

    /**
     * \~chinese
     * 获取群成员列表成功
     * @param user 群成员列表
     *
     * \~english
     * Fetch group member list successfully.
     * @param user group member list
     */
    fun fetchGroupMemberSuccess(user:List<CallKitUserInfo>){}

}