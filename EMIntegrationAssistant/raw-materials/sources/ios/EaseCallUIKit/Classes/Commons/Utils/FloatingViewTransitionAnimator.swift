//
//  FloatingViewTransitionAnimator.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/4/25.
//

import UIKit

// MARK: - 转场动画控制器
class FloatingViewTransitionAnimator: NSObject, UIViewControllerAnimatedTransitioning {
    
    let duration: TimeInterval = 0.618
    var isPresenting: Bool
    var originFrame: CGRect
    
    init(isPresenting: Bool, originFrame: CGRect) {
        self.isPresenting = isPresenting
        self.originFrame = originFrame
        super.init()
    }
    
    func transitionDuration(using transitionContext: UIViewControllerContextTransitioning?) -> TimeInterval {
        return duration
    }
    
    func animateTransition(using transitionContext: UIViewControllerContextTransitioning) {
        let containerView = transitionContext.containerView
        
        if isPresenting {
            // Present动画
            guard let toVC = transitionContext.viewController(forKey: .to) else { return }
            
            containerView.addSubview(toVC.view)
            
            // 设置初始frame为悬浮视图的frame
            toVC.view.frame = originFrame
            toVC.view.layer.cornerRadius = 12
            toVC.view.clipsToBounds = true
            
            UIView.animate(withDuration: duration, delay: 0, usingSpringWithDamping: 1, initialSpringVelocity: 1, options: .curveEaseInOut) {
                // 动画到全屏
                toVC.view.frame = transitionContext.finalFrame(for: toVC)
                toVC.view.layer.cornerRadius = 0
            } completion: { finished in
                transitionContext.completeTransition(!transitionContext.transitionWasCancelled)
                UIApplication.shared.call.keyWindow?.viewWithTag(floatingViewTag)?.isHidden = true
            }
            
        } else {
            // Dismiss动画
            guard let fromVC = transitionContext.viewController(forKey: .from) else { return }
            
            UIApplication.shared.call.keyWindow?.viewWithTag(floatingViewTag)?.isHidden = false
            UIView.animate(withDuration: duration, delay: 0, usingSpringWithDamping: 1, initialSpringVelocity: 1, options: .curveEaseInOut) {
                // 动画回到悬浮视图的位置
                fromVC.view.frame = self.originFrame
                fromVC.view.layer.cornerRadius = 12
            } completion: { finished in
                fromVC.view.removeFromSuperview()
                transitionContext.completeTransition(!transitionContext.transitionWasCancelled)
            }
        }
    }
}
