#!/bin/bash

# 项目发布脚本
# 支持构建Windows、macOS、Linux发行版并上传到GitHub Releases

# 配置区域
PROJECT_NAME="branchlet"  # 项目名称
VERSION="0.1.0"  # 版本号
REPO_OWNER="EricJiang1329145"  # GitHub用户名
REPO_NAME="Branchlet"  # GitHub仓库名

# 显示帮助信息
show_help() {
  echo "用法: $0 [选项]"
  echo ""
  echo "选项:"
  echo "  --repo-owner <用户名>     GitHub用户名"
  echo "  --repo-name <仓库名>      GitHub仓库名"
  echo "  --version <版本号>        版本号"
  echo "  -h, --help               显示此帮助信息"
  echo ""
  echo "环境变量:"
  echo "  GITHUB_TOKEN             GitHub Personal Access Token，需要有 repo 权限"
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo-owner)
      REPO_OWNER="$2"
      shift 2
      ;;
    --repo-name)
      REPO_NAME="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "未知参数: $1"
      show_help
      exit 1
      ;;
  esac
done

# 检查必要工具
check_tools() {
  echo "检查必要工具..."
  if ! command -v npm &> /dev/null; then
    echo "错误: 未找到npm，请先安装Node.js"
    exit 1
  fi
  
  if ! command -v cargo &> /dev/null; then
    echo "错误: 未找到cargo，请先安装Rust"
    exit 1
  fi
  
  if ! command -v curl &> /dev/null; then
    echo "错误: 未找到curl，请先安装curl"
    exit 1
  fi
  
  echo "所有必要工具已安装。"
}

# 清理之前的构建
echo "清理之前的构建..."
cargo clean
rm -rf dist

# 检查工具
check_tools

# 为macOS构建
build_macos() {
  echo "为macOS构建..."
  npm run tauri build -- --target aarch64-apple-darwin
  
  if [ $? -ne 0 ]; then
    echo "macOS构建失败"
    exit 1
  fi
  
  echo "macOS构建完成"
}

# 为Linux构建
build_linux() {
  echo "为Linux构建..."
  npm run tauri build -- --target x86_64-unknown-linux-gnu
  
  if [ $? -ne 0 ]; then
    echo "Linux构建失败"
    exit 1
  fi
  
  echo "Linux构建完成"
}

# 为Windows构建
build_windows() {
  echo "为Windows构建..."
  npm run tauri build -- --target x86_64-pc-windows-msvc
  
  if [ $? -ne 0 ]; then
    echo "Windows构建失败"
    exit 1
  fi
  
  echo "Windows构建完成"
}

# 打包源代码
package_source() {
  echo "打包源代码..."
  # 创建源代码包
  tar -czf "${PROJECT_NAME}-src-${VERSION}.tar.gz" \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude="src-tauri/target" \
    --exclude="dist" \
    .
  
  if [ $? -ne 0 ]; then
    echo "源代码打包失败"
    exit 1
  fi
  
  echo "源代码打包完成"
}

# 创建GitHub Release并上传构建产物
upload_to_github() {
  echo "创建GitHub Release并上传构建产物..."
  
  # 检查GITHUB_TOKEN环境变量
  if [ -z "$GITHUB_TOKEN" ]; then
    echo "错误: 需要设置GITHUB_TOKEN环境变量"
    exit 1
  fi
  
  # 创建Release
  RESPONSE=$(curl -s -w "%{http_code}" -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases \
    -d "{\"tag_name\": \"v$VERSION\", \"name\": \"Release v$VERSION\", \"body\": \"Release of version $VERSION\"}")
  
  HTTP_CODE=${RESPONSE: -3}
  RESPONSE_BODY=${RESPONSE%???}
  
  if [ "$HTTP_CODE" -ne 201 ]; then
    echo "创建Release失败，HTTP状态码: $HTTP_CODE"
    echo "响应内容: $RESPONSE_BODY"
    exit 1
  fi
  
  # 提取RELEASE_ID
  RELEASE_ID=$(echo "$RESPONSE_BODY" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  
  if [ -z "$RELEASE_ID" ]; then
    echo "无法提取RELEASE_ID"
    exit 1
  fi
  
  echo "Release创建成功，ID: $RELEASE_ID"
  
  # 上传macOS DMG
  if [ -f "src-tauri/target/release/bundle/dmg/${PROJECT_NAME}_${VERSION}_aarch64.dmg" ]; then
    echo "上传macOS DMG..."
    curl -s -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Content-Type: application/octet-stream" \
      "https://uploads.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$RELEASE_ID/assets?name=${PROJECT_NAME}_${VERSION}_aarch64.dmg" \
      --data-binary "@src-tauri/target/release/bundle/dmg/${PROJECT_NAME}_${VERSION}_aarch64.dmg"
  fi
  
  # 上传Linux AppImage (需要先构建)
  if [ -f "src-tauri/target/release/bundle/appimage/${PROJECT_NAME}_${VERSION}_amd64.AppImage" ]; then
    echo "上传Linux AppImage..."
    curl -s -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Content-Type: application/octet-stream" \
      "https://uploads.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$RELEASE_ID/assets?name=${PROJECT_NAME}_${VERSION}_amd64.AppImage" \
      --data-binary "@src-tauri/target/release/bundle/appimage/${PROJECT_NAME}_${VERSION}_amd64.AppImage"
  fi
  
  # 上传Windows MSI (需要先构建)
  if [ -f "src-tauri/target/release/bundle/msi/${PROJECT_NAME}_${VERSION}_x64_en-US.msi" ]; then
    echo "上传Windows MSI..."
    curl -s -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Content-Type: application/octet-stream" \
      "https://uploads.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$RELEASE_ID/assets?name=${PROJECT_NAME}_${VERSION}_x64_en-US.msi" \
      --data-binary "@src-tauri/target/release/bundle/msi/${PROJECT_NAME}_${VERSION}_x64_en-US.msi"
  fi
  
  # 上传源代码包
  if [ -f "${PROJECT_NAME}-src-${VERSION}.tar.gz" ]; then
    echo "上传源代码包..."
    curl -s -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Content-Type: application/gzip" \
      "https://uploads.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$RELEASE_ID/assets?name=${PROJECT_NAME}-src-${VERSION}.tar.gz" \
      --data-binary "@${PROJECT_NAME}-src-${VERSION}.tar.gz"
  fi
  
  echo "所有构建产物上传完成"
}

# 执行构建
build_macos
build_linux
build_windows
package_source

# 上传到GitHub
upload_to_github

echo "发布流程完成!"