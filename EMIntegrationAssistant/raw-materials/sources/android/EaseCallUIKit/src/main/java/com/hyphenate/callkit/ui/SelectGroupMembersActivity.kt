package com.hyphenate.callkit.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.hyphenate.callkit.CallKitClient
import com.hyphenate.callkit.CallKitClient.mContext
import com.hyphenate.callkit.R
import com.hyphenate.callkit.bean.Constant
import com.hyphenate.callkit.databinding.ActivityInviteGroupMembersBinding
import com.hyphenate.callkit.interfaces.OnGroupSelectedListener
import com.hyphenate.callkit.ui.fragment.SelectGroupMemberFragment
import com.hyphenate.callkit.utils.CallKitUtils.checkMemberCountLimit
import com.hyphenate.callkit.utils.ChatClient
import com.hyphenate.callkit.utils.ChatLog
import kotlin.collections.arrayListOf
import kotlin.jvm.java
import com.hyphenate.callkit.base.BaseCallActivity

/**
 * \~chinese
 * 选择群成员Activity，用于新建通话时邀请成员
 *
 * \~english
 * Select group members activity, used to invite members when creating a new call
 */
class SelectGroupMembersActivity : AppCompatActivity() {
    companion object {
        private const val TAG = "Callkit SelectGroupMembersActivity"
        const val REQUEST_CODE_INVITE_MEMBERS = 1001
        const val EXTRA_SELECTED_MEMBERS = "selected_members"

        /**
         * 用于邀请群成员
         */
        fun actionStart(context: Context, groupID: String, existMembers: ArrayList<String>): Intent {
            val intent = Intent(context, SelectGroupMembersActivity::class.java)
            intent.putStringArrayListExtra("exist_members", existMembers)
            intent.putExtra("groupID", groupID)
            return intent
        }
        /**
         * 用于新建通话时邀请成员
         */
        fun actionStart(context: Context,groupID: String): Intent {
            val intent = Intent(context, SelectGroupMembersActivity::class.java)
            intent.putExtra("new_call",true)
            intent.putExtra("groupID", groupID)
            return intent
        }
    }
    private var binding: ActivityInviteGroupMembersBinding? = null
    private var selectFragment: SelectGroupMemberFragment? = null
    private var selectedMembers=mutableListOf<String>()
    private var  newCall=false
    private var existMembers : ArrayList<String> ?=null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding= ActivityInviteGroupMembersBinding.inflate(layoutInflater)
        setContentView(binding?.root)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
        initData(savedInstanceState)
        binding?.tvAdd?.setOnClickListener {
            if (newCall){
                if (checkMemberCountLimit(this,selectedMembers.size+(existMembers?.size?:0))){
                    return@setOnClickListener
                }
                CallKitClient.inviteeUsers.clear()
                ChatLog.e(TAG,"selectedMembers="+selectedMembers)
                CallKitClient.inviteeUsers.addAll(selectedMembers)

                CallKitClient.sendInviteMsg()

                val intent = BaseCallActivity.createLockScreenIntent(mContext, MultiCallActivity::class.java)
                mContext.startActivity(intent)
                finish()
            }else{
                if (checkMemberCountLimit(this,selectedMembers.size + (existMembers?.size ?: 0))){
                    return@setOnClickListener
                }
                // 返回选中的成员列表
                val resultIntent = Intent().apply {
                    putStringArrayListExtra(EXTRA_SELECTED_MEMBERS, ArrayList(selectedMembers))
                }
                setResult(RESULT_OK, resultIntent)
                finish()
            }
        }

        binding?.ivBack?.setOnClickListener {
            if (newCall){
                CallKitClient.exitCall()
            }
            finish()
        }
    }

    private fun initData(savedInstanceState: Bundle?) {
        existMembers = intent.getStringArrayListExtra("exist_members")
        val groupID = intent.getStringExtra("groupID")
        newCall = intent.getBooleanExtra("new_call",false)
        if (newCall){
            existMembers = arrayListOf<String>()
            existMembers?.add(ChatClient.getInstance().currentUser)
        }
        binding?.tvAdd?.isSelected = false
        binding?.tvAdd?.isEnabled = false
        binding?.tvAdd?.text= mContext.getString(if (newCall) R.string.callkit_call else R.string.callkit_add, selectedMembers.size)

        // 动态添加fragment
        if (savedInstanceState == null) { // 避免重复添加
            selectFragment = SelectGroupMemberFragment().apply {
                // 在创建fragment时就设置arguments
                val bundle = Bundle().apply {
                    putString(Constant.EXTRA_CONVERSATION_ID, groupID)
                }
                arguments = bundle
            }
            
            // 添加fragment到容器
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, selectFragment!!)
                .commit()
            
            // 等待fragment完全添加后设置数据
            supportFragmentManager.executePendingTransactions()
            
            // 设置已存在的成员列表
            selectFragment?.addSelectMember(existMembers ?: mutableListOf())
            selectFragment?.setGroupSelectListener(object : OnGroupSelectedListener{
                override fun onGroupSelectedChanged(v: View, selectedMembers: MutableList<String>) {
                    this@SelectGroupMembersActivity.selectedMembers=selectedMembers
                    (selectedMembers.size>0).let {
                        binding?.tvAdd?.isSelected = it
                        binding?.tvAdd?.isEnabled = it
                    }
                    binding?.tvAdd?.text= mContext.getString(if (newCall) R.string.callkit_call else R.string.callkit_add, selectedMembers.size)
                }
            })
        }
    }

    override fun onBackPressed() {
        if (newCall){
            CallKitClient.exitCall()
        }
        super.onBackPressed()
    }
}