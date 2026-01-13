//
//  CallError.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 8/7/25.
//

import Foundation
import AgoraRtcKit

@objc public enum CallErrorModule: UInt {
    case im // IMSDK module error
    case rtc // RTC module error
    case business // Business logic error
    case unknown // Unknown error module
}

@objc public enum CallBusinessErrorCode: UInt {
    case state// state error
    case param// param error
    case signaling// signaling error
    case unknown// unknown error
}

/// CallErrorCommonFeature 协议定义了通用的错误特性
@objc public protocol CallErrorCommonFeature: NSObjectProtocol {
    var errorCode: Int { get }
    var message: String { get }
}

/// The `CallErrorCodeGettable` protocol defines methods to retrieve error codes from different modules.
@objc public protocol CallErrorCodeGettable: NSObjectProtocol {
    
    /// Get error code from the IM module.
    /// - Returns: ``ChatErrorCode`` enums representing the error code from the IM module.
    func getIMError() -> ChatErrorCode
    
    /// Get error code from the RTC module.
    /// - Returns: ``AgoraErrorCode`` enums representing the error code from the RTC module.
    func getRTCError() -> AgoraErrorCode
    
    /// Get error code from the business logic module.
    /// - Returns: ``CallBusinessErrorCode`` enums representing the error code from the business logic module.
    func getCallBusinessError() -> CallBusinessErrorCode
}

/// The `CallError` class encapsulates errors that can occur in the call system, providing a structured way to handle errors from different modules such as IM, RTC, and business logic.
@objc public class CallError: NSObject {
    
    /// The module where the error occurred.
    @objc public let module: CallErrorModule
    
    /// The error details conforming to `CallErrorCommonFeature`.
    @objc public var error: CallErrorCommonFeature
    
    @objc public init(_ error: CallErrorCommonFeature, module: CallErrorModule) {
        self.error = error
        self.module = module
        super.init()
    }
    
    /// Convenience initializer for creating a `CallError` with an IM error.
    @objc public class RTC: NSObject,CallErrorCommonFeature {
        @objc public var errorCode: Int
        @objc public var message: String
        @objc public init(code: AgoraErrorCode, message: String) {
            self.errorCode = code.rawValue
            self.message = message
        }
    }
    
    /// Convenience initializer for creating a `CallError` with an RTC error.
    @objc public class IM: NSObject,CallErrorCommonFeature {
        @objc public var errorCode: Int
        @objc public var message: String
        @objc public init(error: ChatError) {
            self.errorCode = error.code.rawValue
            self.message = error.errorDescription ?? ""
        }
    }
    
    /// Convenience initializer for creating a `CallError` with a business logic error.
    @objc public class CallBusiness: NSObject,CallErrorCommonFeature {
        @objc public var errorCode: Int
        @objc public var message: String
        @objc public init(error: CallBusinessErrorCode, message: String) {
            self.errorCode = Int(error.rawValue)
            self.message = message
        }
    }
}

extension CallError: CallErrorCodeGettable {
    public func getIMError() -> ChatErrorCode {
        if self.module == .im {
            return ChatErrorCode(rawValue: self.error.errorCode) ?? .noError
        }
        return .noError
    }
    
    public func getRTCError() -> AgoraErrorCode {
        if self.module == .rtc {
            return AgoraErrorCode(rawValue: self.error.errorCode) ?? .noError
        }
        return .noError
    }
    
    public func getCallBusinessError() -> CallBusinessErrorCode {
        if self.module == .business {
            return CallBusinessErrorCode(rawValue: UInt(self.error.errorCode)) ?? .state
        }
        return .unknown
    }
}

/// First, define the CallErrorPattern struct to encapsulate the error pattern matching logic.
public struct CallErrorPattern {
    let module: CallErrorModule
    let code: Int
    
    /// IM error pattern
    public static func im(_ error: ChatErrorCode) -> CallErrorPattern {
        return CallErrorPattern(module: .im, code: error.rawValue)
    }
    
    /// RTC error pattern
    public static func rtc(_ error: AgoraErrorCode) -> CallErrorPattern {
        return CallErrorPattern(module: .rtc, code: error.rawValue)
    }
    
    /// Business logic error pattern
    public static func business(_ error: CallBusinessErrorCode) -> CallErrorPattern {
        return CallErrorPattern(module: .business, code: Int(error.rawValue))
    }
}

/// Implement the Equatable protocol for CallErrorPattern to allow pattern matching.
extension CallErrorPattern {
    public static func ~= (pattern: CallErrorPattern, value: CallError) -> Bool {
        return value.module == pattern.module && value.error.errorCode == pattern.code
    }
}

/// Define the CallErrorType only for `Swift` enum to categorize errors from different modules.
public enum CallErrorType: Equatable {
    case im(ChatErrorCode)
    case rtc(AgoraErrorCode)
    case business(CallBusinessErrorCode)
    case unknown
}

// Add an extension to CallError to provide a computed property that converts CallError to CallErrorType.
extension CallError {
    
    /// The `errorType` property categorizes the error based on its module and error code.
    public var errorType: CallErrorType {
        switch module {
        case .im:
            if let code = ChatErrorCode(rawValue: error.errorCode) {
                return .im(code)
            }
            return .unknown
            
        case .rtc:
            if let code = AgoraErrorCode(rawValue: error.errorCode) {
                return .rtc(code)
            }
            return .unknown
            
        case .business:
            if let code = CallBusinessErrorCode(rawValue: UInt(error.errorCode)) {
                return .business(code)
            }
            return .unknown
            
        case .unknown:
            return .unknown
        }
    }
    
    public var errorMessage: String {
        return error.message
    }
}
