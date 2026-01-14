package com.hyphenate.callkit.widget

import android.content.Context
import android.util.AttributeSet
import com.hyphenate.callkit.utils.IRefresh
import com.hyphenate.callkit.utils.OnLoadMoreListener
import com.hyphenate.callkit.utils.OnRefreshListener
import com.hyphenate.callkit.utils.SwipeRefreshLayout

class RefreshLayout @JvmOverloads constructor(
    private val context: Context,
    private val attrs: AttributeSet? = null
): SwipeRefreshLayout(context, attrs) {

    override fun finishLoadMore(): IRefresh {
        return super.finishLoadMore()
    }

    override fun finishLoadMoreWithNoMoreData(): IRefresh {
        return super.finishLoadMoreWithNoMoreData()
    }

    override fun finishRefresh(): IRefresh {
        return super.finishRefresh()
    }

    override fun setEnableLoadMore(enable: Boolean): IRefresh {
        return super.setEnableLoadMore(enable)
    }

    override fun setEnableRefresh(enable: Boolean): IRefresh {
        return super.setEnableRefresh(enable)
    }

    override fun setOnRefreshListener(listener: OnRefreshListener?): IRefresh {
        return super.setOnRefreshListener(listener)
    }

    override fun setOnLoadMoreListener(listener: OnLoadMoreListener?): IRefresh {
        return super.setOnLoadMoreListener(listener)
    }

}