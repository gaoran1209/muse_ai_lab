#!/bin/bash
# muse_studio 测试运行脚本
# 用法: bash scripts/test.sh [测试路径/函数] [pytest选项...]

set -e

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

# 激活虚拟环境
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

# 日志目录
mkdir -p logs
LOG_FILE="logs/test_$(date +"%Y%m%d_%H%M%S").log"

# 解析参数：第一个参数是测试路径，剩余是 pytest 选项
TEST_PATTERN="${1:-tests/}"
if [ $# -gt 0 ]; then
    shift
fi
PYTEST_OPTIONS="$@"

if [ -z "$PYTEST_OPTIONS" ]; then
    PYTEST_OPTIONS="-v"
fi

echo "测试目标: ${TEST_PATTERN}"
echo "Pytest 选项: ${PYTEST_OPTIONS}"
echo "日志文件: ${LOG_FILE}"
echo ""

# 运行测试
python -m pytest "${TEST_PATTERN}" ${PYTEST_OPTIONS} \
    --log-cli-level=INFO \
    --log-file="$LOG_FILE" \
    --log-file-level=INFO

echo ""
echo "测试完成。日志: ${LOG_FILE}"
echo ""
echo "使用示例:"
echo "  bash scripts/test.sh                                    # 运行所有测试"
echo "  bash scripts/test.sh tests/providers/                   # Provider 服务测试"
echo "  bash scripts/test.sh tests/providers/llm/               # 仅运行 llm 测试"
echo "  bash scripts/test.sh tests/providers/image/             # 仅运行 image 测试"
echo "  bash scripts/test.sh tests/providers/video/             # 仅运行 video 测试"
echo ""
echo "  bash scripts/test.sh tests/providers/llm/test_zhipu.py # 指定测试文件"
echo "  bash scripts/test.sh tests/providers/llm/test_zhipu.py::TestZhipuGenerate          # 指定测试类"
echo "  bash scripts/test.sh tests/providers/llm/test_zhipu.py::TestZhipuGenerate::test_generate_simple_response  # 指定测试函数"
echo ""
echo "  bash scripts/test.sh -k \"zhipu\"                       # 使用关键字匹配测试"
echo "  bash scripts/test.sh tests/providers/llm/ -x -s        # -x 遇到失败停止, -s 显示输出"
