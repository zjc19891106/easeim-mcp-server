//
//  Appearance.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/26/25.
//

import Foundation

/// An object containing visual configurations for the whole application.
@objcMembers final public class CallAppearance: NSObject {
                
    /// You can change the hue of the base color, and then change the thirteen UIColor objects of the related color series. The UI components that use the relevant color series in the ease chat UIKit will also change accordingly. The default value is 203/360.0.
    public static var primaryHue: CGFloat = 203/360.0
    
    /// You can change the primary hue. The default value is 203/360.0.
    /// After the primary hue is changed, thirteen UIColor objects of the related color series will be changed. The color of UI components that use the related color series in the ease chat UIKit will also change accordingly.
    public static var secondaryHue: CGFloat = 155/360.0
    
    /// You can change the secondary hue. The default value is 155/360.0.
    /// After the secondary hue is changed, thirteen UIColor objects of the related color series will be changed. The color of UI components that use the related color series in the ease chat UIKit will also change accordingly.
    public static var errorHue: CGFloat = 350/360.0
    
    /// You can change the neutral hue. The default value is 203/360.0.
    /// After the neutral hue is changed, thirteen UIColor objects of the related color series will be changed. The color of UI components that use the related color series in the ease chat UIKit will also change accordingly.
    public static var neutralHue: CGFloat = 203/360.0
    
    /// You can change the neutral special hue. The default value is 220/360.0.
    /// After the neutral special hue is changed, thirteen UIColor objects of the related color series will be changed. The color of UI components that use the relevant color series in the ease chat UIKit will also change accordingly.
    public static var neutralSpecialHue: CGFloat = 220/360.0
    
    /// Language type.
    public static var call_language = EaseCallUIKit.LanguageType.Chinese
    
    /// The corner radius of the avatar image view of ``ChatInputBar``.
    public static var avatarRadius: EaseCallUIKit.CornerRadius = .extraSmall
    
    /// The placeholder image of the avatar image view of ``MessageCell``.
    public static var avatarPlaceHolder: UIImage? = UIImage(named: "default_avatar", in: .callBundle, with: nil)
    
    /// The bundle that contains the resources of EaseCallUIKit.
    public static var resourceBundle: Bundle? = nil
    
    /// The background image of the call interface.
    public static var backgroundImage : UIImage? = UIImage(named: "bg", in: .callBundle, with: nil)
}
