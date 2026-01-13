//
//  GroupParticipantsCell.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/30/25.
//
import UIKit

@objc open class GroupParticipantsCell: UITableViewCell {

    public private(set) lazy var checkbox: UIImageView = {
        UIImageView(frame: CGRect(x: 16, y: (self.contentView.frame.height-28)/2.0, width: 28, height: 28)).contentMode(.scaleAspectFit).backgroundColor(.clear)
    }()
    
    lazy var avatar: ImageView = {
        ImageView(frame: CGRect(x: self.checkbox.frame.maxX+12, y: (self.contentView.frame.height-40)/2.0, width: 40, height: 40)).contentMode(.scaleAspectFill).backgroundColor(.clear).cornerRadius(CallAppearance.avatarRadius).contentMode(.scaleAspectFill)
    }()
    
    lazy var nickName: UILabel = {
        UILabel(frame: CGRect(x: self.avatar.frame.maxX+12, y: self.avatar.frame.minX+4, width: self.contentView.frame.width-self.avatar.frame.maxX-12-30, height: 16)).font(UIFont.callTheme.bodyLarge).backgroundColor(.clear).textColor(UIColor.callTheme.neutralColor98)
    }()
    
    lazy var separatorLine: UIView = {
        UIView(frame: CGRect(x: self.nickName.frame.minX, y: self.contentView.frame.height-0.5, width: self.contentView.frame.width-self.nickName.frame.minX, height: 0.5))
    }()

    @objc public required override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        self.contentView.backgroundColor = .clear
        self.backgroundColor = .clear
        self.contentView.addSubViews([self.checkbox,self.avatar,self.nickName,self.separatorLine])
    }
    
    required public init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    open override func layoutSubviews() {
        super.layoutSubviews()
        self.checkbox.frame = CGRect(x: 16, y: (self.contentView.frame.height-28)/2.0, width: 28, height: 28)
        self.avatar.frame = CGRect(x: self.checkbox.frame.maxX+12, y: (self.contentView.frame.height-40)/2.0, width: 40, height: 40)
        self.nickName.frame = CGRect(x: self.avatar.frame.maxX+12, y: (self.contentView.frame.height-16)/2.0, width: self.contentView.frame.width-self.avatar.frame.maxX-12-30, height: 16)
        self.separatorLine.frame = CGRect(x: self.nickName.frame.minX, y: self.contentView.frame.height-0.5, width: self.contentView.frame.width-self.nickName.frame.minX, height: 0.5)
    }
    
    func refresh(profile: CallProfileProtocol,keyword: String) {
        let nickName = profile.nickname.isEmpty ? profile.id:profile.nickname
        self.nickName.text = nickName
        self.nickName.font = UIFont.callTheme.labelLarge
        self.avatar.image(with: profile.avatarURL, placeHolder: CallAppearance.avatarPlaceHolder)
        if let user = CallKitManager.shared.itemsCache[profile.id] {
            self.checkbox.image = UIImage(named: "already_seleted", in: .callBundle, compatibleWith: nil)
        } else {
            self.checkbox.image = UIImage(named: profile.selected ? "select":"unselect", in: .callBundle, compatibleWith: nil)
        }
        self.separatorLine.backgroundColor = Theme.style == .dark ? UIColor.callTheme.neutralColor2:UIColor.callTheme.neutralColor9
    }
    
//    func highlightKeywords(keyword: String, in string: String) -> NSAttributedString {
//        let attributedString = NSMutableAttributedString {
//            AttributedText(string).foregroundColor(Theme.style == .dark ? UIColor.theme.neutralColor98:UIColor.theme.neutralColor1)
//        }
//        if !keyword.isEmpty {
//            var range = (string as NSString).range(of: keyword, options: .caseInsensitive)
//            while range.location != NSNotFound {
//                attributedString.addAttribute(.foregroundColor, value: Theme.style == .dark ? UIColor.theme.primaryDarkColor:UIColor.theme.primaryLightColor, range: range)
//                let remainingRange = NSRange(location: range.location + range.length, length: string.count - (range.location + range.length))
//                range = (string as NSString).range(of: keyword, options: .caseInsensitive, range: remainingRange)
//            }
//        }
//        return attributedString
//    }

}

