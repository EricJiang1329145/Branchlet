#!/bin/bash

# 自动化版本发布脚本
# 用法: ./scripts/release.sh [版本号]

set -e  # 遇到错误时退出

# 获取当前版本号
CURRENT_VERSION=$(node -p "require('./package.json').version")

# 如果没有提供版本号参数，则提示用户输入
if [ $# -eq 0 ]; then
  echo "当前版本: $CURRENT_VERSION"
  read -p "请输入新版本号 (或按回车使用当前版本): " NEW_VERSION
  
  # 如果用户没有输入版本号，则使用当前版本
  if [ -z "$NEW_VERSION" ]; then
    NEW_VERSION=$CURRENT_VERSION
  fi
else
  NEW_VERSION=$1
fi

# 创建版本标签
TAG_NAME="v$NEW_VERSION"

echo "准备发布版本: $TAG_NAME"

# 检查标签是否已存在
while git rev-parse -q --verify "refs/tags/$TAG_NAME" >/dev/null 2>&1; do
  echo "警告: 标签 $TAG_NAME 已存在！"
  read -p "请选择操作: (d) 删除旧标签 (n) 使用新标签名 (s) 跳过标签创建 [d/n/s]: " choice
  
  case $choice in
    d|D)
      echo "正在删除本地标签: $TAG_NAME"
      git tag -d "$TAG_NAME"
      echo "正在删除远程标签: $TAG_NAME"
      if git push origin --delete "$TAG_NAME" 2>/dev/null; then
        echo "远程标签 $TAG_NAME 删除成功"
      else
        echo "警告: 远程标签 $TAG_NAME 删除失败或不存在"
      fi
      break
      ;;
    n|N)
      read -p "请输入新的版本号: " NEW_VERSION
      TAG_NAME="v$NEW_VERSION"
      ;;
    s|S)
      echo "跳过标签创建"
      exit 0
      ;;
    *)
      echo "无效选择，请重新输入"
      ;;
  esac
done

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
  echo "检测到未提交的更改，正在添加并提交..."
  git add .
  git commit -m "chore: release $TAG_NAME"
else
  echo "没有未提交的更改"
fi

# 创建标签
echo "正在创建标签: $TAG_NAME"
git tag -a "$TAG_NAME" -m "Release $TAG_NAME"

# 推送标签到远程仓库
echo "正在推送到远程仓库..."
git push origin "$TAG_NAME"

# 同时推送主分支（如果需要）
# git push origin main

echo "版本 $TAG_NAME 已成功发布并推送到远程仓库！"