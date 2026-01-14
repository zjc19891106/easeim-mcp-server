package com.hyphenate.callkit.interfaces

import android.view.View

/**
 * \~chinese
 * 群组选择监听器
 *
 * \~english
 * Group selected listener
 */
interface OnGroupSelectedListener {
    /**
     * \~chinese
     * 群组选择变化
     * @param v 视图
     * @param selectedMembers 选中的成员
     *
     * \~english
     * Group selected changed
     * @param v view
     * @param selectedMembers selected members
     */
    fun onGroupSelectedChanged(v: View, selectedMembers: MutableList<String>){}
}
