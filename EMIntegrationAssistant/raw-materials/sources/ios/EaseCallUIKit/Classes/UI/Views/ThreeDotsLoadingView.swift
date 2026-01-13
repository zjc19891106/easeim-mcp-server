//
//  ThreeDotsLoadingView.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/23/25.
//

class ThreeDotsLoadingView: UIView {
    
    // MARK: - Properties
    private var dot1: UIView!
    private var dot2: UIView!
    private var dot3: UIView!
    
    private var dots: [UIView] = []
    
    // 可配置属性
    var dotSize: CGFloat = 12 {
        didSet { updateDotSizes() }
    }
    
    var dotSpacing: CGFloat = 8 {
        didSet { layoutDots() }
    }
    
    var dotColor: UIColor = .systemBlue {
        didSet { updateDotColors() }
    }
    
    var animationDuration: TimeInterval = 1.4
    var animationDelay: TimeInterval = 0.16
    
    private var isAnimating = false
    
    // MARK: - Initialization
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupViews()
    }
    
    // MARK: - Setup
    private func setupViews() {
        // 创建三个圆点
        dot1 = createDot()
        dot2 = createDot()
        dot3 = createDot()
        
        dots = [dot1, dot2, dot3]
        
        // 添加到视图
        dots.forEach { addSubview($0) }
        
        // 布局圆点
        layoutDots()
    }
    
    private func createDot() -> UIView {
        let dot = UIView()
        dot.backgroundColor = dotColor
        dot.layer.cornerRadius = dotSize / 2
        dot.translatesAutoresizingMaskIntoConstraints = false
        return dot
    }
    
    // MARK: - Layout
    override func layoutSubviews() {
        super.layoutSubviews()
        layoutDots()
    }
    
    private func layoutDots() {
        let totalWidth = (dotSize * 3) + (dotSpacing * 2)
        let startX = (bounds.width - totalWidth) / 2
        let centerY = bounds.height / 2
        
        for (index, dot) in dots.enumerated() {
            let x = startX + (CGFloat(index) * (dotSize + dotSpacing))
            dot.frame = CGRect(x: x, y: centerY - dotSize/2, width: dotSize, height: dotSize)
            dot.layer.cornerRadius = dotSize / 2
        }
    }
    
    // MARK: - Updates
    private func updateDotSizes() {
        dots.forEach { dot in
            dot.layer.cornerRadius = dotSize / 2
        }
        layoutDots()
    }
    
    private func updateDotColors() {
        dots.forEach { dot in
            dot.backgroundColor = dotColor
        }
    }
    
    // MARK: - Animation
    func startAnimating() {
        guard !isAnimating else { return }
        isAnimating = true
        
        for (index, dot) in dots.enumerated() {
            animateDot(dot, delay: animationDelay * Double(index))
        }
    }
    
    func stopAnimating() {
        isAnimating = false
        dots.forEach { dot in
            dot.layer.removeAllAnimations()
            dot.transform = .identity
        }
    }
    
    private func animateDot(_ dot: UIView, delay: TimeInterval) {
        // 缩放动画
        let scaleAnimation = CAKeyframeAnimation(keyPath: "transform.scale")
        scaleAnimation.values = [1.0, 1.3, 0.7, 1.0]
        scaleAnimation.keyTimes = [0.0, 0.2, 0.4, 1.0]
        scaleAnimation.duration = animationDuration
        scaleAnimation.repeatCount = .infinity
        scaleAnimation.beginTime = CACurrentMediaTime() + delay
        
        // 透明度动画（可选）
        let opacityAnimation = CAKeyframeAnimation(keyPath: "opacity")
        opacityAnimation.values = [1.0, 0.8, 0.6, 1.0]
        opacityAnimation.keyTimes = [0.0, 0.2, 0.4, 1.0]
        opacityAnimation.duration = animationDuration
        opacityAnimation.repeatCount = .infinity
        opacityAnimation.beginTime = CACurrentMediaTime() + delay
        
        // 添加动画
        dot.layer.add(scaleAnimation, forKey: "scaleAnimation")
        dot.layer.add(opacityAnimation, forKey: "opacityAnimation")
    }
}
