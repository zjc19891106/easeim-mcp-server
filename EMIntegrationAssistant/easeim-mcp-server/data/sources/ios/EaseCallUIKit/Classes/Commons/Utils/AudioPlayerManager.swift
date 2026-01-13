//
//  AudioPlayerManager.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/31/25.
//

import AVFoundation
import Foundation

class AudioPlayerManager: NSObject {
    
    // MARK: - Properties
    private var audioPlayer: AVAudioPlayer?
    private var currentURL: URL?
    
    // 单例模式
    static let shared = AudioPlayerManager()
    
    private override init() {
        super.init()
        setupAudioSession()
//        NotificationCenter.default.addObserver(self, selector: #selector(routeChanged), name: AVAudioSession.routeChangeNotification, object: nil)
    }
    
    @objc func routeChanged(notification: Notification) {
        if let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt32,
           let reason = AVAudioSession.RouteChangeReason(rawValue: UInt(reasonValue)) {
            switch reason {
            case.newDeviceAvailable:
                print("耳机已插入")
            case.oldDeviceUnavailable:
                print("耳机已拔出")
            default:
                break
            }
        }
    }
    
    // MARK: - Public Methods
    
    /// 播放音频文件（循环播放）
    /// - Parameter urlString: 音频文件的URL字符串
    func playAudio(from fileName: String) {
        guard let path = Bundle.callBundle.path(forResource: fileName, ofType: "mp3") else {
            consoleLogInfo("Ringtone bundle file not found", type: .error)
            return
        }
        playAudio(from: URL(fileURLWithPath: path))
    }
    
    /// 播放音频文件（循环播放）
    /// - Parameter url: 音频文件的URL
    func playAudio(from url: URL) {
        // 如果是同一个URL，直接返回
        if currentURL == url && audioPlayer?.isPlaying == true {
            print("🎵 已在播放相同音频")
            return
        }
        
        // 停止当前播放
        stopAudio()
        
        do {
            // 创建新的播放器
            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.delegate = self
            audioPlayer?.numberOfLoops = -1 // -1 表示无限循环
            audioPlayer?.prepareToPlay()
            
            // 开始播放
            if audioPlayer?.play() == true {
                currentURL = url
                print("🎵 开始播放: \(url.lastPathComponent)")
            } else {
                print("❌ 播放失败")
            }
            
        } catch {
            print("❌ 创建音频播放器失败: \(error.localizedDescription)")
        }
    }
    
    /// 停止播放
    func stopAudio() {
        print("⏹️ 停止播放")
        audioPlayer?.stop()
        
    }
    
    /// 暂停播放
    func pauseAudio() {
        if audioPlayer?.isPlaying == true {
            audioPlayer?.pause()
            print("⏸️ 暂停播放")
        }
        audioPlayer?.pause()
    }
    
    /// 恢复播放
    func resumeAudio() {
        if audioPlayer?.isPlaying == false {
            audioPlayer?.play()
            print("▶️ 恢复播放")
        }
    }
    
    /// 设置音量
    /// - Parameter volume: 音量值 (0.0 - 1.0)
    func setVolume(_ volume: Float) {
        let clampedVolume = max(0.0, min(1.0, volume))
        audioPlayer?.volume = clampedVolume
        print("🔊 设置音量: \(clampedVolume)")
    }
    
    /// 获取当前播放状态
    var isPlaying: Bool {
        return audioPlayer?.isPlaying ?? false
    }
    
    /// 获取当前音量
    var currentVolume: Float {
        return audioPlayer?.volume ?? 0.0
    }
    
    /// 获取当前播放的URL
    var currentPlayingURL: URL? {
        return currentURL
    }
    
    // MARK: - Private Methods
    
    private func setupAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("❌ 设置音频会话失败: \(error.localizedDescription)")
        }
    }
    
    func tearDown() {
        stopAudio()
        audioPlayer = nil
        currentURL = nil
    }
}

// MARK: - AVAudioPlayerDelegate
extension AudioPlayerManager: AVAudioPlayerDelegate {
    
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        if flag {
            print("🎵 音频播放完成")
        } else {
            print("❌ 音频播放异常结束")
        }
    }
    
    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        if let error = error {
            print("❌ 音频解码错误: \(error.localizedDescription)")
        }
        stopAudio()
    }
}

// MARK: - 使用示例
/*
使用方法：

// 播放网络音频
AudioPlayerManager.shared.playAudio(from: "https://example.com/audio.mp3")

// 播放本地音频
if let localURL = Bundle.main.url(forResource: "music", withExtension: "mp3") {
    AudioPlayerManager.shared.playAudio(from: localURL)
}

// 控制播放
AudioPlayerManager.shared.pauseAudio()
AudioPlayerManager.shared.resumeAudio()
AudioPlayerManager.shared.stopAudio()

// 设置音量
AudioPlayerManager.shared.setVolume(0.8)

// 检查播放状态
if AudioPlayerManager.shared.isPlaying {
    print("正在播放")
}
*/
