import React, { useState, useMemo } from 'react';
import './App.css';

const MOCK_USERS = [
  { id: 'u1', username: 'ゲストユーザー', handle: '@guest', avatar: { bg: '#1abc9c' }, bio: '水滴・ガラス玉テーマのスペースです。' }
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // 空白時間を無くし、常に途切れなく湧き上がるように密に生成
  const bubbles = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      size: Math.floor(Math.random() * 60) + 22, // 22px ～ 82px
      left: Math.random() * 100, // 0% ～ 100%
      duration: Math.random() * 6 + 5, // 5秒 ～ 11秒
      delay: (i * 0.25) + (Math.random() * 1.5), // 連続して湧き出るディレイ
      opacity: Math.random() * 0.35 + 0.55, // 0.55 ～ 0.9 の濃いめ透明度
      swayDuration: Math.random() * 3 + 2,
    }));
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  return (
    <div className="app-container">
      {/* 途切れなく湧き上がり、上端に向かって自然に消えるガラス玉の背景 */}
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
          <h2>ようこそ</h2>
          <p style={{ color: '#95a5a6', margin: '15px 0' }}>サービスを利用するにはログインしてください。</p>
          <button 
            className="logout-btn"
            style={{ 
              backgroundColor: '#1abc9c', 
              color: '#fff', 
              border: 'none', 
              padding: '10px 24px', 
              borderRadius: '20px', 
              fontWeight: 'bold'
            }}
            onClick={() => setIsLoggedIn(true)}
          >
            ログイン / スタート
          </button>
        </div>
      ) : (
        <>
          {/* メニューヘッダー */}
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
                backgroundColor: 'rgba(36, 52, 61, 0.9)', 
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
            <div style={{ backgroundColor: '#24343d', padding: '24px', borderRadius: '16px', color: '#fff', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3>メインダッシュボード</h3>
              <p style={{ color: '#95a5a6', marginTop: '10px' }}>ガラス玉が途切れなく湧き上がり、上部に向かって自然に消えていくアニメーションが適用されています。</p>
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
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#95a5a6', marginBottom: '8px' }}>タグ</div>
                  <div className="profile-tags">
                    <span className="profile-tag">シームレス</span>
                    <span className="profile-tag">フェードアウト</span>
                  </div>
                  <button 
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#34495e',
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