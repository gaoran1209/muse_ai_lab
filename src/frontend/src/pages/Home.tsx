import { Link } from 'react-router-dom';
import './Home.css';

/**
 * 首页 - 字节跳动风格设计
 */
export default function Home() {
  return (
    <div className="home-container">
      {/* 顶部导航 */}
      <header className="home-header">
        <div className="home-logo">
          <div className="logo-icon">M</div>
          <span className="logo-text">Muse Studio</span>
        </div>
        <nav className="home-nav">
          <button className="nav-link">登录</button>
          <button className="nav-button">注册</button>
        </nav>
      </header>

      {/* Hero 区域 */}
      <main className="home-main">
        <div className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              AI 驱动的<span className="text-gradient">内容创作平台</span>
            </h1>
            <p className="hero-description">
              集成多厂商 AI 模型，支持文本、图像、视频生成。
              <br />
              让创意无限延伸。
            </p>
            <div className="hero-actions">
              <Link to="/canvas" className="btn btn-primary">
                开始创作
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <button className="btn btn-secondary">了解更多</button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-card">
              <div className="visual-dot" />
              <div className="visual-dot" />
              <div className="visual-dot" />
            </div>
          </div>
        </div>

        {/* 功能卡片 */}
        <section className="features-section">
          <h2 className="features-title">核心功能</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon feature-icon-llm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4H20M4 12H20M4 20H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="feature-title">LLM 生成</h3>
              <p className="feature-description">支持智谱 AI、Gemini、302.AI 等多厂商大语言模型</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon feature-icon-image">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                  <circle cx="9" cy="9" r="2" fill="currentColor" />
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="feature-title">图像生成</h3>
              <p className="feature-description">Nano Banana 2 / Pro，高质量图像生成</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon feature-icon-video">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 8L19 12L15 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <rect x="3" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <h3 className="feature-title">视频生成</h3>
              <p className="feature-description">Kling 视频生成模型，文生视频轻松实现</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
