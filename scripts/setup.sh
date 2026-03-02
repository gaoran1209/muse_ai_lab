#!/bin/bash

# Muse Studio 环境设置脚本
# 此脚本创建 Python 虚拟环境并安装项目依赖

set -e  # 遇到错误时退出

# 获取脚本所在目录和项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 正在设置 Muse Studio 开发环境..."
echo "项目根目录: $PROJECT_ROOT"

# 检查 Python 3 是否已安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未安装 python3。请安装 Python 3.8 或更高版本。"
    exit 1
fi

# 获取 Python 版本
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ 检测到 Python $PYTHON_VERSION"

# 虚拟环境路径
VENV_PATH="$PROJECT_ROOT/.venv"

# 如果虚拟环境已存在，询问是否重新创建
if [ -d "$VENV_PATH" ]; then
    echo "⚠️  虚拟环境已存在于 $VENV_PATH"
    read -p "是否要重新创建? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在删除现有虚拟环境..."
        rm -rf "$VENV_PATH"
    else
        echo "使用现有虚拟环境。"
    fi
fi

# 创建虚拟环境
if [ ! -d "$VENV_PATH" ]; then
    echo "正在创建虚拟环境..."
    python3 -m venv "$VENV_PATH"
    echo "✓ 虚拟环境已创建于 $VENV_PATH"
fi

# 激活虚拟环境
echo "正在激活虚拟环境..."
source "$VENV_PATH/bin/activate"

# 升级 pip
echo "正在升级 pip..."
pip install --upgrade pip

# 安装项目依赖
echo "正在安装项目依赖..."
pip install -r "$PROJECT_ROOT/requirements.txt"

# Node.js 依赖安装
echo ""
echo "正在检查 Node.js..."

if ! command -v node &> /dev/null; then
    echo "⚠️  未安装 Node.js，跳过前端依赖安装"
    echo "   请安装 Node.js 后运行: cd $PROJECT_ROOT && npm install"
else
    NODE_VERSION=$(node --version)
    echo "✓ 检测到 Node.js $NODE_VERSION"

    # 检查 node_modules 是否已存在
    NODE_MODULES_PATH="$PROJECT_ROOT/node_modules"
    if [ -d "$NODE_MODULES_PATH" ]; then
        echo "⚠️  node_modules 已存在"
        read -p "是否要重新安装? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "正在安装前端依赖..."
            cd "$PROJECT_ROOT"
            npm install
            echo "✓ 前端依赖已安装"
        else
            echo "使用现有 node_modules。"
        fi
    else
        echo "正在安装前端依赖..."
        cd "$PROJECT_ROOT"
        npm install
        echo "✓ 前端依赖已安装"
    fi
fi

echo ""
echo "激活虚拟环境，请运行:"
echo "  source $VENV_PATH/bin/activate"
echo ""
echo "✅ 环境设置完成!"