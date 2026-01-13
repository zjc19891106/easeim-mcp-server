//
//  UIWindow+Key.swift
//  CallUIKit
//
//  Created by 朱继超 on 2023/8/30.
//

import UIKit

public extension UIApplication {
    var call: CallKitWrapper<UIApplication> {
        return CallKitWrapper.init(self)
    }
}


public extension CallKitWrapper where Base == UIApplication {
    
    /// KeyWindow property
    /// How to use?
    /// `UIApplication.shared.call.keyWindow`
    var keyWindow: UIWindow? {
        var window = (base.connectedScenes
         // Keep only active scenes, onscreen and visible to the user
            .filter { $0.activationState == .foregroundActive }
         // Keep only the first `UIWindowScene`
            .first(where: { $0 is UIWindowScene })
         // Get its associated windows
            .flatMap({ $0 as? UIWindowScene })?.windows
         // Finally, keep only the key window
            .first(where: \.isKeyWindow))
        if window == nil {
            window = UIApplication.shared.keyWindow
        }
        return window
    }
}


