//
//  MultiCallParticipantsController.swift
//  EaseCallUIKit
//
//  Created by 朱继超 on 6/30/25.
//

import UIKit


@objc open class MultiCallParticipantsController: UIViewController {
    
    
    private var doneClosure: (([String],String,String) -> Void)?
    
    private var groupName: String = ""
    
    private var groupAvatar: String = ""
    
    public private(set) var groupId = ""
    
    public var participants: [CallProfileProtocol] = []
    
    public var excludeUsers: [String] = []
    
    public private(set) var cursor: String = ""
    
    public private(set) lazy var navigation: CallNavigationBar = {
        self.createNavigation()
    }()
    
    @objc open func createNavigation() -> CallNavigationBar {
        CallNavigationBar(show: CGRect(x: 0, y: 0, width: ScreenWidth, height: 44),textAlignment: .left,rightTitle: "call".call.localize)
    }
    
    public private(set) lazy var participantsList: UITableView = {
        UITableView(frame: .zero, style: .plain).delegate(self).dataSource(self).tableFooterView(UIView()).rowHeight(60).backgroundColor(.clear).separatorStyle(.none)
    }()
    
    @objc required public init(groupId: String,excludeUsers: [String],closure: @escaping ([String],String,String) -> Void) {
        self.groupId = groupId
        self.participants.removeAll()
        self.excludeUsers = excludeUsers
        self.doneClosure = closure
        super.init(nibName: nil, bundle: nil)
        self.fetchParticipants()
    }
    
    required public init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    

    open override func viewDidLoad() {
        super.viewDidLoad()
        self.navigation.leftItem.setImage(UIImage(named: "back", in: .callBundle, with: nil), for: .normal)
        self.navigation.title = "invite_page_title".call.localize
        self.navigation.rightItem.isEnabled = false
        self.view.addSubViews([self.participantsList,self.navigation])
        self.participantsList.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            self.participantsList.topAnchor.constraint(equalTo: self.view.safeAreaLayoutGuide.topAnchor,constant: 44),
            self.participantsList.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            self.participantsList.trailingAnchor.constraint(equalTo: self.view.trailingAnchor),
            self.participantsList.bottomAnchor.constraint(equalTo: self.view.bottomAnchor)
        ])
        // Do any additional setup after loading the view.
        //Back button click of the navigation
        
        self.navigation.clickClosure = { [weak self] in
            self?.navigationClick(type: $0, indexPath: $1)
        }
    
        Theme.registerSwitchThemeViews(view: self)
        self.switchTheme(style: Theme.style)
        if CallKitManager.shared.profileProvider != nil || CallKitManager.shared.profileProviderOC != nil {
            if CallKitManager.shared.profileProvider != nil {
                Task {
                    let profiles = await CallKitManager.shared.profileProvider?.fetchGroupProfiles(profileIds: [groupId])
                    if let profile = profiles?.first {
                        self.groupName = profile.nickname
                        self.groupAvatar = profile.avatarURL
                        if let group = ChatGroup(id: self.groupId),self.groupName.isEmpty,self.groupAvatar.isEmpty {
                            self.groupName = profile.nickname
                            self.groupAvatar = profile.avatarURL
                        }
                    }
                }
            }
            if CallKitManager.shared.profileProviderOC != nil {
                CallKitManager.shared.profileProviderOC?.fetchGroupProfiles(profileIds: [groupId]) { [weak self] profiles in
                    guard let `self` = self else { return }
                    if let profile = profiles.first {
                        self.groupName = profile.nickname
                        self.groupAvatar = profile.avatarURL
                        if let group = ChatGroup(id: self.groupId),self.groupName.isEmpty,self.groupAvatar.isEmpty {
                            self.groupName = profile.nickname
                            self.groupAvatar = profile.avatarURL
                        }
                    }
                }
            }
        } else {
            if let group = ChatGroup(id: self.groupId) {
                self.groupName = group.groupName
                self.groupAvatar = group.groupAvatar
            }
        }
    }
    
    @objc open func navigationClick(type: ChatNavigationBarClickEvent,indexPath: IndexPath?) {
        switch type {
        case .back: self.pop()
        case .rightTitle: self.rightAction()
        default:
            break
        }
    }
    
    @objc open func pop() {
        if self.navigationController != nil {
            self.navigationController?.popViewController(animated: true)
        } else {
            self.dismiss(animated: true)
        }
    }

    @objc open func rightAction() {
        let userIds = self.participants.filter { $0.selected == true }.map { $0.id }
        let nickNames = self.participants.filter { $0.selected == true }.map { $0.nickname }
        var removeAlert = "\("group_delete_members_alert".call.localize) \(userIds.count) \("group members".call.localize) "
        if nickNames.count > 1 {
            removeAlert += "\(nickNames.first ?? "") , \(nickNames[1])"
        } else {
            removeAlert += "\(nickNames.first ?? "")"
        }
        self.doneClosure?(userIds,self.groupName,self.groupAvatar)
        self.dismiss(animated: true)
    }

    private func fetchParticipants() {
        Task {
            let result = await ChatClient.shared().groupManager?.fetchGroupMemberInfoListFromServer(withGroupId: self.groupId, cursor: self.cursor, limit: 20)
            if let error = result?.1 {
                DispatchQueue.main.async {
                    self.showCallToast(toast: error.errorDescription ?? "Fetch group participants failed".call.localize)
                }
                consoleLogInfo("Fetch group participants failed: \(String(describing: error.errorDescription))", type: .error)
                return
            } else {
                if let cursorResult = result?.0 {
                    self.cursor = cursorResult.cursor ?? ""
                    if let profiles = cursorResult.list {
                        self.participants.append(contentsOf: profiles.map({
                            let profile = CallUserProfile()
                            profile.id = $0.userId
                            if let user = CallKitManager.shared.usersCache[profile.id] {
                                profile.nickname = user.nickname
                                profile.avatarURL = user.avatarURL
                            }
                            return profile
                        }))
                    }
                    self.participants.removeAll { $0.id == ChatClient.shared().currentUsername ?? "" }
                    DispatchQueue.main.async {
                        self.participantsList.reloadData()
                    }
                }
            }
            
        }
    }
}

extension MultiCallParticipantsController: UITableViewDelegate,UITableViewDataSource {
    public func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        self.participants.count
    }
    
    public func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        self.cellForRowAt(indexPath: indexPath)
    }
    
    @objc open func cellForRowAt(indexPath: IndexPath) -> UITableViewCell {
        var cell = self.participantsList.dequeueReusableCell(withIdentifier: "GroupParticipantsCell") as? GroupParticipantsCell
        if cell == nil {
            cell = GroupParticipantsCell(style: .default, reuseIdentifier: "GroupParticipantsCell")
        }
        if let profile = self.participants[safely: indexPath.row] {
            cell?.refresh(profile: profile, keyword: "")
            cell?.nickName.textColor = .white
        }
        cell?.selectionStyle = .none
        return cell ?? GroupParticipantsCell()
    }
    
    public func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        self.didSelectRowAt(indexPath: indexPath)
    }
    
    @objc open func didSelectRowAt(indexPath: IndexPath) {
        if let profile = self.participants[safely: indexPath.row] {
            if let user = CallKitManager.shared.itemsCache[profile.id] {
                return
            }
            profile.selected = !profile.selected
            self.participantsList.reloadData()
        }
        let count = self.participants.filter({ $0.selected }).count
        let joinCount = CallKitManager.shared.canvasCache.count
        if count > 0 {
            if joinCount+count > 16 {
                self.showCallToast(toast: "Cannot start multi-call with more than 16 participants".call.localize)
                return
            }
            self.navigation.rightItem.isEnabled = true
            self.navigation.rightItem.title("call".call.localize+"(\(count))", .normal)
        } else {
            self.navigation.rightItem.title("call".call.localize, .normal)
            self.navigation.rightItem.isEnabled = false
        }
    }
    
    public func tableView(_ tableView: UITableView, willDisplay cell: UITableViewCell, forRowAt indexPath: IndexPath) {
        if indexPath.row == self.participants.count - 1 && !self.cursor.isEmpty {
            self.fetchParticipants()
        }
        var unknownInfoIds = [String]()
        if let profile = self.participants[safely: indexPath.row] {
            if profile.nickname.isEmpty {
                unknownInfoIds.append(profile.id)
            }
        }
        
        if CallKitManager.shared.profileProvider != nil,CallKitManager.shared.profileProviderOC == nil {
            Task {
                if let profiles = await CallKitManager.shared.profileProvider?.fetchUserProfiles(profileIds: unknownInfoIds) {
                    for profile in profiles {
                        if let index = self.participants.firstIndex(where: { $0.id == profile.id }) {
                            self.participants[index].nickname = profile.nickname
                            self.participants[index].avatarURL = profile.avatarURL
                        }
                        if let cacheUser = CallKitManager.shared.usersCache[profile.id] {
                            cacheUser.nickname = profile.nickname
                            cacheUser.avatarURL = profile.avatarURL
                        } else {
                            let user = CallUserProfile()
                            user.id = profile.id
                            user.nickname = profile.nickname
                            user.avatarURL = profile.avatarURL
                            user.selected = profile.selected
                            CallKitManager.shared.usersCache[profile.id] = user
                        }
                    }
                }
            }
        } else {
            DispatchQueue.global().async {
                CallKitManager.shared.profileProviderOC?.fetchProfiles(profileIds: unknownInfoIds,completion: { [weak self] profiles in
                    guard let `self` = self else { return }
                    for profile in profiles {
                        if let index = self.participants.firstIndex(where: { $0.id == profile.id }) {
                            self.participants[index].nickname = profile.nickname
                            self.participants[index].avatarURL = profile.avatarURL
                        }
                        if let cacheUser = CallKitManager.shared.usersCache[profile.id] {
                            cacheUser.nickname = profile.nickname
                            cacheUser.avatarURL = profile.avatarURL
                        } else {
                            let user = CallUserProfile()
                            user.id = profile.id
                            user.nickname = profile.nickname
                            user.avatarURL = profile.avatarURL
                            user.selected = profile.selected
                            CallKitManager.shared.usersCache[profile.id] = user
                        }
                    }
                
                })
            }
        }
    }
}

extension MultiCallParticipantsController: ThemeSwitchProtocol {
    open func switchTheme(style: ThemeStyle) {
        self.view.backgroundColor = style == .dark ? UIColor.callTheme.neutralColor1:UIColor.callTheme.neutralColor98
        self.navigation.rightItem.textColor(style == .dark ? UIColor.callTheme.primaryColor6:UIColor.callTheme.primaryColor5, .normal)

    }
}
