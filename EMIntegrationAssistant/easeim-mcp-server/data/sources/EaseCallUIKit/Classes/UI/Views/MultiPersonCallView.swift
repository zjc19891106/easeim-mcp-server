//
//  MultiPersonCallView.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/1/25.
//

import UIKit

public class MultiPersonCallView: UIView {
    
    private weak var expandedView: CallStreamView?
    private var scrollView: UIScrollView?
    private var activeConstraints: [NSLayoutConstraint] = []
    public var touchOtherArea: (() -> Void)?
    private var hasInitial: Bool = false
    // MARK: - 动画保护属性
    private var isAnimating: Bool = false
    private var _isAnimating: Bool {
        get { animationQueue.sync { self._isAnimating } }
        set { animationQueue.sync { self._isAnimating = newValue } }
    }
    private var pendingOperations: [() -> Void] = []
    private let animationGroup = DispatchGroup()
    private let animationQueue = DispatchQueue(label: "animation.queue")
    private let tapDebouncer = Debouncer(delay: 0.3)
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupViews()
    }
    
    // MARK: - 辅助动画方法

    private func animateRemovalAndReturnToNormal(viewsToRemove: [CallStreamView]) {
        self.isAnimating = true
        // 从 canvasCache 中移除
        for view in viewsToRemove {
            CallKitManager.shared.canvasCache.removeValue(forKey: view.item.userId)
        }
        
        // 淡出所有要删除的视图
        UIView.animate(withDuration: 0.3, animations: {
            for view in viewsToRemove {
                view.alpha = 0
            }
            self.scrollView?.alpha = 0
        }, completion: { _ in
            // 移除视图
            for view in viewsToRemove {
                view.removeFromSuperview()
            }
            for subview in self.scrollView?.subviews ?? [] {
                subview.removeFromSuperview()
            }
            self.scrollView?.removeFromSuperview()
            self.scrollView = nil
            self.expandedView = nil
            
            // 重新设置视图
            // 检查删除后剩余的视图数量
            let remainingCount = CallKitManager.shared.canvasCache.count
            if remainingCount == 1 {
                // 只剩一个视图，执行特殊处理
                self.animateToSingleViewLayout()
            } else {
                // 重新布局展开状态的缩略图
                self.setupViews()
            }
            self.setAnimating(false)
        })
    }

    private func animateRemovalInExpandedState(viewsToRemove: [CallStreamView], viewsInScrollView: [CallStreamView]) {
        // 先从缓存中移除
        for view in viewsToRemove {
            CallKitManager.shared.canvasCache.removeValue(forKey: view.item.userId)
        }
        
        let remainingCount = CallKitManager.shared.canvasCache.count
        
        // 如果只剩1个，转换到单视图布局
        if remainingCount == 1 {
            self.animateToSingleViewLayout()
            return  // 提前返回，避免后续操作
        }
        
        // 如果没有展开视图了，返回正常状态
        if let expandedView = expandedView, viewsToRemove.contains(expandedView) {
            self.animateRemovalAndReturnToNormal(viewsToRemove: viewsToRemove)
            return
        }
        
        // 确保 scrollView 存在
        guard let scrollView = scrollView else {
            // 如果 scrollView 丢失，重建展开状态
            self.layoutItemsForExpandedState()
            self.setAnimating(false)
            return
        }
        
        var completionCount = 0
        let totalAnimations = (!viewsInScrollView.isEmpty ? 1 : 0) +
        (viewsToRemove.filter { !viewsInScrollView.contains($0) }.isEmpty ? 0 : 1)
        
        let checkCompletion = { [weak self] in
            completionCount += 1
            if completionCount >= totalAnimations {
                self?.setAnimating(false)
            }
        }
        
        // 从scrollView中删除缩略图
        if !viewsInScrollView.isEmpty {
            UIView.animate(withDuration: 0.3, animations: {
                for view in viewsInScrollView {
                    view.alpha = 0
                    view.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
                }
            }, completion: { _ in
                for view in viewsInScrollView {
                    view.removeFromSuperview()
                }
                
                let remainingCount = CallKitManager.shared.canvasCache.count
                if remainingCount == 1 {
                    self.animateToSingleViewLayout()
                } else {
                    self.updateScrollViewContent()
                }
                checkCompletion()
            })
        }
        
        // 处理主视图中的删除
        let mainViewRemovals = viewsToRemove.filter { !viewsInScrollView.contains($0) }
        if !mainViewRemovals.isEmpty {
            UIView.animate(withDuration: 0.3, animations: {
                for view in mainViewRemovals {
                    view.alpha = 0
                }
            }, completion: { _ in
                for view in mainViewRemovals {
                    view.removeFromSuperview()
                }
                
                let remainingCount = CallKitManager.shared.canvasCache.count
                if remainingCount == 1 {
                    self.animateToSingleViewLayout()
                }
                checkCompletion()
            })
        }
        
        // 如果没有动画，直接完成
        if totalAnimations == 0 {
            self.setAnimating(false)
        }
    }

    // 新增方法：处理只剩一个视图的情况
    private func animateToSingleViewLayout() {
        guard let lastView = CallKitManager.shared.canvasCache.values.first else { return }
        
        // 清除展开状态
        expandedView = nil
        
        // 更新视图状态
        if let item = CallKitManager.shared.itemsCache[lastView.item.userId] {
            item.isExpanded = false
            lastView.updateItem(item)
        }
        lastView.displayMode = .all
        
        // 如果视图在 scrollView 中，移到主视图
        if lastView.superview == scrollView {
            lastView.removeFromSuperview()
            addSubview(lastView)
        }
        
        // 计算目标尺寸
        let aspectRatio = ScreenHeight / ScreenWidth
        let targetSize: CGFloat
        
        if aspectRatio <= 16.0/9.0 {
            // 屏幕高宽比正好是 16:9
            targetSize = ScreenWidth * 2.0/3.0
        } else {
            // 屏幕高宽比大于 16:9（更高的屏幕）
            targetSize = ScreenWidth - 24
        }
        
        // 清除现有约束
        NSLayoutConstraint.deactivate(activeConstraints)
        activeConstraints.removeAll()
        
        // 动画过渡到新布局
        UIView.animate(withDuration: 0.4, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0.3, options: [.curveEaseInOut], animations: {
            // 淡出 scrollView
            self.scrollView?.alpha = 0
            
            // 设置单个视图的约束
            lastView.translatesAutoresizingMaskIntoConstraints = false
            
            self.activeConstraints = [
                lastView.centerXAnchor.constraint(equalTo: self.centerXAnchor),
                lastView.centerYAnchor.constraint(equalTo: self.centerYAnchor),
                lastView.widthAnchor.constraint(equalToConstant: targetSize),
                lastView.heightAnchor.constraint(equalToConstant: targetSize)
            ]
            
            NSLayoutConstraint.activate(self.activeConstraints)
            self.layoutIfNeeded()
            
        }, completion: { _ in
            // 清理 scrollView
            self.scrollView?.removeFromSuperview()
            self.scrollView = nil
            
            // 确保视图可见
            lastView.ensureVisible()
            self.setupViews()
            self.layoutIfNeeded()
        })
    }


    // 更新 scrollView 中的内容布局
    private func updateScrollViewContent() {
        guard let scrollView = scrollView, let expandedView = expandedView else {
            // 如果没有展开视图，应该回到正常状态
            layoutItemsForNormalState()
            return
        }
        
        NSLayoutConstraint.deactivate(activeConstraints)
        activeConstraints.removeAll()
        
        let thumbnailSize: CGFloat = 72
        let thumbnailSpacing: CGFloat = 6
        let padding: CGFloat = 12
        
        // 重新布局 scrollView 中的视图
        let remainingViews = scrollView.subviews
            .compactMap { $0 as? CallStreamView }
            .sorted { $0.item.index > $1.item.index }
        
        for (index, view) in remainingViews.enumerated() {
            view.translatesAutoresizingMaskIntoConstraints = false
            let leadingConstant = padding + CGFloat(index) * (thumbnailSize + thumbnailSpacing)
            
            activeConstraints += [
                view.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor, constant: leadingConstant),
                view.centerYAnchor.constraint(equalTo: scrollView.centerYAnchor),
                view.widthAnchor.constraint(equalToConstant: thumbnailSize),
                view.heightAnchor.constraint(equalToConstant: thumbnailSize)
            ]
        }
        
        // 确保展开视图的约束正确
        activeConstraints += [
            expandedView.centerXAnchor.constraint(equalTo: centerXAnchor),
            expandedView.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -40),
            expandedView.widthAnchor.constraint(equalToConstant: ScreenWidth - 24),
            expandedView.heightAnchor.constraint(equalToConstant: ScreenWidth - 24)
        ]
        
        // 更新 scrollView 的 contentSize
        let contentWidth = padding + CGFloat(remainingViews.count) * (thumbnailSize + thumbnailSpacing) - thumbnailSpacing + padding
        scrollView.contentSize = CGSize(width: contentWidth, height: thumbnailSize)
        
        NSLayoutConstraint.activate(activeConstraints)
    }
    
    func updateItem(_ item: CallStreamItem) {
        CallKitManager.shared.canvasCache[item.userId]?.updateItem(item)
    }
    
    func updateUsersInfo(_ usersInfo: [String]) {
        for userId in usersInfo {
            if let item = CallKitManager.shared.itemsCache[userId] {
                CallKitManager.shared.canvasCache[userId]?.updateItem(item)
            }
        }
    }
    
    // MARK: - Private Methods
    private func setupViews() {
        // Clear existing views
        for subview in scrollView?.subviews ?? [] {
            subview.removeFromSuperview()
        }
        for subview in subviews {
            subview.removeFromSuperview()
        }
        scrollView?.removeFromSuperview()
        scrollView = nil
        
        self.addGestureHandlers()
        self.layoutItemsForNormalState()
        self.updateAllDisplayModes()

    }
    
    private func addGestureHandlers() {
        for canvas in CallKitManager.shared.canvasCache.values {
            canvas.onTap = { [weak self] tappedView in
                self?.handleItemTap(tappedView)
            }
            canvas.onPinchToShrink = { [weak self] view in
                self?.handlePinchToShrink(view)
            }
        }
    }
    
    private func updateAllDisplayModes() {
        let itemViews = CallKitManager.shared.canvasCache.values
        let totalCount = itemViews.count
        if expandedView != nil {
            for view in itemViews {
                view.displayMode = (view == expandedView ? .all:.hidden)
            }
        } else {
            for view in itemViews {
                if totalCount > 6 {
                    view.displayMode = view.item.waiting ? .nameOnly:.buttonsOnly
                } else {
                    if ScreenHeight/ScreenWidth > 1.8,totalCount <= 4 {
                        view.displayMode = view.item.waiting ? .nameOnly:.all
                    } else {
                        view.displayMode = view.item.waiting ? .nameOnly:.buttonsOnly
                    }
                }
            }
        }
    }
    
    private func handleItemTap(_ tappedView: CallStreamView) {
        self.tapDebouncer.debounce { [weak self] in
            guard let `self` = self else { return }
            if self.isAnimating {
                return
            }
            if CallKitManager.shared.canvasCache.count <= 1 {
                // 如果只有一个视图，直接返回,不再特殊处理点击变化
                return
            }
            if let currentExpanded = self.expandedView {
                if currentExpanded == tappedView {
                    // Tapped the expanded view, return to normal
                    self.animateToNormalStateSmooth()
                } else {
                    // Switching to a different expanded view
                    self.switchExpandedViewWithSmartSpace(from: currentExpanded, to: tappedView)
                }
            } else {
                // No expanded view, expand the tapped one
                self.animateExpandViewImproved(tappedView)
            }
            
            // 统一更新所有视图的 displayMode
            self.updateAllDisplayModes()
        }
        
    }
    
    
    private func handlePinchToShrink(_ view: CallStreamView) {
        if isAnimating {
            return
        }
        if expandedView == view {
            animateToNormalStateSmooth()
        }
    }
    
    // Helper method to create smooth position interpolation
    private func animateViewTransition(from startFrame: CGRect, to endFrame: CGRect, view: UIView, duration: TimeInterval = 0.5) {
        // Create a container view for the animation
        let animationContainer = UIView(frame: startFrame)
        animationContainer.backgroundColor = .clear
        addSubview(animationContainer)
        
        // Add the view to the container
        view.frame = animationContainer.bounds
        animationContainer.addSubview(view)
        
        // Animate the container
        UIView.animate(withDuration: duration, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0.3, options: [.curveEaseInOut], animations: {
            animationContainer.frame = endFrame
        }, completion: { _ in
            // Move view back to its parent and remove container
            view.removeFromSuperview()
            self.addSubview(view)
            view.frame = endFrame
            animationContainer.removeFromSuperview()
        })
    }
    
    private func layoutItemsForNormalState() {
        NSLayoutConstraint.deactivate(activeConstraints)
        activeConstraints.removeAll()
        let itemViews = CallKitManager.shared.canvasCache.values.sorted { $0.item.index > $1.item.index }
        // 确保所有视图都在当前视图层级中
        for view in itemViews {
            
            // 从原有父视图移除
            view.translatesAutoresizingMaskIntoConstraints = false
            view.transform = .identity
            // 添加到当前视图
            if view.superview != self {
                view.removeFromSuperview()
                addSubview(view)
            }
        }
        let count = itemViews.count
        let padding: CGFloat = 8
        let availableWidth = bounds.width - (padding * 2)
        let availableHeight = bounds.height - (padding * 2)
        let heightWidthRatio: CGFloat = ScreenHeight/ScreenWidth // Square views
        switch count {
        case 1:
            // Single view - square, centered
            var size: CGFloat = 0
            if heightWidthRatio <= 16.0/9.0 {
                // 屏幕高宽比正好是 16:9
                size = ScreenWidth * 2.0/3.0
            } else {
                // 屏幕高宽比大于 16:9（更高的屏幕）
                size = ScreenWidth - 24
            }
            let view = itemViews[0]
            activeConstraints += [
                view.centerXAnchor.constraint(equalTo: centerXAnchor),
                view.centerYAnchor.constraint(equalTo: centerYAnchor),
                view.widthAnchor.constraint(equalToConstant: size),
                view.heightAnchor.constraint(equalToConstant: size)
            ]
        case 2:
            // Two views - side by side squares
            let maxSize = min((availableWidth - padding) / 2, availableHeight, 250)
            
            activeConstraints += [
                itemViews[0].centerXAnchor.constraint(equalTo: centerXAnchor, constant: -(maxSize + padding) / 2),
                itemViews[0].centerYAnchor.constraint(equalTo: centerYAnchor),
                itemViews[0].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[0].heightAnchor.constraint(equalToConstant: maxSize),
                
                itemViews[1].centerXAnchor.constraint(equalTo: centerXAnchor, constant: (maxSize + padding) / 2),
                itemViews[1].centerYAnchor.constraint(equalTo: centerYAnchor),
                itemViews[1].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[1].heightAnchor.constraint(equalToConstant: maxSize)
            ]
            
        case 3:
            // Special case: 2 rows, second row centered
            let maxSize = min((availableWidth - padding) / 2, (availableHeight - padding) / 2, 200)
            
            // First row - 2 items
            activeConstraints += [
                itemViews[0].centerXAnchor.constraint(equalTo: centerXAnchor, constant: -(maxSize + padding) / 2),
                itemViews[0].centerYAnchor.constraint(equalTo: centerYAnchor, constant: -(maxSize + padding) / 2),
                itemViews[0].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[0].heightAnchor.constraint(equalToConstant: maxSize),
                
                itemViews[1].centerXAnchor.constraint(equalTo: centerXAnchor, constant: (maxSize + padding) / 2),
                itemViews[1].centerYAnchor.constraint(equalTo: centerYAnchor, constant: -(maxSize + padding) / 2),
                itemViews[1].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[1].heightAnchor.constraint(equalToConstant: maxSize)
            ]
            
            // Second row - 1 item centered
            activeConstraints += [
                itemViews[2].centerXAnchor.constraint(equalTo: centerXAnchor),
                itemViews[2].centerYAnchor.constraint(equalTo: centerYAnchor, constant: (maxSize + padding) / 2),
                itemViews[2].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[2].heightAnchor.constraint(equalToConstant: maxSize)
            ]
            
        case 4:
            // 2x2 grid
            let maxSize = min((availableWidth - padding) / 2, (availableHeight - padding) / 2, 200)
            
            activeConstraints += [
                itemViews[0].centerXAnchor.constraint(equalTo: centerXAnchor, constant: -(maxSize + padding) / 2),
                itemViews[0].centerYAnchor.constraint(equalTo: centerYAnchor, constant: -(maxSize + padding) / 2),
                itemViews[0].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[0].heightAnchor.constraint(equalToConstant: maxSize),
                
                itemViews[1].centerXAnchor.constraint(equalTo: centerXAnchor, constant: (maxSize + padding) / 2),
                itemViews[1].centerYAnchor.constraint(equalTo: centerYAnchor, constant: -(maxSize + padding) / 2),
                itemViews[1].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[1].heightAnchor.constraint(equalToConstant: maxSize),
                
                itemViews[2].centerXAnchor.constraint(equalTo: centerXAnchor, constant: -(maxSize + padding) / 2),
                itemViews[2].centerYAnchor.constraint(equalTo: centerYAnchor, constant: (maxSize + padding) / 2),
                itemViews[2].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[2].heightAnchor.constraint(equalToConstant: maxSize),
                
                itemViews[3].centerXAnchor.constraint(equalTo: centerXAnchor, constant: (maxSize + padding) / 2),
                itemViews[3].centerYAnchor.constraint(equalTo: centerYAnchor, constant: (maxSize + padding) / 2),
                itemViews[3].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[3].heightAnchor.constraint(equalToConstant: maxSize)
            ]
            
        case 5 where heightWidthRatio > 1.8:
            
            // Special case: 3 rows (2+2+1), last row centered
            let columns = 2
            let rows = 3
            let maxSize = min((availableWidth - padding * CGFloat(columns - 1)) / CGFloat(columns),
                             (availableHeight - padding * CGFloat(rows - 1)) / CGFloat(rows), 180)
            
            let totalGridHeight = CGFloat(rows) * maxSize + CGFloat(rows - 1) * padding
            let gridStartY = (bounds.height - totalGridHeight) / 2
            
            // First two rows (2+2)
            for i in 0..<4 {
                let row = i / 2
                let col = i % 2
                let x = bounds.width / 2 + (CGFloat(col) - 0.5) * (maxSize + padding)
                let y = gridStartY + CGFloat(row) * (maxSize + padding) + maxSize / 2
                
                activeConstraints += [
                    itemViews[i].centerXAnchor.constraint(equalTo: leadingAnchor, constant: x),
                    itemViews[i].centerYAnchor.constraint(equalTo: topAnchor, constant: y),
                    itemViews[i].widthAnchor.constraint(equalToConstant: maxSize),
                    itemViews[i].heightAnchor.constraint(equalToConstant: maxSize)
                ]
            }
            
            // Third row - 1 item centered
            let y = gridStartY + 2 * (maxSize + padding) + maxSize / 2
            activeConstraints += [
                itemViews[4].centerXAnchor.constraint(equalTo: centerXAnchor),
                itemViews[4].centerYAnchor.constraint(equalTo: topAnchor, constant: y),
                itemViews[4].widthAnchor.constraint(equalToConstant: maxSize),
                itemViews[4].heightAnchor.constraint(equalToConstant: maxSize)
            ]
            
        case 6 where heightWidthRatio > 1.8:
            // 3 rows x 2 columns grid (not 2x3)
            // Use same size as 4 items (2x2 grid)
            let maxSizeForWidth = (availableWidth - padding) / 2
            let maxSizeForHeight = (availableHeight - padding * 2) / 3  // 3 rows
            let maxSize = min(maxSizeForWidth, maxSizeForHeight, 180)
            
            let totalGridWidth = 2 * maxSize + padding
            let totalGridHeight = 3 * maxSize + 2 * padding
            let gridStartX = (bounds.width - totalGridWidth) / 2
            let gridStartY = (bounds.height - totalGridHeight) / 2
            
            // Layout in 3 rows, 2 columns
            for i in 0..<6 {
                let row = i / 2  // 2 columns per row
                let col = i % 2  // column within row
                
                let x = gridStartX + CGFloat(col) * (maxSize + padding) + maxSize / 2
                let y = gridStartY + CGFloat(row) * (maxSize + padding) + maxSize / 2
                itemViews[i].displayMode = .all
                activeConstraints += [
                    itemViews[i].centerXAnchor.constraint(equalTo: leadingAnchor, constant: x),
                    itemViews[i].centerYAnchor.constraint(equalTo: topAnchor, constant: y),
                    itemViews[i].widthAnchor.constraint(equalToConstant: maxSize),
                    itemViews[i].heightAnchor.constraint(equalToConstant: maxSize)
                ]
            }
            
        case 7, 8:
            // Special case for 7-8 items: 3x3 grid with last row centered
            let columns = 3
            let rows = 3
            let maxSize = min((availableWidth - padding * CGFloat(columns - 1)) / CGFloat(columns),
                             (availableHeight - padding * CGFloat(rows - 1)) / CGFloat(rows), 150)
            
            let totalGridHeight = CGFloat(rows) * maxSize + CGFloat(rows - 1) * padding
            let gridStartY = (bounds.height - totalGridHeight) / 2
            
            // Layout all items
            for (index, view) in itemViews.enumerated() {
                let row = index / columns
                let col = index % columns
                
                // Check if this is the last row
                let isLastRow = row == rows - 1
                let itemsInLastRow = count - row * columns
                
                if isLastRow && itemsInLastRow < columns {
                    // Center the last row items
                    let totalLastRowWidth = CGFloat(itemsInLastRow) * maxSize + CGFloat(itemsInLastRow - 1) * padding
                    let lastRowStartX = (bounds.width - totalLastRowWidth) / 2
                    let x = lastRowStartX + CGFloat(col) * (maxSize + padding)
                    let y = gridStartY + CGFloat(row) * (maxSize + padding)
                    
                    activeConstraints += [
                        view.leadingAnchor.constraint(equalTo: leadingAnchor, constant: x),
                        view.topAnchor.constraint(equalTo: topAnchor, constant: y),
                        view.widthAnchor.constraint(equalToConstant: maxSize),
                        view.heightAnchor.constraint(equalToConstant: maxSize)
                    ]
                } else {
                    // Normal grid positioning
                    let totalGridWidth = CGFloat(columns) * maxSize + CGFloat(columns - 1) * padding
                    let gridStartX = (bounds.width - totalGridWidth) / 2
                    let x = gridStartX + CGFloat(col) * (maxSize + padding)
                    let y = gridStartY + CGFloat(row) * (maxSize + padding)
                    
                    activeConstraints += [
                        view.leadingAnchor.constraint(equalTo: leadingAnchor, constant: x),
                        view.topAnchor.constraint(equalTo: topAnchor, constant: y),
                        view.widthAnchor.constraint(equalToConstant: maxSize),
                        view.heightAnchor.constraint(equalToConstant: maxSize)
                    ]
                }
            }
            
        default:
            // For more items, use flexible grid with special centering rules
            let columns: Int
            let rows: Int
            
            // Determine grid size based on count
            if count <= 9 {
                columns = 3
                rows = Int(ceil(Double(count) / Double(columns)))
            } else if count <= 12 {
                columns = 3
                rows = Int(ceil(Double(count) / Double(columns)))
            } else {
                columns = 4
                rows = Int(ceil(Double(count) / Double(columns)))
            }
            
            let maxSizeByWidth = (availableWidth - padding * CGFloat(columns - 1)) / CGFloat(columns)
            let maxSizeByHeight = (availableHeight - padding * CGFloat(rows - 1)) / CGFloat(rows)
            let size = min(maxSizeByWidth, maxSizeByHeight, 150)
            
            let totalGridHeight = CGFloat(rows) * size + CGFloat(rows - 1) * padding
            let gridStartY = (bounds.height - totalGridHeight) / 2
            
            // Layout all rows
            for (index, view) in itemViews.enumerated() {
                let row = index / columns
                let col = index % columns
                
                // Check if this is the last row
                let isLastRow = row == rows - 1
                let itemsInLastRow = count - row * columns
                
                if isLastRow && itemsInLastRow < columns {
                    // Center the last row items
                    let totalLastRowWidth = CGFloat(itemsInLastRow) * size + CGFloat(itemsInLastRow - 1) * padding
                    let lastRowStartX = (bounds.width - totalLastRowWidth) / 2
                    let x = lastRowStartX + CGFloat(col) * (size + padding)
                    let y = gridStartY + CGFloat(row) * (size + padding)
                    
                    activeConstraints += [
                        view.leadingAnchor.constraint(equalTo: leadingAnchor, constant: x),
                        view.topAnchor.constraint(equalTo: topAnchor, constant: y),
                        view.widthAnchor.constraint(equalToConstant: size),
                        view.heightAnchor.constraint(equalToConstant: size)
                    ]
                } else {
                    // Normal grid positioning
                    let totalGridWidth = CGFloat(columns) * size + CGFloat(columns - 1) * padding
                    let gridStartX = (bounds.width - totalGridWidth) / 2
                    let x = gridStartX + CGFloat(col) * (size + padding)
                    let y = gridStartY + CGFloat(row) * (size + padding)
                    
                    activeConstraints += [
                        view.leadingAnchor.constraint(equalTo: leadingAnchor, constant: x),
                        view.topAnchor.constraint(equalTo: topAnchor, constant: y),
                        view.widthAnchor.constraint(equalToConstant: size),
                        view.heightAnchor.constraint(equalToConstant: size)
                    ]
                }
            }
        }
        
        NSLayoutConstraint.activate(activeConstraints)
    }
    
    private func layoutItemsForExpandedState() {
        guard let expandedView = expandedView else { return }
        
        // Clear all existing constraints first
        NSLayoutConstraint.deactivate(activeConstraints)
        activeConstraints.removeAll()
        expandedView.translatesAutoresizingMaskIntoConstraints = false
        let padding: CGFloat = 20
        let heightWidthRatio: CGFloat = ScreenHeight/ScreenWidth // Square views
        
        var expandedHeight: CGFloat = 0
        
        if heightWidthRatio <= 16.0/9.0 {
            // 屏幕高宽比正好是 16:9
            expandedHeight = ScreenWidth * 2.0/3.0
        } else {
            // 屏幕高宽比大于 16:9（更高的屏幕）
            expandedHeight = ScreenWidth - 24
        }
        let thumbnailSize: CGFloat = 72
        let thumbnailSpacing: CGFloat = 6
        
        // Setup scroll view for thumbnails
        if scrollView == nil {
            scrollView = UIScrollView()
            scrollView!.showsHorizontalScrollIndicator = false
            scrollView!.translatesAutoresizingMaskIntoConstraints = false
            scrollView!.bounces = false
            scrollView!.alpha = 0
            scrollView!.backgroundColor = UIColor.clear
            addSubview(scrollView!)
            
            UIView.animate(withDuration: 0.3) {
                self.scrollView!.alpha = 1
            }
        }
        
        // Ensure expanded view is in the main view (not in scroll view)
        if expandedView.superview != self {
            expandedView.removeFromSuperview()
            addSubview(expandedView)
        }
        
        // Make sure expanded view is visible
        expandedView.ensureVisible()
        
        // Ensure correct view hierarchy
        if let scrollView = scrollView {
            // Make sure scrollView is at the correct position in hierarchy
            insertSubview(scrollView, at: 0)
        }
        
        // Move expanded view to the absolute front
        bringSubviewToFront(expandedView)
        
        let itemViews = CallKitManager.shared.canvasCache.values.sorted { $0.item.index > $1.item.index }
        // Add thumbnail views to scroll view (all square) - sorted by index
        let otherViews = itemViews.filter { $0 != expandedView }.sorted { $0.item.index > $1.item.index }
        
        // Clear scroll view content first
        scrollView!.subviews.forEach { $0.removeFromSuperview() }
        
        var contentWidth = CGFloat(otherViews.count) * (thumbnailSize + thumbnailSpacing) - thumbnailSpacing
        activeConstraints += [
            expandedView.centerXAnchor.constraint(equalTo: centerXAnchor),
            expandedView.centerYAnchor.constraint(equalTo: centerYAnchor,constant: heightWidthRatio > 16.0/9.0 ? -40 : -10),
            expandedView.widthAnchor.constraint(equalToConstant: expandedHeight),
            expandedView.heightAnchor.constraint(equalToConstant: expandedHeight)
        ]
        // Removed the extra padding
        activeConstraints += [
            scrollView!.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView!.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView!.topAnchor.constraint(equalTo: expandedView.bottomAnchor, constant: 12),
            scrollView!.heightAnchor.constraint(equalToConstant: thumbnailSize)
        ]

        for (index, view) in otherViews.enumerated() {
            // Ensure view is visible before adding to scroll view
            view.ensureVisible()
            view.displayMode = .hidden
            scrollView!.addSubview(view)
            view.translatesAutoresizingMaskIntoConstraints = false
            
            let leadingConstant = 12 + CGFloat(index) * (thumbnailSize + thumbnailSpacing)
            
            activeConstraints += [
                view.leadingAnchor.constraint(equalTo: scrollView!.leadingAnchor, constant: leadingConstant),
                view.centerYAnchor.constraint(equalTo: scrollView!.centerYAnchor),
                view.widthAnchor.constraint(equalToConstant: thumbnailSize),
                view.heightAnchor.constraint(equalToConstant: thumbnailSize)
            ]
        }
        expandedView.displayMode = .all
        contentWidth = 12 + CGFloat(otherViews.count) * (thumbnailSize + thumbnailSpacing) - thumbnailSpacing + padding
        scrollView!.contentSize = CGSize(width: contentWidth, height: thumbnailSize)
        
        // Activate all constraints at once
        NSLayoutConstraint.activate(activeConstraints)
        
        // Final check: ensure expanded view is visible and on top
        expandedView.ensureVisible()
        bringSubviewToFront(expandedView)
    }
    
    public override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesBegan(touches, with: event)
        
        guard let touch = touches.first else { return }
        let location = touch.location(in: self)
        
        // 检查是否点击到 CallStreamView
        var hitCallStreamView = false
        
        for subview in subviews {
            if let streamView = subview as? CallStreamView,
               streamView.frame.contains(location) {
                hitCallStreamView = true
                break
            }
        }
        
        // 也检查 scrollView 中的视图
        if let scrollView = scrollView {
            let scrollLocation = touch.location(in: scrollView)
            for subview in scrollView.subviews {
                if let streamView = subview as? CallStreamView,
                   streamView.frame.contains(scrollLocation) {
                    hitCallStreamView = true
                    break
                }
            }
        }
        
        if !hitCallStreamView {
            // 点击了空白区域
            self.touchOtherArea?()
        }
    }
}

//动画保护
// MARK: - 改进的动画保护机制
extension MultiPersonCallView {
    
    private func performAnimatedOperation(_ operation: @escaping () -> Void) {
        animationQueue.async { [weak self] in
            guard let self = self else { return }
            
            if self._isAnimating {
                self.pendingOperations.append(operation)
                return
            }
            
            DispatchQueue.main.async {
                self._isAnimating = true
                self.animationGroup.enter()
                operation()
            }
        }
    }
    
    private func completeAnimation() {
        animationGroup.leave()
        animationGroup.notify(queue: .main) { [weak self] in
            self?.animationQueue.async {
                self?._isAnimating = false
                if let nextOp = self?.pendingOperations.first {
                    self?.pendingOperations.removeFirst()
                    DispatchQueue.main.async {
                        self?.performAnimatedOperation(nextOp)
                    }
                }
            }
        }
    }


    // 简化的动画保护，只用于updateWithItems相关操作
    private func setAnimating(_ animating: Bool) {
        isAnimating = animating
        
        if !animating && !pendingOperations.isEmpty {
            let nextOperation = pendingOperations.removeFirst()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                nextOperation()
            }
        }
    }
    
    // 添加待处理操作（仅用于updateWithItems）
    private func addPendingOperation(_ operation: @escaping () -> Void) {
        if isAnimating {
            pendingOperations.append(operation)
        } else {
            operation()
        }
    }
}

// MARK: - 改进现有动画方法（最简单的方案）
extension MultiPersonCallView {
    
    private func animateExpandViewImproved(_ viewToExpand: CallStreamView) {
        self.isAnimating = true
        // Store original frame for calculating starting constraints
        let originalFrame = viewToExpand.frame
        
        // Ensure the view is visible and in the correct superview
        viewToExpand.ensureVisible()
        if viewToExpand.superview != self {
            viewToExpand.removeFromSuperview()
            addSubview(viewToExpand)
        }
        
        expandedView = viewToExpand
        
        // Update display modes, item states, and video streams (unchanged)
        for view in CallKitManager.shared.canvasCache.values {
            view.displayMode = (view == viewToExpand ? .all : .hidden)
            view.item.isExpanded = (view == viewToExpand)
            if viewToExpand.item.userId == view.item.userId {
                CallKitManager.shared.engine?.setRemoteVideoStream(UInt(view.item.uid), type: .high)
            } else {
                CallKitManager.shared.engine?.setRemoteVideoStream(UInt(view.item.uid), type: CallKitManager.shared.getStreamRenderQuality(with: UInt(CallKitManager.shared.canvasCache.count)))
            }
        }
        
        // Deactivate existing constraints to prepare for transition
        NSLayoutConstraint.deactivate(activeConstraints)
        activeConstraints.removeAll()
        
        // Set up the target expanded layout, but don't activate constraints yet
        layoutItemsForExpandedState()
        let targetConstraints = activeConstraints // Capture the new expanded constraints
        NSLayoutConstraint.deactivate(targetConstraints) // Deactivate temporarily
        
        // Create temporary starting constraints matching the original frame
        viewToExpand.translatesAutoresizingMaskIntoConstraints = false
        let startingConstraints: [NSLayoutConstraint] = [
            viewToExpand.leadingAnchor.constraint(equalTo: leadingAnchor, constant: originalFrame.origin.x),
            viewToExpand.topAnchor.constraint(equalTo: topAnchor, constant: originalFrame.origin.y),
            viewToExpand.widthAnchor.constraint(equalToConstant: originalFrame.width),
            viewToExpand.heightAnchor.constraint(equalToConstant: originalFrame.height)
        ]
        // Add starting constraints for other views/scrollView if needed, but focus on expanded view for simplicity
        
        // Activate starting constraints
        NSLayoutConstraint.activate(startingConstraints)
        layoutIfNeeded() // Ensure starting position is applied immediately
        
        // Animate the transition to target constraints
        UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0.3, options: [.curveEaseInOut, .allowUserInteraction], animations: {
            // Swap constraints: deactivate starting, activate target
            NSLayoutConstraint.deactivate(startingConstraints)
            NSLayoutConstraint.activate(targetConstraints)
            
            // Also animate scrollView fade-in if it was just created
            self.scrollView?.alpha = 1.0
            
            self.layoutIfNeeded() // This triggers the animated layout change
        }, completion: { _ in
            // Clean up: remove starting constraints entirely
            startingConstraints.forEach { $0.isActive = false }
            
            // Ensure final layout and visibility
            self.activeConstraints = targetConstraints
            self.layoutIfNeeded()
            viewToExpand.ensureVisible()
            self.bringSubviewToFront(viewToExpand)
            self.updateAllDisplayModes()
            self.setAnimating(false)
        })
    }
    
    // 缩小动画也需要相应改进
    private func animateToNormalStateSmooth() {
        guard let currentExpanded = expandedView else { return }
        self.isAnimating = true
        let expandedFrame = currentExpanded.frame
        expandedView = nil
        
        CallKitManager.shared.itemsCache.values.forEach { $0.isExpanded = false }
        
        // Clean up orphaned views
        cleanupOrphanedViews()
        
        // Get sorted views once
        let itemViews = CallKitManager.shared.canvasCache.values
            .sorted { $0.item.index > $1.item.index }
        
        // Move all views back to main view
        itemViews.forEach { view in
            if view.superview != self {
                view.removeFromSuperview()
                view.transform = .identity
                addSubview(view)
            }
            view.ensureVisible()
        }
        
        updateAllDisplayModes()
        
        // Calculate target layout without activating constraints
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layoutItemsForNormalState()
        layoutIfNeeded()
        let finalFrame = currentExpanded.frame
        currentExpanded.frame = expandedFrame
        CATransaction.commit()
        
        // Animate transition
        UIView.animateKeyframes(withDuration: 0.5, delay: 0, options: [.calculationModeCubic], animations: {
            UIView.addKeyframe(withRelativeStartTime: 0, relativeDuration: 0.6) {
                let intermediateSize = CGSize(
                    width: expandedFrame.width - (expandedFrame.width - finalFrame.width) * 0.7,
                    height: expandedFrame.height - (expandedFrame.height - finalFrame.height) * 0.7
                )
                let intermediateOrigin = CGPoint(
                    x: expandedFrame.origin.x + (finalFrame.origin.x - expandedFrame.origin.x) * 0.7,
                    y: expandedFrame.origin.y + (finalFrame.origin.y - expandedFrame.origin.y) * 0.7
                )
                currentExpanded.frame = CGRect(origin: intermediateOrigin, size: intermediateSize)
            }
            
            UIView.addKeyframe(withRelativeStartTime: 0.6, relativeDuration: 0.4) {
                currentExpanded.frame = finalFrame
            }
            
            UIView.addKeyframe(withRelativeStartTime: 0, relativeDuration: 0.3) {
                self.scrollView?.alpha = 0
            }
        }, completion: { _ in
            self.scrollView?.removeFromSuperview()
            self.scrollView = nil
            
            // Don't call setupViews() here, just ensure layout is correct
            self.layoutItemsForNormalState()
            itemViews.forEach { $0.ensureVisible() }
            self.setAnimating(false)
        })
    }
    
    // Add helper method to clean up orphaned views
    private func cleanupOrphanedViews() {
        for subview in subviews {
            if let streamView = subview as? CallStreamView {
                if CallKitManager.shared.canvasCache[streamView.item.userId] == nil {
                    streamView.removeFromSuperview()
                }
            }
        }
        
        if let scrollView = scrollView {
            for subview in scrollView.subviews {
                if let streamView = subview as? CallStreamView {
                    if CallKitManager.shared.canvasCache[streamView.item.userId] == nil {
                        streamView.removeFromSuperview()
                    }
                }
            }
        }
    }
    
}

// MARK: - 智能空间腾挪的切换动画
extension MultiPersonCallView {
    
    private func switchExpandedViewWithSmartSpace(from oldView: CallStreamView, to newView: CallStreamView) {
        self.isAnimating = true
        // 1. 记录初始位置
        let oldExpandedFrame = oldView.frame
        var newThumbnailFrame: CGRect = .zero
        var newViewOriginalPositionInScroll: Int = -1
        
        // 获取 newView 的位置
        if let scrollView = scrollView, newView.superview == scrollView {
            newThumbnailFrame = scrollView.convert(newView.frame, to: self)
            
            // 找到 newView 在 scrollView 中的实际位置（不是 item.index）
            let sortedViews = scrollView.subviews.compactMap { $0 as? CallStreamView }
                .sorted { $0.item.index > $1.item.index }
            newViewOriginalPositionInScroll = sortedViews.firstIndex(of: newView) ?? -1
        } else {
            newThumbnailFrame = newView.frame
        }
        
        // 2. 更新视图状态和视频流
        for view in CallKitManager.shared.canvasCache.values {
            view.displayMode = (view == newView ? .all : .hidden)
            if newView.item.userId == view.item.userId {
                CallKitManager.shared.engine?.setRemoteVideoStream(UInt(view.item.uid), type: .high)
            } else {
                CallKitManager.shared.engine?.setRemoteVideoStream(UInt(view.item.uid), type: CallKitManager.shared.getStreamRenderQuality(with: UInt(CallKitManager.shared.canvasCache.count)))
            }
        }
        
        // 更新展开状态
        expandedView = newView
        oldView.item.isExpanded = false
        newView.item.isExpanded = true
        
        // 3. 如果 newView 在 scrollView 中，移到主视图
        if newView.superview == scrollView {
            newView.removeFromSuperview()
            addSubview(newView)
            newView.frame = newThumbnailFrame
        }
        print("newThumbnail .frame : \(newThumbnailFrame)")
        
        // 4. 计算 oldView 在 scrollView 中的目标位置
        var oldViewTargetPosition: Int = 0
        var needsSpaceAnimation = true
        
        if let scrollView = scrollView {
            let existingViews = scrollView.subviews.compactMap { $0 as? CallStreamView }
                .sorted { $0.item.index > $1.item.index }
            
            // 根据 index 大小关系计算插入位置
            for view in existingViews {
                if view.item.index > oldView.item.index {
                    oldViewTargetPosition += 1
                }
            }
            
            // 如果是最后一个位置，不需要空间动画
            let totalPositions = existingViews.count + 1
            needsSpaceAnimation = (oldViewTargetPosition < totalPositions - 1)
        }
        
        // 5. 准备视图移动数据
        var viewsToMove: [(view: CallStreamView, startX: CGFloat, endX: CGFloat)] = []
        let thumbnailSize: CGFloat = 72
        let thumbnailSpacing: CGFloat = 6
        let padding: CGFloat = 12
        
        if let scrollView = scrollView, needsSpaceAnimation {
            let currentViews = scrollView.subviews.compactMap { $0 as? CallStreamView }
                .sorted { $0.item.index > $1.item.index }
            
            // 计算每个视图的目标位置
            for (currentPosition, view) in currentViews.enumerated() {
                let currentX = view.frame.origin.x
                var targetPosition = currentPosition
                
                // 如果当前位置 >= oldView的目标位置，需要右移
                if currentPosition >= oldViewTargetPosition {
                    targetPosition = currentPosition + 1
                }
                
                // 如果 newView 原本在这之前，需要左移填补空缺
                if newViewOriginalPositionInScroll >= 0 && currentPosition > newViewOriginalPositionInScroll {
                    targetPosition -= 1
                }
                
                let targetX = padding + CGFloat(targetPosition) * (thumbnailSize + thumbnailSpacing)
                
                if currentX != targetX {
                    viewsToMove.append((view: view, startX: currentX, endX: targetX))
                }
            }
        }
        
        // 6. 创建快照用于动画
        guard let oldViewSnapshot = oldView.snapshotView(afterScreenUpdates: false) else {
            print("⚠️ Failed to create snapshot")
            return
        }
        
        oldViewSnapshot.frame = oldExpandedFrame
        addSubview(oldViewSnapshot)
        print("oldViewSnapshot.frame : \(oldViewSnapshot.frame)")
        // 隐藏原始 oldView
        oldView.isHidden = true
        oldView.alpha = 0
        
        
        // 7. 准备 oldView 的最终位置
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        
        if let scrollView = scrollView {
            // 移除旧的父视图关系
            oldView.removeFromSuperview()
            
            // 添加到 scrollView
            scrollView.addSubview(oldView)
            oldView.translatesAutoresizingMaskIntoConstraints = false
            
            // 设置正确的约束（使用计算出的目标位置）
            let leadingConstant = padding + CGFloat(oldViewTargetPosition) * (thumbnailSize + thumbnailSpacing)
            
            // 在 switchExpandedViewWithSmartSpace 中修改
            let oldViewConstraints = [
                oldView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor, constant: leadingConstant),
                oldView.centerYAnchor.constraint(equalTo: scrollView.centerYAnchor),
                oldView.widthAnchor.constraint(equalToConstant: thumbnailSize),
                oldView.heightAnchor.constraint(equalToConstant: thumbnailSize)
            ]

            // 添加到 activeConstraints 数组
            activeConstraints.append(contentsOf: oldViewConstraints)
            NSLayoutConstraint.activate(oldViewConstraints)
            oldView.removeFromSuperview()
        }
        
        // 重新布局展开状态
        layoutItemsForExpandedState()
        self.setNeedsLayout()
        self.layoutIfNeeded()
        Thread.sleep(forTimeInterval: 0.01)
        
        let newExpandedFrame = newView.frame
        var oldThumbnailFrameInMainView: CGRect = .zero
        
        if let scrollView = scrollView {
            oldThumbnailFrameInMainView = scrollView.convert(oldView.frame, to: self)
            oldView.isHidden = false  // 使其可见但透明
        }
        
        // 重置 newView 到动画开始位置
        newView.frame = newThumbnailFrame
        CATransaction.commit()
        
        // 8. 执行动画
        // 第一阶段：为 oldView 腾出空间（如果需要）
        if needsSpaceAnimation && !viewsToMove.isEmpty {
            UIView.animate(withDuration: 0.25,
                          delay: 0,
                          options: [.curveEaseOut],
                          animations: {
                for (view, _, endX) in viewsToMove {
                    view.frame.origin.x = endX
                }
            })
        }
        
        // 第二阶段：主动画
        UIView.animate(withDuration: 0.25,
                      delay: needsSpaceAnimation ? 0.05 : 0,
                      options: [.curveEaseInOut],
                      animations: {
            // oldView 快照缩小到目标位置
            oldViewSnapshot.frame = oldThumbnailFrameInMainView
            
            // 真实 oldView 渐显
            oldView.alpha = 1.0
        }, completion: { _ in
            // 移除快照
            oldViewSnapshot.removeFromSuperview()
        })
        
        // newView 展开动画
        UIView.animate(withDuration: 0.25,
                      delay: 0.05,
                      options: [.curveEaseInOut],
                      animations: {
            // 展开到目标位置
            newView.frame = newExpandedFrame
            
            // 确保层级正确
            self.bringSubviewToFront(newView)
        }, completion: { _ in
            // 确保视图可见
            newView.ensureVisible()
            self.updateAllDisplayModes()
            
            // 更新 scrollView 的 contentSize
            if let scrollView = self.scrollView {
                let viewCount = scrollView.subviews.compactMap { $0 as? CallStreamView }.count
                let contentWidth = padding + CGFloat(viewCount) * (thumbnailSize + thumbnailSpacing) - thumbnailSpacing + padding
                scrollView.contentSize = CGSize(width: contentWidth, height: thumbnailSize)
            }
            // 重新布局展开状态
            self.layoutItemsForExpandedState()
            self.setNeedsLayout()
            self.layoutIfNeeded()
            self.setAnimating(false)
        })
    }
    
    private func updateExpandedViewOnly(newExpandedView: CallStreamView) {
        var expandedHeight: CGFloat = 0
        
        let heightWidthRatio: CGFloat = ScreenHeight/ScreenWidth // Square views
        
        if heightWidthRatio <= 16.0/9.0 {
            // 屏幕高宽比正好是 16:9
            expandedHeight = ScreenWidth * 2.0/3.0
        } else {
            // 屏幕高宽比大于 16:9（更高的屏幕）
            expandedHeight = ScreenWidth - 24
        }
        // 只更新 expandedView 的约束，不重建整个 scrollView
        NSLayoutConstraint.deactivate(activeConstraints.filter { constraint in
            constraint.firstItem === expandedView || constraint.secondItem === expandedView
        })
        
        // 添加新的展开视图约束
        let expandedConstraints = [
            newExpandedView.centerXAnchor.constraint(equalTo: centerXAnchor),
            newExpandedView.centerYAnchor.constraint(equalTo: centerYAnchor),
            newExpandedView.widthAnchor.constraint(equalToConstant: expandedHeight),
            newExpandedView.heightAnchor.constraint(equalToConstant: expandedHeight)
        ]
        
        activeConstraints.append(contentsOf: expandedConstraints)
        NSLayoutConstraint.activate(expandedConstraints)
    }
}

// MARK: - 添加用户处理
extension MultiPersonCallView {
    
    /// 检测并添加新用户视图（从全局缓存中检测新增的视图）
    func addNewUsersIfNeeded() {
        // 1. 找出新增的视图（在缓存中但不在当前视图层级中的）
        var newViews: [CallStreamView] = []
        var existingViewIds = Set<String>()
        
        // 收集当前已显示的视图ID
        for subview in subviews {
            if let streamView = subview as? CallStreamView {
                existingViewIds.insert(streamView.item.userId)
            }
        }
        
        // 检查scrollView中的视图
        if let scrollView = scrollView {
            for subview in scrollView.subviews {
                if let streamView = subview as? CallStreamView {
                    existingViewIds.insert(streamView.item.userId)
                }
            }
        }
        
        // 找出新增的视图
        for (userId, view) in CallKitManager.shared.canvasCache {
            if !existingViewIds.contains(userId) {
                newViews.append(view)
            }
        }
        
        // 如果没有新增视图，直接返回
        guard !newViews.isEmpty else { return }
        
        // 2. 根据当前状态处理新增视图
        if expandedView != nil {
            // 展开状态下添加
            addUsersInExpandedState(newViews)
        } else {
            // 正常状态下添加
            addUsersInNormalState(newViews)
        }
    }
    
    // 新增辅助方法：检查是否有新用户
    private func checkForNewUsers() -> Bool {
        var existingViewIds = Set<String>()
        
        // 收集当前已显示的视图ID
        for subview in subviews {
            if let streamView = subview as? CallStreamView {
                existingViewIds.insert(streamView.item.userId)
            }
        }
        
        if let scrollView = scrollView {
            for subview in scrollView.subviews {
                if let streamView = subview as? CallStreamView {
                    existingViewIds.insert(streamView.item.userId)
                }
            }
        }
        
        // 检查是否有新用户
        for (userId, _) in CallKitManager.shared.canvasCache {
            if !existingViewIds.contains(userId) {
                return true
            }
        }
        
        return false
    }

    // 处理删除逻辑
    private func handleUserRemoval(_ removeUsers: [String]) {
        // 原有的删除逻辑...
        var viewsInScrollView: [CallStreamView] = []
        let currentUserIds = Set(CallKitManager.shared.itemsCache.keys)
        var viewsToRemove: [CallStreamView] = []
        
        // 检查 scrollView 中的 CallStreamView
        if let scrollView = scrollView {
            for subview in scrollView.subviews {
                if let streamView = subview as? CallStreamView {
                    if !currentUserIds.contains(streamView.item.userId) {
                        viewsToRemove.append(streamView)
                    } else {
                        viewsInScrollView.append(streamView)
                    }
                }
            }
        }
        
        let isRemovingExpandedView = removeUsers.contains { $0 == expandedView?.item.userId ?? "" }
        
        if isRemovingExpandedView {
            animateRemovalAndReturnToNormal(viewsToRemove: viewsToRemove)
        } else if expandedView != nil {
            animateRemovalInExpandedState(viewsToRemove: viewsToRemove, viewsInScrollView: viewsInScrollView)
        } else {
            layoutItemsForNormalState()
        }
        
        updateAllDisplayModes()
    }

    // 合并处理添加和删除
    private func handleAddAndRemove(_ removeUsers: [String]) {
        // 先处理删除
        handleUserRemoval(removeUsers)
        
        // 延迟添加新用户，避免布局冲突
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.addNewUsersIfNeeded()
        }
    }

    
    /// 在正常状态下添加新用户
    private func addUsersInNormalState(_ newViews: [CallStreamView]) {
        self.isAnimating = true
        // 为新视图添加手势处理
        for view in newViews {
            view.onTap = { [weak self] tappedView in
                self?.handleItemTap(tappedView)
            }
            view.onPinchToShrink = { [weak self] view in
                self?.handlePinchToShrink(view)
            }
            view.alpha = 0
        }
        
        // 重新布局所有视图
        layoutItemsForNormalState()
        updateAllDisplayModes()
        
        // 动画显示新视图
        UIView.animate(withDuration: 0.3, delay: 0, options: [.curveEaseOut], animations: {
            for view in newViews {
                view.alpha = 1.0
            }
            self.setAnimating(false)
            self.layoutIfNeeded()
        })
    }
    
    /// 在展开状态下添加新用户
    private func addUsersInExpandedState(_ newViews: [CallStreamView]) {
        self.isAnimating = true
        guard let scrollView = scrollView, let expandedView = expandedView else {
            // 如果不在展开状态，使用正常状态添加
            addUsersInNormalState(newViews)
            return
        }
        
        // 1. 为新视图设置初始状态
        for view in newViews {
            view.displayMode = .hidden
            view.alpha = 0
            view.translatesAutoresizingMaskIntoConstraints = false
            
            // 添加手势处理
            view.onTap = { [weak self] tappedView in
                self?.handleItemTap(tappedView)
            }
            view.onPinchToShrink = { [weak self] view in
                self?.handlePinchToShrink(view)
            }
            
            // 添加到scrollView
            scrollView.addSubview(view)
        }
        
        // 2. 获取当前scrollView中的所有缩略图（不包括新添加的）
        let existingThumbnails = scrollView.subviews
            .compactMap { $0 as? CallStreamView }
            .filter { !newViews.contains($0) }
            .sorted { $0.item.index > $1.item.index }
        
        // 3. 合并所有缩略图并排序
        let allThumbnails = (existingThumbnails + newViews)
            .filter { $0 != expandedView }
            .sorted { $0.item.index > $1.item.index }
        
        // 4. 重新布局
        rebuildExpandedStateLayout(expandedView: expandedView, thumbnails: allThumbnails)
        
        // 5. 动画显示新添加的视图
        UIView.animate(withDuration: 0.3, delay: 0, options: [.curveEaseOut], animations: {
            for view in newViews {
                view.alpha = 1.0
            }
            self.layoutIfNeeded()
        }, completion: { _ in
            // 更新显示模式
            self.updateAllDisplayModes()
            
            // 如果需要，滚动到显示新添加的用户
            if let lastNewView = newViews.last {
                self.scrollToShowThumbnail(lastNewView)
            }
            self.setAnimating(false)
        })
    }
    
    /// 重建展开状态的布局
    private func rebuildExpandedStateLayout(expandedView: CallStreamView, thumbnails: [CallStreamView]) {
        // 清除旧约束
        NSLayoutConstraint.deactivate(activeConstraints)
        activeConstraints.removeAll()
        
        let thumbnailSize: CGFloat = 72
        let thumbnailSpacing: CGFloat = 6
        let padding: CGFloat = 12
        
        // 计算展开视图尺寸
        let expandedHeight = (ScreenHeight/ScreenWidth <= 16.0/9.0) ?
            ScreenWidth * 2.0/3.0 : ScreenWidth - 24
        
        // 设置展开视图约束
        expandedView.translatesAutoresizingMaskIntoConstraints = false
        activeConstraints += [
            expandedView.centerXAnchor.constraint(equalTo: centerXAnchor),
            expandedView.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -40),
            expandedView.widthAnchor.constraint(equalToConstant: expandedHeight),
            expandedView.heightAnchor.constraint(equalToConstant: expandedHeight)
        ]
        
        // 设置scrollView约束
        if let scrollView = scrollView {
            activeConstraints += [
                scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
                scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
                scrollView.topAnchor.constraint(equalTo: expandedView.bottomAnchor, constant: 12),
                scrollView.heightAnchor.constraint(equalToConstant: thumbnailSize)
            ]
            
            // 布局所有缩略图
            for (index, view) in thumbnails.enumerated() {
                let leadingConstant = padding + CGFloat(index) * (thumbnailSize + thumbnailSpacing)
                
                view.translatesAutoresizingMaskIntoConstraints = false
                activeConstraints += [
                    view.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor, constant: leadingConstant),
                    view.centerYAnchor.constraint(equalTo: scrollView.centerYAnchor),
                    view.widthAnchor.constraint(equalToConstant: thumbnailSize),
                    view.heightAnchor.constraint(equalToConstant: thumbnailSize)
                ]
            }
            
            // 更新contentSize
            let contentWidth = padding + CGFloat(thumbnails.count) * (thumbnailSize + thumbnailSpacing) - thumbnailSpacing + padding
            scrollView.contentSize = CGSize(width: contentWidth, height: thumbnailSize)
        }
        
        // 激活所有约束
        NSLayoutConstraint.activate(activeConstraints)
    }
    
    /// 滚动到显示指定的缩略图
    private func scrollToShowThumbnail(_ thumbnail: CallStreamView) {
        guard let scrollView = scrollView else { return }
        
        let thumbnailFrame = thumbnail.frame
        let visibleRect = CGRect(
            x: max(0, thumbnailFrame.origin.x - 6),
            y: 0,
            width: min(thumbnailFrame.width + 12, scrollView.contentSize.width),
            height: thumbnailFrame.height
        )
        scrollView.scrollRectToVisible(visibleRect, animated: true)
    }
    
    /// 改进的updateWithItems方法 - 只处理删除，添加通过addNewUsersIfNeeded处理 - 使用队列保护
    func updateWithItems(_ removeUsers: [String] = []) {
        addPendingOperation { [weak self] in
            self?.performUpdateWithItems(removeUsers)
        }
    }
    
    private func performUpdateWithItems(_ removeUsers: [String]) {
        self.isAnimating = true
        
        // 检查是否只需要添加新用户
        if checkForNewUsers() && removeUsers.isEmpty {
            addNewUsersIfNeeded()
            // addNewUsersIfNeeded会在完成时调用setAnimating(false)
            return
        }
        
        // 如果没有要删除的用户
        guard !removeUsers.isEmpty else {
            self.setAnimating(false)
            return
        }
        
        var viewsInScrollView: [CallStreamView] = []
        var viewsToRemove: [CallStreamView] = []
        
        for user in removeUsers {
            if let streamView = CallKitManager.shared.canvasCache[user] {
                viewsToRemove.append(streamView)
            }
        }
        
        if let scrollView = scrollView {
            for subview in scrollView.subviews {
                if let streamView = subview as? CallStreamView {
                    viewsInScrollView.append(streamView)
                }
            }
        }
        
        let isRemovingExpandedView = removeUsers.contains {
            $0 == expandedView?.item.userId ?? ""
        }
        
        if isRemovingExpandedView {
            animateRemovalAndReturnToNormal(viewsToRemove: viewsToRemove)
        } else if expandedView != nil {
            animateRemovalInExpandedState(viewsToRemove: viewsToRemove,
                                          viewsInScrollView: viewsInScrollView)
        } else {
            // 如果在正常状态下删除，重新布局
            setupViews()
            self.setAnimating(false)
        }
        
        updateAllDisplayModes()
    }
        
    
    /// 统一的刷新方法
    func refreshViews() {
        // 检测并添加新用户
        addNewUsersIfNeeded()
        
        // 根据当前状态刷新布局
        if expandedView != nil {
            // 展开状态：获取所有缩略图并重建布局
            if let scrollView = scrollView {
                let thumbnails = scrollView.subviews
                    .compactMap { $0 as? CallStreamView }
                    .filter { $0 != expandedView }
                    .sorted { $0.item.index > $1.item.index }
                
                rebuildExpandedStateLayout(expandedView: expandedView!, thumbnails: thumbnails)
            }
        } else {
            // 正常状态：重新布局
            layoutItemsForNormalState()
        }
        
        updateAllDisplayModes()
        layoutIfNeeded()
    }
}
