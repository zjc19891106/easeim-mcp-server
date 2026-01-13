//
//  DragFloatView.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/25/25.
//

import Foundation
import UIKit

// 拖曳view的方向
@objc public enum DragDirection: Int {
    case any        // 任意方向
    case horizontal // 水平方向
    case vertical   // 垂直方向
}

open class DragFloatView: UIView {
    // MARK: - Properties
    
    /// 是否可以拖曳，默认为 true
    public var dragEnable: Bool = true
    
    /// 活动范围，默认为父视图的 frame 范围内
    /// 如果设置了，则会在给定的范围内活动
    /// 如果没设置，则会在父视图范围内活动
    /// 注意：设置的 frame 不要大于父视图范围
    /// 注意：设置的 frame 为 .zero 表示活动的范围为默认的父视图 frame，如果想要不能活动，请设置 dragEnable 为 false
    public var freeRect: CGRect = .zero {
        didSet {
            keepBounds()
        }
    }
    
    /// 拖曳的方向，默认为 .any，任意方向
    public var dragDirection: DragDirection = .any
    
    /// 内部懒加载的 UIImageView
    /// 开发者也可以自定义控件添加到本 view 中
    /// 注意：最好不要同时使用内部的 imageView 和 button
    private(set) lazy var imageView: UIImageView = {
        let imageView = UIImageView()
        imageView.isUserInteractionEnabled = true
        imageView.clipsToBounds = true
//        contentViewForDrag.addSubview(imageView)
        return imageView
    }()
    
    /// 内部懒加载的 UIButton
    /// 开发者也可以自定义控件添加到本 view 中
    /// 注意：最好不要同时使用内部的 imageView 和 button
    private(set) lazy var button: UIButton = {
        let button = UIButton(type: .custom)
        button.clipsToBounds = true
        button.isUserInteractionEnabled = false
//        contentViewForDrag.addSubview(button)
        return button
    }()
    
    /// 是否总是保持在父视图边界，默认为 false，没有黏贴边界效果
    /// isKeepBounds = true，它将自动黏贴边界，而且是最近的边界
    /// isKeepBounds = false，它将不会黏贴在边界，自由状态，跟随手指到任意位置，但也不可以拖出给定的范围 frame
    public var isKeepBounds: Bool = false {
        didSet {
            if isKeepBounds {
                keepBounds()
            }
        }
    }
    
    /// 点击的回调
    open var clickDragViewBlock: ((DragFloatView) -> Void)?
    
    /// 开始拖动的回调
    public var beginDragBlock: ((DragFloatView) -> Void)?
    
    /// 拖动中的回调
    public var duringDragBlock: ((DragFloatView) -> Void)?
    
    /// 结束拖动的回调
    public var endDragBlock: ((DragFloatView) -> Void)?
    
    // MARK: - Private Properties
    
    /// 内容 view，命名为 contentViewForDrag 以防止与其他第三方库的 contentView 属性冲突
    public private(set) lazy var contentViewForDrag: UIView = {
        let view = UIView()
        view.clipsToBounds = true
        return view
    }()
    
    private var startPoint: CGPoint = .zero
    private var panGestureRecognizer: UIPanGestureRecognizer!
    private var previousScale: CGFloat = 0.0
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
        addSubview(contentViewForDrag)
    }
    
    required public init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }
    
    // MARK: - Layout
    
    public override func layoutSubviews() {
        super.layoutSubviews()
        
        if freeRect != .zero {
            // 设置了 freeRect，活动范围
        } else {
            // 没有设置 freeRect，设置默认活动范围为父视图的 bounds
            freeRect = superview?.bounds ?? .zero
        }
        
//        imageView.frame = bounds
//        button.frame = bounds
        contentViewForDrag.frame = bounds
    }
    
    // MARK: - Setup
    
    private func setup() {
        dragEnable = true // 默认可以拖曳
        clipsToBounds = true
        isKeepBounds = false
        backgroundColor = .lightGray
        
        // 添加点击手势
        let singleTap = UITapGestureRecognizer(target: self, action: #selector(clickDragView))
        addGestureRecognizer(singleTap)
        
        // 添加拖动手势
        panGestureRecognizer = UIPanGestureRecognizer(target: self, action: #selector(dragAction(_:)))
        panGestureRecognizer.minimumNumberOfTouches = 1
        panGestureRecognizer.maximumNumberOfTouches = 1
        panGestureRecognizer.delegate = self
        addGestureRecognizer(panGestureRecognizer)
    }
    
    // MARK: - Actions
    
    @objc public func clickDragView() {
        clickDragViewBlock?(self)
    }
    
    @objc private func dragAction(_ pan: UIPanGestureRecognizer) {
        guard dragEnable else { return }
        
        switch pan.state {
        case .began:
            beginDragBlock?(self)
            pan.setTranslation(.zero, in: self)
            startPoint = pan.translation(in: self)
            
        case .changed:
            duringDragBlock?(self)
            let point = pan.translation(in: self)
            var dx: CGFloat = 0.0
            var dy: CGFloat = 0.0
            
            switch dragDirection {
            case .any:
                dx = point.x - startPoint.x
                dy = point.y - startPoint.y
            case .horizontal:
                dx = point.x - startPoint.x
                dy = 0
            case .vertical:
                dx = 0
                dy = point.y - startPoint.y
            }
            
            // 计算移动后的 view 中心点
            let newCenter = CGPoint(x: center.x + dx, y: center.y + dy)
            center = newCenter
            pan.setTranslation(.zero, in: self)
            
        case .ended:
            keepBounds()
            endDragBlock?(self)
            
        default:
            break
        }
    }
    
    // MARK: - Boundary Handling
    
    private func keepBounds() {
        let centerX = freeRect.origin.x + (freeRect.size.width - frame.size.width) / 2
        var rect = frame
        
        if !isKeepBounds {
            // 没有设置黏贴边界效果
            if frame.origin.x < freeRect.origin.x {
                UIView.animate(withDuration: 0.5, delay: 0, options: .curveEaseInOut) {
                    rect.origin.x = self.freeRect.origin.x
                    self.frame = rect
                }
            } else if freeRect.origin.x + freeRect.size.width < frame.origin.x + frame.size.width {
                UIView.animate(withDuration: 0.5, delay: 0, options: .curveEaseInOut) {
                    rect.origin.x = self.freeRect.origin.x + self.freeRect.size.width - self.frame.size.width
                    self.frame = rect
                }
            }
        } else {
            // 设置了自动粘边效果
            if frame.origin.x < centerX {
                UIView.animate(withDuration: 0.5, delay: 0, options: .curveEaseInOut) {
                    rect.origin.x = self.freeRect.origin.x
                    self.frame = rect
                }
            } else {
                UIView.animate(withDuration: 0.5, delay: 0, options: .curveEaseInOut) {
                    rect.origin.x = self.freeRect.origin.x + self.freeRect.size.width - self.frame.size.width
                    self.frame = rect
                }
            }
        }
        
        if frame.origin.y < freeRect.origin.y {
            UIView.animate(withDuration: 0.5, delay: 0, options: .curveEaseInOut) {
                rect.origin.y = self.freeRect.origin.y
                self.frame = rect
            }
        } else if freeRect.origin.y + freeRect.size.height < frame.origin.y + frame.size.height {
            UIView.animate(withDuration: 0.5, delay: 0, options: .curveEaseInOut) {
                rect.origin.y = self.freeRect.origin.y + self.freeRect.size.height - self.frame.size.height
                self.frame = rect
            }
        }
    }
}

// MARK: - UIGestureRecognizerDelegate

extension DragFloatView: UIGestureRecognizerDelegate {
    public override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        if gestureRecognizer is UIPanGestureRecognizer {
            // 如果是拖动手势，判断是否可以拖曳
            return dragEnable
        }
        return true
    }
}
