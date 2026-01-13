//
//  BundleExtension.swift
//  CallUIKit
//
//  Created by 朱继超 on 2023/8/30.
//

import Foundation

/**
 A type extension to provide a computed property for ChatroomResourceBundle.
 
 This extension provides a computed property `chatBundle` of type `Bundle` to access the ChatroomResourceBundle. If the ChatroomResourceBundle is already initialized, it returns the existing instance. Otherwise, it initializes the ChatroomResourceBundle with the path of the "ChatRoomResource.bundle" file in the main bundle. If the bundle is not found, it returns the main bundle.
 */
fileprivate var CallResourceBundle: Bundle?

public extension Bundle {
    /**
     A computed property to access the ChatroomResourceBundle.
     
     This computed property returns the ChatroomResourceBundle. If the ChatroomResourceBundle is already initialized, it returns the existing instance. Otherwise, it initializes the ChatroomResourceBundle with the path of the "ChatRoomResource.bundle" file in the main bundle. If the bundle is not found, it returns the main bundle.
     */
    class var callBundle: Bundle {
        if CallAppearance.resourceBundle != nil {
            return CallAppearance.resourceBundle!
        } else {
            if CallResourceBundle != nil {
                return CallResourceBundle!
            }
#if COCOAPODS
        CallResourceBundle = Bundle(for: CallAppearance.self)
                .url(forResource: "EaseCallUIKit.bundle/CallResource", withExtension: "bundle")
                .flatMap { Bundle(url: $0) }
#elseif SWIFT_PACKAGE
        CallResourceBundle = Bundle.module
#elseif STATIC_LIBRARY
        CallResourceBundle = Bundle.main
                .url(forResource: "EaseCallUIKit.bundle/CallResource", withExtension: "bundle")
                .flatMap(Bundle.init(url:))!
#else
        CallResourceBundle = Bundle(for: CallAppearance.self)
#endif
            return CallResourceBundle!
        }
    }
}

