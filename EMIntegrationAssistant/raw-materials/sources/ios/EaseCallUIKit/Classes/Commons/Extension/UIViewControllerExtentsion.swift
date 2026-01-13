//
//  UIViewControllerExtentsion.swift
//  Pods
//
//  Created by 朱继超 on 2022/8/3.
//

import Foundation
import UIKit
import QuartzCore

/// Extension for UIViewController to provide custom presentation and dismissal animations.
public extension UIViewController {
    
    /// Presents a view controller with a push animation.
    /// - Parameters:
    ///   - controller: The view controller to present.
    ///   - completion: A closure to be executed after the presentation finishes.
    func presentViewControllerPush(_ controller: UIViewController, completion: (() -> Void)? = nil) {
        controller.modalTransitionStyle = .crossDissolve
        let transition = CATransition()
        transition.duration = 0.35
        transition.type = CATransitionType.push
        transition.subtype = CATransitionSubtype.fromRight
        self.view.superview?.layer.add(transition, forKey: "presentPush")
        if self.responds(to: #selector(self.present(_:animated:completion:))) {
            self.present(controller, animated: true, completion: completion)
        }
    }
    
    /// Dismisses the current view controller with a pop animation.
    /// - Parameter completion: A closure to be executed after the dismissal finishes.
    func dismissPopViewController(completion: (() -> Void)? = nil) {
        let transition = CATransition()
        transition.duration = 0.35
        transition.type = CATransitionType.push
        transition.subtype = CATransitionSubtype.fromLeft
        self.view.superview?.layer.add(transition, forKey: "presentPush")
        if self.responds(to: #selector(self.dismiss(animated:completion:))) {
            self.dismiss(animated: true, completion: completion)
        }
    }
    
}

extension UIViewController {
    
    /// Current view controller show toast.When you want to show some content for user.
    /// - Parameters:
    ///   - content: ``String`` value.
    ///   - duration: ``TimeInterval``.How long show
    public func showCallToast(toast content: String, duration: TimeInterval = 2.0, delay: TimeInterval = 0.0) {
        let toastView = UIVisualEffectView(effect: UIBlurEffect(style: Theme.style == .dark ? .light:.dark)).cornerRadius(.medium)
        toastView.alpha = 0
        toastView.backgroundColor = Theme.style == .dark ? UIColor.callTheme.barrageLightColor3:UIColor.callTheme.barrageDarkColor3
        toastView.translatesAutoresizingMaskIntoConstraints = false
        let size = content.call.sizeWithText(font: UIFont.callTheme.bodyMedium, size: CGSize(width: view.frame.width-80, height: 999))
        view.addSubview(toastView)
        view.bringSubviewToFront(toastView)
        var toastWidth = size.width+40
        if toastWidth >= view.frame.width-80 {
            toastWidth = view.frame.width - 80
        }
        NSLayoutConstraint.activate([
            toastView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toastView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            toastView.widthAnchor.constraint(lessThanOrEqualToConstant: view.frame.width-80),
            toastView.heightAnchor.constraint(greaterThanOrEqualToConstant: size.height+16)
        ])
        
        let label = UILabel().text(content).textColor(UIColor.callTheme.neutralColor98).textAlignment(.center).numberOfLines(0).backgroundColor(.clear)
        label.translatesAutoresizingMaskIntoConstraints = false
        toastView.contentView.addSubview(label)
        
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: toastView.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: toastView.trailingAnchor, constant: -16),
            label.topAnchor.constraint(equalTo: toastView.topAnchor, constant: 8),
            label.bottomAnchor.constraint(equalTo: toastView.bottomAnchor, constant: -8)
        ])
        
        UIView.animate(withDuration: 0.3, delay: delay, options: .curveEaseOut, animations: {
            toastView.alpha = 1
        }, completion: { (finished) in
            DispatchQueue.main.asyncAfter(deadline: .now()+duration) {
                toastView.removeFromSuperview()
            }
        })
    }
    
    static var currentController: UIViewController? {
        if let vc = UIApplication.shared.call.keyWindow?.rootViewController {
            if let nav = vc as? UINavigationController {
                return nav.visibleViewController?.presentedViewController ?? nav.visibleViewController
            }
            if let tab = vc as? UITabBarController {
                if let nav = tab.selectedViewController as? UINavigationController {
                    return nav.visibleViewController?.presentedViewController ?? nav.visibleViewController
                } else {
                    return tab.selectedViewController?.presentedViewController ?? tab.selectedViewController
                }
            }
            if let presented = vc.presentedViewController {
                var presentedVC: UIViewController? = presented
                while presentedVC?.presentedViewController != nil {
                    presentedVC = presentedVC?.presentedViewController
                }
                return presentedVC
            }
            return vc
        }
        return nil
    }
    
    static func currentController(with view: Any) -> UIViewController? {
        if let view = view as? UIView {
            var next = view.superview
            while next != nil {
                if let nextResponder = next?.next as? UIViewController {
                    return nextResponder
                }
                next = next?.superview
            }
        } else if let view = view as? UIBarButtonItem {
            var window = UIApplication.shared.call.keyWindow
            if window?.windowLevel != .normal {
                let windows = UIApplication.shared.windows
                for tempWin in windows {
                    if tempWin.windowLevel == .normal {
                        window = tempWin
                        break
                    }
                }
            }
            if let frontView = window?.subviews.first {
                if let nextResponder = frontView.next as? UIViewController {
                    return nextResponder
                } else {
                    return window?.rootViewController
                }
            }
        }
        return nil
    }
}
