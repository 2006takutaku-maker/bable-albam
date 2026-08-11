import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

// サンプルユーザーやモックデータ（必要に応じて置き換えてください）
const MOCK_USERS = [
  { id: 'u1', username: 'ゲストユーザー', handle: '@guest', avatar: { bg: '#e74c3c' }, bio: '写真や思い出を共有するスペースです。' }
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // シャボン玉の数とランダムパラメータの生成（マウント時に一度だけ作成してシャッフル）
  const bubbles = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      size: Math.floor(Math.random() * 50) + 15, // 15px ～ 65px
      left: Math.random() * 100, // 0% ～ 100%
      duration: Math.random() * 12 + 6, // 6秒 ～ 18秒
      delay: Math.random() * 8, // 0秒 ～ 8秒の遅延
      opacity: Math.random() * 0.6 + 0.25, // 0.25 ～ 0.85 の透明度
    }));
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  // 未ログイン時の個人用選択画面（ログイン前）
  if (!isLoggedIn) {
    return (
      <div className="app-container">
        {/* 背景のリアルなランダムシャボン玉 */}
        <div className="bubble-container">
          {bubbles.map(b => (
            <div
              key={b.id}
              className="bubble"
              style={{
                width: `${b.size}px`,
                height: `${b.size}px`,
                left: `${b.left}%`,
                opacity: b.opacity,
                animationDuration: `${b.duration}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="profile-card" style={{ marginTop: '100px', textAlign: 'center', padding: '30px' }}>
          <h2>ようこそ</h2>
          <p style={{ color: '#aaa', margin: '15px 0' }}>サービスを利用するにはログインしてください。</p>
          <button 
            className="logout-btn"
            style={{ 
              backgroundColor: '#e67e22', 
              color: '#fff', 
              border: 'none', 
              padding: '10px 24px', 
              borderRadius: '20px', 
              fontWeight: 'bold',
              cursor: 'pointer',
              zIndex: 1001,
              position: 'relative'
            }}
            onClick={() => setIsLoggedIn(true)}
          >
            ログイン / スタート
          </button>
        </div>
      </div>
    );
  }

  // ログイン後のメイン画面
  return (
    <div className="app-container">
      {/* 背景のリアルなランダムシャボン玉 */}
      <div className="bubble-container">
        {bubbles.map(b => (
          <div
            key={b.id}
            className="bubble"
            style={{
              width: `${b.size}px`,
              height: `${b.size}px`,
              left: `${b.left}%`,
              opacity: b.opacity,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>

      {/* メニューヘッダー（ログアウト・プロフィールボタンが確実に押せるよう最前面に配置） */}
      <div className="menu-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        width: '100%', 
        maxWidth: '600px', 
        marginBottom: '20px',
        position: 'relative',
        zIndex: 1000,
        pointerEvents: 'auto'
      }}>
        <div 
          className="profile-btn"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'pointer', 
            backgroundColor: 'rgba(50, 50, 50, 0.85)', 
            padding: '6px 14px', 
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            pointerEvents: 'auto',
            zIndex: 1001
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
            backgroundColor: '#c0392b', 
            color: '#fff', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            fontWeight: 'bold',
            cursor: 'pointer',
            pointerEvents: 'auto',
            zIndex: 1001
          }} 
          onClick={handleLogout}
        >
          ログアウト
        </button>
      </div>

      {/* メインコンテンツエリア */}
      <div className="main-content" style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '600px' }}>
        <div style={{ backgroundColor: '#383838', padding: '24px', borderRadius: '16px', color: '#fff', textAlign: 'center' }}>
          <h3>メインダッシュボード</h3>
          <p style={{ color: '#bbb', marginTop: '10px' }}>ボタンやメニューは正常に操作可能です。</p>
        </div>
      </div>

      {/* プロフィールモーダル（開いた場合） */}
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
              <div className="profile-user-info">
                <h2 className="profile-name">{currentUser.username}</h2>
                <div className="profile-handle">{currentUser.handle}</div>
                <div className="profile-bio">{currentUser.bio}</div>
              </div>
            </div>
            <div className="profile-body">
              <div className="profile-section-title">タグ・興味</div>
              <div className="profile-tags">
                <span className="profile-tag">写真・ギャラリー</span>
                <span className="profile-tag">コミュニティ</span>
              </div>
              <button 
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#555',
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
    </div>
  );
}