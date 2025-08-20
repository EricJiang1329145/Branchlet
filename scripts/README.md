# 自动化发布脚本说明

本项目包含两个自动化发布脚本：

1. `auto-publish.sh` - 全新编写的自动化发布脚本
2. `publish.sh` - 原有的发布脚本（已更新支持发布状态选项）

## auto-publish.sh 使用方法

```bash
# 给脚本添加执行权限
chmod +x scripts/auto-publish.sh

# 运行脚本
./scripts/auto-publish.sh
```

脚本执行后会：
1. 显示当前版本号
2. 提示输入目标版本号
3. 提供发布状态选项供选择（Latest、Pre-release、Draft）
4. 自动更新版本号并推送到GitHub

## publish.sh 使用方法

```bash
# 给脚本添加执行权限
chmod +x scripts/publish.sh

# 运行脚本
./scripts/publish.sh
```

脚本执行后会：
1. 提示输入版本号和版本介绍
2. 提供发布状态选项供选择（Latest、Pre-release、Draft）
3. 构建项目并上传到GitHub Releases

## 环境变量配置

为了能够上传到GitHub Releases，需要配置以下环境变量：

```bash
# GitHub Personal Access Token，需要有 repo 权限
export GITHUB_TOKEN=your_github_token
```

建议将环境变量配置在 `.env` 文件中，脚本会自动加载该文件。