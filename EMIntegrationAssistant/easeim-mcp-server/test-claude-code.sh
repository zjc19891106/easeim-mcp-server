#!/bin/bash

# 环信 MCP Server 快速测试脚本

echo "=================================="
echo "环信 MCP Server 快速测试"
echo "=================================="
echo ""

# 1. 检查配置文件
echo "1️⃣ 检查配置文件..."
if [ -f ~/.config/claude/claude_desktop_config.json ]; then
    echo "✅ 配置文件存在"
    echo "📄 配置内容："
    cat ~/.config/claude/claude_desktop_config.json | head -20
else
    echo "❌ 配置文件不存在"
    exit 1
fi

echo ""

# 2. 检查关键文件
echo "2️⃣ 检查关键文件..."
FILES=(
    "dist/index.js"
    "data/configs/index.json"
    "data/configs/impact-analysis.json"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        size=$(ls -lh "$file" | awk '{print $5}')
        echo "✅ $file ($size)"
    else
        echo "❌ $file 不存在"
    fi
done

echo ""

# 3. 测试 Server 启动
echo "3️⃣ 测试 Server 启动（3秒后自动停止）..."
timeout 3 node dist/index.js 2>&1 || echo "Server 已停止"

echo ""
echo "=================================="
echo "✅ 准备完成！"
echo "=================================="
echo ""
echo "📋 下一步操作："
echo ""
echo "1. 重启 Claude Code"
echo "   - 完全退出 Claude Code 应用"
echo "   - 重新打开 Claude Code"
echo ""
echo "2. 在 Claude Code 中测试以下问题："
echo ""
echo "   问题 1: 你好，请列出所有可用的 MCP 工具"
echo "   预期: 应该看到 9 个工具，包括 get_config_usage"
echo ""
echo "   问题 2: 请列出 EaseChatUIKit 的所有配置项"
echo "   预期: 返回 10 个配置项列表"
echo ""
echo "   问题 3: avatarRadius 配置项是做什么的？"
echo "   预期: 返回详细的使用信息，包括影响的 25 个组件"
echo ""
echo "   问题 4: 我想把所有头像改成圆形，应该怎么做？"
echo "   预期: Claude 会调用 get_config_usage，然后给出配置方案"
echo ""
echo "=================================="
echo "🐛 如果遇到问题，查看："
echo "   docs/CLAUDE_CODE_SETUP.md"
echo "=================================="
