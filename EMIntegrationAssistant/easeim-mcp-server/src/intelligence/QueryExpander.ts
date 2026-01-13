/**
 * 查询扩展器
 * 通过同义词库和领域术语映射提升检索召回率
 */

export interface ExpandedQuery {
  original: string;
  expanded: string[];
  synonymsUsed: Array<{ term: string; synonyms: string[] }>;
}

export class QueryExpander {
  // 环信 SDK 领域同义词库
  private synonyms: Map<string, string[]> = new Map([
    // === 核心概念 ===
    ['消息', ['message', 'msg', '信息', '聊天']],
    ['message', ['消息', 'msg', '信息']],
    ['msg', ['message', '消息']],

    ['发送', ['send', '发', '推送', '传送']],
    ['send', ['发送', '发', 'post']],

    ['接收', ['receive', '收到', '收取', '获取']],
    ['receive', ['接收', '收到', 'get']],

    // === 用户相关 ===
    ['头像', ['avatar', '图像', '照片', '用户头像']],
    ['avatar', ['头像', 'profile image', 'photo']],

    ['昵称', ['nickname', '名称', '用户名', '显示名']],
    ['nickname', ['昵称', 'name', 'display name']],

    ['用户', ['user', '成员', '联系人']],
    ['user', ['用户', 'member', 'contact']],

    // === 群组/聊天室 ===
    ['群', ['group', '群组', '群聊']],
    ['group', ['群', '群组', '群聊']],
    ['群组', ['group', '群', '群聊']],

    ['聊天室', ['chatroom', 'room', '直播间', '房间']],
    ['chatroom', ['聊天室', 'room', '直播间']],
    ['直播间', ['chatroom', '聊天室', 'room']],

    // === 会话 ===
    ['会话', ['conversation', 'conv', '对话', '聊天']],
    ['conversation', ['会话', 'conv', 'chat']],
    ['conv', ['conversation', '会话']],

    // === UI 元素 ===
    ['气泡', ['bubble', '消息框', '消息气泡']],
    ['bubble', ['气泡', '消息框', 'message bubble']],

    ['颜色', ['color', '色彩', '配色']],
    ['color', ['颜色', '色彩', 'hue']],

    ['样式', ['style', '外观', '风格', 'UI']],
    ['style', ['样式', '外观', 'appearance']],

    ['主题', ['theme', '风格', '皮肤']],
    ['theme', ['主题', '风格', 'skin']],

    ['背景', ['background', 'bg', '底色']],
    ['background', ['背景', 'bg']],

    ['按钮', ['button', 'btn', '控件']],
    ['button', ['按钮', 'btn']],
    ['btn', ['button', '按钮']],

    ['菜单', ['menu', '选项', '操作栏']],
    ['menu', ['菜单', '选项']],

    // === 回调/监听 ===
    ['回调', ['callback', 'delegate', '监听', 'listener', '事件']],
    ['callback', ['回调', 'delegate', 'handler']],
    ['delegate', ['回调', 'callback', '代理']],
    ['监听', ['listener', 'callback', '观察', 'observer']],
    ['listener', ['监听', 'callback', 'observer']],

    // === 操作动词 ===
    ['修改', ['change', '更改', '设置', '调整', 'modify']],
    ['change', ['修改', '更改', 'update']],
    ['设置', ['set', '配置', '修改']],
    ['set', ['设置', 'configure', 'setup']],

    ['自定义', ['custom', 'customize', '定制', '个性化']],
    ['custom', ['自定义', 'customize', '定制']],
    ['customize', ['自定义', 'custom', '定制']],

    ['添加', ['add', '增加', '新增', '插入']],
    ['add', ['添加', '增加', 'insert']],

    ['删除', ['delete', '移除', '清除', 'remove']],
    ['delete', ['删除', 'remove', 'clear']],
    ['remove', ['删除', 'delete', '移除']],

    // === 错误相关 ===
    ['错误', ['error', '异常', '问题', '失败']],
    ['error', ['错误', '异常', 'exception', 'failure']],
    ['失败', ['fail', 'failed', '错误', '不成功']],
    ['fail', ['失败', 'failed', 'error']],

    // === 功能模块 ===
    ['推送', ['push', '通知', 'notification']],
    ['push', ['推送', 'notification']],

    ['音视频', ['audio video', '通话', 'call', 'rtc']],
    ['通话', ['call', '音视频', 'voice', 'video']],
    ['call', ['通话', '音视频', '呼叫']],

    ['登录', ['login', '登陆', '签入', 'sign in']],
    ['login', ['登录', 'sign in', 'authenticate']],

    ['退出', ['logout', '登出', '注销', 'sign out']],
    ['logout', ['退出', 'sign out', '注销']],

    // === 消息类型 ===
    ['文本', ['text', '文字']],
    ['text', ['文本', '文字']],

    ['图片', ['image', '照片', 'picture', 'photo']],
    ['image', ['图片', 'picture', 'photo']],

    ['语音', ['voice', '音频', 'audio']],
    ['voice', ['语音', 'audio']],

    ['视频', ['video', '影片']],

    ['文件', ['file', '附件', '文档']],
    ['file', ['文件', 'attachment', 'document']],

    ['位置', ['location', '地理位置', '地点']],
    ['location', ['位置', '地点', 'position']],

    // === SDK 组件 ===
    ['uikit', ['UI组件', '界面组件', 'UI Kit']],
    ['sdk', ['SDK', '开发包', '开发套件']],
  ]);

  // 缩写展开映射
  private abbreviations: Map<string, string[]> = new Map([
    ['msg', ['message']],
    ['conv', ['conversation']],
    ['btn', ['button']],
    ['bg', ['background']],
    ['img', ['image']],
    ['cfg', ['config', 'configuration']],
    ['init', ['initialize', 'initialization']],
    ['auth', ['authentication', 'authorize']],
    ['pwd', ['password']],
    ['usr', ['user']],
    ['grp', ['group']],
    ['rm', ['room', 'chatroom']],
  ]);

  // 停用词 - 扩展时忽略
  private stopWords: Set<string> = new Set([
    '的', '是', '在', '了', '和', '与', '或', '一个', '这个', '那个',
    '如何', '怎么', '怎样', '什么', '为什么', '哪个', '哪些',
    'the', 'a', 'an', 'is', 'are', 'to', 'for', 'of', 'in', 'on',
    'how', 'what', 'why', 'which', 'when', 'where',
    'can', 'could', 'would', 'should', 'do', 'does',
  ]);

  /**
   * 扩展查询 - 返回原始查询 + 同义词扩展
   */
  expand(query: string): ExpandedQuery {
    const tokens = this.tokenize(query);
    const expandedSet: Set<string> = new Set(tokens);
    const synonymsUsed: Array<{ term: string; synonyms: string[] }> = [];

    for (const token of tokens) {
      // 跳过停用词
      if (this.stopWords.has(token.toLowerCase())) {
        continue;
      }

      // 查找同义词
      const syns = this.findSynonyms(token);
      if (syns.length > 0) {
        syns.forEach(s => expandedSet.add(s));
        synonymsUsed.push({ term: token, synonyms: syns });
      }

      // 展开缩写
      const abbrevExpanded = this.expandAbbreviation(token);
      if (abbrevExpanded.length > 0) {
        abbrevExpanded.forEach(s => expandedSet.add(s));
      }
    }

    return {
      original: query,
      expanded: Array.from(expandedSet),
      synonymsUsed,
    };
  }

  /**
   * 获取用于搜索的扩展查询字符串
   */
  getExpandedSearchTerms(query: string): string[] {
    const result = this.expand(query);
    return result.expanded;
  }

  /**
   * 检查两个查询是否语义等价
   */
  areEquivalent(query1: string, query2: string): boolean {
    const expanded1 = new Set(this.expand(query1).expanded.map(t => t.toLowerCase()));
    const expanded2 = new Set(this.expand(query2).expanded.map(t => t.toLowerCase()));

    // 计算 Jaccard 相似度
    const intersection = new Set([...expanded1].filter(x => expanded2.has(x)));
    const union = new Set([...expanded1, ...expanded2]);

    return intersection.size / union.size > 0.5;
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    const normalized = text.toLowerCase();

    // 英文单词
    const englishWords = normalized.match(/[a-z][a-z0-9]*/g) || [];
    tokens.push(...englishWords);

    // 中文词汇 - 简单按标点/空格分割
    const chineseSegments = normalized.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseSegments) {
      tokens.push(segment);
      // 拆分为单字以增加匹配机会
      if (segment.length > 1) {
        for (const char of segment) {
          tokens.push(char);
        }
      }
    }

    return [...new Set(tokens)];
  }

  /**
   * 查找同义词
   */
  private findSynonyms(term: string): string[] {
    const lowerTerm = term.toLowerCase();

    // 直接查找
    if (this.synonyms.has(lowerTerm)) {
      return this.synonyms.get(lowerTerm)!;
    }

    // 中文字符逐字匹配
    if (/[\u4e00-\u9fa5]/.test(term)) {
      const synonyms: string[] = [];
      for (const [key, values] of this.synonyms) {
        if (key.includes(term) || term.includes(key)) {
          synonyms.push(...values);
        }
      }
      return [...new Set(synonyms)];
    }

    return [];
  }

  /**
   * 展开缩写
   */
  private expandAbbreviation(term: string): string[] {
    const lowerTerm = term.toLowerCase();
    return this.abbreviations.get(lowerTerm) || [];
  }

  /**
   * 添加自定义同义词（运行时扩展）
   */
  addSynonym(term: string, synonyms: string[]): void {
    const existing = this.synonyms.get(term.toLowerCase()) || [];
    this.synonyms.set(term.toLowerCase(), [...new Set([...existing, ...synonyms])]);
  }

  /**
   * 获取某个词的所有同义词
   */
  getSynonyms(term: string): string[] {
    return this.findSynonyms(term);
  }
}
