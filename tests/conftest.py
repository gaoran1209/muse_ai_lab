import logging
import os

import pytest

from src.backend.logger import logger


def _disable_live_provider_tests_by_default() -> None:
    """Skip live provider integration tests unless explicitly opted in."""
    if os.getenv("RUN_LIVE_PROVIDER_TESTS", "").lower() in {"1", "true", "yes", "on"}:
        return
    for key in ("GEMINI_API_KEY", "ZHIPU_API_KEY", "THIRTYTWO_API_KEY"):
        os.environ.pop(key, None)


_disable_live_provider_tests_by_default()


def pytest_runtest_setup(item):
    """测试开始前的钩子"""
    logger.info(f"[TEST START] {item.nodeid}")


def pytest_runtest_call(item):
    """测试执行中的钩子"""
    logger.debug(f"[TEST RUNNING] {item.nodeid}")


def pytest_runtest_teardown(item, nextitem):
    """测试结束后的钩子"""
    logger.info(f"[TEST END] {item.nodeid}")


def pytest_runtest_logreport(report):
    """测试结果报告钩子"""
    if report.when == "call":
        if report.passed:
            logger.info(f"[TEST PASSED] {report.nodeid}")
        elif report.failed:
            logger.error(f"[TEST FAILED] {report.nodeid}")
            if report.longrepr:
                logger.error(f"Failure details: {report.longrepr}")
        elif report.skipped:
            logger.warning(f"[TEST SKIPPED] {report.nodeid}")


@pytest.fixture(autouse=True)
def test_logger(request):
    """为每个测试提供日志功能"""
    test_name = request.node.name
    logger.debug(f"Starting test: {test_name}")
    yield
    logger.debug(f"Finished test: {test_name}")


@pytest.fixture(autouse=True)
def ensure_output_dir():
    """确保测试输出目录存在"""
    output_dirs = [
        "tests/providers/image/output",
        "tests/providers/video/output",
    ]
    for dir_path in output_dirs:
        os.makedirs(dir_path, exist_ok=True)
    yield
