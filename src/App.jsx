import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';

// =========================================================
// 1. Firebaseの設定情報
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyBvU40Kz7wRY7gCsIq7VNSFDVevSsDrBC4",
  authDomain: "arubam-5e380.firebaseapp.com",
  databaseURL: "https://arubam-5e380-default-rtdb.firebaseio.com",
  projectId: "arubam-5e380",
  storageBucket: "arubam-5e380.firebasestorage.app",
  messagingSenderId: "527752001870",
  appId: "1:527752001870:web:99bf524ebe898d9a82061f",
  measurementId: "G-PHXB8KWDXB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const AVATARS = [
  { type: 'emoji', emoji: '🐱', bg: '#ff7675' },
  { type: 'emoji', emoji: '🐶', bg: '#74b9ff' },
  { type: 'emoji', emoji: '🐰', bg: '#fd79a8' },
  { type: 'emoji', emoji: '🦊', bg: '#ffeaa7' },
  { type: 'emoji', emoji: '🐼', bg: '#55efc4' },
  { type: 'emoji', emoji: '🦁', bg: '#e17055' }
];

export default function App() {
  // localStorage から自動ログイン状態を読み込む初期化
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [authMode, setAuthMode] = useState('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState(0);
  const [customAvatar, setCustomAvatar] = useState(null);

  // 初期画面判定（ログイン済みの場合はメニュー画面からスタート）
  const [currentScreen, setCurrentScreen] = useState(() => {
    return localStorage.getItem('currentUser') ? 'menu' : 'auth';
  });

  const [activeTab, setActiveTab] = useState('private');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomInput, setRoomInput] = useState('');

  const [genres, setGenres] = useState(['すべて', '日常', '旅行', 'イベント']);
  const [selectedGenre, setSelectedGenre] = useState('すべて');

  const [roomMembers, setRoomMembers] = useState([]);
  const [bubbles, setBubbles] = useState([]);
  const [albumSettings, setAlbumSettings] = useState({
    bgType: 'preset',
    bgColor: '#0f2027',
    bgImage: null,
    presetBg: 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [tocActiveTab, setTocActiveTab] = useState('photos');
  const [speedMode, setSpeedMode] = useState('normal');

  const getAlbumKey = () => {
    if (activeTab === 'private') {
      return `private_${currentUser?.username}`;
    }
    return `shared_${roomNumber}`;
  };

  const albumKey = getAlbumKey();

  // Screen Wake Lock API
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log('Wake Lock エラー:', err);
      }
    };

    if (currentScreen === 'album') {
      requestWakeLock();
    }

    return () => {
      if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
      }
    };
  }, [currentScreen]);

  // Firestore リアルタイム同期
  useEffect(() => {
    if (currentScreen !== 'album' || !albumKey) return;

    const bubblesRef = collection(db, 'albums', albumKey, 'bubbles');
    const unsubscribeBubbles = onSnapshot(bubblesRef, (snapshot) => {
      const loadedBubbles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBubbles(loadedBubbles);
    });

    const settingsRef = doc(db, 'albums', albumKey);
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAlbumSettings(data);
        if (data.genres && Array.isArray(data.genres)) {
          setGenres(data.genres);
        }
      } else {
        const defaultSettings = {
          bgType: 'preset',
          bgColor: '#0f2027',
          bgImage: null,
          presetBg: activeTab === 'private'
            ? 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
            : 'linear-gradient(180deg, #141e30 0%, #243b55 100%)',
          genres: ['すべて', '日常', '旅行', 'イベント']
        };
        setAlbumSettings(defaultSettings);
      }
    });

    let unsubscribeMembers = () => {};
    if (activeTab === 'shared') {
      const membersRef = collection(db, 'albums', albumKey, 'members');
      unsubscribeMembers = onSnapshot(membersRef, (snapshot) => {
        const loadedMembers = snapshot.docs.map(doc => doc.data());
        setRoomMembers(loadedMembers);
      });

      const myMemberRef = doc(db, 'albums', albumKey, 'members', currentUser.username);
      setDoc(myMemberRef, {
        username: currentUser.username,
        avatar: currentUser.avatar,
        joinedAt: Date.now()
      }, { merge: true });
    }

    return () => {
      unsubscribeBubbles();
      unsubscribeSettings();
      unsubscribeMembers();
    };
  }, [currentScreen, albumKey, activeTab, currentUser]);

  const updateSettings = async (newSettings) => {
    const updated = { ...albumSettings, ...newSettings };
    setAlbumSettings(updated);
    const settingsRef = doc(db, 'albums', albumKey);
    await setDoc(settingsRef, updated, { merge: true });
  };

  const handleAddGenre = () => {
    const newGenre = prompt('新しいジャンル名を入力してください:');
    if (newGenre && newGenre.trim()) {
      const trimmed = newGenre.trim();
      if (!genres.includes(trimmed)) {
        const nextGenres = [...genres, trimmed];
        setGenres(nextGenres);
        setSelectedGenre(trimmed);
        updateSettings({ genres: nextGenres });
      } else {
        alert('そのジャンルは既に存在します。');
      }
    }
  };

  const handleCustomAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomAvatar({ type: 'image', url: event.target.result });
      setSelectedAvatarIdx(-1);
    };
    reader.readAsDataURL(file);
  };

  const getSelectedAvatar = () => {
    if (selectedAvatarIdx === -1 && customAvatar) {
      return customAvatar;
    }
    return AVATARS[selectedAvatarIdx] || AVATARS[0];
  };

  // ログイン / アカウント作成（localStorage への保存を追加）
  const handleAuth = async (e) => {
    e.preventDefault();
    const username = usernameInput.trim();
    const password = passwordInput.trim();

    if (!username || !password) {
      alert('ユーザー名とパスワードを入力してください');
      return;
    }

    try {
      const userRef = doc(db, 'users', username);
      const userSnap = await getDoc(userRef);

      if (authMode === 'register') {
        if (userSnap.exists()) {
          alert('このユーザー名は既に使われています。別の名前を指定するかログインしてください。');
          return;
        }

        const newUser = {
          username,
          password,
          avatar: getSelectedAvatar()
        };

        await setDoc(userRef, newUser);
        const userObj = { username, avatar: newUser.avatar };
        setCurrentUser(userObj);
        localStorage.setItem('currentUser', JSON.stringify(userObj));
        alert('アカウントを作成しました！');
        setCurrentScreen('menu');
      } else {
        if (!userSnap.exists()) {
          alert('ユーザーが存在しません。新規登録を行ってください。');
          return;
        }

        const userData = userSnap.data();
        if (userData.password !== password) {
          alert('パスワードが違います。');
          return;
        }

        const userObj = {
          username: userData.username,
          avatar: userData.avatar || AVATARS[0]
        };
        setCurrentUser(userObj);
        localStorage.setItem('currentUser', JSON.stringify(userObj));
        setCurrentScreen('menu');
      }
      setPasswordInput('');
    } catch (err) {
      console.error(err);
      alert('認証処理中にエラーが発生しました。');
    }
  };

  // ログアウト（localStorage からクリア）
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setCurrentScreen('auth');
    setIsTocOpen(false);
  };

  const enterPrivateAlbum = () => {
    setActiveTab('private');
    setSelectedGenre('すべて');
    setCurrentScreen('album');
  };

  const enterSharedAlbum = (e) => {
    e.preventDefault();
    if (!roomInput.trim()) {
      alert('ルーム番号を入力してください');
      return;
    }
    setRoomNumber(roomInput.trim());
    setActiveTab('shared');
    setSelectedGenre('すべて');
    setCurrentScreen('album');
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const genreToAssign = selectedGenre === 'すべて' ? (genres[1] || '未分類') : selectedGenre;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        createBubble(event.target.result, genreToAssign);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBgImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      updateSettings({
        bgImage: event.target.result,
        bgType: 'image'
      });
    };
    reader.readAsDataURL(file);
  };

  const getBaseDuration = () => {
    return speedMode === 'slow' ? 45 : speedMode === 'fast' ? 15 : 30;
  };

  const createBubble = async (imgSrc, genre) => {
    const depth = Math.random();
    const size = Math.floor(depth * 120) + 80;
    const opacity = 0.5 + depth * 0.5;
    const blur = 0; 
    const zIndex = Math.floor(depth * 100);

    const newBubbleData = {
      src: imgSrc,
      genre: genre || '未分類',
      size,
      opacity,
      blur,
      zIndex,
      depth,
      author: currentUser.username,
      authorAvatar: currentUser.avatar,
      left: Math.floor(Math.random() * 85) + 5,
      swayDuration: Math.floor(Math.random() * 3) + 2,
      delay: Math.random() * 2,
      createdAt: Date.now()
    };

    const bubblesRef = collection(db, 'albums', albumKey, 'bubbles');
    await addDoc(bubblesRef, newBubbleData);
  };

  const handleAnimationEnd = (id) => {
    setBubbles((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          const depth = Math.random();
          return {
            ...b,
            depth,
            left: Math.floor(Math.random() * 85) + 5,
            size: Math.floor(depth * 120) + 80,
            opacity: 0.5 + depth * 0.5,
            blur: 0,
            zIndex: Math.floor(depth * 100)
          };
        }
        return b;
      })
    );
  };

  const handleDeleteBubble = async (id) => {
    const bubbleRef = doc(db, 'albums', albumKey, 'bubbles', id);
    await deleteDoc(bubbleRef);
  };

  const handleClearAll = async () => {
    if (window.confirm('このアルバムの写真をすべて削除しますか？')) {
      const bubblesRef = collection(db, 'albums', albumKey, 'bubbles');
      const snapshot = await getDocs(bubblesRef);
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      setIsTocOpen(false);
    }
  };

  const getContainerStyle = () => {
    let backgroundStyle = {};
    if (albumSettings.bgType === 'color') {
      backgroundStyle = { backgroundColor: albumSettings.bgColor };
    } else if (albumSettings.bgType === 'image' && albumSettings.bgImage) {
      backgroundStyle = {
        backgroundImage: `url(${albumSettings.bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    } else {
      backgroundStyle = { background: albumSettings.presetBg };
    }

    return {
      ...styles.container,
      ...backgroundStyle
    };
  };

  const renderAvatarIcon = (avatarObj, sizeStyle = {}) => {
    if (!avatarObj) return null;
    if (avatarObj.type === 'image') {
      return (
        <img
          src={avatarObj.url}
          alt="avatar"
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', ...sizeStyle }}
        />
      );
    }
    return (
      <span style={{ fontSize: sizeStyle.fontSize || '12px' }}>
        {avatarObj.emoji}
      </span>
    );
  };

  const filteredBubbles = selectedGenre === 'すべて'
    ? bubbles
    : bubbles.filter(b => b.genre === selectedGenre);

  // 1. ログイン / 新規登録 画面
  if (currentScreen === 'auth') {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <h1 style={styles.appTitle}>🫧 Bubble Album</h1>
          <div style={styles.authTabGroup}>
            <button
              style={{ ...styles.authTabBtn, borderBottom: authMode === 'login' ? '2px solid #007bff' : 'none', color: authMode === 'login' ? '#fff' : '#aaa' }}
              onClick={() => setAuthMode('login')}
            >
              ログイン
            </button>
            <button
              style={{ ...styles.authTabBtn, borderBottom: authMode === 'register' ? '2px solid #007bff' : 'none', color: authMode === 'register' ? '#fff' : '#aaa' }}
              onClick={() => setAuthMode('register')}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleAuth} style={styles.form}>
            {authMode === 'register' && (
              <div style={styles.avatarPickerSection}>
                <span style={{ color: '#ccc', fontSize: '12px' }}>アイコンを選択 / アップロード:</span>
                <div style={styles.avatarGrid}>
                  {AVATARS.map((av, idx) => (
                    <div
                      key={idx}
                      onClick={() => { setSelectedAvatarIdx(idx); setCustomAvatar(null); }}
                      style={{
                        ...styles.avatarBadge,
                        backgroundColor: av.bg,
                        border: selectedAvatarIdx === idx ? '2px solid #fff' : '2px solid transparent'
                      }}
                    >
                      {av.emoji}
                    </div>
                  ))}
                  <label
                    style={{
                      ...styles.avatarBadge,
                      backgroundColor: '#555',
                      border: selectedAvatarIdx === -1 ? '2px solid #007bff' : '2px solid transparent',
                      overflow: 'hidden'
                    }}
                    title="画像をアップロード"
                  >
                    {customAvatar ? (
                      <img src={customAvatar.url} alt="custom" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      '📷'
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomAvatarUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder="ユーザー名"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              style={styles.input}
            />
            <input
              type="password"
              placeholder="パスワード"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.submitBtn}>
              {authMode === 'login' ? 'ログイン' : 'アカウント作成'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. モード選択メニュー
  if (currentScreen === 'menu') {
    return (
      <div style={styles.menuContainer}>
        <div style={styles.menuHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ ...styles.avatarBadgeSmall, backgroundColor: currentUser?.avatar?.bg || 'transparent' }}>
              {renderAvatarIcon(currentUser?.avatar)}
            </span>
            <span><strong>{currentUser?.username}</strong></span>
          </div>
          <button className="logout-btn" style={styles.logoutBtn} onClick={handleLogout}>ログアウト</button>
        </div>

        <h2 style={{ color: '#fff', marginBottom: '30px' }}>📖 アルバムを選択</h2>

        <div style={styles.menuGrid}>
          <div style={styles.menuCard} onClick={enterPrivateAlbum}>
            <div style={styles.cardIcon}>🔒</div>
            <h3>プライベートアルバム</h3>
            <p>自分だけの写真が入る専用のアルバムです。</p>
            <button style={styles.enterBtn}>入場する</button>
          </div>

          <div style={styles.menuCard}>
            <div style={styles.cardIcon}>🌐</div>
            <h3>共有アルバム</h3>
            <p>同じルーム番号を入力した人とリアルタイム共有できます。</p>
            <form onSubmit={enterSharedAlbum} style={{ width: '100%' }}>
              <input
                type="text"
                placeholder="例: ROOM-1234"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                style={{ ...styles.input, marginBottom: '10px' }}
              />
              <button type="submit" style={{ ...styles.enterBtn, backgroundColor: '#17a2b8' }}>
                ルームへ入る
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 3. シャボン玉アルバム画面
  return (
    <div style={getContainerStyle()}>
      {/* 上部ヘッダー */}
      <div style={styles.header}>
        <div style={styles.topControlRow}>
          <button style={styles.backMenuBtn} onClick={() => setCurrentScreen('menu')}>
            ◀ メニューに戻る
          </button>

          <div style={styles.badge}>
            {activeTab === 'private' ? `🔒 プライベート` : `🌐 共有ルーム [${roomNumber}]`}
          </div>

          {activeTab === 'shared' && (
            <div style={styles.membersBar}>
              <span style={{ fontSize: '11px', color: '#ccc', marginRight: '4px' }}>参加中:</span>
              {roomMembers.map((m, i) => (
                <div key={i} style={styles.memberTag}>
                  <div style={{ ...styles.avatarBadgeSmall, backgroundColor: m.avatar?.bg || 'transparent' }}>
                    {renderAvatarIcon(m.avatar)}
                  </div>
                  <span style={styles.memberName}>{m.username}</span>
                </div>
              ))}
            </div>
          )}

          <button style={styles.tocToggleBtn} onClick={() => setIsTocOpen(!isTocOpen)}>
            📖 もくじ・設定
          </button>

          <label style={styles.uploadBtn}>
            ＋ 写真を追加
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* ジャンル切り替えタブバー */}
        <div style={styles.genreTabBar}>
          <span style={styles.genreLabel}>🏷️ ジャンル:</span>
          {genres.map((g) => (
            <button
              key={g}
              style={{
                ...styles.genreTabBtn,
                backgroundColor: selectedGenre === g ? '#007bff' : 'rgba(255,255,255,0.15)',
                color: '#fff',
                fontWeight: selectedGenre === g ? 'bold' : 'normal'
              }}
              onClick={() => setSelectedGenre(g)}
            >
              {g}
            </button>
          ))}
          <button style={styles.addGenreBtn} onClick={handleAddGenre} title="ジャンルを追加">
            ＋ タブ追加
          </button>
        </div>
      </div>

      {/* もくじ・設定パネル */}
      <div
        style={{
          ...styles.tocPanel,
          transform: isTocOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
      >
        <div style={styles.tocHeader}>
          <h2 style={styles.tocTitle}>📖 目次メニュー</h2>
          <button style={styles.closeTocBtn} onClick={() => setIsTocOpen(false)}>
            ✕
          </button>
        </div>

        <div style={styles.tocTabGroup}>
          <button
            style={{
              ...styles.tocTabBtn,
              borderBottom: tocActiveTab === 'photos' ? '2px solid #007bff' : 'none',
              color: tocActiveTab === 'photos' ? '#fff' : '#888',
              fontWeight: tocActiveTab === 'photos' ? 'bold' : 'normal'
            }}
            onClick={() => setTocActiveTab('photos')}
          >
            📷 写真一覧 ({filteredBubbles.length})
          </button>
          <button
            style={{
              ...styles.tocTabBtn,
              borderBottom: tocActiveTab === 'settings' ? '2px solid #007bff' : 'none',
              color: tocActiveTab === 'settings' ? '#fff' : '#888',
              fontWeight: tocActiveTab === 'settings' ? 'bold' : 'normal'
            }}
            onClick={() => setTocActiveTab('settings')}
          >
            🎨 背景・設定
          </button>
        </div>

        <div style={styles.tocContent}>
          {tocActiveTab === 'photos' && (
            <div style={styles.tocListContainer}>
              <div style={styles.listHeader}>
                <span style={styles.settingLabel}>📷 [{selectedGenre}] の写真</span>
                {bubbles.length > 0 && (
                  <button style={styles.clearAllBtn} onClick={handleClearAll}>
                    すべて削除
                  </button>
                )}
              </div>

              {filteredBubbles.length === 0 ? (
                <p style={styles.emptyTocText}>このジャンルには写真がありません</p>
              ) : (
                <div style={styles.thumbGrid}>
                  {filteredBubbles.map((b, idx) => (
                    <div key={b.id} style={styles.thumbCard}>
                      <img
                        src={b.src}
                        alt={`photo-${idx}`}
                        style={styles.thumbImg}
                        onClick={() => setSelectedImage(b.src)}
                      />
                      <div style={styles.thumbAuthorBox}>
                        <div style={{ ...styles.avatarBadgeSmall, backgroundColor: b.authorAvatar?.bg || 'transparent' }}>
                          {renderAvatarIcon(b.authorAvatar)}
                        </div>
                        <span style={styles.thumbAuthorText}>{b.author || '不明'}</span>
                      </div>
                      <button
                        style={styles.deleteThumbBtn}
                        onClick={() => handleDeleteBubble(b.id)}
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tocActiveTab === 'settings' && (
            <div>
              <div style={styles.settingSection}>
                <div style={styles.settingLabel}>🎨 背景スタイルの変更</div>
                <div style={styles.presetGroup}>
                  <button
                    style={{ ...styles.presetBtn, background: 'linear-gradient(180deg, #0f2027, #2c5364)' }}
                    onClick={() => updateSettings({ presetBg: 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', bgType: 'preset' })}
                  />
                  <button
                    style={{ ...styles.presetBtn, background: 'linear-gradient(180deg, #1a2a6c, #b21f1f, #fdbb2d)' }}
                    onClick={() => updateSettings({ presetBg: 'linear-gradient(180deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)', bgType: 'preset' })}
                  />
                  <button
                    style={{ ...styles.presetBtn, background: 'linear-gradient(180deg, #130cb7, #52e5e7)' }}
                    onClick={() => updateSettings({ presetBg: 'linear-gradient(180deg, #130cb7 0%, #52e5e7 100%)', bgType: 'preset' })}
                  />
                  <button
                    style={{ ...styles.presetBtn, background: '#111' }}
                    onClick={() => updateSettings({ bgColor: '#111111', bgType: 'color' })}
                  />
                </div>

                <div style={styles.colorPickerRow}>
                  <span style={styles.subLabel}>カラー単色指定:</span>
                  <input
                    type="color"
                    value={albumSettings.bgColor || '#0f2027'}
                    onChange={(e) => updateSettings({ bgColor: e.target.value, bgType: 'color' })}
                    style={styles.colorInput}
                  />
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={styles.bgUploadBtn}>
                    🖼️ 背景画像をアップロード
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBgImageUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              <div style={styles.settingSection}>
                <div style={styles.settingLabel}>🫧 浮遊スピードの設定</div>
                <div style={styles.speedGroup}>
                  <button
                    style={{ ...styles.speedBtn, backgroundColor: speedMode === 'slow' ? '#007bff' : '#444' }}
                    onClick={() => setSpeedMode('slow')}
                  >
                    ゆったり
                  </button>
                  <button
                    style={{ ...styles.speedBtn, backgroundColor: speedMode === 'normal' ? '#007bff' : '#444' }}
                    onClick={() => setSpeedMode('normal')}
                  >
                    標準
                  </button>
                  <button
                    style={{ ...styles.speedBtn, backgroundColor: speedMode === 'fast' ? '#007bff' : '#444' }}
                    onClick={() => setSpeedMode('fast')}
                  >
                    にぎやか
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 写真未登録時の案内 */}
      {filteredBubbles.length === 0 && (
        <div style={styles.emptyText}>
          【{selectedGenre}】ジャンルの写真はありません<br />
          「＋ 写真を追加」から選択中のジャンルに画像を追加できます✨
        </div>
      )}

      {/* シャボン玉浮遊領域 */}
      <div style={styles.stage}>
        {filteredBubbles.map((b) => {
          const duration = Math.floor((1.2 - (b.depth || 0.5) * 0.4) * getBaseDuration());

          return (
            <div
              key={b.id}
              onClick={() => setSelectedImage(b.src)}
              onAnimationEnd={() => handleAnimationEnd(b.id)}
              style={{
                ...styles.bubbleWrapper,
                left: `${b.left}%`,
                width: `${b.size}px`,
                height: `${b.size}px`,
                zIndex: b.zIndex,
                opacity: b.opacity,
                animation: `floatUp ${duration}s linear ${b.delay}s infinite, sway ${b.swayDuration}s ease-in-out infinite alternate`
              }}
            >
              <div style={styles.bubbleGlass}>
                <img src={b.src} alt="bubble-item" className="bubble-img" style={styles.bubbleImg} />
                {b.authorAvatar && (
                  <div 
                    title={`${b.author} (${b.genre || '未分類'})`}
                    style={{ ...styles.bubbleAuthorBadge, backgroundColor: b.authorAvatar.bg || 'transparent' }}
                  >
                    {renderAvatarIcon(b.authorAvatar, { fontSize: '10px' })}
                  </div>
                )}
                <div style={styles.shine} />
              </div>
            </div>
          );
        })}
      </div>

      {/* モーダル表示 */}
      {selectedImage && (
        <div style={styles.modalOverlay} onClick={() => setSelectedImage(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="selected" style={styles.modalImg} />
            <button style={styles.closeBtn} onClick={() => setSelectedImage(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(105vh); }
          100% { transform: translateY(-250px); }
        }
        @keyframes sway {
          0% { margin-left: -20px; }
          100% { margin-left: 20px; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  authContainer: {
    width: '100vw',
    height: '100vh',
    background: 'linear-gradient(135deg, #111e2e, #0a1118)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif'
  },
  authCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    padding: '30px',
    borderRadius: '12px',
    width: '320px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center'
  },
  appTitle: { color: '#fff', fontSize: '22px', marginBottom: '20px' },
  authTabGroup: { display: 'flex', justifyContent: 'space-around', marginBottom: '20px' },
  authTabBtn: { background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  avatarPickerSection: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' },
  avatarGrid: { display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' },
  avatarBadge: { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px' },
  avatarBadgeSmall: { width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  input: { padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '13px', outline: 'none' },
  submitBtn: { padding: '10px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '10px' },

  menuContainer: {
    width: '100vw',
    height: '100vh',
    background: 'linear-gradient(135deg, #0f2027, #2c5364)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif',
    position: 'relative'
  },
  menuHeader: { position: 'absolute', top: '20px', right: '20px', color: '#fff', fontSize: '13px', display: 'flex', gap: '15px', alignItems: 'center' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  menuGrid: { display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' },
  menuCard: { backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', width: '240px', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  cardIcon: { fontSize: '40px', marginBottom: '10px' },
  enterBtn: { padding: '8px 20px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', marginTop: '10px', width: '100%' },

  container: { width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: 'sans-serif', transition: 'background 0.5s ease' },
  header: { position: 'absolute', top: '15px', left: '15px', zIndex: 150, display: 'flex', flexDirection: 'column', gap: '10px' },
  topControlRow: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  backMenuBtn: { backgroundColor: 'rgba(0, 0, 0, 0.5)', color: '#fff', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '12px' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backdropFilter: 'blur(5px)' },
  
  membersBar: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0,0,0,0.4)', padding: '4px 10px', borderRadius: '20px' },
  memberTag: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 8px 2px 4px', borderRadius: '12px' },
  memberName: { color: '#fff', fontSize: '11px', fontWeight: 'bold' },

  tocToggleBtn: { backgroundColor: 'rgba(0, 0, 0, 0.5)', color: '#fff', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  uploadBtn: { backgroundColor: '#28a745', color: '#fff', padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },

  genreTabBar: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', backgroundColor: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '20px', backdropFilter: 'blur(5px)' },
  genreLabel: { color: '#aaa', fontSize: '11px', fontWeight: 'bold', marginRight: '4px' },
  genreTabBtn: { border: 'none', padding: '4px 12px', borderRadius: '14px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s ease' },
  addGenreBtn: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px dashed rgba(255,255,255,0.5)', padding: '4px 10px', borderRadius: '14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' },

  tocPanel: { position: 'absolute', top: 0, left: 0, width: '320px', height: '100vh', backgroundColor: 'rgba(20, 25, 35, 0.95)', backdropFilter: 'blur(10px)', zIndex: 200, transition: 'transform 0.3s ease-in-out', padding: '20px', boxSizing: 'border-box', color: '#fff' },
  tocHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' },
  tocTitle: { fontSize: '16px', margin: 0 },
  closeTocBtn: { background: 'none', border: 'none', color: '#ccc', fontSize: '20px', cursor: 'pointer' },
  
  tocTabGroup: { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: '15px' },
  tocTabBtn: { flex: 1, background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', fontSize: '12px' },

  tocContent: { display: 'flex', flexDirection: 'column', height: 'calc(100% - 90px)', overflowY: 'auto' },
  settingSection: { marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' },
  settingLabel: { fontSize: '12px', fontWeight: 'bold', color: '#ddd', marginBottom: '8px' },
  presetGroup: { display: 'flex', gap: '8px', marginBottom: '10px' },
  presetBtn: { flex: 1, height: '28px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer' },
  colorPickerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  subLabel: { fontSize: '11px', color: '#aaa' },
  colorInput: { border: 'none', width: '28px', height: '28px', cursor: 'pointer', background: 'none' },
  bgUploadBtn: { display: 'block', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', padding: '6px 0', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', border: '1px dashed rgba(255,255,255,0.4)' },
  speedGroup: { display: 'flex', gap: '6px' },
  speedBtn: { flex: 1, padding: '5px 0', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' },
  tocListContainer: { flex: 1 },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  clearAllBtn: { backgroundColor: '#dc3545', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' },
  emptyTocText: { fontSize: '12px', color: '#666', textAlign: 'center', marginTop: '20px' },
  thumbGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' },
  thumbCard: { position: 'relative', height: '90px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000', cursor: 'pointer' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbAuthorBox: { position: 'absolute', top: '4px', left: '4px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '10px' },
  thumbAuthorText: { color: '#fff', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' },
  deleteThumbBtn: { position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(220,53,69,0.8)', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' },
  emptyText: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255,255,255,0.7)', fontSize: '14px', textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.8)', lineHeight: '1.6' },
  stage: { width: '100%', height: '100%', position: 'relative' },
  bubbleWrapper: { position: 'absolute', bottom: 0, cursor: 'pointer', willChange: 'transform' },
  bubbleGlass: {
    width: '100%', height: '100%', borderRadius: '50%', position: 'relative', overflow: 'hidden',
    background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0.05) 70%)',
    boxShadow: 'inset 0 0 20px rgba(255,255,255,0.6), inset 10px 0 15px rgba(255,0,150,0.3), inset -10px 0 15px rgba(0,255,255,0.3), 0 0 15px rgba(255,255,255,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  bubbleImg: { 
    width: '85%', 
    height: '85%', 
    objectFit: 'cover', 
    borderRadius: '50%',
    imageRendering: 'high-quality',
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
    transform: 'translateZ(0)'
  },
  bubbleAuthorBadge: { position: 'absolute', bottom: '10%', right: '10%', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', border: '1px solid #fff', zIndex: 10, overflow: 'hidden' },
  shine: { position: 'absolute', top: '12%', left: '15%', width: '25%', height: '15%', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)', transform: 'rotate(-30deg)' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  modalCard: { backgroundColor: '#fff', padding: '12px 12px 20px 12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '85%', maxHeight: '85%' },
  modalImg: { maxWidth: '100%', maxHeight: '70vh', borderRadius: '4px', objectFit: 'contain' },
  closeBtn: { backgroundColor: '#333', color: '#fff', border: 'none', padding: '6px 20px', borderRadius: '15px', cursor: 'pointer', fontSize: '12px' }
};