//
//  CallKitConfig.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 8/8/25.
//

import Foundation

@objc public class CallKitConfig: NSObject {
    
    /// Indicates whether to enable Picture-in-Picture mode for 1v1 video calls
    public var enablePIPOn1V1VideoScene: Bool = false
    
    /// Indicates whether to enable VOIP mode
    public var enableVOIP: Bool = false
    
    /// Indicates whether to enable call recording.The minimum cannot be less than 10.
    public var ringTimeOut = 30
    
    /// ``LiveCommunicationKit`` supports multiple conversation groups, and each conversation group supports multiple conversations.
    public var maximumConversationGroups: Int = 1
    
    /// ``LiveCommunicationKit`` supports multiple conversation groups, and each conversation group supports multiple conversations.
    public var maximumConversationsPerConversationGroup: Int = 1
    
    /// Disable RTC token validation
    public var disableRTCTokenValidation: Bool = false
}
