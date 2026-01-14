package com.hyphenate.callkit.widget

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Context
import android.util.AttributeSet
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import androidx.core.view.children
import androidx.core.view.isGone
import kotlin.math.ceil
import kotlin.math.min
import kotlin.math.sqrt
import com.hyphenate.callkit.R
import com.hyphenate.callkit.utils.ChatLog

/**
 * \~chinese
 * 多人视频通话网格布局
 * 支持网格模式和主视图+底部滚动模式
 *
 * \~english
 * Multi-video call grid layout, supports grid mode and main view + bottom scroll mode
 */
class MultiVideoCallGridLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : ViewGroup(context, attrs, defStyleAttr) {

    companion object {
        private const val TAG = "MultiVideoCallGridLayout"
        private const val DEFAULT_SPACING = 8 // dp
        private const val MIN_ITEM_SIZE = 120 // dp
        private const val BOTTOM_ROW_HEIGHT = 72 // dp
        private const val ANIMATION_DURATION = 300L
        private const val GRID_ROW_MARGIN = DEFAULT_SPACING // dp - 网格模式每行开始和结束的margin
        private const val FOCUS_HORIZONTAL_MARGIN = DEFAULT_SPACING // dp - 焦点模式主视图的左右margin
    }
    private var horizontalSpacing: Int = 0
    private var verticalSpacing: Int = 0
    private var minItemSize: Int = 0
    private var bottomRowHeight: Int = 0
    private var gridRowMargin: Int = 0 // 网格模式每行的左右margin
    private var focusHorizontalMargin: Int = 0 // 焦点模式主视图的左右margin
    private var onItemClickListener: OnItemClickListener? = null
    private var focusedView: View? = null
    // 布局模式
    private var layoutMode = LayoutMode.GRID
    
    // 底部滚动视图
    private var bottomScrollView: HorizontalScrollView? = null
    private var bottomContainer: LinearLayout? = null
    
    // 保存原始视图顺序，用于恢复网格模式时的正确排列
    private var originalViews = mutableListOf<View>()
    
    // 动画相关
    private var isAnimating = false

    init {
        initView()
    }

    private fun initView() {
        horizontalSpacing = dpToPx(DEFAULT_SPACING)
        verticalSpacing = dpToPx(DEFAULT_SPACING)
        minItemSize = dpToPx(MIN_ITEM_SIZE)
        bottomRowHeight = dpToPx(BOTTOM_ROW_HEIGHT)
        gridRowMargin = dpToPx(GRID_ROW_MARGIN)
        focusHorizontalMargin = dpToPx(FOCUS_HORIZONTAL_MARGIN)

        if (bottomScrollView==null){
            bottomScrollView = HorizontalScrollView(context).apply {
                isHorizontalScrollBarEnabled = false
                overScrollMode = OVER_SCROLL_NEVER
            }

            bottomContainer = LinearLayout(context).apply {
                gravity= Gravity.BOTTOM
                orientation = LinearLayout.HORIZONTAL
                // 设置左右padding来处理整体间距
                setPadding(horizontalSpacing, 0, horizontalSpacing, 0)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    bottomRowHeight
                )
            }
            bottomScrollView?.addView(bottomContainer)
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {

        val availableWidth = MeasureSpec.getSize(widthMeasureSpec) - paddingLeft - paddingRight
        val availableHeight = MeasureSpec.getSize(heightMeasureSpec) - paddingTop - paddingBottom
        
        val childCount = childCount
        
        if (childCount == 0) {
            setMeasuredDimension(
                MeasureSpec.getSize(widthMeasureSpec),
                MeasureSpec.getSize(heightMeasureSpec)
            )
            return
        }

        when (layoutMode) {
            LayoutMode.GRID -> {
                measureGridMode(widthMeasureSpec, heightMeasureSpec, availableWidth, availableHeight)
            }
            LayoutMode.FOCUS -> {
                measureFocusMode(widthMeasureSpec, heightMeasureSpec, availableWidth, availableHeight)
            }
        }

        setMeasuredDimension(
            MeasureSpec.getSize(widthMeasureSpec),
            MeasureSpec.getSize(heightMeasureSpec)
        )
    }

    private fun measureGridMode(widthMeasureSpec: Int, heightMeasureSpec: Int, availableWidth: Int, availableHeight: Int) {
        val childCount = originalViews.size

        // 计算最佳的行列数
        val gridInfo = calculateOptimalGrid(childCount, availableWidth, availableHeight)
        
        // 计算每个item的大小（考虑行margin）
        val availableWidthForItems = availableWidth - 2 * gridRowMargin
        val itemWidth = (availableWidthForItems - horizontalSpacing * (gridInfo.columns - 1)) / gridInfo.columns
        val itemHeight = itemWidth
        
        // 测量所有子视图
        val childWidthSpec = MeasureSpec.makeMeasureSpec(itemWidth, MeasureSpec.EXACTLY)
        val childHeightSpec = MeasureSpec.makeMeasureSpec(itemHeight, MeasureSpec.EXACTLY)
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child?.visibility != GONE) {
                child?.measure(childWidthSpec, childHeightSpec)
            }
        }
        ChatLog.d(TAG, "measureGridMode() itemWidth: $itemWidth, itemHeight: $itemHeight")
    }

    private fun measureFocusMode(widthMeasureSpec: Int, heightMeasureSpec: Int, availableWidth: Int, availableHeight: Int) {
        // 主视图区域高度（总高度减去底部滚动区域）
        val mainViewWidth = availableWidth - 2 * focusHorizontalMargin
        val mainViewHeight = mainViewWidth

        originalViews.forEach {
            if (it == focusedView){
                // 测量主视图（聚焦的视图）
                val mainWidthSpec = MeasureSpec.makeMeasureSpec(mainViewWidth, MeasureSpec.EXACTLY)
                val mainHeightSpec = MeasureSpec.makeMeasureSpec(mainViewHeight, MeasureSpec.EXACTLY)
                it.measure(mainWidthSpec, mainHeightSpec)
            }else{
                val bottomItemSpec = MeasureSpec.makeMeasureSpec(bottomRowHeight, MeasureSpec.EXACTLY)
                it.measure(bottomItemSpec, bottomItemSpec)
            }
        }
        // 如果底部滚动视图存在，也要测量它
        bottomScrollView?.let { scrollView ->
            val scrollWidthSpec = MeasureSpec.makeMeasureSpec(availableWidth, MeasureSpec.EXACTLY)
            val scrollHeightSpec = MeasureSpec.makeMeasureSpec(bottomRowHeight, MeasureSpec.EXACTLY)
            scrollView.measure(scrollWidthSpec, scrollHeightSpec)
        }
        bottomContainer?.let { container ->
            val widthSpec = View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
            val heightSpec = View.MeasureSpec.makeMeasureSpec(bottomRowHeight+mainViewHeight+verticalSpacing, View.MeasureSpec.EXACTLY)
            container.measure(widthSpec, heightSpec)
            container.minimumWidth= availableWidth // 设置最小宽度为可用宽度
        }
    }


    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        val childCount = childCount
        if (childCount == 0) {
            return
        }

        when (layoutMode) {
            LayoutMode.GRID -> {
                layoutGridMode()
            }
            LayoutMode.FOCUS -> {
                layoutFocusMode()
            }
        }
    }

    private fun layoutGridMode() {
        val childCount = originalViews.size

        val availableWidth = width - paddingLeft - paddingRight
        val availableHeight = height - paddingTop - paddingBottom
        
        val gridInfo = calculateOptimalGrid(childCount, availableWidth, availableHeight)
        
        // 计算每个item的大小（考虑行margin）
        val availableWidthForItems = availableWidth - 2 * gridRowMargin
        val itemWidth = (availableWidthForItems - horizontalSpacing * (gridInfo.columns - 1)) / gridInfo.columns
        val itemHeight = itemWidth
        
        // 计算实际使用的总高度
        val totalUsedHeight = gridInfo.rows * itemHeight + (gridInfo.rows - 1) * verticalSpacing
        // 计算垂直居中的偏移量
        val verticalOffset = (availableHeight - totalUsedHeight) / 2
        
        // 计算最后一行的item数量
        val lastRowItems = childCount % gridInfo.columns
        val isLastRowIncomplete = lastRowItems != 0 && gridInfo.rows > 1
        
        // 布局所有子视图
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child.isGone) continue
            
            val row = i / gridInfo.columns
            val col = i % gridInfo.columns
            
            // 检查是否是最后一行且需要居中
            val isLastRow = row == gridInfo.rows - 1
            var horizontalOffset = gridRowMargin // 添加行margin
            
            if (isLastRow && isLastRowIncomplete) {
                // 计算最后一行的居中偏移量
                val lastRowItemsCount = if (lastRowItems == 0) gridInfo.columns else lastRowItems
                val lastRowTotalWidth = lastRowItemsCount * itemWidth + (lastRowItemsCount - 1) * horizontalSpacing
                horizontalOffset = gridRowMargin + (availableWidthForItems - lastRowTotalWidth) / 2
            }
            
            val childLeft = paddingLeft + horizontalOffset + col * (itemWidth + horizontalSpacing)
            val childTop = paddingTop + verticalOffset + row * (itemHeight + verticalSpacing)
            val childRight = childLeft + itemWidth
            val childBottom = childTop + itemHeight
            
            child.layout(childLeft, childTop, childRight, childBottom)
            
            // 设置点击监听器
            child.setOnClickListener { view ->
                if (!isAnimating) {
                    onItemClickListener?.onItemClick(view, i)
                }
            }
        }
        originalViews.forEach {
            setChildViewVisiable(it,R.id.ll_container,VISIBLE)
            if (originalViews.size<=6){
                setChildViewVisiable(it,R.id.user_name,VISIBLE)
            }else{
                setChildViewVisiable(it,R.id.user_name,GONE)
            }
        }
    }

    private fun layoutFocusMode() {
        val availableWidth = width - paddingLeft - paddingRight
        val availableHeight = height - paddingTop - paddingBottom

        // 计算主视图的大小（考虑左右margin）
        val mainViewWidth = availableWidth - 2 * focusHorizontalMargin
        val mainViewSize = mainViewWidth
        // 计算垂直居中偏移量（考虑底部滚动视图的空间）
        val totalContentHeight = mainViewSize + verticalSpacing + bottomRowHeight
        val verticalOffset = (availableHeight - totalContentHeight) / 2

        // 布局主视图
        focusedView?.let { view ->
            view.layout(
                paddingLeft + focusHorizontalMargin,
                paddingTop + verticalOffset,
                paddingLeft + focusHorizontalMargin + mainViewWidth,
                paddingTop + verticalOffset + mainViewSize
            )

            // 设置点击监听器（点击主视图回到网格模式）
            view.setOnClickListener {
                if (!isAnimating) {
                    switchToGridMode()
                }
            }
        }
        // 布局底部滚动视图
        layoutBottomScrollView(availableWidth, availableHeight, mainViewSize, verticalOffset)
    }

    private fun setupBottomScrollView(availableWidth: Int) {
        val layoutParams = LinearLayout.LayoutParams(
            bottomRowHeight, bottomRowHeight
        ).apply {
            // 使用统一的左右margin，第一个和最后一个视图的额外间距由container的padding处理
            setMargins(0, 0, horizontalSpacing, 0)
        }

        originalViews.filter {
                it != focusedView
            }
            .forEach {
                (it.parent as? ViewGroup)?.removeView(it)
                bottomContainer?.addView(it, layoutParams)
                it.setOnClickListener { clickedView ->
                    if (!isAnimating) {
                        switchFocusedView(clickedView)
                    }
                }
            }
        if (bottomScrollView?.parent !=this@MultiVideoCallGridLayout){
            (bottomScrollView?.parent as? ViewGroup)?.removeView(bottomScrollView)
            addView(bottomScrollView,0)
        }
    }

    private fun layoutBottomScrollView(availableWidth: Int, availableHeight: Int, mainViewHeight: Int, verticalOffset: Int = 0) {
        bottomScrollView?.let { scrollView ->
            val left = paddingLeft
            //top 这里把scrollView到顶，调的很大，是为了子view和focusview切换时动画效果能展现出来。注意跟focusview的层级问题导致的点击事件问题
            val top = paddingTop + verticalOffset
            val right = paddingLeft + availableWidth
            val bottom = top + mainViewHeight + verticalSpacing+ bottomRowHeight
            scrollView.layout(left, top, right, bottom)
        }
        originalViews.forEach {
            if (it != focusedView) {
                setChildViewVisiable(it, R.id.ll_container, GONE)
                setChildViewVisiable(it, R.id.network_status, GONE)
            }else{
                setChildViewVisiable(it, R.id.ll_container, VISIBLE)
                setChildViewVisiable(it, R.id.network_status, VISIBLE)
            }
        }
    }


    /**
     * 切换到聚焦模式
     */
    fun switchToFocusMode(focusView: View) {
        if (isAnimating || layoutMode == LayoutMode.FOCUS) {
            return
        }
        focusedView = focusView
        animateToFocusMode()
    }

    /**
     * 切换聚焦的视图
     */
    private fun switchFocusedView(newFocusView: View) {
        if (isAnimating || newFocusView == focusedView) {
            return
        }
        val oldFocusView = focusedView
        focusedView = newFocusView
        animateFocusSwitch(oldFocusView, newFocusView)
    }

    /**
     * 切换到网格模式
     */
    fun switchToGridMode() {
        if (isAnimating || layoutMode == LayoutMode.GRID) {
            return
        }
        animateToGridMode()
    }

    private fun animateToFocusMode() {
        isAnimating = true
        // 保存当前位置
        val animators = mutableListOf<Animator>()
        children.forEach { child ->
            if (child != bottomScrollView) {
                // 保存原始位置
//                child.tag = Rect(child.left, child.top, child.right, child.bottom)
                val alpha = ObjectAnimator.ofFloat(child, View.ALPHA, 1f, 0f)
                animators.add(alpha)
            }
        }
        
        val animatorSet = AnimatorSet()
        animatorSet.playTogether(animators)
        animatorSet.duration = ANIMATION_DURATION
        animatorSet.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                layoutMode = LayoutMode.FOCUS

                removeAllViews()

                // 确保focusedView在主容器中
                focusedView?.let { view ->
                    if (view.parent != this@MultiVideoCallGridLayout) {
                        // 如果focusedView不在主容器中，先从其父容器移除，然后添加到主容器
                        (view.parent as? ViewGroup)?.removeView(view)
                        addView(view)
                    }
                }

                val availableWidth = width - paddingLeft - paddingRight

                // 设置底部滚动视图
                setupBottomScrollView(availableWidth)
                
                // 恢复透明度
                originalViews.forEach { child ->
                    if (child != bottomScrollView) {
                        child.alpha = 1f
                    }
                }

                isAnimating = false
            }
        })
        animatorSet.start()
    }

    private fun animateToGridMode() {
        isAnimating = true

        val animators = mutableListOf<Animator>()
        // 主视图缩放动画
        originalViews.forEach { view ->
//            val scaleX = ObjectAnimator.ofFloat(view, View.SCALE_X, 1f, 0.8f, 1f)
//            val scaleY = ObjectAnimator.ofFloat(view, View.SCALE_Y, 1f, 0.8f, 1f)
            val alpha = ObjectAnimator.ofFloat(view, View.ALPHA, 1f, 0f)
            animators.addAll(listOf(alpha))
        }
        val animatorSet = AnimatorSet()
        animatorSet.playTogether(animators)
        animatorSet.duration = ANIMATION_DURATION
        animatorSet.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                layoutMode = LayoutMode.GRID
                // 5. 清除主容器中剩余的任何视图（如果有的话）
                bottomContainer?.removeAllViews()
                removeAllViews()
                // 6. 按原始顺序重新添加所有视频视图到主容器
                originalViews.forEach { it ->
                    (it.parent as? ViewGroup)?.removeView(it)
                    addView(it)
                    it.alpha=1f
                }
                focusedView = null
                requestLayout()
                isAnimating = false
            }
        })
        animatorSet.start()
    }

    private fun animateFocusSwitch(oldFocusView: View?, newFocusView: View) {
        isAnimating = true
        
        // 获取newFocusView和oldFocusView的屏幕绝对坐标
        val newViewLocation = IntArray(2)
        val oldViewLocation = IntArray(2)
        
        newFocusView.getLocationOnScreen(newViewLocation)
        oldFocusView?.getLocationOnScreen(oldViewLocation)
        
        // 计算左下角坐标（屏幕坐标系中，y坐标向下增加）
        val newViewBottomLeftX = newViewLocation[0].toFloat()
        val newViewBottomLeftY = newViewLocation[1].toFloat() + newFocusView.height
        
        val oldViewBottomLeftX = oldViewLocation[0].toFloat()
        val oldViewBottomLeftY = oldViewLocation[1].toFloat() + (oldFocusView?.height ?: 0)
        
        // 计算平移距离（从newView左下角到oldView左下角）
        val deltaX = oldViewBottomLeftX - newViewBottomLeftX
        val deltaY = oldViewBottomLeftY - newViewBottomLeftY
        
        // 计算缩放比例（从newView尺寸到oldView尺寸）
        val scaleX = (oldFocusView?.width?.toFloat() ?: newFocusView.width.toFloat()) / newFocusView.width.toFloat()
        val scaleY = (oldFocusView?.height?.toFloat() ?: newFocusView.height.toFloat()) / newFocusView.height.toFloat()
        
        // 设置pivotPoint为左下角（相对于view的坐标系）
        newFocusView.pivotX = 0f
        newFocusView.pivotY = newFocusView.height.toFloat()
        
        val animators = mutableListOf<Animator>()
        
        // 平移动画
        val translationX = ObjectAnimator.ofFloat(newFocusView, View.TRANSLATION_X, 0f, deltaX)
        val translationY = ObjectAnimator.ofFloat(newFocusView, View.TRANSLATION_Y, 0f, deltaY)
        
        // 缩放动画（以左下角为原点）
        val scaleXAnimator = ObjectAnimator.ofFloat(newFocusView, View.SCALE_X, 1f, scaleX)
        val scaleYAnimator = ObjectAnimator.ofFloat(newFocusView, View.SCALE_Y, 1f, scaleY)

//        val alphaAnimator = ObjectAnimator.ofFloat(newFocusView, View.ALPHA, 1f, 0f)
        
        animators.addAll(listOf(translationX, translationY, scaleXAnimator, scaleYAnimator))
        
        // 为oldFocusView添加动画（从oldView位置移动到newView位置，以右下角为原点）
        oldFocusView?.let { oldView ->
            // 先设置oldView为透明，然后通过动画显示出来
            oldView.alpha = 0f
            
            // 计算右下角坐标
            val oldViewBottomRightX = oldViewLocation[0].toFloat() + oldView.width
            val oldViewBottomRightY = oldViewLocation[1].toFloat() + oldView.height
            
            val newViewBottomRightX = newViewLocation[0].toFloat() + newFocusView.width
            val newViewBottomRightY = newViewLocation[1].toFloat() + newFocusView.height
            
            // 计算平移距离（从oldView右下角到newView右下角）
            val oldDeltaX = newViewBottomRightX - oldViewBottomRightX
            val oldDeltaY = newViewBottomRightY - oldViewBottomRightY
            
            // 计算缩放比例（从oldView尺寸到newView尺寸）
            val oldScaleX = newFocusView.width.toFloat() / oldView.width.toFloat()
            val oldScaleY = newFocusView.height.toFloat() / oldView.height.toFloat()
            
            // 设置pivotPoint为右下角（相对于view的坐标系）
            oldView.pivotX = oldView.width.toFloat()
            oldView.pivotY = oldView.height.toFloat()
            
            // oldView的动画
            val oldTranslationX = ObjectAnimator.ofFloat(oldView, View.TRANSLATION_X, 0f, oldDeltaX)
            val oldTranslationY = ObjectAnimator.ofFloat(oldView, View.TRANSLATION_Y, 0f, oldDeltaY)
            val oldScaleXAnimator = ObjectAnimator.ofFloat(oldView, View.SCALE_X, 1f, oldScaleX)
            val oldScaleYAnimator = ObjectAnimator.ofFloat(oldView, View.SCALE_Y, 1f, oldScaleY)
            val oldAlphaAnimator = ObjectAnimator.ofFloat(oldView, View.ALPHA, 0f, 1f)
            
            animators.addAll(listOf(oldTranslationX, oldTranslationY, oldScaleXAnimator, oldScaleYAnimator, oldAlphaAnimator))
            
        }
        
        val animatorSet = AnimatorSet()
        animatorSet.playTogether(animators)
        animatorSet.duration = ANIMATION_DURATION
        animatorSet.addListener(object : AnimatorListenerAdapter() {

            override fun onAnimationEnd(animation: Animator) {
                // 重置newFocusView的变换属性
                newFocusView.translationX = 0f
                newFocusView.translationY = 0f
                newFocusView.scaleX = 1f
                newFocusView.scaleY = 1f
                newFocusView.pivotX = newFocusView.width.toFloat() / 2
                newFocusView.pivotY = newFocusView.height.toFloat() / 2
                newFocusView.alpha= 1f
                
                // 重置oldFocusView的变换属性
                oldFocusView?.let { oldView ->
                    oldView.translationX = 0f
                    oldView.translationY = 0f
                    oldView.scaleX = 1f
                    oldView.scaleY = 1f
                    oldView.pivotX = oldView.width.toFloat() / 2
                    oldView.pivotY = oldView.height.toFloat() / 2
                }
                
                // 记录新焦点视图在底部容器中的位置索引
                val newFocusViewIndex = bottomContainer?.indexOfChild(newFocusView) ?: -1
                
                // 实际移动视图：将新的焦点视图从底部容器移到主容器，将旧的焦点视图移到底部容器的相同位置
                
                // 1. 处理新的焦点视图 - 确保它在主容器中
                if (newFocusView.parent == bottomContainer) {
                    bottomContainer?.removeView(newFocusView)
                } else if (newFocusView.parent != this@MultiVideoCallGridLayout) {
                    (newFocusView.parent as? ViewGroup)?.removeView(newFocusView)
                }
                
                // 确保新焦点视图在主容器中
                if (newFocusView.parent == null) {
                    addView(newFocusView)
                }
                
                // 2. 处理旧的焦点视图 - 将其移到底部容器的指定位置
                oldFocusView?.let { oldView ->
                    if (oldView != newFocusView) { // 确保不是同一个视图
                        (oldView.parent as? ViewGroup)?.removeView(oldView)
                        // 添加到底部容器，使用统一的margin
                        val layoutParams = LinearLayout.LayoutParams(bottomRowHeight , bottomRowHeight).apply {
                            // 使用统一的margin，与其他视图保持一致
                            setMargins(0, 0, horizontalSpacing, 0)
                        }
                        
                        // 将旧焦点视图插入到新焦点视图原来的位置，实现位置互换
                        if (newFocusViewIndex >= 0 && newFocusViewIndex <= (bottomContainer?.childCount ?: 0)) {
                            bottomContainer?.addView(oldView, newFocusViewIndex, layoutParams)
                        } else {
                            // 如果索引无效，则添加到末尾作为备选方案
                            bottomContainer?.addView(oldView, layoutParams)
                        }
                        
                        // 恢复oldView的透明度
                        oldView.alpha = 1f
                        
                        // 设置点击监听器
                        oldView.setOnClickListener { clickedView ->
                            if (!isAnimating) {
                                switchFocusedView(clickedView)
                            }
                        }
                    }
                }

                // 3. 重新布局
                requestLayout()
                
                isAnimating = false
            }
        })
        animatorSet.start()
    }

    private fun setChildViewVisiable(parentView: View,restID:Int, visiable: Int) {
        if (parentView is MultiVideoCallMemberView) {
            val llContainer = parentView.findViewById<View>(restID)
            llContainer?.visibility=visiable
        }
    }

    /**
     * 计算最佳的网格布局
     */
    private fun calculateOptimalGrid(childCount: Int, availableWidth: Int, availableHeight: Int): GridInfo {
        if (childCount <= 1) {
            return GridInfo(1, 1)
        }

        // 特殊情况处理
        when (childCount) {
            2 -> {
                return GridInfo(1, 2) // 1行2列
            }
            3, 4 -> {
                return GridInfo(2, 2) // 2行2列
            }
            5, 6 -> {
                return GridInfo(3, 2) // 3行2列
            }
            7, 8, 9 -> {
                return GridInfo(3, 3) // 3行3列
            }
            10, 11, 12 -> {
                return GridInfo(4, 3) // 4行3列
            }
            13, 14, 15, 16 -> {
                return GridInfo(4, 4) // 4行4列
            }
        }

        // 对于更多参与者，动态计算
        val aspectRatio = availableWidth.toFloat() / availableHeight.toFloat()
        val sqrtCount = sqrt(childCount.toFloat())
        
        var bestColumns = ceil(sqrtCount).toInt()
        var bestRows = ceil(childCount.toFloat() / bestColumns).toInt()
        
        // 根据屏幕宽高比调整
        if (aspectRatio > 1.5f) {
            // 宽屏，增加列数
            bestColumns = min(bestColumns + 1, childCount)
            bestRows = ceil(childCount.toFloat() / bestColumns).toInt()
        } else if (aspectRatio < 0.75f) {
            // 高屏，增加行数
            bestRows = min(bestRows + 1, childCount)
            bestColumns = ceil(childCount.toFloat() / bestRows).toInt()
        }
        
        return GridInfo(bestRows, bestColumns)
    }

    /**
     * 是否处于聚焦模式
     */
    fun isFocusMode(): Boolean {
        return layoutMode == LayoutMode.FOCUS
    }

    /**
     * 获取当前聚焦视图
     */
    fun getFocusedView(): View? {
        return focusedView
    }

    /**
     * 设置间距
     */
    fun setSpacing(horizontal: Int, vertical: Int) {
        horizontalSpacing = dpToPx(horizontal)
        verticalSpacing = dpToPx(vertical)
        requestLayout()
    }

    /**
     * 设置网格模式每行的左右margin
     */
    fun setGridRowMargin(margin: Int) {
        gridRowMargin = dpToPx(margin)
        requestLayout()
    }

    /**
     * 设置焦点模式主视图的左右margin
     */
    fun setFocusHorizontalMargin(margin: Int) {
        focusHorizontalMargin = dpToPx(margin)
        requestLayout()
    }

    /**
     * 设置最小item大小
     */
    fun setMinItemSize(size: Int) {
        minItemSize = dpToPx(size)
        requestLayout()
    }

    /**
     * 添加视频视图
     */
    fun addVideoView(view: View) {
        if (!originalViews.contains(view)){
            originalViews.add(view)
        }
        if (layoutMode == LayoutMode.FOCUS) {
            // 如果当前是聚焦模式，直接添加到底部容器
            bottomContainer?.addView(view)
        } else {
            // 否则添加到主容器
            if (view.parent != this@MultiVideoCallGridLayout) {
                (view.parent as? ViewGroup)?.removeView(view)
                addView(view)
            }else{
                Log.e(TAG, "addVideoView: View already added to this layout")
            }

        }
    }

    /**
     * 移除视频视图
     */
    fun removeVideoView(view: View) {
        if (!originalViews.contains(view)) {
            ChatLog.e(TAG, "removeVideoView: View not found in original views")
            return
        }
        originalViews.remove(view)
        if (layoutMode== LayoutMode.FOCUS ) {
            if (focusedView == view){
                focusedView = null // 如果移除的是聚焦视图，清空聚焦视图
                // 切换回网格模式
                switchToGridMode()
            }else{
                // 如果移除的是底部滚动视图中的视图，也需要从底部容器中移除
                bottomContainer?.removeView(view)
            }
        }else{
            removeView(view)
        }
    }

    /**
     * 清除所有视频视图
     */
    fun clearAllViews() {
        focusedView = null
        layoutMode = LayoutMode.GRID
        originalViews.clear()
        removeAllViews()
        bottomScrollView = null
        bottomContainer = null
    }

    /**
     * 设置点击监听器
     */
    fun setOnItemClickListener(listener: OnItemClickListener?) {
        onItemClickListener = listener
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density + 0.5f).toInt()
    }

    /**
     * 布局模式枚举
     */
    enum class LayoutMode {
        GRID,   // 网格模式
        FOCUS   // 聚焦模式（一个大视图+底部滚动）
    }

    /**
     * 网格信息
     */
    private data class GridInfo(val rows: Int, val columns: Int)

    /**
     * 点击监听器
     */
    interface OnItemClickListener {
        fun onItemClick(view: View, position: Int)
    }

    override fun generateDefaultLayoutParams(): ViewGroup.LayoutParams {
        return ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    }

    override fun generateLayoutParams(attrs: AttributeSet?): ViewGroup.LayoutParams {
        return ViewGroup.LayoutParams(context, attrs)
    }

    override fun generateLayoutParams(p: ViewGroup.LayoutParams?): ViewGroup.LayoutParams {
        return ViewGroup.LayoutParams(p)
    }

    override fun checkLayoutParams(p: ViewGroup.LayoutParams?): Boolean {
        return p is ViewGroup.LayoutParams
    }
    @Synchronized
    fun refreshSequence(memberView: MultiVideoCallMemberView) {
        originalViews.remove(memberView)
        val count = originalViews.filter { it is MultiVideoCallMemberView }
            .count{ (it as MultiVideoCallMemberView).isConnected() }
        originalViews.add(count,memberView)

        if (layoutMode==LayoutMode.GRID){
            //grid mode
            if (memberView.parent == this) {
                removeView(memberView)
                children.filter { it is MultiVideoCallMemberView }.count{(it as MultiVideoCallMemberView).isConnected() }.let { count ->
                    addView(memberView, count)
                    ChatLog.d(TAG, "refreshSequence() add ${memberView.getUserInfo()?.userId} at position: $count")
                }
            }
        }else{
            if (memberView.parent == bottomContainer) {
                bottomContainer?.removeView(memberView)
                bottomContainer?.children?.filter { it is MultiVideoCallMemberView }?.count{(it as MultiVideoCallMemberView).isConnected() }?.let { count ->
                    bottomContainer?.addView(memberView, count)
                    ChatLog.d(TAG, "refreshSequence() add ${memberView.getUserInfo()?.userId} at position: $count in bottomContainer")
                }
            }
        }
    }
}