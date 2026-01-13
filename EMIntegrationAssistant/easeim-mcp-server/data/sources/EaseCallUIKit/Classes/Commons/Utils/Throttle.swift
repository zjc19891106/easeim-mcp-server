//
//  Throttle.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 8/4/25.
//

import Foundation
import AgoraRtcKit

// 定义结构体来存储不同类型的回调信息
struct RTCVideoStateInfo {
    let uid: UInt
    let state: AgoraVideoRemoteState
    let reason: AgoraVideoRemoteReason
    let elapsed: Int
}

struct RTCUserJoinInfo {
    let uid: UInt
    let elapsed: Int
}

struct RTCAudioMuteInfo {
    let uid: UInt
    let muted: Bool
}

class RTCCallbackThrottler {
    // 分别存储不同类型的待处理信息
    private var pendingVideoStates: [RTCVideoStateInfo] = []
    private var pendingUserJoins: [RTCUserJoinInfo] = []
    private var pendingAudioMutes: [RTCAudioMuteInfo] = []
    
    // 为不同类型的回调使用不同的定时器
    private var videoStateTimer: Timer?
    private var userJoinTimer: Timer?
    private var audioMuteTimer: Timer?
    
    private let batchInterval: TimeInterval = 0.3 // 批处理间隔
    private let maxBatchSize: Int = 15 // 每批最大处理数量
    private let lock = NSLock()
    
    // MARK: - Video State Methods
    func addVideoState(uid: UInt,
                      state: AgoraVideoRemoteState,
                      reason: AgoraVideoRemoteReason,
                      elapsed: Int,
                      completion: @escaping ([RTCVideoStateInfo]) -> Void) {
        
        lock.lock()
        defer { lock.unlock() }
        
        let stateInfo = RTCVideoStateInfo(uid: uid,
                                         state: state,
                                         reason: reason,
                                         elapsed: elapsed)
        
        pendingVideoStates.append(stateInfo)
        
        if pendingVideoStates.count >= maxBatchSize {
            processVideoStateBatch(completion: completion)
            return
        }
        
        videoStateTimer?.invalidate()
        videoStateTimer = Timer.scheduledTimer(withTimeInterval: batchInterval, repeats: false) { [weak self] _ in
            self?.processVideoStateBatch(completion: completion)
        }
    }
    
    private func processVideoStateBatch(completion: @escaping ([RTCVideoStateInfo]) -> Void) {
        guard !pendingVideoStates.isEmpty else { return }
        
        lock.lock()
        defer { lock.unlock() }
        
        let statesToProcess = Array(pendingVideoStates)
        pendingVideoStates.removeAll()
        videoStateTimer?.invalidate()
        videoStateTimer = nil
        
        completion(statesToProcess)
    }
    
    // MARK: - User Join Methods
    func addUserJoin(uid: UInt,
                    elapsed: Int,
                    completion: @escaping ([RTCUserJoinInfo]) -> Void) {
        
        lock.lock()
        defer { lock.unlock() }
        
        let joinInfo = RTCUserJoinInfo(uid: uid, elapsed: elapsed)
        pendingUserJoins.append(joinInfo)
        
        if pendingUserJoins.count >= maxBatchSize {
            processUserJoinBatch(completion: completion)
            return
        }
        
        userJoinTimer?.invalidate()
        userJoinTimer = Timer.scheduledTimer(withTimeInterval: batchInterval, repeats: false) { [weak self] _ in
            self?.processUserJoinBatch(completion: completion)
        }
    }
    
    private func processUserJoinBatch(completion: @escaping ([RTCUserJoinInfo]) -> Void) {
        guard !pendingUserJoins.isEmpty else { return }
        
        lock.lock()
        defer { lock.unlock() }
        
        let joinsToProcess = Array(pendingUserJoins)
        pendingUserJoins.removeAll()
        userJoinTimer?.invalidate()
        userJoinTimer = nil
        
        completion(joinsToProcess)
    }
    
    // MARK: - Audio Mute Methods
    func addAudioMute(uid: UInt,
                     muted: Bool,
                     completion: @escaping ([RTCAudioMuteInfo]) -> Void) {
        
        lock.lock()
        defer { lock.unlock() }
        
        let muteInfo = RTCAudioMuteInfo(uid: uid, muted: muted)
        pendingAudioMutes.append(muteInfo)
        
        if pendingAudioMutes.count >= maxBatchSize {
            processAudioMuteBatch(completion: completion)
            return
        }
        
        audioMuteTimer?.invalidate()
        audioMuteTimer = Timer.scheduledTimer(withTimeInterval: batchInterval, repeats: false) { [weak self] _ in
            self?.processAudioMuteBatch(completion: completion)
        }
    }
    
    private func processAudioMuteBatch(completion: @escaping ([RTCAudioMuteInfo]) -> Void) {
        guard !pendingAudioMutes.isEmpty else { return }
        
        lock.lock()
        defer { lock.unlock() }
        
        let mutesToProcess = Array(pendingAudioMutes)
        pendingAudioMutes.removeAll()
        audioMuteTimer?.invalidate()
        audioMuteTimer = nil
        
        completion(mutesToProcess)
    }
    
    // MARK: - Legacy Support (保留兼容旧代码)
    func addUID(_ uid: UInt, completion: @escaping ([UInt]) -> Void) {
        addUserJoin(uid: uid, elapsed: 0) { joinInfos in
            let uids = joinInfos.map { $0.uid }
            completion(uids)
        }
    }
    
    // MARK: - Utility Methods
    func flushAll() {
        lock.lock()
        defer { lock.unlock() }
        
        pendingVideoStates.removeAll()
        pendingUserJoins.removeAll()
        pendingAudioMutes.removeAll()
        
        videoStateTimer?.invalidate()
        userJoinTimer?.invalidate()
        audioMuteTimer?.invalidate()
        
        videoStateTimer = nil
        userJoinTimer = nil
        audioMuteTimer = nil
    }
    
    func clear() {
        flushAll()
    }
    
    func clearUserPendings(with uid: UInt) {
        lock.lock()
        defer { lock.unlock() }
        
        pendingUserJoins.removeAll { $0.uid == uid }
        pendingAudioMutes.removeAll { $0.uid == uid }
        pendingVideoStates.removeAll { $0.uid == uid }
    }
}

/// A utility class to debounce actions, delaying execution until a specified time interval has passed without further calls.
/// Useful for handling events like rapid successive clicks, executing only the last one after a quiet period.
class Debouncer {
    private let delay: TimeInterval
    private var timer: Timer?
    private let queue: DispatchQueue
    
    /// Initializes the Debouncer.
    /// - Parameters:
    ///   - delay: The time interval to wait before executing the action after the last call (in seconds).
    ///   - queue: The dispatch queue on which to execute the debounced actions. Defaults to main queue.
    init(delay: TimeInterval, queue: DispatchQueue = .main) {
        self.delay = delay
        self.queue = queue
    }
    
    /// Debounces the given action: schedules it to run after the delay, canceling any previous scheduled action.
    /// - Parameter action: The closure to execute after the debounce delay.
    func debounce(_ action: @escaping () -> Void) {
        // Cancel any existing timer
        timer?.invalidate()
        timer = nil
        
        // Schedule a new timer on the specified queue
        timer = Timer(timeInterval: delay, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            action()
            self.timer = nil
        }
        
        // Ensure the timer runs on the correct queue
        queue.async {
            RunLoop.current.add(self.timer!, forMode: .default)
        }
    }
    
    
}

