//
//  GlobalTimerManager.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/25/25.
//

import Foundation

@objc public class GlobalTimerManager: NSObject {
    
    private var listeners: NSHashTable<TimerServiceListener> = NSHashTable<TimerServiceListener>.weakObjects()
    
    /// Cache for timer start intervals with identify.
    public internal(set) var timerCache: [String: TimeInterval] = [:]
    
    /// Shared instance of GlobalTimerManager
    @objc public static let shared = GlobalTimerManager()
    
    /// Timer for global tasks
    private var globalTimer: Timer?
    
    /// 使用串行队列确保线程安全
    private let timerQueue = DispatchQueue(label: "com.timer.manager.queue", qos: .userInitiated)
    
    private override init() {
        super.init()
    }
    
    public func invalidate() {
        timerQueue.sync {
            self.listeners.removeAllObjects()
            self.timerCache.removeAll()
            self.globalTimer?.invalidate()
            self.globalTimer = nil
        }
    }
}

extension GlobalTimerManager: TimerService {
    
    public func removeListener(_ listener: any TimerServiceListener, timerIdentify: String) {
        timerQueue.sync {
            if self.listeners.contains(listener), self.timerCache.keys.contains(timerIdentify) {
                self.listeners.remove(listener)
                self.timerCache.removeValue(forKey: timerIdentify)
                if self.listeners.count <= 0 {
                    self.globalTimer?.invalidate()
                    self.globalTimer = nil
                }
            }
        }
    }
    
    public func removeTimeAsSimilarKey(_ timerIdentify: String) {
        timerQueue.sync {
            for key in self.timerCache.keys where key.hasPrefix(timerIdentify) {
                self.timerCache.removeValue(forKey: key)
            }
        }
    }
    
    public func registerListener(_ listener: any TimerServiceListener, timerIdentify: String) {
        timerQueue.sync {
            if self.listeners.contains(listener), self.timerCache.keys.contains(timerIdentify) {
                return
            }

            self.listeners.add(listener)
            self.timerCache[timerIdentify] = Date().timeIntervalSince1970
            
            if self.globalTimer == nil {
                // 确保Timer在主线程创建和运行
                DispatchQueue.main.async {
                    self.globalTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] timer in
                        self?.handleTimerFired()
                    }
                    
                    // 确保Timer在common模式下运行
                    if let timer = self.globalTimer {
                        RunLoop.main.add(timer, forMode: .common)
                    }
                }
            }
        }
    }
    
    public func replaceTimer(_ listener: any TimerServiceListener, timerIdentify: String) {
        timerQueue.sync {
            // 检查监听器是否已注册且计时器标识符存在
            guard self.listeners.contains(listener),
                  self.timerCache.keys.contains(timerIdentify) else {
                return
            }
            
            // 重置计时器开始时间为当前时间
            self.timerCache[timerIdentify] = Date().timeIntervalSince1970
            
            // 立即通知监听器计时器已重置（间隔为0）
            DispatchQueue.main.async {
                listener.timeChanged(timerIdentify, interval: 0)
            }
        }
    }
    
    private func handleTimerFired() {
        // 在串行队列中安全地读取数据
        timerQueue.async {
            let currentTime = Date().timeIntervalSince1970
            let timerData = self.timerCache.map { (identify, startTime) in
                return (identify: identify, interval: UInt(currentTime - startTime))
            }
            let listenersSnapshot = self.listeners.allObjects
            
            // 在主线程通知监听器
            DispatchQueue.main.async {
                for (identify, interval) in timerData {
                    for listener in listenersSnapshot {
                        listener.timeChanged(identify, interval: interval)
                    }
                }
            }
        }
    }
}

// MARK: - 性能优化版本（可选）
extension GlobalTimerManager {
    
    /// 批量更新版本，减少主线程调度次数
    private func handleTimerFiredOptimized() {
        timerQueue.async {
            let currentTime = Date().timeIntervalSince1970
            let timerUpdates: [(String, UInt)] = self.timerCache.compactMap { (identify, startTime) in
                return (identify, UInt(currentTime - startTime))
            }
            let listenersSnapshot = self.listeners.allObjects
            
            guard !timerUpdates.isEmpty && !listenersSnapshot.isEmpty else { return }
            
            // 单次主线程调度，批量更新
            DispatchQueue.main.async {
                for listener in listenersSnapshot {
                    for (identify, interval) in timerUpdates {
                        listener.timeChanged(identify, interval: interval)
                    }
                }
            }
        }
    }
}
