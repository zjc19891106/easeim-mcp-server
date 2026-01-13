//
//  Providers.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/7/25.
//

import Foundation

/// Profile provider of the ChatUIKit.Only available in Swift language.
public protocol CallUserProfileProvider { //去掉user
    
    /// Coroutine obtains user information asynchronously.
    /// - Parameter profileIds: The corresponding conversation id string array.
    /// - Returns: Array of the conform``ChatUserProfileProtocol`` object.
    func fetchUserProfiles(profileIds: [String]) async -> [CallProfileProtocol]
    
    
    /// Coroutine obtains group information asynchronously.
    /// - Parameter profileIds: The corresponding group id string array.
    /// - Returns: Array of the conform``ChatUserProfileProtocol`` object.
    func fetchGroupProfiles(profileIds: [String]) async -> [CallProfileProtocol]
}

/// /// Profile provider of the ChatUIKit.Only available in Objective-C language.
@objc public protocol CallUserProfileProviderOC: NSObjectProtocol {
    
    /// Need to obtain the list display information on the current screen.
    /// - Parameters:
    ///   - profileIds: The corresponding conversation id string array.
    ///   - completion: Callback,obtain Array of the ``ChatUserProfileProtocol`` object.
    func fetchProfiles(profileIds: [String],completion: @escaping ([CallProfileProtocol]) -> Void)
    
    /// Need to obtain the group display information on the current screen.
    /// - Parameters:
    ///   - profileIds: The corresponding group id string array.
    ///   - completion: Callback,obtain Array of the ``ChatUserProfileProtocol`` object.
    func fetchGroupProfiles(profileIds: [String],completion: @escaping ([CallProfileProtocol]) -> Void)
}

@objc public protocol CallTokenProvider: NSObjectProtocol {    
    
    /// Get the App ID of the Agora SDK.
    /// - Returns: The App ID as a string.
    func getAppId() -> String
    
    /// Need to obtain the call token.
    func fetchCallToken(completion: @escaping (UInt32, String?, Int64) -> Void)
    
    /// Get the call token synchronously.
    /// - Parameter uids: The user ID array.
    /// - Returns: A dictionary where keys are user IDs and values are the corresponding tokens.
    func getRelations(rtc uids: [UInt32]) -> [UInt32:String]
    
    /// Asynchronously get the call token.
    /// - Parameters:
    ///   - uids: The user ID array.
    ///   - completion: Callback, returns a dictionary where keys are user IDs and values are the corresponding tokens.
    func getRelationsAsync(rtc uids: [UInt32],completion: @escaping ([UInt32:String]) -> Void)
}
