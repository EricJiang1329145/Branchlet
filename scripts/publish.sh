#!/bin/bash

# 项目发布脚本
# 支持构建Windows、macOS发行版并上传到GitHub Releases

# 配置区域
PROJECT_NAME="branchlet"  # 项目名称
VERSION="0.1.0"  # 版本号
REPO_OWNER="EricJiang1329145"  # GitHub用户名
REPO_NAME="Branchlet"  # GitHub仓库名

# 从 .env 文件加载环境变量
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# 询问版本号和介绍
echo "请输入版本号 (默认: $VERSION):"
read -r INPUT_VERSION
if [ -n "$INPUT_VERSION" ]; then
  VERSION="$INPUT_VERSION"
fi

echo "请输入版本介绍:"
read -r RELEASE_NOTES
if [ -z "$RELEASE_NOTES" ]; then
  RELEASE_NOTES="Release of version $VERSION"
fi

# 复述用户输入
echo "您输入的版本号是: $VERSION"
echo "您输入的版本介绍是: $RELEASE_NOTES"
echo "您输入的仓库所有者是: $REPO_OWNER"
echo "您输入的仓库名称是: $REPO_NAME"
echo "请确认以上信息是否正确，按回车键继续..."
read -r

# 检查版本是否已存在
if [ -n "$GITHUB_TOKEN" ]; then
  echo "检查GitHub上是否已存在版本 $VERSION..."
  CHECK_RESPONSE=$(curl -s -w "%{http_code}" -X GET \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/v$VERSION")
  
  CHECK_HTTP_CODE=${CHECK_RESPONSE: -3}
  CHECK_RESPONSE_BODY=${CHECK_RESPONSE%???}
  
  if [ "$CHECK_HTTP_CODE" -eq 200 ]; then
    echo "警告: GitHub上已存在版本 $VERSION"
    EXISTING_RELEASE_NOTES=$(echo "$CHECK_RESPONSE_BODY" | grep -o '"body":"[^"]*"' | cut -d'"' -f4)
    echo "已存在的版本备注: $EXISTING_RELEASE_NOTES"
    echo "是否要替换已存在的版本? (y/N)"
    read -r REPLACE_VERSION
    if [[ ! "$REPLACE_VERSION" =~ ^[Yy]$ ]]; then
      echo "取消发布流程"
      exit 0
    fi
  fi
else
  echo "警告: 未设置GITHUB_TOKEN，跳过版本检查"
fi

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
  
  # 检查llvm-rc工具（用于Windows构建）
  # 首先检查是否在PATH中
  if ! command -v llvm-rc &> /dev/null; then
    # 检查Homebrew安装的LLVM路径
    if [ -d "/opt/homebrew/opt/llvm/bin" ]; then
      export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
      echo "已添加Homebrew LLVM到PATH"
    fi
    
    # 再次检查llvm-rc工具
    if ! command -v llvm-rc &> /dev/null; then
      echo "警告: 未找到llvm-rc工具，Windows构建可能会失败"
      echo "请安装LLVM工具链以支持Windows构建:"
      echo "  macOS: brew install llvm"
      echo "  Ubuntu/Debian: sudo apt-get install llvm"
      echo "  其他系统: 请参考 https://llvm.org/docs/GettingStarted.html"
    fi
  fi
  
  echo "必要工具检查完成。"
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

# 为Windows构建
build_windows() {
  # 检查llvm-rc工具是否存在
  if ! command -v llvm-rc &> /dev/null; then
    echo "警告: 未找到llvm-rc工具，跳过Windows构建"
    echo "请安装LLVM工具链以支持Windows构建:"
    echo "  macOS: brew install llvm"
    echo "  Ubuntu/Debian: sudo apt-get install llvm"
    echo "  其他系统: 请参考 https://llvm.org/docs/GettingStarted.html"
    return 0
  fi
   
  # 检查是否安装了Visual Studio的link.exe工具链
  if ! command -v link.exe &> /dev/null; then
    echo "警告: 未找到Visual Studio的link.exe工具链，跳过Windows构建"
    echo "提示: 在macOS上进行Windows交叉编译需要安装Visual Studio Build Tools"
    echo "请参考: https://tauri.app/v1/guides/building/cross-platform/#windows"
    return 0
  fi
  
  echo "为Windows构建..."
  npm run tauri build -- --target x86_64-pc-windows-msvc
  
  if [ $? -ne 0 ]; then
    echo "警告: Windows构建失败，但将继续执行其他步骤"
    echo "提示: 在macOS上进行Windows交叉编译需要额外的工具链，如Visual Studio Build Tools"
    return 0  # 返回0以继续执行其他步骤
  fi
  
  echo "Windows构建完成"
  return 0
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
    --exclude="${PROJECT_NAME}-src-${VERSION}.tar.gz" \
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
  
  # 检查Release是否已存在
  echo "检查Release是否已存在..."
  CHECK_RESPONSE=$(curl -s -w "%{http_code}" -X GET \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/v$VERSION")
  
  CHECK_HTTP_CODE=${CHECK_RESPONSE: -3}
  CHECK_RESPONSE_BODY=${CHECK_RESPONSE%???}
  
  # 如果Release已存在，则删除它
  if [ "$CHECK_HTTP_CODE" -eq 200 ]; then
    echo "发现已存在的Release，正在删除..."
    EXISTING_RELEASE_ID=$(echo "$CHECK_RESPONSE_BODY" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    
    if [ -n "$EXISTING_RELEASE_ID" ]; then
      DELETE_RESPONSE=$(curl -s -w "%{http_code}" -X DELETE \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$EXISTING_RELEASE_ID")
      
      DELETE_HTTP_CODE=${DELETE_RESPONSE: -3}
      
      if [ "$DELETE_HTTP_CODE" -eq 204 ]; then
        echo "已删除已存在的Release"
        # 等待一段时间确保Release已被完全删除，并确认删除操作已完成
        echo "等待GitHub完成删除操作..."
        sleep 5
        
        # 确认Release是否真的已被删除
        echo "确认Release是否已被删除..."
        CONFIRM_RESPONSE=$(curl -s -w "%{http_code}" -X GET \
          -H "Authorization: token $GITHUB_TOKEN" \
          -H "Accept: application/vnd.github.v3+json" \
          "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/v$VERSION")
        
        CONFIRM_HTTP_CODE=${CONFIRM_RESPONSE: -3}
        
        # 如果仍然能获取到Release信息，则等待一段时间再检查
        if [ "$CONFIRM_HTTP_CODE" -eq 200 ]; then
          echo "Release似乎仍未被删除，再等待5秒..."
          sleep 5
          
          # 再次确认
          CONFIRM_RESPONSE2=$(curl -s -w "%{http_code}" -X GET \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/v$VERSION")
          
          CONFIRM_HTTP_CODE2=${CONFIRM_RESPONSE2: -3}
          
          if [ "$CONFIRM_HTTP_CODE2" -eq 200 ]; then
            echo "警告: Release可能仍未被删除，将继续尝试创建新Release"
            # 等待更长时间确保Release被删除
            echo "等待10秒以确保Release被完全删除..."
            sleep 10
          else
            echo "Release已被成功删除"
          fi
        else
          echo "Release已被成功删除"
        fi
      else
        echo "删除已存在的Release失败，HTTP状态码: $DELETE_HTTP_CODE"
        exit 1
      fi
    fi
  fi
  
  # 如果Release仍然存在，等待一段时间再尝试创建
  if [ "$CHECK_HTTP_CODE" -eq 200 ] && [ "$CONFIRM_HTTP_CODE2" -eq 200 ]; then
    echo "Release可能仍未被删除，等待15秒后再尝试创建..."
    sleep 15
  fi
  
  # 创建Release，最多重试3次
  for i in {1..3}; do
    echo "尝试创建Release (第 $i 次尝试)..."
    RESPONSE=$(curl -s -w "%{http_code}" -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github.v3+json" \
      https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases \
      -d "{\"tag_name\": \"v$VERSION\", \"name\": \"Release v$VERSION\", \"body\": \"$RELEASE_NOTES\"}")
    
    HTTP_CODE=${RESPONSE: -3}
    RESPONSE_BODY=${RESPONSE%???}
    
    if [ "$HTTP_CODE" -eq 201 ]; then
      echo "Release创建成功"
      break
    elif [ "$HTTP_CODE" -eq 422 ] && [[ "$RESPONSE_BODY" == *"already_exists"* ]]; then
      echo "警告: tag_name已存在，等待10秒后重试..."
      sleep 10
      continue
    else
      echo "创建Release失败，HTTP状态码: $HTTP_CODE"
      echo "响应内容: $RESPONSE_BODY"
      if [ $i -eq 3 ]; then
        exit 1
      fi
    fi
  done
  
  # 提取RELEASE_ID
  echo "调试信息: HTTP响应状态码: $HTTP_CODE"
  echo "调试信息: HTTP响应内容: $RESPONSE_BODY"
  
  # 只提取一次RELEASE_ID
  echo "正在提取RELEASE_ID..."
  echo "响应体内容: $RESPONSE_BODY"
  
  # 使用更准确的正则表达式提取id
  RELEASE_ID=$(echo "$RESPONSE_BODY" | grep -o '"id": *[0-9]*' | head -1 | sed 's/"id": *\([0-9]*\)/\1/')
  echo "提取到的RELEASE_ID: $RELEASE_ID"
  
  if [ -z "$RELEASE_ID" ]; then
    echo "无法提取RELEASE_ID"
    exit 1
  fi
  
  echo "Release创建成功，ID: $RELEASE_ID"
  
  # 通用文件上传函数
  upload_asset() {
    local file_path="$1"
    local content_type="$2"
    
    if [ -f "$file_path" ]; then
      echo "上传文件: $(basename "$file_path")..."
      curl -s -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Content-Type: $content_type" \
        "https://uploads.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$RELEASE_ID/assets?name=$(basename "$file_path")" \
        --data-binary "@$file_path"
      echo "文件上传完成: $(basename "$file_path")"
    else
      echo "警告: 未找到文件: $file_path"
    fi
  }
  
  # 上传macOS DMG
  # 查找匹配的DMG文件
  DMG_FILE=""
  if [ -f "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/${PROJECT_NAME}_${VERSION}_aarch64.dmg" ]; then
    DMG_FILE="src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/${PROJECT_NAME}_${VERSION}_aarch64.dmg"
  elif [ -f "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/${PROJECT_NAME}_${VERSION}.dmg" ]; then
    DMG_FILE="src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/${PROJECT_NAME}_${VERSION}.dmg"
  else
    # 查找任何匹配项目名和版本的DMG文件
    DMG_FILE=$(ls "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/${PROJECT_NAME}_"*".dmg" 2>/dev/null | head -n 1)
  fi
  
  if [ -n "$DMG_FILE" ] && [ -f "$DMG_FILE" ]; then
    upload_asset "$DMG_FILE" "application/octet-stream"
  else
    echo "警告: 未找到macOS DMG文件"
  fi
  
  # 上传Windows MSI
  # 查找匹配的MSI文件
  MSI_FILE=""
  if [ -f "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/${PROJECT_NAME}_${VERSION}_x64_en-US.msi" ]; then
    MSI_FILE="src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/${PROJECT_NAME}_${VERSION}_x64_en-US.msi"
  else
    # 查找任何匹配项目名和版本的MSI文件
    MSI_FILE=$(ls "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/${PROJECT_NAME}_"*".msi" 2>/dev/null | head -n 1)
  fi
  
  if [ -n "$MSI_FILE" ] && [ -f "$MSI_FILE" ]; then
    upload_asset "$MSI_FILE" "application/octet-stream"
  else
    echo "警告: 未找到Windows MSI文件"
  fi
  
  # 上传源代码包
  upload_asset "${PROJECT_NAME}-src-${VERSION}.tar.gz" "application/gzip"
  
  echo "所有构建产物上传完成"
}

# 清理之前的构建产物
rm -f "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/${PROJECT_NAME}_"*_aarch64.dmg
rm -f "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/${PROJECT_NAME}_"*.dmg
rm -f "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/${PROJECT_NAME}_"*_x64_en-US.msi
rm -f "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/${PROJECT_NAME}_"*.msi
rm -f "${PROJECT_NAME}-src-${VERSION}.tar.gz"

# 执行构建
build_macos

# 尝试构建Windows版本
build_windows

package_source

# 上传到GitHub
upload_to_github

echo "发布流程完成!"