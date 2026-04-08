# ⚔️ WeChat Gomoku - 真技能五子棋

<div align="center">

![Version](https://img.shields.io/badge/version-2.3.5-blue)
![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

[中文](#中文说明) | [English](#english-description)

**诸神之战 - 一款融合五子棋与技能系统的微信小游戏**

[在线演示](#) • [文档](#文档) • [问题报告](#问题报告) • [贡献](#贡献)

</div>

---

## 中文说明

### 🎮 游戏介绍

《真技能五子棋·诸神之战》是一款创新的微信小游戏，将经典五子棋与独特的技能系统完美融合。玩家需要在遵守黑方禁手规则的同时，通过积累内力（MP）来使用强大技能，与智能AI对手展开激烈对弈。

### ⭐ 核心特性

#### 游戏规则
- **黑方（玩家）**: 受禁手限制（长连、三三、四四判负），连5个棋子获胜
- **白方（AI）**: 无禁手限制，连5个棋子直接获胜
- **优先级**: 五连 > 禁手（同时满足时按五连胜）

#### 5个技能系统
| 技能 | 成本 | 效果 |
|-----|------|------|
| 🕐 时光倒流 | 30 MP | 悔棋一步，撤销上一步操作 |
| 💥 力拔山兮 | 50 MP | 炸毁十字范围内的所有棋子 |
| 🌪️ 飞沙走石 | 70 MP | 移动对方一个棋子到别处 |
| ❄️ 静如止水 | 100 MP | 暂停对方一个回合 |
| 🔄 东山再起 | 200 MP | 重开棋局，清空所有棋子 |

#### 内力系统
- 初始内力：0 点
- 积累方式：每下一颗棋子 +5 点
- 最大内力：200 点
- 内力不足无法使用对应技能

#### 用户体验
- 🎵 高质量背景音乐（CDN 古筝音乐）
- 🔊 完整音效系统（放置、技能、胜负）
- 📱 完美适配 iPhone 刘海屏
- 🎨 精美 UI 设计，响应式布局
- 📖 详细游戏说明（10 个章节，可滑动浏览）

### 🚀 快速开始

#### 前置条件
- 微信开发者工具
- WeChat 最新版本
- iPhone 或 Android 设备（真机测试）

#### 部署步骤

1. **克隆项目**
```bash
git clone https://github.com/leeking001/wechat-gomoku.git
cd wechat-gomoku
```

2. **在微信开发者工具中打开**
- 打开微信开发者工具
- 选择"导入项目"
- 选择本项目目录
- 输入 AppID（从微信小游戏后台获取）

3. **编译项目**
- 快捷键：`Ctrl+B` (Windows) 或 `Cmd+B` (Mac)
- 或点击"编译"按钮

4. **真机测试**
- 点击"预览"获取二维码
- 用手机 WeChat 扫码
- 或使用"自动真机调试"

5. **上传部署**
- 点击"上传"按钮
- 填写版本号和说明
- 提交到微信小游戏平台

### 📁 项目结构

```
wechat-gomoku/
├── game.js                      # 主游戏文件 (33 KB)
│   ├── Canvas 渲染系统
│   ├── 触摸交互处理
│   ├── UI 绘制
│   └── 音效管理
│
├── utils/
│   ├── gomoku-skill.js         # 游戏引擎和技能系统
│   │   ├── 五子棋核心逻辑
│   │   ├── 禁手检测（长连、三三、四四）
│   │   ├── 5 个技能实现
│   │   └── 内力系统
│   │
│   └── guide.js                # 游戏说明内容 (10 章节)
│       └── 精简、易读的规则说明
│
├── sounds/                      # 音效文件
│   ├── bg-music.wav            # CDN 古筝背景音乐
│   ├── click.wav               # 点击音效
│   ├── place.wav               # 落子音效
│   ├── skill.wav               # 技能音效
│   ├── win.wav                 # 胜利音效
│   └── lose.wav                # 失败音效
│
├── images/                      # 游戏资源
│
├── game.json                    # 小游戏入口配置
├── project.config.json          # 微信开发工具配置
└── .gitignore                   # Git 忽略规则
```

### 🎯 游戏流程

```
1. 游戏开始
   ↓
2. 首次点击棋盘 → 音乐自动播放
   ↓
3. 轮流放置棋子，积累内力
   ↓
4. 内力充足时使用技能改变局面
   ↓
5. 连成 5 个棋子获胜
   或触发禁手判负
```

### 🔧 技术栈

| 技术 | 说明 |
|-----|------|
| 语言 | JavaScript (ES6+) |
| 渲染 | Canvas 2D API |
| 平台 | WeChat Mini Game |
| 音频 | Web Audio API + CDN |
| 适配 | 响应式布局、safe area |

### ⚙️ 系统要求

- **微信版本**: 7.0 及以上
- **设备**: iOS 10+ / Android 5+
- **屏幕尺寸**: 支持各种屏幕尺寸
- **特殊支持**: iPhone 刘海屏、安全区域

### 📖 文档

详细的技术文档和开发指南：

| 文档 | 描述 |
|-----|------|
| [DEPLOYMENT.md](./docs/DEPLOYMENT_FIX_v2.3.3.md) | 完整部署指南 |
| [FORBIDDEN_HANDS.md](./docs/FORBIDDEN_HANDS_FIX_v2.3.5.md) | 禁手检测实现说明 |
| [GUIDE_OPTIMIZATION.md](./docs/GUIDE_OPTIMIZATION_v2.3.4.md) | 说明页面优化 |
| [PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md) | 项目结构详解 |

### 🧪 测试覆盖

- ✅ 基础游戏流程
- ✅ 5 个技能系统
- ✅ AI 对手
- ✅ 禁手检测（长连、三三、四四）
- ✅ 内力系统
- ✅ 音效播放
- ✅ 触摸交互
- ✅ iPhone 刘海屏适配
- ✅ 高 DPI 屏幕适配

### 🎓 技术亮点

#### 架构设计
- 模块化设计：游戏引擎与 UI 完全分离
- 响应式布局：完美适配各种屏幕尺寸
- 容错机制：音效失败自动降级

#### 算法优化
- 高效的禁手检测算法
- 智能 AI 算法（评分系统）
- 流畅的 Canvas 渲染

#### 用户体验
- CDN 音乐，无需本地存储
- 自动音乐播放（首次交互后）
- 流畅的触摸交互
- 详细的游戏说明

### 🐛 已知问题

目前暂无已知问题。如遇到问题，请[提交 Issue](#问题报告)。

### 📝 版本历史

| 版本 | 日期 | 主要改进 |
|-----|------|--------|
| v2.3.5 | 2026-04-07 | 🔧 实现禁手检测（长连、三三、四四） |
| v2.3.4 | 2026-04-07 | ✨ 优化说明页面交互和文案 |
| v2.3.3 | 2026-04-07 | 🔧 修复按钮位置和说明内容 |
| v2.3.2 | 2026-04-07 | 🎵 升级为 CDN 古筝音乐 |
| v2.3.1 | 2026-04-07 | 🔧 修复音乐和技能 bug |
| v2.3.0 | 2026-04-02 | 🎮 初版完成 |

### 🤝 贡献

欢迎提交 Pull Request 或提出建议！

### 📞 问题报告

如遇到问题，请：
1. 检查 [文档](#文档) 是否有解决方案
2. 提交 [Issue](https://github.com/leeking001/wechat-gomoku/issues)
3. 描述：问题现象、重现步骤、预期结果

### 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

---

## English Description

### 🎮 About

**WeChat Gomoku - The Battle of Gods** is an innovative WeChat mini-game that combines classic Gomoku with a unique skill system. Players must compete with an intelligent AI opponent while adhering to Black piece forbidden hand rules and accumulating MP (internal power) to use powerful skills.

### ⭐ Features

- **5-in-a-row Gomoku** with forbidden hand rules
- **5 unique skills** with MP system (30/50/70/100/200 cost)
- **AI opponent** with smart strategy
- **High-quality music** from CDN (Pixabay guzheng)
- **Complete sound effects** system
- **Responsive UI** with safe area support
- **Detailed game guide** with 10 sections

### 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/leeking001/wechat-gomoku.git

# Open in WeChat Developer Tools
# Compile: Ctrl+B (Windows) or Cmd+B (Mac)
# Test: Click "Preview" for QR code or use auto device debug
# Deploy: Click "Upload"
```

### 📖 Documentation

See [docs/](./docs/) folder for detailed guides in Chinese.

### 📄 License

MIT License

---

<div align="center">

### 🎉 感谢您的关注！

Made with ❤️ by [leeking001](https://github.com/leeking001)

[⬆️ 回到顶部](#-wechat-gomoku---真技能五子棋)

</div>
