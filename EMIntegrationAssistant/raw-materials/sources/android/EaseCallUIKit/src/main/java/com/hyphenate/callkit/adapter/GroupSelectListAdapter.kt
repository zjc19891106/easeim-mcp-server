package com.hyphenate.callkit.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import coil.load
import com.hyphenate.callkit.R
import com.hyphenate.callkit.base.BaseAdapter
import com.hyphenate.callkit.bean.CallKitUserInfo
import com.hyphenate.callkit.databinding.CallkitLayoutGroupMemberSelectItemBinding
import com.hyphenate.callkit.interfaces.OnGroupSelectedListener

/**
 * \~chinese
 * 群成员选择列表适配器
 * \~english
 * Group member selection list adapter
 */
class GroupSelectListAdapter: BaseAdapter<CallKitUserInfo>() {

    private var originalCheckedList:MutableList<String> = mutableListOf()
    private var newSelectedList:MutableList<String> = mutableListOf()

    private var selectedListener: OnGroupSelectedListener?=null
    private var memberList:MutableList<String> = mutableListOf()
    override fun getViewHolder(parent: ViewGroup, viewType: Int): ViewHolder<CallKitUserInfo> =
        GroupSelectListViewHolder(CallkitLayoutGroupMemberSelectItemBinding.inflate(LayoutInflater.from(parent.context)))

    override fun onBindViewHolder(holder: ViewHolder<CallKitUserInfo>, position: Int) {
        if (holder is GroupSelectListViewHolder){
            selectedListener?.let {
                holder.setCheckBoxSelectListener(it)
            }
            if (memberList.isNotEmpty()){
                holder.setMemberList(memberList)
            }
        }
        super.onBindViewHolder(holder, position)
    }

    fun setCheckBoxSelectListener(listener: OnGroupSelectedListener){
        this.selectedListener = listener
        notifyDataSetChanged()
    }

    fun setGroupMemberList(list: MutableList<String>){
        this.memberList = list
        notifyDataSetChanged()
    }

    fun addSelectList(list: MutableList<String>){
        if (list.isNotEmpty()){
            list.forEach { id ->
                if (!originalCheckedList.contains(id)){
                    originalCheckedList.add(id)
                }
            }
        }
        notifyDataSetChanged()
    }

    fun resetSelect(){
        originalCheckedList.clear()
        notifyDataSetChanged()
    }

    open inner class GroupSelectListViewHolder(
        private val mViewBinding: CallkitLayoutGroupMemberSelectItemBinding
    ): ViewHolder<CallKitUserInfo>(binding = mViewBinding) {
        private var selectedListener: OnGroupSelectedListener?=null
        private var memberList:MutableList<String> = mutableListOf()

        override fun setData(item: CallKitUserInfo?, position: Int) {
            item?.run {
                with(mViewBinding) {
                    cbSelect.isEnabled=true
                    cbSelect.isChecked=false
                    if (originalCheckedList.contains(item.userId)){
                        cbSelect.isEnabled = false
                        cbSelect.isSelected=true
                    }else{
                        cbSelect.isSelected=false
                    }
                    if (newSelectedList.contains(item.userId)){
                        cbSelect.isChecked = true
                    }

                    itemLayout.setOnClickListener{ view->
                        if (cbSelect.isEnabled){
                            cbSelect.isChecked = !cbSelect.isChecked
                        }

                        if (cbSelect.isChecked){
                            if (!newSelectedList.contains(userId)){
                                newSelectedList.add(userId)
                            }
                        }else{
                            newSelectedList.remove(userId)
                        }

                        selectedListener?.onGroupSelectedChanged(view,newSelectedList)
                    }

                    ivAvatar.load(item.avatar) {
                        placeholder(R.drawable.callkit_default_avatar)
                        error(R.drawable.callkit_default_avatar)
                        crossfade(true)
                    }
                    tvName.text = item.getName()
                }
            }
        }
        fun setCheckBoxSelectListener(listener: OnGroupSelectedListener){
            this.selectedListener = listener
        }

        fun setMemberList(list: MutableList<String>){
            this.memberList = list
        }

    }
}