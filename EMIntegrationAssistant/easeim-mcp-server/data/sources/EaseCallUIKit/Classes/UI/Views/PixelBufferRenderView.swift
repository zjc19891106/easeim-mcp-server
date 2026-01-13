//
//  PixelBufferRenderView.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/9/25.
//

import UIKit
import AVFoundation
import AgoraRtcKit

public class PixelBufferRenderView: DragFloatView {
    public internal(set) var userId: String = ""
    public var uid : UInt32 = 0
    public var isVideoMuted: Bool = false
    public var isAudioMuted: Bool = false
    private var videoWidth: Int32 = 0
    private var videoHeight: Int32 = 0
    let micView = UIImageView()
    let avatarContainer = UIImageView().contentMode(.scaleToFill)
    let avatar = ImageView(frame: .zero).contentMode(.scaleAspectFill)
    let videoContainerView = UIView() // Container for video
    
    let blurEffectView = UIVisualEffectView()
    
    
    lazy var displayLayer: AVSampleBufferDisplayLayer = {
        let layer = AVSampleBufferDisplayLayer()
        return layer
    }()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        videoContainerView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(videoContainerView)
        self.videoContainerView.layer.addSublayer(displayLayer)
        displayLayer.frame = self.videoContainerView.bounds
        avatarContainer.translatesAutoresizingMaskIntoConstraints = false
        addSubview(avatarContainer)
        avatarContainer.addSubview(avatar)
        avatarContainer.isHidden = true
        let blurEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        blurEffectView.effect = blurEffect
        blurEffectView.translatesAutoresizingMaskIntoConstraints = false
        avatarContainer.addSubview(blurEffectView)
        blurEffectView.isHidden = true
        avatar.translatesAutoresizingMaskIntoConstraints = false
        micView.translatesAutoresizingMaskIntoConstraints = false
        micView.isUserInteractionEnabled = false
        addSubview(micView)
        NSLayoutConstraint.activate([
            videoContainerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            videoContainerView.trailingAnchor.constraint(equalTo: trailingAnchor),
            videoContainerView.topAnchor.constraint(equalTo: topAnchor),
            videoContainerView.bottomAnchor.constraint(equalTo: bottomAnchor),
            avatarContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
            avatarContainer.trailingAnchor.constraint(equalTo: trailingAnchor),
            avatarContainer.topAnchor.constraint(equalTo: topAnchor),
            avatarContainer.bottomAnchor.constraint(equalTo: bottomAnchor),
            blurEffectView.topAnchor.constraint(equalTo: avatarContainer.topAnchor),
            blurEffectView.leadingAnchor.constraint(equalTo: avatarContainer.leadingAnchor),
            blurEffectView.trailingAnchor.constraint(equalTo: avatarContainer.trailingAnchor),
            blurEffectView.bottomAnchor.constraint(equalTo: avatarContainer.bottomAnchor),
            avatar.centerXAnchor.constraint(equalTo: avatarContainer.centerXAnchor),
            avatar.centerYAnchor.constraint(equalTo: avatarContainer.centerYAnchor),
            avatar.widthAnchor.constraint(equalTo: avatarContainer.widthAnchor),
            avatar.heightAnchor.constraint(equalTo: avatarContainer.heightAnchor),
            micView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            micView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            micView.widthAnchor.constraint(equalToConstant: 14),
            micView.heightAnchor.constraint(equalToConstant: 14)
        ])
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public override func layoutSubviews() {
        super.layoutSubviews()
        if self.frame.width == ScreenWidth,self.frame.height == ScreenHeight {
            self.isUserInteractionEnabled = false
            self.blurEffectView.isHidden = false
        } else {
            self.isUserInteractionEnabled = true
            self.blurEffectView.isHidden = true
        }
    }
    
    func updateAudioState(_ mute: Bool) {
        isAudioMuted = mute
        micView.image = mute ? UIImage(named: "mic_off", in: .callBundle, with: nil) : UIImage(named: "mic_on", in: .callBundle, with: nil)
        self.micView.isHidden = !mute
        if !micView.isHidden {
            bringSubviewToFront(micView)
        }
    }
    
    func updateVideoState(_ mute: Bool) {
        isVideoMuted = mute
        if mute {
            self.displayLayer.flushAndRemoveImage()
            // Hide the layer
            self.displayLayer.isHidden = true
            self.displayLayer.opacity = 0
            self.avatarContainer.isHidden = false
            // Ensure avatar is visible
            bringSubviewToFront(avatarContainer)
            bringSubviewToFront(micView)
            let avatarURL = CallKitManager.shared.usersCache[userId]?.avatarURL ?? ""
            avatar.image(with: avatarURL, placeHolder: CallAppearance.avatarPlaceHolder)
        } else {
            // Show display layer
            self.displayLayer.isHidden = false
            self.displayLayer.opacity = 1
            self.avatarContainer.isHidden = true
            sendSubviewToBack(avatarContainer)
        }
        if self.frame.width == ScreenWidth,self.frame.height == ScreenHeight {
            self.isUserInteractionEnabled = false
            self.blurEffectView.isHidden = false
        } else {
            self.isUserInteractionEnabled = true
            self.blurEffectView.isHidden = true
        }
    }
    
    private func configLayers() {
        self.clipsToBounds = true
        self.layer.addSublayer(displayLayer)
        displayLayer.frame = self.bounds
        displayLayer.zPosition = 0
    }
    
    func createLayer() -> AVSampleBufferDisplayLayer {
        let layer = AVSampleBufferDisplayLayer()
        return layer
    }
    
    func clean() {
        self.displayLayer.removeFromSuperlayer()
        self.displayLayer = createLayer()
        self.layer.addSublayer(displayLayer)
    }

    func renderFromVideoFrameData(videoData: AgoraOutputVideoFrame) {
        let width = videoData.width
        let height = videoData.height
        let yStride = videoData.yStride
        let uStride = videoData.uStride
        let vStride = videoData.vStride
        
        let yBuffer = videoData.yBuffer
        let uBuffer = videoData.uBuffer
        let vBuffer = videoData.vBuffer
        
        autoreleasepool {
            var pixelBuffer: CVPixelBuffer?
            let pixelAttributes: [String: Any] = [kCVPixelBufferIOSurfacePropertiesKey as String: [:]]
            
            let result = CVPixelBufferCreate(kCFAllocatorDefault,
                                             Int(width),
                                             Int(height),
                                             kCVPixelFormatType_420YpCbCr8Planar,
                                             pixelAttributes as CFDictionary,
                                             &pixelBuffer)
            
            guard result == kCVReturnSuccess, let pixelBuffer = pixelBuffer else {
                print("Unable to create CVPixelBuffer: \(result)")
                return
            }
            
            CVPixelBufferLockBaseAddress(pixelBuffer, .init(rawValue: 0))
            let yPlane = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0)
            let pixelBufferYBytes = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)

            for i in 0..<height {
                memcpy(yPlane?.advanced(by: pixelBufferYBytes * Int(i)), yBuffer?.advanced(by: Int(yStride * i)), Int(yStride))
            }

            let uPlane = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 1)
            let pixelBufferUBytes = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 1)

            for i in 0..<height / 2 {
                memcpy(uPlane?.advanced(by: pixelBufferUBytes * Int(i)), uBuffer?.advanced(by: Int(uStride * i)), Int(uStride))
            }

            let vPlane = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 2)
            let pixelBufferVBytes = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 2)

            for i in 0..<height / 2 {
                memcpy(vPlane?.advanced(by: pixelBufferVBytes * Int(i)), vBuffer?.advanced(by: Int(vStride * i)), Int(vStride))
            }
            
            CVPixelBufferUnlockBaseAddress(pixelBuffer, .init(rawValue: 0))
            
            self.renderVideoPixelBuffer(pixelBuffer: pixelBuffer, width: width, height: height)
        }
    }
    
    func renderVideoPixelBuffer(pixelBuffer: CVPixelBuffer, width: Int32, height: Int32) {
        DispatchQueue.main.async {
            self.videoWidth = width
            self.videoHeight = height
            self.layoutDisplayer()
        }
        
        // 创建 CMVideoFormatDescription
        var videoInfo: CMVideoFormatDescription?
        let status = CMVideoFormatDescriptionCreateForImageBuffer(allocator: kCFAllocatorDefault,
                                                                  imageBuffer: pixelBuffer,
                                                                  formatDescriptionOut: &videoInfo)
        guard status == noErr, let videoInfo = videoInfo else {
            print("Error creating video format description")
            return
        }

        // 创建 CMSampleTimingInfo
        var timingInfo = CMSampleTimingInfo()
        timingInfo.duration = CMTime.zero
        timingInfo.decodeTimeStamp = CMTime.invalid
        timingInfo.presentationTimeStamp = CMTime(seconds: CACurrentMediaTime(), preferredTimescale: 1000)

        // 创建 CMSampleBuffer
        var sampleBuffer: CMSampleBuffer?
        let sampleBufferStatus = CMSampleBufferCreateReadyWithImageBuffer(allocator: kCFAllocatorDefault,
                                                                          imageBuffer: pixelBuffer,
                                                                          formatDescription: videoInfo,
                                                                          sampleTiming: &timingInfo,
                                                                          sampleBufferOut: &sampleBuffer)
        guard sampleBufferStatus == noErr, let sampleBuffer = sampleBuffer else {
            print("Error creating sample buffer")
            return
        }

        // 将样本缓冲区排队到显示层
        self.displayLayer.enqueue(sampleBuffer)
        CMSampleBufferInvalidate(sampleBuffer)
    }
    
    private func layoutDisplayer() {
        guard videoWidth > 0, videoHeight > 0 else {
            return
        }
        
        let viewWidth = self.bounds.size.width
        let viewHeight = self.bounds.size.height
        
        // 确保view尺寸有效
        guard viewWidth > 0, viewHeight > 0 else {
            print("Warning: View bounds are invalid - width: \(viewWidth), height: \(viewHeight)")
            return
        }

        let videoRatio = CGFloat(videoWidth) / CGFloat(videoHeight)
        let viewRatio = viewWidth / viewHeight

        var videoSize = CGSize.zero
        var xOffset: CGFloat = 0
        var yOffset: CGFloat = 0
        
        
        if videoRatio >= viewRatio {
            // 视频更宽，以view高度为准，视频宽度会超出view
            videoSize.height = viewHeight
            videoSize.width = videoSize.height * videoRatio
            // 水平居中，垂直填满
            xOffset = (viewWidth - videoSize.width) / 2
            yOffset = 0
        } else {
            // 视频更高，以view宽度为准，视频高度会超出view
            videoSize.width = viewWidth
            videoSize.height = videoSize.width / videoRatio
            // 垂直居中，水平填满
            xOffset = 0
            yOffset = (viewHeight - videoSize.height) / 2
        }

        let renderRect = CGRect(x: xOffset, y: yOffset, width: videoSize.width, height: videoSize.height)
        
       

        if !renderRect.equalTo(displayLayer.frame) {
            displayLayer.frame = renderRect
        }
    }
    
}

