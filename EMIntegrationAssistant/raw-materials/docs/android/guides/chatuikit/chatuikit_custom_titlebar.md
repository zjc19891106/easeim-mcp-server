# 页面标题栏

`ChatUIKitTitleBar` 是可自定义的标题栏组件，基于 Material Toolbar 提供灵活的布局方式，支持显示头像、状态图标、标题、副标题、导航按钮和菜单等多种元素。聊天页面、会话列表页面、联系人列表页面、群详情页面和联系人详情页面的标题栏均使用 `ChatUIKitTitleBar`。你可以根据自身需求设置标题栏。

## 概述

//TODO：找UI设计提供图

1. 单聊聊天页面的标题栏（绿点表示对端用户在线）如下图所示：

```
┌──────────────────────────────────────────────────┐
│ ← │ 👤🟢 │ 张三                         ⋮        │
│   │       │ 在线                                 │
└──────────────────────────────────────────────────┘
  ↑   ↑     ↑                              ↑
  │   │     └─ 标题 + 副标题                └─ 菜单
  │   └────── Logo/头像
  └────────── 导航（返回）按钮
```


2. 群聊页面的标题栏如下图所示：

```
┌──────────────────────────────────────────────────┐
│ ← │ 👥  │ 开发组                      ⋮           │
└──────────────────────────────────────────────────┘
    
```

各页面的 `Fragment#Builder` 提供如下方法：

| 方法                             | 描述                                                         |
| -------------------------------- | ------------------------------------------------------------ |
| `useTitleBar()`     | 是否使用默认的标题栏（`ChatUIKitTitleBar`）。<br/> - `true`：是。 <br/> - (默认) `false`: 否。           |
| `setTitleBarTitle()`    | 设置标题栏的中部标题。                                            |
| `setTitleBarSubTitle()`    | 设置副标题（仅聊天页面支持）。                                            |
| `enableTitleBarPressBack()`   | 设置是否显示返回按钮，默认不显示。<br/> - `true`：显示。 <br/> - (默认) `false`: 不显示。              |
| `setTitleBarBackPressListener()` | 设置点击标题栏返回按钮的监听器。                               |

- 设置聊天页面标题栏：

```kotlin
class ChatActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)
        
        val chatFragment = UIKitChatFragment.Builder(conversationId, chatType)
            .useTitleBar(true)                          // 是否使用标题栏
            .setTitleBarTitle("张三")                   // 设置标题
            .setTitleBarSubTitle("在线")                // 设置副标题（仅聊天页面支持）
            .enableTitleBarPressBack(true)              // 显示返回按钮
            .setTitleBarBackPressListener { finish() }  // 返回监听
            .build()
        
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, chatFragment)
            .commit()
    }
}
```

- 设置会话列表页面标题栏：

```kotlin
val fragment = ChatUIKitConversationListFragment.Builder()
    .useTitleBar(true) // 是否使用标题栏
    .setTitleBarTitle("消息") // 设置标题
    .enableTitleBarPressBack(false)  // 首页不显示返回
    .build()
```

- 设置联系人列表标题栏：

```kotlin
val fragment = ChatUIKitContactsListFragment.Builder()
    .useTitleBar(true) // 是否使用标题栏
    .setTitleBarTitle("联系人")  // 设置标题
    .enableTitleBarPressBack(false)  // 显示返回按钮
    .build()
```

## 设置是否启用标题栏

例如，设置是否启用会话列表页面的标题栏：

```kotlin

//是否使用默认的标题栏（ChatUIKitTitleBar）：true：是；(默认) false: 否。
ChatUIKitConversationListFragment.Builder().useTitleBar()
```

## 设置标题栏的背景色

```kotlin
binding?.titleConversations?.setBackgroundColor(ContextCompat.getColor(mContext,R.color.blue))
```

## 设置左侧头像

```kotlin
//使用 binding?.titleConversations 可以直接获取到 ChatUIKitTitleBar
binding?.titleConversations?.let { titlebar->
    // 获取 logoView
    titlebar.getLogoView()
    // 设置头像
    titlebar.setLogo()
    // 获取 StatusView 
    titlebar.getStatusView()
    // 设置用户状态
    titlebar.setLogoStatus()
    // 设置用户状态的外间距
    titlebar.setLogoStatusMargin()
    // 设置用户状态图标大小
    titlebar.setLogoStatusSize()
} 
```

## 设置左侧头像及文本区域点击事件

```kotlin
// logo 图标区域点击事件 
binding?.titleConversations?.setLogoClickListener {}
// logo status 文本区域点击事件
binding?.titleConversations?.setTitleClickListener {} 
```

## 设置中部标题

例如，设置会话列表页面的标题栏中的标题：

```kotlin
// 文本设置
ChatUIKitConversationListFragment.Builder().setTitleBarTitle("title")
// 图片设置
binding?.titleConversations?.setTitleEndDrawable(R.drawable.conversation_title)
    
```

## 设置副标题

仅聊天页面支持在标题栏设置副标题。

```kotlin
titleBar.setSubtitle("在线")
titleBar.setSubtitle(R.string.online_status)
```

## 设置右侧显示图标

一般情况下，右侧会支持设置多个图标。我们采用设置菜单的方式进行设置。

例如，`ChatUIKitConversationListFragment` 提供 `defaultMenu()` 方法添加默认的 menu 菜单。若默认菜单不满足需求，可以替换为自己的 menu 菜单，重写 `defaultMenu()` 方法。   

```kotlin
    // 添加 menu
    override fun defaultMenu() {
        // 自定义满足自身需求的 menu 文件
        binding?.titleConversations?.inflateMenu(R.menu.my_menu)
    }

    // 设置 menu 点击事件
    override fun setMenuItemClick(item: MenuItem): Boolean {
        when(item.itemId) {
            R.id.action_my_menu -> {
                // todo：实现点击指定 menu 后的逻辑处理
                return true
            }
            else -> return false
        }
    }

    // 支持通过 tint 属性设置 menu icon 颜色
    setMenuIconTint(@ColorInt colorInt: Int)
    // 支持设置 menu 文本颜色
    setMenuTitleColor(@ColorInt colorInt: Int)
    // 支持设置隐藏/显示指定 menu 项
    setMenuIconVisible(id:Int,visible:Boolean)

```

## 设置返回按钮和事件监听

例如，设置会话列表页面的标题栏中的返回按钮：

```kotlin
//设置是否支持显示返回按钮：true：是；(默认) false: 否。   
ChatUIKitConversationListFragment.Builder().enableTitleBarPressBack()
//设置点击标题栏返回按钮的监听器。 
ChatUIKitConversationListFragment.Builder().setTitleBarBackPressListener()   
```

## 常见问题

### 设置的 Title 不显示？

检查是否设置了 Logo 且未调整布局。Logo 和 Title 共享空间，如果 Logo 太大可能遮挡标题。

```kotlin
// 确保 Logo 大小合适
titleBar.setLogoSize(40.dpToPx(context))
```

### 菜单图标颜色不生效？

确保在 `inflateMenu()` 之后调用颜色设置方法：

```kotlin
titleBar.inflateMenu(R.menu.chat_menu)
titleBar.setMenuIconTint(Color.WHITE) // 必须在 inflateMenu 之后
```

### 状态图标如何显示？

状态图标默认隐藏，需要手动设置：

```kotlin
titleBar.setLogoStatus(R.drawable.ic_online)
titleBar.getStatusView().visibility = View.VISIBLE
```

### 使用 Builder 配置后如何修改标题栏？

Builder 只进行初始化配置，后续可以在 Fragment 中获取 TitleBar 对象进行修改：

```kotlin
// 在自定义的 Fragment 中
override fun initView(savedInstanceState: Bundle?) {
    super.initView(savedInstanceState)
    
    // 获取并修改 TitleBar
    binding?.titleBar?.apply {
        setTitle("新标题")
        setLogo(R.drawable.new_avatar)
    }
}
```

### `useTitleBarToReplaceActionBar` 使用？

Builder 的 `useTitleBarToReplaceActionBar` 默认 `false`，通常不需要使用此选项。只有在需要将 TitleBar 作为 Activity 的 ActionBar，并通过 `onOptionsItemSelected(android.R.id.home)` 处理返回事件时才设置为 `true`。

```kotlin
//（推荐）一般情况
.useTitleBarToReplaceActionBar(false)
.setTitleBarBackPressListener { activity?.finish() }

// 特殊情况（需要 ActionBar 集成）
.useTitleBarToReplaceActionBar(true)

// 然后在 Activity 中：
override fun onOptionsItemSelected(item: MenuItem): Boolean {
    if (item.itemId == android.R.id.home) {
        finish()
        return true
    }
    return super.onOptionsItemSelected(item)
}
```




