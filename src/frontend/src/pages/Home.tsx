import { Link } from 'react-router-dom';

/**
 * 首页
 */
export default function Home() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '16px', fontWeight: 700 }}>
        Muse Studio
      </h1>
      <p style={{ fontSize: '18px', marginBottom: '32px', opacity: 0.9 }}>
        AI 驱动的创意内容生成平台
      </p>
      <Link
        to="/canvas"
        style={{
          padding: '14px 32px',
          background: 'white',
          color: '#667eea',
          borderRadius: '12px',
          textDecoration: 'none',
          fontSize: '16px',
          fontWeight: 600,
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        进入无限画布
      </Link>
    </div>
  );
}
