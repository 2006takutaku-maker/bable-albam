import React, { useState, useMemo } from 'react';
import './App.css';

const MOCK_USERS = [
  { id: 'u1', username: 'ゲストユーザー', handle: '@guest', avatar: { bg: '#ff758c' }, bio: 'Bubble Album へようこそ。' }
];

export default function App() {
  // localStorage を使って一度ログインしたら次から自動ログインにする設定
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // シャボン玉の生成設定
  const bubbles = useMemo(() => {
    return Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      size: Math.floor(Math.random() * 60) + 20,
      left: Math.random() * 100,
      duration: Math.random() * 6 + 5,
      delay: (i * 0.3) + (Math.random() * 1.5),
      opacity: Math.random() * 0.35 + 0.55,
      swayDuration: Math.random() * 3 + 2,
    }));
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
  };

  return (
    <div className="app-container">
      {/* 背景のシャボン玉 */}
      <div className="bubble-container">
        {bubbles.map(b => (
          <div
            key={b.id}
            className="bubble"
            style={{
              width: `${b.size}px`,
              height: `${b.size}px`,
              left: `${b.left}%`,
              '--bubble-opacity': b.opacity,
              animationDuration: `${b.duration}s, ${b.swayDuration}s`,
              animationDelay: `${b.delay}s, 0s`,
            }}
          />
        ))}
      </div>

      {!isLoggedIn ? (
        <div className="profile-card" style={{ marginTop: '100px', textAlign: 'center', padding: '30px', zIndex: 10 }}>
          <h2>Bubble Album</h2>
          <p style={{ color: '#b0b0c0', margin: '15px 0' }}>ログインすると自動で状態が保持されます。</p>
          <button 
            className="logout-btn"
            style={{ 
              backgroundColor: '#ff758c', 
              color: '#fff', 
              border: 'none', 
              padding: '10px 24px', 
              borderRadius: '20px', 
              fontWeight: 'bold'
            }}
            onClick={handleLogin}
          >
            ログインする
          </button>
        </div>
      ) : (
        <>
          {/* ヘッダーメニュー */}
          <div className="menu-header" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            width: '100%', 
            maxWidth: '600px', 
            marginBottom: '20px'
          }}>
            <div 
              className="profile-btn"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                backgroundColor: 'rgba(30, 30, 36, 0.9)', 
                padding: '6px 14px', 
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff'
              }}
              onClick={() => setIsProfileOpen(true)}
            >
              <span style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%', 
                backgroundColor: currentUser.avatar.bg,
                display: 'inline-block' 
              }} />
              <span><strong>{currentUser.username}</strong> ⚙️</span>
            </div>

            <button 
              className="logout-btn"
              style={{ 
                backgroundColor: '#e74c3c', 
                color: '#fff', 
                border: 'none', 
                padding: '8px 16px', 
                borderRadius: '20px', 
                fontWeight: 'bold'
              }} 
              onClick={handleLogout}
            >
              ログアウト
            </button>
          </div>

          {/* メインコンテンツ */}
          <div className="main-content" style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '600px' }}>
            <div style={{ backgroundColor: '#1e1e24', padding: '24px', borderRadius: '16px', color: '#fff', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3>アルバムスペース</h3>
              <p style={{ color: '#b0b0c0', marginTop: '10px' }}>自動ログインが有効になっています。</p>
            </div>
          </div>

          {/* プロフィールモーダル */}
          {isProfileOpen && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2000,
              padding: '20px'
            }} onClick={() => setIsProfileOpen(false)}>
              <div className="profile-card" onClick={(e) => e.stopPropagation()}>
                <div className="profile-cover" />
                <div className="profile-header">
                  <div className="profile-avatar" style={{ backgroundColor: currentUser.avatar.bg }} />
                  <h2 className="profile-name">{currentUser.username}</h2>
                  <div className="profile-handle">{currentUser.handle}</div>
                  <div className="profile-bio">{currentUser.bio}</div>
                </div>
                <div className="profile-body">
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#b0b0c0', marginBottom: '8px' }}>タグ</div>
                  <div className="profile-tags">
                    <span className="profile-tag">Bubble Album</span>
                    <span className="profile-tag">自動ログイン</span>
                  </div>
                  <button 
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#2c2c35',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      marginTop: '10px'
                    }}
                    onClick={() => setIsProfileOpen(false)}
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}