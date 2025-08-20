#!/bin/bash

# 自动发布脚本
# 该脚本会显示当前版本号，提示用户输入目标版本号，并提供发布状态选项

# 获取当前版本号
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d '"' -f 4)

echo "当前版本号: $CURRENT_VERSION"

# 提示用户输入目标版本号
read -p "请输入目标版本号 (例如: 0.1.11): " TARGET_VERSION

# 验证版本号格式
if [[ ! $TARGET_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "错误: 版本号格式不正确，请使用 semantic versioning 格式 (例如: 1.0.0)"
  exit 1
fi

echo "目标版本号: $TARGET_VERSION"

echo "请选择发布状态:"
echo "1) Latest (最新稳定版)"
echo "2) Pre-release (预发布版)"
echo "3) Draft (草稿)"

read -p "请输入选项 (1-3, 默认为1): " RELEASE_CHOICE

# 设置默认选项
if [ -z "$RELEASE_CHOICE" ]; then
  RELEASE_CHOICE=1
fi

# 根据用户选择设置发布参数
DRAFT=false
PRERELEASE=false
case $RELEASE_CHOICE in
  1)
    echo "将发布为 Latest 版本"
    ;;
  2)
    echo "将发布为 Pre-release 版本"
    PRERELEASE=true
    ;;
  3)
    echo "将发布为 Draft 版本"
    DRAFT=true
    ;;
  *)
    echo "无效选项，将发布为 Latest 版本"
    ;;
esac

# 更新 package.json 中的版本号
echo "正在更新 package.json 版本号..."
sed -i "" "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$TARGET_VERSION\"/" package.json

# 更新 src-tauri/tauri.conf.json 中的版本号
echo "正在更新 src-tauri/tauri.conf.json 版本号..."
sed -i "" "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$TARGET_VERSION\"/" src-tauri/tauri.conf.json

# 创建新的 Git tag
echo "正在创建 Git tag v$TARGET_VERSION..."
git add package.json src-tauri/tauri.conf.json
git commit -m "Update version to $TARGET_VERSION"
git tag -a "v$TARGET_VERSION" -m "Release version $TARGET_VERSION"

# 推送更改到远程仓库
echo "正在推送到远程仓库..."
git push origin main
git push origin "v$TARGET_VERSION"

echo "版本 $TARGET_VERSION 已成功发布!"
echo "发布状态: $(case $RELEASE_CHOICE in 1) echo 'Latest'; ;; 2) echo 'Pre-release'; ;; 3) echo 'Draft'; ;; *) echo 'Latest'; ;; esac)"