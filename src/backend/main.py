"""
FastAPI 应用入口

Muse AI Studio 后端服务主入口。
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.backend.api import router
from src.backend.database import create_tables
from src.backend.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("Starting Muse AI Lab backend...")
    create_tables()
    logger.info("Database tables ready.")
    yield
    logger.info("Shutting down Muse AI Lab backend...")


# 创建 FastAPI 应用
app = FastAPI(
    title="Muse AI Studio API",
    description="AI 内容生成平台，支持多厂商 LLM/图像/视频提供商",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(router)


# 根路径
@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "Muse AI Studio API",
        "version": "1.0.0",
        "docs": "/docs",
    }


# 健康检查
@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}
