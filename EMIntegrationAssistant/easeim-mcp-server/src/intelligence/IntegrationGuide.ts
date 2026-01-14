/**
 * UIKit 集成指南和问题诊断知识库
 *
 * 功能：
 * 1. 平台版本要求检查
 * 2. CocoaPods 配置问题诊断
 * 3. Xcode 构建问题解决方案
 * 4. 模拟器运行问题处理
 */

// ==================== 类型定义 ====================

export interface PlatformRequirement {
  component: string;
  minVersion: string;         // 最低 iOS 版本
  xcodeVersion?: string;      // 推荐 Xcode 版本
  cocoapodsVersion?: string;  // 推荐 CocoaPods 版本
  notes?: string[];
}

export interface IntegrationProblem {
  id: string;
  keywords: string[];           // 触发关键词
  errorPatterns: string[];      // 错误信息匹配模式
  symptom: string;              // 问题症状描述
  cause: string;                // 原因分析
  solutions: IntegrationSolution[];
  relatedComponents?: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface IntegrationSolution {
  description: string;
  codeExample?: string;
  fileToModify?: string;
  settingPath?: string;        // Xcode 设置路径
}

export interface PodfileCheck {
  valid: boolean;
  issues: PodfileIssue[];
  suggestions: string[];
}

export interface PodfileIssue {
  type: 'version' | 'setting' | 'config';
  message: string;
  fix: string;
}

// ==================== 平台要求定义 ====================

export const PLATFORM_REQUIREMENTS: Record<string, PlatformRequirement> = {
  'EaseChatUIKit': {
    component: 'EaseChatUIKit',
    minVersion: '15.0',
    xcodeVersion: '16.0',
    cocoapodsVersion: '1.14.3',
    notes: [
      '新建项目使用模拟器需要启用 Rosetta 模式',
      '需要在 Info.plist 添加相机、麦克风、相册权限'
    ]
  },
  'EaseCallUIKit': {
    component: 'EaseCallUIKit',
    minVersion: '15.0',
    xcodeVersion: '16.0',
    cocoapodsVersion: '1.14.3',
    notes: [
      '需要开通环信 RTC 功能',
      '开通 RTC 后需等待 15 分钟数据同步',
      'VOIP 功能需要在 Apple Developer 申请证书',
      '画中画功能需要 iOS 15+',
      '注意：新版 Flutter 和 React Native 暂无 CallKit 源码及文档'
    ]
  },
  'EaseChatroomUIKit': {
    component: 'EaseChatroomUIKit',
    minVersion: '13.0',
    xcodeVersion: '15.0',
    cocoapodsVersion: '1.14.3',
    notes: []
  },
  'EaseIMKit': {
    component: 'EaseIMKit',
    minVersion: '13.0',
    xcodeVersion: '15.0',
    cocoapodsVersion: '1.14.3',
    notes: []
  }
};

// ==================== 集成问题知识库 ====================

export const INTEGRATION_PROBLEMS: IntegrationProblem[] = [
  // ===== Podfile 版本问题 =====
  {
    id: 'podfile_ios_version_too_low',
    keywords: ['platform', 'ios', '版本', 'version', 'deployment target'],
    errorPatterns: [
      'deployment target',
      'minimum deployment',
      'platform :ios',
      'IPHONEOS_DEPLOYMENT_TARGET'
    ],
    symptom: 'Podfile 中 iOS 部署目标版本过低',
    cause: 'EaseChatUIKit 和 EaseCallUIKit 要求 iOS 15.0+，EaseChatroomUIKit 要求 iOS 13.0+',
    solutions: [
      {
        description: '修改 Podfile 中的 platform 版本',
        codeExample: `# EaseChatUIKit / EaseCallUIKit 使用:
platform :ios, '15.0'

# EaseChatroomUIKit 使用:
platform :ios, '13.0'`,
        fileToModify: 'Podfile'
      },
      {
        description: '在 post_install 中统一设置 deployment target',
        codeExample: `post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
    end
  end
end`,
        fileToModify: 'Podfile'
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit'],
    priority: 'critical'
  },

  // ===== rsync 沙盒问题 =====
  {
    id: 'rsync_sandbox_error',
    keywords: ['rsync', 'sandbox', 'deny', 'file-write-create', 'samba'],
    errorPatterns: [
      'Sandbox: rsync.samba',
      'deny(1) file-write-create',
      'rsync error',
      'ENABLE_USER_SCRIPT_SANDBOXING'
    ],
    symptom: 'Xcode 15+ 编译时报错 Sandbox: rsync.samba deny file-write-create',
    cause: 'Xcode 15 默认启用了脚本沙盒，rsync 无法写入文件',
    solutions: [
      {
        description: '在 Build Settings 中关闭 User Script Sandboxing',
        settingPath: 'Build Settings → User Script Sandboxing → NO',
        codeExample: `// 方法 1: 在 Xcode 中设置
// Build Settings → 搜索 "ENABLE_USER_SCRIPT_SANDBOXING"
// 将 "User Script Sandboxing" 设为 "NO"

// 方法 2: 在 Podfile 的 post_install 中设置
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
end`
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit'],
    priority: 'critical'
  },

  // ===== CocoaPods 版本问题 =====
  {
    id: 'cocoapods_version_old',
    keywords: ['cocoapods', 'pod install', 'version', 'PBXFileSystemSynchronizedRootGroup', 'RuntimeError'],
    errorPatterns: [
      'PBXFileSystemSynchronizedRootGroup',
      'unknown ISA',
      'RuntimeError - `PBXGroup`',
      'pod install failed'
    ],
    symptom: 'pod install 失败，报错 PBXFileSystemSynchronizedRootGroup 或 unknown ISA',
    cause: 'CocoaPods 版本过低，不支持 Xcode 16 的新项目格式',
    solutions: [
      {
        description: '升级 CocoaPods 到 1.14.3 或更高版本',
        codeExample: `# 检查当前版本
pod --version

# 升级 CocoaPods
sudo gem install cocoapods

# 或使用 Homebrew
brew upgrade cocoapods

# 升级后重新安装
pod install --repo-update`
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit'],
    priority: 'high'
  },

  // ===== Xcode 版本兼容问题 =====
  {
    id: 'xcode_version_incompatible',
    keywords: ['xcode', 'version', 'project format', 'Adjust the project format'],
    errorPatterns: [
      'Adjust the project format using a compatible version',
      'project format',
      'cannot be opened'
    ],
    symptom: 'Xcode 16 以下版本打开项目报错 "Adjust the project format using a compatible version"',
    cause: '项目使用了 Xcode 16 的新格式，旧版本 Xcode 无法识别',
    solutions: [
      {
        description: '升级 Xcode 到 16.0 或更高版本',
        codeExample: `# 从 Mac App Store 更新 Xcode
# 或从 Apple Developer 下载：
# https://developer.apple.com/xcode/`
      },
      {
        description: '如果必须使用旧版 Xcode，联系项目维护者调整项目格式',
        codeExample: `# 在 Xcode 16 中：
# File → Project Settings → Project Format
# 选择与目标 Xcode 版本兼容的格式`
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit'],
    priority: 'high'
  },

  // ===== 模拟器架构问题 =====
  {
    id: 'simulator_architecture',
    keywords: ['simulator', 'rosetta', '模拟器', 'arm64', 'x86_64', 'architecture'],
    errorPatterns: [
      'building for iOS Simulator',
      'arm64',
      'x86_64',
      'architecture not found',
      'Rosetta'
    ],
    symptom: '新建项目在模拟器上运行失败，架构不兼容',
    cause: 'Apple Silicon Mac 上某些依赖库可能需要 Rosetta 模式运行模拟器',
    solutions: [
      {
        description: '使用 Rosetta 模式打开 Xcode',
        codeExample: `# 方法 1: 启用 Rosetta 模式
# 1. 在 Finder 中找到 Xcode.app
# 2. 右键 → 显示简介
# 3. 勾选 "使用 Rosetta 打开"

# 方法 2: 选择 Rosetta 模拟器
# 在 Xcode 中选择带有 (Rosetta) 后缀的模拟器
# 例如: iPhone 15 Pro (Rosetta)`
      },
      {
        description: '在 Build Settings 中排除模拟器的 arm64 架构',
        codeExample: `# 在 Podfile 的 post_install 中添加:
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64'
    end
  end
end`
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit'],
    priority: 'medium'
  },

  // ===== 权限配置问题 =====
  {
    id: 'missing_permissions',
    keywords: ['permission', 'privacy', 'info.plist', '权限', 'camera', 'microphone', 'photo'],
    errorPatterns: [
      'NSCameraUsageDescription',
      'NSMicrophoneUsageDescription',
      'NSPhotoLibraryUsageDescription',
      'This app has crashed because it attempted to access privacy-sensitive data'
    ],
    symptom: '应用崩溃，提示缺少隐私权限描述',
    cause: 'Info.plist 中缺少必要的隐私权限描述',
    solutions: [
      {
        description: '在 Info.plist 中添加必要的权限描述',
        codeExample: `<!-- 在 Info.plist 中添加以下键值 -->
<key>NSCameraUsageDescription</key>
<string>需要访问相机以进行视频通话</string>

<key>NSMicrophoneUsageDescription</key>
<string>需要访问麦克风以进行语音通话</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>需要访问相册以发送图片</string>`,
        fileToModify: 'Info.plist'
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit'],
    priority: 'critical'
  },

  // ===== Swift 版本问题 =====
  {
    id: 'swift_version_mismatch',
    keywords: ['swift', 'version', 'SWIFT_VERSION', 'module compiled'],
    errorPatterns: [
      'SWIFT_VERSION',
      'module compiled with Swift',
      'swift-version'
    ],
    symptom: 'Swift 版本不匹配导致编译失败',
    cause: '项目 Swift 版本与依赖库编译版本不一致',
    solutions: [
      {
        description: '在 Podfile 中统一 Swift 版本',
        codeExample: `post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_VERSION'] = '5.0'
    end
  end
end`,
        fileToModify: 'Podfile'
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit'],
    priority: 'high'
  },

  // ===== Bitcode 问题 =====
  {
    id: 'bitcode_error',
    keywords: ['bitcode', 'ENABLE_BITCODE'],
    errorPatterns: [
      'ENABLE_BITCODE',
      'bitcode bundle could not be generated',
      'does not contain bitcode'
    ],
    symptom: '编译失败，提示 Bitcode 相关错误',
    cause: '某些依赖库不支持 Bitcode',
    solutions: [
      {
        description: '禁用 Bitcode（Xcode 14+ 已默认禁用）',
        codeExample: `# 在 Podfile 的 post_install 中添加:
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_BITCODE'] = 'NO'
    end
  end
end`,
        fileToModify: 'Podfile'
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit'],
    priority: 'medium'
  },

  // ===== 环信服务配置问题 =====
  {
    id: 'easemob_service_not_enabled',
    keywords: ['appkey', 'RTC', '未开通', '服务未开启', 'not enabled'],
    errorPatterns: [
      'service not enabled',
      'RTC service',
      'appkey invalid',
      'Invalid AppKey'
    ],
    symptom: '调用 API 失败，提示服务未开通或 AppKey 无效',
    cause: '环信控制台未开通相应服务，或 AppKey 配置错误',
    solutions: [
      {
        description: '在环信控制台开通相应服务',
        codeExample: `// 1. 登录环信控制台: https://console.easemob.com
// 2. 选择应用 → 功能配置
// 3. 开通所需功能（IM、RTC 等）
// 4. 注意：开通 RTC 后需等待约 15 分钟数据同步

// 检查 AppKey 格式是否正确:
// 格式: orgname#appname
let appKey = "your_org#your_app"`
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit'],
    priority: 'critical'
  },

  // ===== Framework 搜索路径问题 =====
  {
    id: 'framework_not_found',
    keywords: ['framework not found', 'library not found', 'ld: framework not found'],
    errorPatterns: [
      'framework not found',
      'library not found',
      'ld: library not found',
      'No such module'
    ],
    symptom: '编译失败，提示找不到 Framework 或 Library',
    cause: 'Framework 搜索路径配置不正确，或 pod install 未正确执行',
    solutions: [
      {
        description: '重新执行 pod install',
        codeExample: `# 清理并重新安装
pod deintegrate
pod cache clean --all
pod install --repo-update`
      },
      {
        description: '检查是否使用了正确的工作区文件',
        codeExample: `# 使用 .xcworkspace 而不是 .xcodeproj
open YourProject.xcworkspace`
      }
    ],
    relatedComponents: ['EaseChatUIKit', 'EaseCallUIKit', 'EaseChatroomUIKit'],
    priority: 'high'
  }
];

// ==================== 完整 Podfile 模板 ====================

export const PODFILE_TEMPLATES: Record<string, string> = {
  'EaseChatUIKit': `source 'https://github.com/CocoaPods/Specs.git'
platform :ios, '15.0'

target 'YourTarget' do
  use_frameworks!

  pod 'EaseChatUIKit'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
end`,

  'EaseCallUIKit': `source 'https://github.com/CocoaPods/Specs.git'
platform :ios, '15.0'

target 'YourTarget' do
  use_frameworks!

  pod 'EaseCallUIKit'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
end`,

  'EaseChatroomUIKit': `source 'https://github.com/CocoaPods/Specs.git'
platform :ios, '13.0'

target 'YourTarget' do
  use_frameworks!

  pod 'EaseChatroomUIKit'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
end`
};

// ==================== IntegrationGuide 类 ====================

export class IntegrationGuide {
  private problems: IntegrationProblem[];
  private requirements: Record<string, PlatformRequirement>;

  constructor() {
    this.problems = INTEGRATION_PROBLEMS;
    this.requirements = PLATFORM_REQUIREMENTS;
  }

  /**
   * 获取组件的平台要求
   */
  getRequirements(component: string): PlatformRequirement | null {
    return this.requirements[component] || null;
  }

  /**
   * 获取所有组件的平台要求
   */
  getAllRequirements(): PlatformRequirement[] {
    return Object.values(this.requirements);
  }

  /**
   * 检查 Podfile 配置是否符合要求
   */
  checkPodfileConfig(
    podfileContent: string,
    targetComponent: string
  ): PodfileCheck {
    const requirement = this.requirements[targetComponent];
    if (!requirement) {
      return {
        valid: false,
        issues: [{
          type: 'config',
          message: `未知组件: ${targetComponent}`,
          fix: `支持的组件: ${Object.keys(this.requirements).join(', ')}`
        }],
        suggestions: []
      };
    }

    const issues: PodfileIssue[] = [];
    const suggestions: string[] = [];

    // 检查 platform 版本
    const platformMatch = podfileContent.match(/platform\s*:ios\s*,\s*['"]?(\d+\.\d+)['"]?/);
    if (platformMatch) {
      const currentVersion = parseFloat(platformMatch[1]);
      const requiredVersion = parseFloat(requirement.minVersion);

      if (currentVersion < requiredVersion) {
        issues.push({
          type: 'version',
          message: `iOS 部署目标版本过低: ${currentVersion}，${targetComponent} 要求 ${requirement.minVersion}+`,
          fix: `将 platform :ios, '${platformMatch[1]}' 改为 platform :ios, '${requirement.minVersion}'`
        });
      }
    } else {
      issues.push({
        type: 'version',
        message: '未找到 platform 声明',
        fix: `添加 platform :ios, '${requirement.minVersion}'`
      });
    }

    // 检查 IPHONEOS_DEPLOYMENT_TARGET 设置
    if (!podfileContent.includes('IPHONEOS_DEPLOYMENT_TARGET')) {
      suggestions.push(`建议在 post_install 中添加 IPHONEOS_DEPLOYMENT_TARGET = '${requirement.minVersion}' 确保所有 Pod 目标一致`);
    }

    // 检查 User Script Sandboxing 设置
    if (!podfileContent.includes('ENABLE_USER_SCRIPT_SANDBOXING')) {
      suggestions.push("建议添加 ENABLE_USER_SCRIPT_SANDBOXING = 'NO' 避免 rsync 报错（Xcode 15+）");
    }

    // 检查 use_frameworks!
    if (!podfileContent.includes('use_frameworks!')) {
      issues.push({
        type: 'config',
        message: '缺少 use_frameworks! 声明',
        fix: '在 target 块内添加 use_frameworks!'
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * 根据错误信息诊断问题
   */
  diagnoseError(errorMessage: string): IntegrationProblem[] {
    const matchedProblems: Array<{ problem: IntegrationProblem; score: number }> = [];

    for (const problem of this.problems) {
      let score = 0;

      // 匹配错误模式
      for (const pattern of problem.errorPatterns) {
        if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
          score += 10;
        }
      }

      // 匹配关键词
      for (const keyword of problem.keywords) {
        if (errorMessage.toLowerCase().includes(keyword.toLowerCase())) {
          score += 5;
        }
      }

      if (score > 0) {
        matchedProblems.push({ problem, score });
      }
    }

    // 按匹配分数排序
    return matchedProblems
      .sort((a, b) => b.score - a.score)
      .map(item => item.problem);
  }

  /**
   * 根据关键词搜索问题
   */
  searchProblems(query: string): IntegrationProblem[] {
    const queryLower = query.toLowerCase();

    return this.problems.filter(problem => {
      // 搜索关键词
      if (problem.keywords.some(k => k.toLowerCase().includes(queryLower))) {
        return true;
      }

      // 搜索症状描述
      if (problem.symptom.toLowerCase().includes(queryLower)) {
        return true;
      }

      // 搜索原因
      if (problem.cause.toLowerCase().includes(queryLower)) {
        return true;
      }

      return false;
    });
  }

  /**
   * 获取组件的 Podfile 模板
   */
  getPodfileTemplate(component: string): string | null {
    return PODFILE_TEMPLATES[component] || null;
  }

  /**
   * 获取所有问题列表
   */
  getAllProblems(): IntegrationProblem[] {
    return this.problems;
  }

  /**
   * 根据 ID 获取问题
   */
  getProblemById(id: string): IntegrationProblem | null {
    return this.problems.find(p => p.id === id) || null;
  }

  /**
   * 生成集成检查清单
   */
  generateChecklist(component: string): string {
    const req = this.requirements[component];
    if (!req) {
      return `未知组件: ${component}`;
    }

    let checklist = `# ${component} 集成检查清单\n\n`;

    checklist += `## 环境要求\n`;
    checklist += `- [ ] iOS 部署目标: ${req.minVersion}+\n`;
    if (req.xcodeVersion) {
      checklist += `- [ ] Xcode 版本: ${req.xcodeVersion}+\n`;
    }
    if (req.cocoapodsVersion) {
      checklist += `- [ ] CocoaPods 版本: ${req.cocoapodsVersion}+\n`;
    }
    checklist += `\n`;

    checklist += `## Podfile 配置\n`;
    checklist += `- [ ] platform :ios, '${req.minVersion}'\n`;
    checklist += `- [ ] use_frameworks!\n`;
    checklist += `- [ ] pod '${component}'\n`;
    checklist += `- [ ] post_install: IPHONEOS_DEPLOYMENT_TARGET = '${req.minVersion}'\n`;
    checklist += `- [ ] post_install: ENABLE_USER_SCRIPT_SANDBOXING = 'NO'\n`;
    checklist += `\n`;

    if (component === 'EaseChatUIKit' || component === 'EaseCallUIKit') {
      checklist += `## Info.plist 权限\n`;
      checklist += `- [ ] NSCameraUsageDescription\n`;
      checklist += `- [ ] NSMicrophoneUsageDescription\n`;
      checklist += `- [ ] NSPhotoLibraryUsageDescription\n`;
      checklist += `\n`;
    }

    if (component === 'EaseCallUIKit') {
      checklist += `## 环信服务\n`;
      checklist += `- [ ] 在环信控制台开通 RTC 功能\n`;
      checklist += `- [ ] 等待 15 分钟数据同步\n`;
      checklist += `- [ ] 如需 VOIP，申请 VoIP 证书\n`;
      checklist += `\n`;
    }

    if (req.notes && req.notes.length > 0) {
      checklist += `## 注意事项\n`;
      for (const note of req.notes) {
        checklist += `- ${note}\n`;
      }
    }

    return checklist;
  }
}
