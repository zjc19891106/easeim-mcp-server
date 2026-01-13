//
//  UIImpactGeneratorExtension.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/3/25.
//

import UIKit

@objc public extension UIImpactFeedbackGenerator {
    
    static func impactOccurred(style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }
}

