import { IntegrationRegistry, IntegrationProblem, PlatformRequirement } from './IntegrationRegistry.js';

export interface IntegrationSolution {
  description: string;
  codeExample?: string;
  fileToModify?: string;
  settingPath?: string;
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

export class IntegrationGuide {
  private registry: IntegrationRegistry;

  constructor(registry?: IntegrationRegistry) {
    this.registry = registry || new IntegrationRegistry();
  }

  getRequirements(component: string): PlatformRequirement | null {
    return this.registry.getRequirement(component);
  }

  getAllRequirements(): PlatformRequirement[] {
    return this.registry.getAllRequirements();
  }

  checkPodfileConfig(podfileContent: string, targetComponent: string): PodfileCheck {
    const requirement = this.registry.getRequirement(targetComponent);
    if (!requirement) {
      return {
        valid: false,
        issues: [{
          type: 'config',
          message: `未知组件: ${targetComponent}`,
          fix: `支持的组件: ${this.registry.getAllRequirements().map(r => r.component).join(', ')}`
        }],
        suggestions: []
      };
    }

    const issues: PodfileIssue[] = [];
    const suggestions: string[] = [];

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

    if (!podfileContent.includes('IPHONEOS_DEPLOYMENT_TARGET')) {
      suggestions.push(`建议在 post_install 中添加 IPHONEOS_DEPLOYMENT_TARGET = '${requirement.minVersion}' 确保所有 Pod 目标一致`);
    }

    if (!podfileContent.includes('ENABLE_USER_SCRIPT_SANDBOXING')) {
      suggestions.push("建议添加 ENABLE_USER_SCRIPT_SANDBOXING = 'NO' 避免 rsync 报错（Xcode 15+）");
    }

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

  diagnoseError(errorMessage: string): IntegrationProblem[] {
    const matchedProblems: Array<{ problem: IntegrationProblem; score: number }> = [];

    for (const problem of this.registry.getProblems()) {
      let score = 0;

      for (const pattern of problem.errorPatterns) {
        if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
          score += 10;
        }
      }

      for (const keyword of problem.keywords) {
        if (errorMessage.toLowerCase().includes(keyword.toLowerCase())) {
          score += 5;
        }
      }

      if (score > 0) {
        matchedProblems.push({ problem, score });
      }
    }

    return matchedProblems
      .sort((a, b) => b.score - a.score)
      .map(item => item.problem);
  }

  searchProblems(query: string): IntegrationProblem[] {
    const queryLower = query.toLowerCase();

    return this.registry.getProblems().filter(problem => {
      if (problem.keywords.some(k => k.toLowerCase().includes(queryLower))) {
        return true;
      }

      if (problem.symptom.toLowerCase().includes(queryLower)) {
        return true;
      }

      if (problem.cause.toLowerCase().includes(queryLower)) {
        return true;
      }

      return false;
    });
  }

  getPodfileTemplate(component: string): string | null {
    return this.registry.getPodfileTemplate(component);
  }

  getAllProblems(): IntegrationProblem[] {
    return this.registry.getProblems();
  }

  getProblemById(id: string): IntegrationProblem | null {
    return this.registry.getProblems().find(p => p.id === id) || null;
  }

  generateChecklist(component: string): string {
    const req = this.registry.getRequirement(component);
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
