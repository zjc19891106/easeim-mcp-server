//
//  PIPTransitionAnimator.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/19/25.
//

import Foundation

// MARK: - 画中画转场动画器
class PIPTransitionAnimator: NSObject, UIViewControllerAnimatedTransitioning {
    
    enum TransitionType {
        case present
        case dismiss
    }
    
    private let type: TransitionType
    private let duration: TimeInterval
    
    init(type: TransitionType, duration: TimeInterval = 0.5) {
        self.type = type
        self.duration = duration
        super.init()
    }
    
    func transitionDuration(using transitionContext: UIViewControllerContextTransitioning?) -> TimeInterval {
        return duration
    }
    
    func animateTransition(using transitionContext: UIViewControllerContextTransitioning) {
        switch type {
        case .present:
            presentAnimation(using: transitionContext)
        case .dismiss:
            dismissAnimation(using: transitionContext)
        }
    }
    
    // MARK: - Present动画：从画中画窗口放大到全屏
    private func presentAnimation(using transitionContext: UIViewControllerContextTransitioning) {
        guard let toVC = transitionContext.viewController(forKey: .to) as? Call1v1VideoViewController else {
            transitionContext.completeTransition(false)
            return
        }
        
        let containerView = transitionContext.containerView
        let finalFrame = transitionContext.finalFrame(for: toVC)
        
        // 获取PIP窗口的初始位置和大小
        var initialFrame = CallKitManager.shared.lastPIPFrame
        if initialFrame == .zero {
            // 默认PIP位置（右上角）
            initialFrame = CGRect(x: ScreenWidth - 120, y: NavigationHeight + 12, width: 108, height: 192)
        }
        
        // 将视图控制器添加到容器
        toVC.view.frame = finalFrame
        containerView.addSubview(toVC.view)
        
        // 创建一个容器视图用于动画
        let animationContainer = UIView(frame: initialFrame)
        animationContainer.backgroundColor = .clear
        animationContainer.layer.cornerRadius = 12
        animationContainer.clipsToBounds = true
        containerView.addSubview(animationContainer)
        
        // 创建遮罩视图用于裁剪内容
        let maskLayer = CAShapeLayer()
        let initialPath = UIBezierPath(roundedRect: animationContainer.bounds, cornerRadius: 12)
        maskLayer.path = initialPath.cgPath
        animationContainer.layer.mask = maskLayer
        
        // 将toVC的视图作为子视图添加到动画容器中
        toVC.view.removeFromSuperview()
        animationContainer.addSubview(toVC.view)
        
        // 初始状态：内容缩放以适应小窗口
        let scaleX = initialFrame.width / finalFrame.width
        let scaleY = initialFrame.height / finalFrame.height
        let scale = min(scaleX, scaleY)
        toVC.view.transform = CGAffineTransform(scaleX: scale, y: scale)
        toVC.view.center = CGPoint(x: animationContainer.bounds.midX, y: animationContainer.bounds.midY)
        
        // 隐藏导航栏和底部栏，避免动画过程中显示
        toVC.navigationBar.alpha = 0
        toVC.bottomView.alpha = 0
        
        // 创建阴影效果
        animationContainer.layer.shadowColor = UIColor.black.cgColor
        animationContainer.layer.shadowOffset = CGSize(width: 0, height: 4)
        animationContainer.layer.shadowOpacity = 0.3
        animationContainer.layer.shadowRadius = 10
        
        // 执行动画
        UIView.animate(withDuration: duration,
                       delay: 0,
                       usingSpringWithDamping: 0.85,
                       initialSpringVelocity: 0.2,
                       options: [.curveEaseInOut]) {
            
            // 容器放大到全屏
            animationContainer.frame = finalFrame
            animationContainer.layer.cornerRadius = 0
            
            // 更新遮罩路径
            let finalPath = UIBezierPath(rect: finalFrame)
            maskLayer.path = finalPath.cgPath
            
            // 内容恢复原始大小
            toVC.view.transform = .identity
            toVC.view.frame = animationContainer.bounds
            
            // 阴影渐出
            animationContainer.layer.shadowOpacity = 0
            
        } completion: { finished in
            // 将视图恢复到正常层级
            toVC.view.removeFromSuperview()
            containerView.addSubview(toVC.view)
            toVC.view.frame = finalFrame
            
            // 恢复导航栏和底部栏
            UIView.animate(withDuration: 0.2) {
                toVC.navigationBar.alpha = 1
                toVC.bottomView.alpha = 1
            }
            
            // 清理动画容器
            animationContainer.removeFromSuperview()
            
            // 确保floatView正确显示
            toVC.ensureFloatViewVisible()
            
            transitionContext.completeTransition(finished)
        }
    }
    
    // MARK: - Dismiss动画：从全屏缩小到画中画窗口
    private func dismissAnimation(using transitionContext: UIViewControllerContextTransitioning) {
        guard let fromVC = transitionContext.viewController(forKey: .from) as? Call1v1VideoViewController else {
            transitionContext.completeTransition(false)
            return
        }
        
        let containerView = transitionContext.containerView
        
        // 计算最终PIP位置
        var finalFrame = CallKitManager.shared.lastPIPFrame
        if finalFrame == .zero {
            finalFrame = CGRect(x: ScreenWidth - 120, y: NavigationHeight + 12, width: 108, height: 192)
        }
        
        // 如果有目标视图控制器，确保它在底层
        if let toVC = transitionContext.viewController(forKey: .to) {
            containerView.insertSubview(toVC.view, at: 0)
        }
        
        // 创建动画容器
        let animationContainer = UIView(frame: fromVC.view.frame)
        animationContainer.backgroundColor = .clear
        animationContainer.layer.cornerRadius = 0
        animationContainer.clipsToBounds = true
        containerView.addSubview(animationContainer)
        
        // 创建遮罩视图
        let maskLayer = CAShapeLayer()
        let initialPath = UIBezierPath(rect: animationContainer.bounds)
        maskLayer.path = initialPath.cgPath
        animationContainer.layer.mask = maskLayer
        
        // 将fromVC的视图移到动画容器中
        fromVC.view.removeFromSuperview()
        animationContainer.addSubview(fromVC.view)
        fromVC.view.frame = animationContainer.bounds
        
        // 先隐藏导航栏和底部栏
        UIView.animate(withDuration: 0.2) {
            fromVC.navigationBar.alpha = 0
            fromVC.bottomView.alpha = 0
        }
        
        // 添加阴影效果
        animationContainer.layer.shadowColor = UIColor.black.cgColor
        animationContainer.layer.shadowOffset = CGSize(width: 0, height: 4)
        animationContainer.layer.shadowOpacity = 0
        animationContainer.layer.shadowRadius = 10
        
        // 延迟执行主动画，让导航栏隐藏动画先完成
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            UIView.animate(withDuration: self.duration,
                           delay: 0,
                           usingSpringWithDamping: 0.85,
                           initialSpringVelocity: 0,
                           options: [.curveEaseInOut]) {
                
                // 容器缩小到PIP大小
                animationContainer.frame = finalFrame
                animationContainer.layer.cornerRadius = 12
                
                // 更新遮罩路径
                let finalPath = UIBezierPath(roundedRect: CGRect(origin: .zero, size: finalFrame.size), cornerRadius: 12)
                maskLayer.path = finalPath.cgPath
                
                // 缩放内容以适应小窗口
                let scaleX = finalFrame.width / fromVC.view.bounds.width
                let scaleY = finalFrame.height / fromVC.view.bounds.height
                let scale = min(scaleX, scaleY)
                fromVC.view.transform = CGAffineTransform(scaleX: scale, y: scale)
                fromVC.view.center = CGPoint(x: finalFrame.width / 2, y: finalFrame.height / 2)
                
                // 阴影渐入
                animationContainer.layer.shadowOpacity = 0.3
                
            } completion: { finished in
                // 保存最终的PIP位置
                CallKitManager.shared.lastPIPFrame = finalFrame
                
                // 清理动画容器
                animationContainer.removeFromSuperview()
                
                transitionContext.completeTransition(finished)
            }
        }
    }
}

// MARK: - 转场代理（单例模式）
class PIPTransitionDelegate: NSObject, UIViewControllerTransitioningDelegate {
    
    static let shared = PIPTransitionDelegate()
    
    private override init() {
        super.init()
    }
    
    func animationController(forPresented presented: UIViewController,
                           presenting: UIViewController,
                           source: UIViewController) -> UIViewControllerAnimatedTransitioning? {
        return PIPTransitionAnimator(type: .present)
    }
    
    func animationController(forDismissed dismissed: UIViewController) -> UIViewControllerAnimatedTransitioning? {
        return PIPTransitionAnimator(type: .dismiss)
    }
}
