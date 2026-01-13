//
//  MenuCell.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 7/1/25.
//

import UIKit

// MARK: - 菜单项数据模型
class MenuItem: NSObject {
    let title: String
    let icon: UIImage?
    let badgeCount: Int
    var blur: Bool = false
    
    init(title: String, icon: UIImage?, badgeCount: Int, blur: Bool = false) {
        self.title = title
        self.icon = icon
        self.badgeCount = badgeCount
        self.blur = blur
    }
}

// MARK: - 自定义CollectionViewCell
class MenuCell: UICollectionViewCell {
    
    private lazy var iconImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .white
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()
    
    private lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.textAlignment = .center
        label.font = UIFont.systemFont(ofSize: 12)
        label.textColor = .white
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var badgeLabel: UILabel = {
        let label = UILabel()
        label.backgroundColor = .red
        label.textColor = .white
        label.font = UIFont.systemFont(ofSize: 10, weight: .bold)
        label.textAlignment = .center
        label.layer.cornerRadius = 9
        label.clipsToBounds = true
        label.isHidden = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let iconBackgroundView: UIView = {
        let view = UIView()
        view.backgroundColor = .darkGray
        view.layer.cornerRadius = 25
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupViews() {
        contentView.addSubview(iconBackgroundView)
        iconBackgroundView.addSubview(iconImageView)
        contentView.addSubview(titleLabel)
        contentView.addSubview(badgeLabel)
        
        NSLayoutConstraint.activate([
            // 图标背景视图
            iconBackgroundView.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            iconBackgroundView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            iconBackgroundView.widthAnchor.constraint(equalToConstant: 50),
            iconBackgroundView.heightAnchor.constraint(equalToConstant: 50),
            
            // 图标
            iconImageView.centerXAnchor.constraint(equalTo: iconBackgroundView.centerXAnchor),
            iconImageView.centerYAnchor.constraint(equalTo: iconBackgroundView.centerYAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 24),
            iconImageView.heightAnchor.constraint(equalToConstant: 24),
            
            // 标题
            titleLabel.topAnchor.constraint(equalTo: iconBackgroundView.bottomAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            
            // 角标
            badgeLabel.topAnchor.constraint(equalTo: iconBackgroundView.topAnchor, constant: -4),
            badgeLabel.trailingAnchor.constraint(equalTo: iconBackgroundView.trailingAnchor, constant: 4),
            badgeLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 18),
            badgeLabel.heightAnchor.constraint(equalToConstant: 18)
        ])
    }
    
    func configure(with menuItem: MenuItem) {
        iconImageView.image = menuItem.icon
        titleLabel.text = menuItem.title
        
        if menuItem.badgeCount > 0 {
            badgeLabel.isHidden = false
            badgeLabel.text = "\(menuItem.badgeCount)"
        } else {
            badgeLabel.isHidden = true
        }
    }
}

