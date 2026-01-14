package com.hyphenate.callkit.interfaces

import android.view.View

/**
 * \~chinese
 * 条目点击监听器
 *
 * \~english
 * Item click listener interface
 */
interface OnItemClickListener {
    /**
     * \~chinese
     * 条目点击
     * @param view 视图
     * @param position 位置
     *
     * \~english
     * Item click
     * @param view view
     * @param position position
     */
    fun onItemClick(view: View?, position: Int)
}