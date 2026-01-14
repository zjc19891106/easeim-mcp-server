package com.hyphenate.callkit.ui.fragment

import android.os.Bundle
import android.view.View
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.RecyclerView

import com.hyphenate.callkit.adapter.GroupSelectListAdapter
import com.hyphenate.callkit.base.BaseListFragment
import com.hyphenate.callkit.base.BaseAdapter
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.bean.Constant
import com.hyphenate.callkit.interfaces.IGroupRequest
import com.hyphenate.callkit.interfaces.IUIKitGroupResultView
import com.hyphenate.callkit.interfaces.OnGroupSelectedListener
import com.hyphenate.callkit.utils.ChatClient
import com.hyphenate.callkit.utils.ChatGroup
import com.hyphenate.callkit.utils.ChatLog
import com.hyphenate.callkit.utils.OnLoadMoreListener
import com.hyphenate.callkit.utils.catchChatException
import com.hyphenate.callkit.viewmodel.CallKitGroupViewModel
import kotlinx.coroutines.launch
import kotlin.collections.toMutableList
import kotlin.jvm.java

/**
 * \~chinese
 * 选择群成员Fragment
 *
 * \~english
 * Select group member fragment
 */
open class SelectGroupMemberFragment : BaseListFragment<CallKitUserInfo>(),
    IUIKitGroupResultView, OnGroupSelectedListener {
    private val memberSelectAdapter: GroupSelectListAdapter by lazy { GroupSelectListAdapter() }
    private var groupId: String? = null
    private var currentGroup: ChatGroup? = null

    private var sortedList: MutableList<CallKitUserInfo> = mutableListOf()

    private var groupViewModel: IGroupRequest? = null
    private var listener: OnGroupSelectedListener? = null

    // 分页相关变量
    private var currentCursor: String? = null
    private var isLoading = false
    private var hasMoreData = true

    override fun initAdapter(): BaseAdapter<CallKitUserInfo> {
        return memberSelectAdapter
    }

    override fun initView(savedInstanceState: Bundle?) {
        groupId = arguments?.getString(Constant.EXTRA_CONVERSATION_ID) ?: ""
        super.initView(savedInstanceState)
        groupId?.let {
            currentGroup = ChatClient.getInstance().groupManager().getGroup(it)
        }
    }

    override fun initViewModel() {
        super.initViewModel()
        groupViewModel = ViewModelProvider(this)[CallKitGroupViewModel::class.java]
    }


    override fun initListener() {
        super.initListener()
        memberSelectAdapter.setCheckBoxSelectListener(this)
    }

    override fun initData() {
        loadData()
    }

    fun setMemberList(members: MutableList<String>) {
        memberSelectAdapter.setGroupMemberList(members)
    }

    fun addSelectMember(members: MutableList<String>) {
        memberSelectAdapter.addSelectList(members)
    }

    override fun refreshData() {
        // 下拉刷新时重置分页状态
        currentCursor = null
        hasMoreData = true
        sortedList.clear()
        loadData()
    }

    open fun loadData() {
        ChatLog.d(TAG, "loadData called - isLoading: $isLoading, hasMoreData: $hasMoreData, currentCursor: $currentCursor")
        if (isLoading || !hasMoreData) return

        isLoading = true
        val isFirstPage = currentCursor == null

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                groupId?.let { groupId ->
                    groupViewModel
                        ?.fetchGroupMemberFromService(groupId, currentCursor, isFirstPage)
                        ?.catchChatException { e ->
                            isLoading = false
                            finishRefresh()
                            binding?.srlContactRefresh?.finishLoadMore()
                        }
                        ?.collect { result ->
                            val (users, nextCursor) = result
                            currentCursor = nextCursor
                            hasMoreData = !nextCursor.isNullOrEmpty()

                            if (isFirstPage) {
                                sortedList.clear()
                            }
                            sortedList.addAll(users)

                            mListAdapter.setData(sortedList)
                            isLoading = false
                            finishRefresh()

                            if (hasMoreData) {
                                binding?.srlContactRefresh?.finishLoadMore()
                                ChatLog.d(TAG, "finishLoadMore - hasMoreData: true")
                            } else {
                                binding?.srlContactRefresh?.finishLoadMoreWithNoMoreData()
                                ChatLog.d(TAG, "finishLoadMoreWithNoMoreData - hasMoreData: false")
                            }
                        }
                }
            }
        }
    }

    override fun initRecyclerView(): RecyclerView? {
        return binding?.rvList
    }

    fun resetSelect() {
        memberSelectAdapter.resetSelect()
    }

    override fun onGroupSelectedChanged(v: View, selectedMembers: MutableList<String>) {
        listener?.onGroupSelectedChanged(v, selectedMembers)
    }

    fun setGroupSelectListener(listener: OnGroupSelectedListener) {
        this.listener = listener
    }

    override fun fetchGroupMemberSuccess(users: List<CallKitUserInfo>) {
        sortedList = users.toMutableList()
        finishRefresh()
        groupId?.apply {
            mListAdapter.setData(sortedList)
        }
    }

    override fun onLoadMore() {
        ChatLog.d(TAG, "onLoadMore called")
        loadData()
    }
}