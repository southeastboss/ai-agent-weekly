@echo off
REM ============================================================
REM  AI Agent Weekly — 一键部署脚本
REM  用法：双击运行 DEPLOY.bat，按提示操作
REM ============================================================

cd /d "%~dp0"

echo.
echo ========================================
echo   AI Agent Weekly 部署助手
echo ========================================
echo.

REM 检查 Git
where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Git，请先安装 Git
    pause
    exit /b 1
)

REM 检查 gh CLI
where gh >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [提示] 未安装 gh CLI，将使用手动方式创建仓库
    set USE_GH=0
) else (
    echo [提示] gh CLI 已找到
    set USE_GH=1
)

if %USE_GH%==1 (
    echo.
    echo 请确保已登录 GitHub：
    echo   gh auth login
    echo.
    set /p REPO_NAME="请输入 GitHub 仓库名（默认: ai-agent-weekly）: "
    if "%REPO_NAME%"=="" set REPO_NAME=ai-agent-weekly
    
    echo.
    echo 正在创建 GitHub 仓库...
    gh repo create %REPO_NAME% --public --source=. --push --description "AI Agent 前沿动态 — 每日自动更新"
    
    if %ERRORLEVEL% neq 0 (
        echo [错误] 创建仓库失败，请手动到 github.com 创建
        echo.
        echo ========================================
        echo   手动部署步骤
        echo ========================================
        echo.
        echo 1. 访问 https://github.com/new
        echo 2. 仓库名输入: %REPO_NAME%
        echo 3. 设为 Public，不要勾选 Initialize
        echo 4. 点击 Create repository
        echo 5. 复制仓库 URL，然后运行:
        echo.
        echo    git remote add origin 你的仓库URL
        echo    git push -u origin master
        echo.
        pause
        exit /b 1
    )
) else (
    echo.
    echo ========================================
    echo   手动部署步骤
    echo ========================================
    echo.
    echo 1. 访问 https://github.com/new
    echo 2. 仓库名输入: ai-agent-weekly
    echo 3. 设为 Public，不要勾选 Initialize
    echo 4. 点击 Create repository
    echo 5. 复制仓库 URL（以 .git 结尾）
    echo.
    set /p REPO_URL="请粘贴仓库 URL: "
    
    if "%REPO_URL%"=="" (
        echo [错误] URL 不能为空
        pause
        exit /b 1
    )
    
    echo.
    echo 正在添加远程仓库并推送...
    git remote add origin %REPO_URL%
    git branch -M master
    git push -u origin master
)

echo.
echo ========================================
echo   部署成功！
echo ========================================
echo.
echo 接下来请配置 GitHub Pages:
echo.
echo 1. 访问 https://github.com/settings/pages
echo 2. Source 选择: Deploy from a branch
echo 3. Branch 选择: master / (root)
echo 4. 点击 Save
echo.
echo 等待 2 分钟后访问:
echo   https://[你的用户名].github.io/ai-agent-weekly
echo.
pause
