# Branchlet - 笔记应用

Branchlet 是一个基于 Tauri、React 和 TypeScript 构建的桌面笔记应用，具有 GitHub 同步功能。它允许您创建和管理分层笔记，并将笔记同步到 GitHub 仓库进行备份和跨设备访问。

## 功能特性

- **分层笔记管理**：以树形结构组织笔记，支持无限层级的子笔记
- **GitHub 同步**：自动将笔记同步到 GitHub 仓库进行备份和跨设备访问
- **实时编辑**：所见即所得的笔记编辑体验
- **本地存储**：所有笔记数据都存储在本地，确保隐私安全
- **跨平台支持**：支持 Windows、macOS 和 Linux 操作系统

## 技术栈

- [Tauri](https://tauri.app/) - 构建安全、快速且体积小的桌面应用程序
- [React](https://reactjs.org/) - 用于构建用户界面的 JavaScript 库
- [TypeScript](https://www.typescriptlang.org/) - JavaScript 的超集，添加了静态类型定义
- [Vite](https://vitejs.dev/) - 快速的构建工具

## 推荐的 IDE 设置

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) (v16 或更高版本)
- [Rust](https://www.rust-lang.org/) (通过 rustup 安装)

### 安装依赖

```bash
npm install
```

### 项目依赖

#### 生产环境依赖

- `@heroui/react`: ^2.8.2
- `@octokit/rest`: ^20.0.0
- `@tauri-apps/api`: ^2
- `@tauri-apps/plugin-fs`: ^2.4.1
- `@tauri-apps/plugin-opener`: ^2
- `framer-motion`: ^12.23.12
- `react`: ^18.3.1
- `react-dom`: ^18.3.1
- `react-window`: ^1.8.11
- `uuid`: ^11.1.0

#### 开发环境依赖

- `@tauri-apps/cli`: ^2
- `@types/react`: ^18.3.1
- `@types/react-dom`: ^18.3.1
- `@types/react-window`: ^1.8.8
- `@types/uuid`: ^10.0.0
- `@vitejs/plugin-react`: ^4.3.4
- `typescript`: ~5.6.2
- `vite`: ^6.0.3

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

### 预览构建

```bash
npm run preview
```

### 运行桌面应用

```bash
npm run tauri dev
```

### 构建桌面应用

```bash
npm run tauri build
```

## GitHub 同步设置

Branchlet 支持将笔记自动同步到 GitHub 仓库进行备份和跨设备访问。

1. 在 GitHub 上创建一个 Personal Access Token：
   - 访问 [GitHub Token 设置页面](https://github.com/settings/tokens/new)
   - 选择适当的权限（至少需要 `repo` 权限）
   - 生成 token 并保存

2. 在应用中配置 GitHub 同步：
   - 点击界面右上角的"设置"按钮
   - 在弹出的设置框中输入您的 GitHub Personal Access Token
   - 点击"保存"按钮

3. 应用会自动创建一个名为 `Branchlet-nts` 的仓库用于存储笔记。

应用会在每次启动时自动从 GitHub 拉取最新的笔记，您也可以手动点击"拉取"按钮同步笔记。点击"推送"按钮可以将本地更改推送到 GitHub。

## 项目结构

```
src/
├── App.tsx          # 主应用组件
├── GithubSync.tsx    # GitHub 同步功能组件
├── main.tsx          # 应用入口点
└── vite-env.d.ts     # TypeScript 声明文件

src-tauri/
├── src/
│   ├── main.rs       # Tauri 后端主文件
│   └── lib.rs        # Tauri 命令模块
└── tauri.conf.json   # Tauri 配置文件
```

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
