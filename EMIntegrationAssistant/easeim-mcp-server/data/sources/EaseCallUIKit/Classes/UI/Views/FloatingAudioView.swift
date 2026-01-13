//
//  FloatingView.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/4/25.
//

import UIKit

// MARK: - 悬浮视图
public class FloatingAudioView: DragFloatView {
        
    
    // MARK: - Properties
    private let blurEffectView = UIVisualEffectView()
    private let containerView = UIView()
    private let phoneIconImageView = UIImageView()
    private let timeLabel = UILabel()
    
    // MARK: - Initialization
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }
    
    // MARK: - Setup Methods
    private func setupView() {
        self.backgroundColor = UIColor.clear
        self.dragEnable = true
        self.isKeepBounds = true
        self.freeRect = CGRect(x: 12, y: NavigationHeight, width: ScreenWidth-24, height: ScreenHeight-NavigationHeight-BottomBarHeight-49)
        // Container view setup
        containerView.backgroundColor = UIColor.clear
        containerView.layer.cornerRadius = 12
        containerView.layer.masksToBounds = true
        containerView.layer.shadowColor = UIColor.black.cgColor
        containerView.layer.shadowOffset = CGSize(width: 0, height: 4)
        containerView.layer.shadowOpacity = 0.3
        containerView.layer.shadowRadius = 8
        containerView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(containerView)
        
        // Create blur effect
        let blurEffect = UIBlurEffect(style: .systemMaterialDark)
        blurEffectView.effect = blurEffect
        blurEffectView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(blurEffectView)
        
        // Create vibrancy effect for better text appearance
        let vibrancyEffect = UIVibrancyEffect(blurEffect: blurEffect)
        let vibrancyEffectView = UIVisualEffectView(effect: vibrancyEffect)
        vibrancyEffectView.translatesAutoresizingMaskIntoConstraints = false
        
        // Phone icon setup
        phoneIconImageView.image = UIImage(named: "phone_pick", in: .callBundle, with: nil)?.withTintColor(UIColor.callTheme.secondaryColor5, renderingMode: .alwaysOriginal)
        phoneIconImageView.backgroundColor = .clear
        phoneIconImageView.contentMode = .scaleAspectFit
        phoneIconImageView.translatesAutoresizingMaskIntoConstraints = false
        blurEffectView.contentView.addSubview(phoneIconImageView)
        
        // Time label setup
        timeLabel.text = "Waiting".call.localize
        timeLabel.textColor = UIColor.callTheme.secondaryColor5
        timeLabel.font = UIFont.callTheme.labelExtraSmall
        timeLabel.textAlignment = .center
        timeLabel.backgroundColor = .clear
        timeLabel.translatesAutoresizingMaskIntoConstraints = false
        blurEffectView.contentView.addSubview(timeLabel)
        
        // Layout constraints
        NSLayoutConstraint.activate([
            // Container view
            containerView.topAnchor.constraint(equalTo: topAnchor),
            containerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: bottomAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 80),
            containerView.heightAnchor.constraint(equalToConstant: 80),
            
            // Blur effect view
            blurEffectView.topAnchor.constraint(equalTo: containerView.topAnchor),
            blurEffectView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            blurEffectView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            blurEffectView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            
            // Phone icon
            phoneIconImageView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            phoneIconImageView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 8),
            phoneIconImageView.widthAnchor.constraint(equalToConstant: 24),
            phoneIconImageView.heightAnchor.constraint(equalToConstant: 24),
            
            // Time label
            timeLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            timeLabel.topAnchor.constraint(equalTo: phoneIconImageView.bottomAnchor, constant: 8),
            timeLabel.leadingAnchor.constraint(greaterThanOrEqualTo: containerView.leadingAnchor, constant: 8),
            timeLabel.trailingAnchor.constraint(lessThanOrEqualTo: containerView.trailingAnchor, constant: -8)
        ])
    }
    
    func updateSeconds(seconds: Int) {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60
        timeLabel.text = String(format: "%02d:%02d:%02d", hours, minutes, secs)
    }
    
    public func present(on viewController: UIViewController) {
        // Ensure the view controller is presented modally
        let presentedVC = UIApplication.shared.call.keyWindow?.rootViewController
        viewController.modalPresentationStyle = .custom
        viewController.transitioningDelegate = self
        
        presentedVC?.present(viewController, animated: true)
    }
    
}

public let floatingViewTag = 20250707

// MARK: - Extension for easy usage
public extension FloatingAudioView {
    static func addToWindow() -> FloatingAudioView? {
        guard let window = UIApplication.shared.call.keyWindow else {
            consoleLogInfo("Could not find key window for FloatingView", type: .error)
            return nil
        }
        
        let floatingView = FloatingAudioView()
        let initialFrame = CGRect(x: ScreenWidth - 12 - 69,y: window.safeAreaInsets.top + 60,width: 69,height: 64 )
        floatingView.frame = initialFrame
        floatingView.tag = floatingViewTag
        window.addSubview(floatingView)
        
        // Position at top-right corner initially
        return floatingView
    }
    
    static func isFloatingViewVisible() -> Bool {
        guard let window = UIApplication.shared.call.keyWindow else {
            consoleLogInfo("Could not find key window for FloatingView", type: .error)
            return false
        }
        
        return window.viewWithTag(floatingViewTag) != nil
    }
    
    static func getFloatingView() -> FloatingAudioView? {
        guard let window = UIApplication.shared.call.keyWindow else {
            consoleLogInfo("Could not find key window for FloatingView", type: .error)
            return nil
        }
        
        return window.viewWithTag(floatingViewTag) as? FloatingAudioView
    }
    
    static func removeFromWindow() {
        guard let window = UIApplication.shared.call.keyWindow else {
            consoleLogInfo("Could not find key window for FloatingView", type: .error)
            return
        }
        
        if let floatingView = window.viewWithTag(floatingViewTag) as? FloatingAudioView {
            floatingView.removeFromSuperview()
        }
    }
}


// MARK: - UIViewControllerTransitioningDelegate
extension FloatingAudioView: UIViewControllerTransitioningDelegate {
    
    public func animationController(forPresented presented: UIViewController, presenting: UIViewController, source: UIViewController) -> UIViewControllerAnimatedTransitioning? {
        // 将悬浮视图的frame转换到window坐标系
        return FloatingViewTransitionAnimator(isPresenting: true, originFrame: self.frame)
    }
    
    public func animationController(forDismissed dismissed: UIViewController) -> UIViewControllerAnimatedTransitioning? {
        // 将悬浮视图的frame转换到window坐标系
        if CallKitManager.shared.callVC == nil {
            return nil
        }
        return FloatingViewTransitionAnimator(isPresenting: false, originFrame: self.frame)
    }
}
