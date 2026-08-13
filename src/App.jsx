 import React, { useState, useEffect, useRef, useMemo } from 'react';
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
// 1. Firebase
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

// =========================================================
// 2. Avatar
// =========================================================

const AVATARS = [
  { type: 'emoji', emoji: '🐱', bg: '#ff7675' },
  { type: 'emoji', emoji: '🐶', bg: '#74b9ff' },
  { type: 'emoji', emoji: '🐰', bg: '#fd79a8' },
  { type: 'emoji', emoji: '🦊', bg: '#ffeaa7' },
  { type: 'emoji', emoji: '🐼', bg: '#55efc4' },
  { type: 'emoji', emoji: '🦁', bg: '#e17055' }
];

// =========================================================
// 3. ユーティリティ
// =========================================================

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

const random = (min, max) =>
  Math.random() * (max - min) + min;

const randomInt = (min, max) =>
  Math.floor(random(min, max + 1));

const makeId = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

// =========================================================
// 4. 写真バブル Canvas
//    人物写真を極端に歪ませない。
// =========================================================

function PhotoBubbleCanvas({ src, size }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    let cancelled = false;

    const draw = async () => {
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;

      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      } catch {
        return;
      }

      if (cancelled) return;

      const w = Math.round(size);
      const h = Math.round(size);

      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 3;

      // ---------------------------------------------------
      // 写真を正方形にクロップ
      // ---------------------------------------------------

      const sourceSize = Math.min(img.width, img.height);

      const sx = (img.width - sourceSize) / 2;
      const sy = (img.height - sourceSize) / 2;

      // ---------------------------------------------------
      // 軽い球面効果
      //
      // 人物写真を大きく歪ませると顔が壊れるので、
      // 中央付近はほぼ元画像のまま。
      // ---------------------------------------------------

      const imageCanvas = document.createElement('canvas');
      imageCanvas.width = w;
      imageCanvas.height = h;

      const imageCtx = imageCanvas.getContext('2d');

      imageCtx.drawImage(
        img,
        sx,
        sy,
        sourceSize,
        sourceSize,
        0,
        0,
        w,
        h
      );

      const sourceData = imageCtx.getImageData(0, 0, w, h);
      const srcData = sourceData.data;

      const output = ctx.createImageData(w, h);
      const outData = output.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const index = (y * w + x) * 4;

          if (distance > radius) {
            outData[index + 3] = 0;
            continue;
          }

          const normalized = distance / radius;

          // 中央はほぼ歪ませない
          const distortion =
            normalized < 0.45
              ? 1
              : 1 - (normalized - 0.45) * 0.25;

          const sourceX =
            Math.round(cx + dx * distortion);

          const sourceY =
            Math.round(cy + dy * distortion);

          const sx2 = clamp(sourceX, 0, w - 1);
          const sy2 = clamp(sourceY, 0, h - 1);

          const sourceIndex =
            (sy2 * w + sx2) * 4;

          outData[index] =
            srcData[sourceIndex];

          outData[index + 1] =
            srcData[sourceIndex + 1];

          outData[index + 2] =
            srcData[sourceIndex + 2];

          outData[index + 3] = 255;
        }
      }

      ctx.putImageData(output, 0, 0);

      // ---------------------------------------------------
      // 円形クリップ
      // ---------------------------------------------------

      ctx.save();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // ---------------------------------------------------
      // 薄い虹色の差し色
      // ---------------------------------------------------

      const rainbow =
        ctx.createConicGradient(
          -Math.PI / 2,
          cx,
          cy
        );

      rainbow.addColorStop(
        0,
        'rgba(255,100,150,0.18)'
      );

      rainbow.addColorStop(
        0.25,
        'rgba(255,230,100,0.12)'
      );

      rainbow.addColorStop(
        0.5,
        'rgba(80,220,255,0.14)'
      );

      rainbow.addColorStop(
        0.75,
        'rgba(160,100,255,0.12)'
      );

      rainbow.addColorStop(
        1,
        'rgba(255,100,150,0.18)'
      );

      ctx.globalCompositeOperation = 'screen';

      ctx.strokeStyle = rainbow;
      ctx.lineWidth = Math.max(2, size * 0.035);

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
      ctx.stroke();

      // ---------------------------------------------------
      // 左上ハイライト
      // ---------------------------------------------------

      const highlight =
        ctx.createRadialGradient(
          cx - radius * 0.35,
          cy - radius * 0.38,
          2,
          cx - radius * 0.35,
          cy - radius * 0.38,
          radius * 0.5
        );

      highlight.addColorStop(
        0,
        'rgba(255,255,255,0.7)'
      );

      highlight.addColorStop(
        0.3,
        'rgba(255,255,255,0.18)'
      );

      highlight.addColorStop(
        1,
        'rgba(255,255,255,0)'
      );

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = highlight;

      ctx.beginPath();
      ctx.arc(
        cx - radius * 0.35,
        cy - radius * 0.38,
        radius * 0.42,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // ---------------------------------------------------
      // 下側の薄い青い反射
      // ---------------------------------------------------

      const bottomGlow =
        ctx.createRadialGradient(
          cx + radius * 0.25,
          cy + radius * 0.35,
          1,
          cx + radius * 0.25,
          cy + radius * 0.35,
          radius * 0.65
        );

      bottomGlow.addColorStop(
        0,
        'rgba(60,210,255,0.18)'
      );

      bottomGlow.addColorStop(
        1,
        'rgba(60,210,255,0)'
      );

      ctx.fillStyle = bottomGlow;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // ---------------------------------------------------
      // 内側の陰影
      // ---------------------------------------------------

      const shadow =
        ctx.createRadialGradient(
          cx,
          cy,
          radius * 0.45,
          cx,
          cy,
          radius
        );

      shadow.addColorStop(
        0,
        'rgba(0,0,0,0)'
      );

      shadow.addColorStop(
        0.75,
        'rgba(0,0,0,0.04)'
      );

      shadow.addColorStop(
        1,
        'rgba(0,0,0,0.3)'
      );

      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = shadow;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // ---------------------------------------------------
      // 外周
      // ---------------------------------------------------

      ctx.globalCompositeOperation = 'source-over';

      ctx.strokeStyle =
        'rgba(255,255,255,0.55)';

      ctx.lineWidth = Math.max(1.5, size * 0.012);

      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    };

    draw();

    return () => {
      cancelled = true;
    };
  }, [src, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        borderRadius: '50%'
      }}
    />
  );
}

// =========================================================
// 5. 空バブル
// =========================================================

function EmptyBubble({ size, variant = 0 }) {
  const colors = [
    ['rgba(255,255,255,0.72)', 'rgba(80,200,255,0.2)'],
    ['rgba(255,255,255,0.7)', 'rgba(255,120,210,0.2)'],
    ['rgba(255,255,255,0.7)', 'rgba(180,130,255,0.22)'],
    ['rgba(255,255,255,0.72)', 'rgba(100,255,210,0.18)']
  ];

  const [white, color] =
    colors[variant % colors.length];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        position: 'relative',
        background: `
          radial-gradient(
            circle at 30% 25%,
            rgba(255,255,255,0.17),
            transparent 28%
          ),
          radial-gradient(
            circle at 65% 70%,
            ${color},
            transparent 58%
          ),
          rgba(255,255,255,0.025)
        `,
        border: `1.5px solid ${white}`,
        boxShadow: `
          inset -8px -12px 20px rgba(0,0,0,0.14),
          inset 8px 8px 18px rgba(255,255,255,0.12),
          0 8px 18px rgba(0,0,0,0.12)
        `
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: '25%',
          height: '12%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.75)',
          left: '20%',
          top: '17%',
          transform: 'rotate(-25deg)',
          filter: 'blur(1px)'
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: '12%',
          height: '12%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.55)',
          right: '20%',
          bottom: '22%',
          filter: 'blur(1px)'
        }}
      />
    </div>
  );
}

// =========================================================
// 6. 文字バブル
// =========================================================

function TextBubble({ char, size }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: `
          radial-gradient(
            circle at 30% 25%,
            rgba(255,255,255,0.7),
            rgba(255,255,255,0.08) 35%,
            rgba(80,170,255,0.12) 75%,
            rgba(255,255,255,0.03)
          )
        `,
        border:
          '1.5px solid rgba(255,255,255,0.7)',
        boxShadow: `
          inset -8px -10px 18px rgba(0,0,0,0.12),
          inset 6px 5px 12px rgba(255,255,255,0.25),
          0 8px 16px rgba(0,0,0,0.16)
        `,
        color: '#fff',
        textShadow:
          '0 2px 5px rgba(0,0,0,0.45)',
        fontWeight: 700,
        fontSize: Math.max(16, size * 0.34),
        overflow: 'hidden'
      }}
    >
      <span
        style={{
          position: 'relative',
          zIndex: 2
        }}
      >
        {char === ' ' ? '·' : char}
      </span>

      <div
        style={{
          position: 'absolute',
          width: '28%',
          height: '14%',
          background: 'rgba(255,255,255,0.7)',
          borderRadius: '50%',
          top: '16%',
          left: '20%',
          transform: 'rotate(-25deg)',
          filter: 'blur(1px)'
        }}
      />
    </div>
  );
}

// =========================================================
// 7. Bubble Editor
// =========================================================

function BubbleEditor({
  bubble,
  onChange,
  onDelete,
  onClose
}) {
  if (!bubble) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${bubble.left}%`,
        top: `${bubble.top}%`,
        width: bubble.size,
        height: bubble.size,
        transform: `
          translate(-50%, -50%)
          rotate(${bubble.rotation}deg)
        `,
        zIndex: 10000,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -6,
          border:
            '2px solid rgba(0,150,255,0.9)',
          borderRadius: '50%'
        }}
      />

      {/* 回転 */}
      <button
        style={{
          ...editorHandleStyle,
          top: -38,
          left: '50%',
          transform: 'translateX(-50%)'
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onChange({
            ...bubble,
            rotation: bubble.rotation + 15
          });
        }}
      >
        ↻
      </button>

      {/* サイズ＋ */}
      <button
        style={{
          ...editorHandleStyle,
          right: -35,
          bottom: -35
        }}
        onPointerDown={(e) => {
          e.stopPropagation();

          onChange({
            ...bubble,
            size: clamp(
              bubble.size + 15,
              60,
              500
            )
          });
        }}
      >
        ＋
      </button>

      {/* サイズ－ */}
      <button
        style={{
          ...editorHandleStyle,
          right: -35,
          bottom: 5
        }}
        onPointerDown={(e) => {
          e.stopPropagation();

          onChange({
            ...bubble,
            size: clamp(
              bubble.size - 15,
              60,
              500
            )
          });
        }}
      >
        −
      </button>

      {/* 削除 */}
      <button
        style={{
          ...editorHandleStyle,
          left: -35,
          top: -35,
          background: '#dc3545'
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onDelete(bubble.id);
          onClose();
        }}
      >
        ×
      </button>
    </div>
  );
}

const editorHandleStyle = {
  position: 'absolute',
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: 'none',
  background: '#007bff',
  color: '#fff',
  cursor: 'pointer',
  zIndex: 20,
  fontWeight: 'bold'
};

// =========================================================
// 8. Main
// =========================================================

export default function App() {
  // -------------------------------------------------------
  // User
  // -------------------------------------------------------

  const [currentUser, setCurrentUser] =
    useState(() => {
      const saved =
        localStorage.getItem('currentUser');

      return saved
        ? JSON.parse(saved)
        : null;
    });

  const [authMode, setAuthMode] =
    useState('login');

  const [usernameInput, setUsernameInput] =
    useState('');

  const [passwordInput, setPasswordInput] =
    useState('');

  const [selectedAvatarIdx, setSelectedAvatarIdx] =
    useState(0);

  const [customAvatar, setCustomAvatar] =
    useState(null);

  const [currentScreen, setCurrentScreen] =
    useState(() =>
      localStorage.getItem('currentUser')
        ? 'menu'
        : 'auth'
    );

  // -------------------------------------------------------
  // Album
  // -------------------------------------------------------

  const [activeTab, setActiveTab] =
    useState('private');

  const [roomNumber, setRoomNumber] =
    useState('');

  const [roomInput, setRoomInput] =
    useState('');

  const [genres, setGenres] = useState([
    'すべて',
    '日常',
    '旅行',
    'イベント'
  ]);

  const [selectedGenre, setSelectedGenre] =
    useState('すべて');

  const [roomMembers, setRoomMembers] =
    useState([]);

  // 参加人数表示の開閉
  const [showMembersBar, setShowMembersBar] =
    useState(true);

  // 退出したメンバーの履歴
  const [leftMembers, setLeftMembers] =
    useState([]);

  const [bubbles, setBubbles] =
    useState([]);

  const [albumSettings, setAlbumSettings] =
    useState({
      bgType: 'preset',
      bgColor: '#0f2027',
      bgImage: null,
      presetBg:
        'linear-gradient(180deg,#0f2027 0%,#203a43 50%,#2c5364 100%)'
    });

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  const [selectedImage, setSelectedImage] =
    useState(null);

  const [isTocOpen, setIsTocOpen] =
    useState(false);

  const [tocActiveTab, setTocActiveTab] =
    useState('photos');

  const [speedMode, setSpeedMode] =
    useState('normal');

  // ★ 新機能
  const [isPaused, setIsPaused] =
    useState(false);

  const [selectedBubbleId, setSelectedBubbleId] =
    useState(null);

  const [showPhotoPicker, setShowPhotoPicker] =
    useState(false);

  const [showTextInput, setShowTextInput] =
    useState(false);

  const [textInput, setTextInput] =
    useState('');

  // -------------------------------------------------------
  // 空バブル
  // -------------------------------------------------------

  const [emptyBubbles, setEmptyBubbles] =
    useState([]);

  const [emptyBubbleCount, setEmptyBubbleCount] =
    useState(() => {
      try {
        const saved = Number(
          localStorage.getItem('bubble-empty-count')
        );
        return Number.isFinite(saved)
          ? Math.max(0, Math.min(120, saved))
          : 30;
      } catch {
        return 30;
      }
    });

  // -------------------------------------------------------
  // WakeLock
  // -------------------------------------------------------

  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock =
            await navigator.wakeLock.request(
              'screen'
            );
        }
      } catch {}
    };

    if (currentScreen === 'album') {
      requestWakeLock();
    }

    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, [currentScreen]);

  // =======================================================
  // Album Key
  // =======================================================

  const getAlbumKey = () => {
    if (activeTab === 'private') {
      return `private_${currentUser?.username}`;
    }

    return `shared_${roomNumber}`;
  };

  const albumKey = getAlbumKey();

  // =======================================================
  // 初期空バブル
  // =======================================================

  useEffect(() => {
    if (currentScreen !== 'album') return;

    const generated = Array.from(
      { length: emptyBubbleCount },
      (_, i) => ({
        id: `empty-${makeId()}-${i}`,
        type: 'empty',

        left: random(4, 94),
        top: random(5, 92),

        size: randomInt(55, 155),

        rotation: random(-30, 30),

        dx: random(-30, 30),
        dy: random(-25, 25),

        duration:
          speedMode === 'slow'
            ? random(20, 35)
            : speedMode === 'fast'
              ? random(9, 17)
              : random(14, 25),

        delay: random(-20, 0),

        opacity: random(0.35, 0.8),

        variant: randomInt(0, 3)
      })
    );

    setEmptyBubbles(generated);
  }, [currentScreen, emptyBubbleCount, speedMode]);

  // =======================================================
  // Firestore同期
  // =======================================================

  useEffect(() => {
    if (
      currentScreen !== 'album' ||
      !albumKey
    ) {
      return;
    }

    const bubblesRef =
      collection(
        db,
        'albums',
        albumKey,
        'bubbles'
      );

    const unsubscribeBubbles =
      onSnapshot(
        bubblesRef,
        snapshot => {
          const loaded =
            snapshot.docs.map(d => ({
              id: d.id,
              ...d.data()
            }));

          setBubbles(loaded);
        }
      );

    const settingsRef =
      doc(db, 'albums', albumKey);

    const unsubscribeSettings =
      onSnapshot(
        settingsRef,
        snapshot => {
          if (snapshot.exists()) {
            const data =
              snapshot.data();

            setAlbumSettings(data);

            if (
              Array.isArray(data.genres)
            ) {
              setGenres(data.genres);
            }
          } else {
            const defaults = {
              bgType: 'preset',
              bgColor: '#0f2027',
              bgImage: null,
              presetBg:
                'linear-gradient(180deg,#0f2027 0%,#203a43 50%,#2c5364 100%)',
              genres: [
                'すべて',
                '日常',
                '旅行',
                'イベント'
              ]
            };

            setAlbumSettings(defaults);
          }
        }
      );

    let unsubscribeMembers =
      () => {};
    let unsubscribeLeftMembers =
      () => {};
    let myMemberRef = null;

    if (activeTab === 'shared') {
      const membersRef =
        collection(
          db,
          'albums',
          albumKey,
          'members'
        );

      const leftMembersRef =
        collection(
          db,
          'albums',
          albumKey,
          'leftMembers'
        );

      // 現在参加中の人
      unsubscribeMembers =
        onSnapshot(
          membersRef,
          snapshot => {
            setRoomMembers(
              snapshot.docs.map(
                d => ({
                  id: d.id,
                  ...d.data()
                })
              )
            );
          }
        );

      // 過去に退出した人
      unsubscribeLeftMembers =
        onSnapshot(
          leftMembersRef,
          snapshot => {
            const loaded =
              snapshot.docs
                .map(d => ({
                  id: d.id,
                  ...d.data()
                }))
                .sort(
                  (a, b) =>
                    (b.leftAt || 0) -
                    (a.leftAt || 0)
                );

            setLeftMembers(loaded);
          }
        );

      myMemberRef =
        doc(
          db,
          'albums',
          albumKey,
          'members',
          currentUser.username
        );

      // 入室
      setDoc(
        myMemberRef,
        {
          username:
            currentUser.username,
          avatar:
            currentUser.avatar,
          joinedAt: Date.now()
        },
        { merge: true }
      );
    }

    return () => {
      unsubscribeBubbles();
      unsubscribeSettings();
      unsubscribeMembers();
      unsubscribeLeftMembers();

      // 共有ルームから抜けたときだけ退出履歴を残す
      if (
        activeTab === 'shared' &&
        myMemberRef &&
        currentUser?.username
      ) {
        const leftMembersRef =
          collection(
            db,
            'albums',
            albumKey,
            'leftMembers'
          );

        addDoc(
          leftMembersRef,
          {
            username:
              currentUser.username,
            avatar:
              currentUser.avatar || null,
            leftAt: Date.now()
          }
        )
          .then(() =>
            deleteDoc(myMemberRef)
          )
          .catch(error =>
            console.error(
              '退出処理エラー:',
              error
            )
          );
      }
    };
  }, [
    currentScreen,
    albumKey,
    activeTab,
    currentUser
  ]);

  // =======================================================
  // Settings
  // =======================================================

  const updateSettings = async (
    newSettings
  ) => {
    const updated = {
      ...albumSettings,
      ...newSettings
    };

    setAlbumSettings(updated);

    await setDoc(
      doc(db, 'albums', albumKey),
      updated,
      { merge: true }
    );
  };

  // =======================================================
  // Avatar
  // =======================================================

  const getSelectedAvatar = () => {
    if (
      selectedAvatarIdx === -1 &&
      customAvatar
    ) {
      return customAvatar;
    }

    return (
      AVATARS[selectedAvatarIdx] ||
      AVATARS[0]
    );
  };

  const renderAvatarIcon = (
    avatar,
    sizeStyle = {}
  ) => {
    if (!avatar) return null;

    if (avatar.type === 'image') {
      return (
        <img
          src={avatar.url}
          alt="avatar"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            ...sizeStyle
          }}
        />
      );
    }

    return (
      <span
        style={{
          fontSize:
            sizeStyle.fontSize ||
            '12px'
        }}
      >
        {avatar.emoji}
      </span>
    );
  };

  // =======================================================
  // Auth
  // =======================================================

  const handleAuth = async e => {
    e.preventDefault();

    const username =
      usernameInput.trim();

    const password =
      passwordInput.trim();

    if (!username || !password) {
      alert(
        'ユーザー名とパスワードを入力してください'
      );
      return;
    }

    try {
      const userRef =
        doc(db, 'users', username);

      const userSnap =
        await getDoc(userRef);

      if (authMode === 'register') {
        if (userSnap.exists()) {
          alert(
            'このユーザー名は既に使われています。'
          );
          return;
        }

        const newUser = {
          username,
          password,
          avatar: getSelectedAvatar()
        };

        await setDoc(
          userRef,
          newUser
        );

        const userObj = {
          username,
          avatar: newUser.avatar
        };

        setCurrentUser(userObj);

        localStorage.setItem(
          'currentUser',
          JSON.stringify(userObj)
        );

        setCurrentScreen('menu');
      } else {
        if (!userSnap.exists()) {
          alert(
            'ユーザーが存在しません。'
          );
          return;
        }

        const userData =
          userSnap.data();

        if (
          userData.password !== password
        ) {
          alert(
            'パスワードが違います。'
          );
          return;
        }

        const userObj = {
          username:
            userData.username,

          avatar:
            userData.avatar ||
            AVATARS[0]
        };

        setCurrentUser(userObj);

        localStorage.setItem(
          'currentUser',
          JSON.stringify(userObj)
        );

        setCurrentScreen('menu');
      }

      setPasswordInput('');
    } catch (error) {
      console.error(error);
      alert(
        '認証処理中にエラーが発生しました。'
      );
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(
      'currentUser'
    );
    setCurrentScreen('auth');
    setIsTocOpen(false);
  };

  // =======================================================
  // Room
  // =======================================================

  const enterPrivateAlbum = () => {
    setActiveTab('private');
    setSelectedGenre('すべて');
    setCurrentScreen('album');
  };

  const enterSharedAlbum = e => {
    e.preventDefault();

    if (!roomInput.trim()) {
      alert(
        'ルーム番号を入力してください'
      );
      return;
    }

    setRoomNumber(
      roomInput.trim()
    );

    setActiveTab('shared');
    setSelectedGenre('すべて');
    setCurrentScreen('album');
  };

  // =======================================================
  // Image upload
  // =======================================================

  const handleImageUpload = e => {
    const files =
      Array.from(e.target.files);

    if (!files.length) return;

    const genre =
      selectedGenre === 'すべて'
        ? genres[1] || '未分類'
        : selectedGenre;

    files.forEach(file => {
      const reader =
        new FileReader();

      reader.onload = event => {
        createBubble(
          event.target.result,
          genre
        );
      };

      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleBgImageUpload = e => {
    const file =
      e.target.files[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = event => {
      updateSettings({
        bgImage:
          event.target.result,
        bgType: 'image'
      });
    };

    reader.readAsDataURL(file);
  };

  // =======================================================
  // Create photo bubble
  // =======================================================

  const createBubble = async (
    imgSrc,
    genre
  ) => {
    const size =
      randomInt(120, 230);

    const newBubble = {
      type: 'photo',

      src: imgSrc,

      genre:
        genre || '未分類',

      size,

      opacity:
        random(0.82, 1),

      zIndex:
        randomInt(10, 90),

      left:
        random(8, 88),

      top:
        random(10, 90),

      rotation:
        random(-15, 15),

      dx:
        random(-30, 30),

      dy:
        random(-30, 30),

      duration:
        speedMode === 'slow'
          ? random(22, 34)
          : speedMode === 'fast'
            ? random(10, 17)
            : random(15, 26),

      delay:
        random(-15, 0),

      author:
        currentUser.username,

      authorAvatar:
        currentUser.avatar,

      fixed: false,

      createdAt:
        Date.now()
    };

    await addDoc(
      collection(
        db,
        'albums',
        albumKey,
        'bubbles'
      ),
      newBubble
    );
  };

  // =======================================================
  // 写真を呼ぶ
  // 静止中だけ
  // =======================================================

  const callPhoto = async bubble => {
    if (!isPaused) return;

    const newBubble = {
      ...bubble,

      type: 'photo',

      left:
        clamp(
          50 + random(-10, 10),
          5,
          95
        ),

      top:
        clamp(
          50 + random(-10, 10),
          5,
          95
        ),

      size:
        randomInt(140, 240),

      rotation:
        random(-10, 10),

      fixed: false,

      createdAt:
        Date.now()
    };

    delete newBubble.id;

    await addDoc(
      collection(
        db,
        'albums',
        albumKey,
        'bubbles'
      ),
      newBubble
    );

    setShowPhotoPicker(false);
  };

  // =======================================================
  // Text
  // =======================================================

  const createTextBubbles =
    async () => {
      const text =
        textInput.trim();

      if (!text) return;

      const messageId =
        makeId();

      const chars =
        Array.from(text);

      const batch =
        writeBatch(db);

      chars.forEach(
        (char, index) => {
          const ref =
            doc(
              collection(
                db,
                'albums',
                albumKey,
                'bubbles'
              )
            );

          batch.set(ref, {
            type: 'text',

            text: char,

            messageId,

            textIndex: index,

            textLength:
              chars.length,

            size:
              randomInt(75, 115),

            left:
              random(5, 95),

            top:
              random(5, 95),

            rotation:
              random(-25, 25),

            dx:
              random(-35, 35),

            dy:
              random(-35, 35),

            duration:
              speedMode === 'slow'
                ? random(22, 34)
                : speedMode === 'fast'
                  ? random(10, 18)
                  : random(15, 25),

            delay:
              random(-12, 0),

            opacity: 0.9,

            author:
              currentUser.username,

            authorAvatar:
              currentUser.avatar,

            fixed: false,

            createdAt:
              Date.now()
          });
        }
      );

      await batch.commit();

      setTextInput('');
      setShowTextInput(false);
    };

  // =======================================================
  // Genre
  // =======================================================

  const handleAddGenre = () => {
    const name =
      prompt(
        '新しいジャンル名を入力してください:'
      );

    if (!name?.trim()) return;

    const value =
      name.trim();

    if (genres.includes(value)) {
      alert(
        'そのジャンルは既に存在します。'
      );
      return;
    }

    const next =
      [...genres, value];

    setGenres(next);
    setSelectedGenre(value);

    updateSettings({
      genres: next
    });
  };

  // =======================================================
  // Bubble update
  // =======================================================

  const updateBubble =
    async (
      bubbleId,
      changes
    ) => {
      const ref =
        doc(
          db,
          'albums',
          albumKey,
          'bubbles',
          bubbleId
        );

      await setDoc(
        ref,
        changes,
        { merge: true }
      );
    };

  const deleteBubble =
    async id => {
      await deleteDoc(
        doc(
          db,
          'albums',
          albumKey,
          'bubbles',
          id
        )
      );

      if (
        selectedBubbleId === id
      ) {
        setSelectedBubbleId(null);
      }
    };

  // =======================================================
  // Clear
  // =======================================================

  const handleClearAll =
    async () => {
      if (
        !window.confirm(
          'このアルバムの写真・文字をすべて削除しますか？'
        )
      ) {
        return;
      }

      const ref =
        collection(
          db,
          'albums',
          albumKey,
          'bubbles'
        );

      const snapshot =
        await getDocs(ref);

      const batch =
        writeBatch(db);

      snapshot.docs.forEach(
        d => batch.delete(d.ref)
      );

      await batch.commit();

      setSelectedBubbleId(null);
    };

  // =======================================================
  // Background
  // =======================================================

  const getContainerStyle =
    () => {
      let backgroundStyle = {};

      if (
        albumSettings.bgType ===
        'color'
      ) {
        backgroundStyle = {
          backgroundColor:
            albumSettings.bgColor
        };
      } else if (
        albumSettings.bgType ===
          'image' &&
        albumSettings.bgImage
      ) {
        backgroundStyle = {
          backgroundImage:
            `url(${albumSettings.bgImage})`,
          backgroundSize:
            'cover',
          backgroundPosition:
            'center'
        };
      } else {
        backgroundStyle = {
          background:
            albumSettings.presetBg
        };
      }

      return {
        ...styles.container,
        ...backgroundStyle
      };
    };

  // =======================================================
  // Filter
  // =======================================================

  const filteredBubbles =
    useMemo(() => {
      if (
        selectedGenre === 'すべて'
      ) {
        return bubbles;
      }

      return bubbles.filter(
        b =>
          b.genre ===
          selectedGenre
      );
    }, [
      bubbles,
      selectedGenre
    ]);

  // =======================================================
  // Text grouping
  // =======================================================

  const textGroups =
    useMemo(() => {
      const groups = {};

      bubbles
        .filter(
          b =>
            b.type === 'text' &&
            b.messageId
        )
        .forEach(b => {
          if (!groups[b.messageId]) {
            groups[b.messageId] = [];
          }

          groups[b.messageId].push(b);
        });

      Object.values(groups).forEach(
        group => {
          group.sort(
            (a, b) =>
              a.textIndex -
              b.textIndex
          );
        }
      );

      return groups;
    }, [bubbles]);

  // =======================================================
  // Text target
  // 中央付近で文字を整列
  // =======================================================

  const getTextTarget =
    bubble => {
      const group =
        textGroups[
          bubble.messageId
        ];

      if (!group) {
        return null;
      }

      const index =
        group.findIndex(
          b => b.id === bubble.id
        );

      if (index < 0) {
        return null;
      }

      const spacing =
        Math.min(
          8,
          70 / Math.max(
            group.length,
            1
          )
        );

      const start =
        50 -
        ((group.length - 1) *
          spacing) /
          2;

      return {
        left:
          start +
          index * spacing,

        top: 50,

        rotation: 0
      };
    };

  // =======================================================
  // Pointer drag
  // =======================================================

  const dragRef = useRef(null);

  const handlePointerDown =
    (e, bubble) => {
      if (!isPaused) return;

      e.stopPropagation();

      setSelectedBubbleId(
        bubble.id
      );

      const stage =
        e.currentTarget.closest(
          '[data-stage="true"]'
        );

      if (!stage) return;

      const rect =
        stage.getBoundingClientRect();

      dragRef.current = {
        id: bubble.id,
        startX: e.clientX,
        startY: e.clientY,
        originalLeft:
          bubble.left,
        originalTop:
          bubble.top,
        width:
          rect.width,
        height:
          rect.height
      };

      e.currentTarget.setPointerCapture?.(
        e.pointerId
      );
    };

  const handlePointerMove =
    e => {
      const drag =
        dragRef.current;

      if (!drag) return;

      const dx =
        ((e.clientX -
          drag.startX) /
          drag.width) *
        100;

      const dy =
        ((e.clientY -
          drag.startY) /
          drag.height) *
        100;

      const left =
        clamp(
          drag.originalLeft + dx,
          2,
          98
        );

      const top =
        clamp(
          drag.originalTop + dy,
          2,
          98
        );

      setBubbles(prev =>
        prev.map(b =>
          b.id === drag.id
            ? {
                ...b,
                left,
                top
              }
            : b
        )
      );
    };

  const handlePointerUp =
    async () => {
      const drag =
        dragRef.current;

      if (!drag) return;

      dragRef.current = null;

      const bubble =
        bubbles.find(
          b => b.id === drag.id
        );

      if (!bubble) return;

      await updateBubble(
        drag.id,
        {
          left: bubble.left,
          top: bubble.top
        }
      );
    };

  // =======================================================
  // Avatar upload
  // =======================================================

  const handleCustomAvatarUpload =
    e => {
      const file =
        e.target.files[0];

      if (!file) return;

      const reader =
        new FileReader();

      reader.onload = event => {
        setCustomAvatar({
          type: 'image',
          url: event.target.result
        });

        setSelectedAvatarIdx(-1);
      };

      reader.readAsDataURL(file);
    };

  // =======================================================
  // Render
  // =======================================================

  // -------------------------------------------------------
  // Auth
  // -------------------------------------------------------

  if (
    currentScreen === 'auth'
  ) {
    return (
      <div
        style={
          styles.authContainer
        }
      >
        <div
          style={
            styles.authCard
          }
        >
          <h1
            style={
              styles.appTitle
            }
          >
            🫧 Bubble Album
          </h1>

          <div
            style={
              styles.authTabGroup
            }
          >
            <button
              style={{
                ...styles.authTabBtn,
                color:
                  authMode ===
                  'login'
                    ? '#fff'
                    : '#888',
                borderBottom:
                  authMode ===
                  'login'
                    ? '2px solid #007bff'
                    : 'none'
              }}
              onClick={() =>
                setAuthMode(
                  'login'
                )
              }
            >
              ログイン
            </button>

            <button
              style={{
                ...styles.authTabBtn,
                color:
                  authMode ===
                  'register'
                    ? '#fff'
                    : '#888',
                borderBottom:
                  authMode ===
                  'register'
                    ? '2px solid #007bff'
                    : 'none'
              }}
              onClick={() =>
                setAuthMode(
                  'register'
                )
              }
            >
              新規登録
            </button>
          </div>

          <form
            onSubmit={
              handleAuth
            }
            style={
              styles.form
            }
          >
            {authMode ===
              'register' && (
              <div
                style={
                  styles.avatarPickerSection
                }
              >
                <span
                  style={{
                    color: '#ccc',
                    fontSize: 12
                  }}
                >
                  アイコンを選択
                </span>

                <div
                  style={
                    styles.avatarGrid
                  }
                >
                  {AVATARS.map(
                    (av, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedAvatarIdx(
                            idx
                          );
                          setCustomAvatar(
                            null
                          );
                        }}
                        style={{
                          ...styles.avatarBadge,
                          backgroundColor:
                            av.bg,
                          border:
                            selectedAvatarIdx ===
                            idx
                              ? '2px solid #fff'
                              : '2px solid transparent'
                        }}
                      >
                        {av.emoji}
                      </div>
                    )
                  )}

                  <label
                    style={{
                      ...styles.avatarBadge,
                      background:
                        '#555',
                      border:
                        selectedAvatarIdx ===
                        -1
                          ? '2px solid #007bff'
                          : '2px solid transparent'
                    }}
                  >
                    {customAvatar ? (
                      <img
                        src={
                          customAvatar.url
                        }
                        alt="custom"
                        style={{
                          width:
                            '100%',
                          height:
                            '100%',
                          objectFit:
                            'cover',
                          borderRadius:
                            '50%'
                        }}
                      />
                    ) : (
                      '📷'
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleCustomAvatarUpload
                      }
                      style={{
                        display:
                          'none'
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder="ユーザー名"
              value={
                usernameInput
              }
              onChange={e =>
                setUsernameInput(
                  e.target.value
                )
              }
              style={
                styles.input
              }
            />

            <input
              type="password"
              placeholder="パスワード"
              value={
                passwordInput
              }
              onChange={e =>
                setPasswordInput(
                  e.target.value
                )
              }
              style={
                styles.input
              }
            />

            <button
              type="submit"
              style={
                styles.submitBtn
              }
            >
              {authMode ===
              'login'
                ? 'ログイン'
                : 'アカウント作成'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------
  // Menu
  // -------------------------------------------------------

  if (
    currentScreen === 'menu'
  ) {
    return (
      <div
        style={
          styles.menuContainer
        }
      >
        <div
          style={
            styles.menuHeader
          }
        >
          <div
            style={{
              display:
                'flex',
              alignItems:
                'center',
              gap: 8
            }}
          >
            <div
              style={{
                ...styles.avatarBadgeSmall,
                backgroundColor:
                  currentUser
                    ?.avatar
                    ?.bg ||
                  'transparent'
              }}
            >
              {renderAvatarIcon(
                currentUser?.avatar
              )}
            </div>

            <strong>
              {
                currentUser?.username
              }
            </strong>
          </div>

          <button
            style={
              styles.logoutBtn
            }
            onClick={
              handleLogout
            }
          >
            ログアウト
          </button>
        </div>

        <h2
          style={{
            color: '#fff',
            marginBottom:
              30
          }}
        >
          📖 アルバムを選択
        </h2>

        <div
          style={
            styles.menuGrid
          }
        >
          <div
            style={
              styles.menuCard
            }
          >
            <div
              style={
                styles.cardIcon
              }
            >
              🔒
            </div>

            <h3>
              プライベートアルバム
            </h3>

            <p>
              自分だけの写真が入る専用アルバムです。
            </p>

            <button
              style={
                styles.enterBtn
              }
              onClick={
                enterPrivateAlbum
              }
            >
              入場する
            </button>
          </div>

          <div
            style={
              styles.menuCard
            }
          >
            <div
              style={
                styles.cardIcon
              }
            >
              🌐
            </div>

            <h3>
              共有アルバム
            </h3>

            <p>
              同じルーム番号を入力した人とリアルタイム共有できます。
            </p>

            <form
              onSubmit={
                enterSharedAlbum
              }
              style={{
                width:
                  '100%'
              }}
            >
              <input
                type="text"
                placeholder="例: ROOM-1234"
                value={
                  roomInput
                }
                onChange={e =>
                  setRoomInput(
                    e.target.value
                  )
                }
                style={{
                  ...styles.input,
                  width:
                    '100%',
                  boxSizing:
                    'border-box',
                  marginBottom:
                    10
                }}
              />

              <button
                type="submit"
                style={{
                  ...styles.enterBtn,
                  backgroundColor:
                    '#17a2b8'
                }}
              >
                ルームへ入る
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =======================================================
  // Album
  // =======================================================

  return (
    <div
      style={
        getContainerStyle()
      }
      onPointerMove={
        handlePointerMove
      }
      onPointerUp={
        handlePointerUp
      }
    >
      {/* ===============================================
          Header
      =============================================== */}

      <div
        style={
          styles.header
        }
      >
        <div
          style={
            styles.topControlRow
          }
        >
          <button
            style={
              styles.backMenuBtn
            }
            onClick={() =>
              setCurrentScreen(
                'menu'
              )
            }
          >
            ◀ メニュー
          </button>

          <div
            style={
              styles.badge
            }
          >
            {activeTab ===
            'private'
              ? '🔒 プライベート'
              : `🌐 共有 [${roomNumber}]`}
          </div>

          {/* 静止 / 再生 */}
          <button
            style={{
              ...styles.pauseBtn,
              background:
                isPaused
                  ? '#28a745'
                  : '#ff9800'
            }}
            onClick={() => {
              setIsPaused(
                value => !value
              );

              setSelectedBubbleId(
                null
              );
            }}
          >
            {isPaused
              ? '▶ 再生'
              : '⏸ 静止'}
          </button>

          {/* 写真追加 */}
          <label
            style={
              styles.uploadBtn
            }
          >
            ＋ 写真を追加
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={
                handleImageUpload
              }
              style={{
                display:
                  'none'
              }}
            />
          </label>

          {/* ★ 静止中だけ写真を呼ぶ */}
          {isPaused && (
            <button
              style={
                styles.callPhotoBtn
              }
              onClick={() =>
                setShowPhotoPicker(
                  true
                )
              }
            >
              📷 写真を呼ぶ
            </button>
          )}

          {/* ★ 言葉 */}
          <button
            style={
              styles.textBtn
            }
            onClick={() =>
              setShowTextInput(
                true
              )
            }
          >
            💬 言葉を追加
          </button>

          <button
            style={
              styles.tocToggleBtn
            }
            onClick={() =>
              setIsTocOpen(
                value => !value
              )
            }
          >
            📖 もくじ・設定
          </button>
        </div>

        <div
          style={
            styles.genreTabBar
          }
        >
          <span
            style={
              styles.genreLabel
            }
          >
            🏷️ ジャンル:
          </span>

          {genres.map(
            genre => (
              <button
                key={genre}
                style={{
                  ...styles.genreTabBtn,
                  backgroundColor:
                    selectedGenre ===
                    genre
                      ? '#007bff'
                      : 'rgba(255,255,255,0.15)'
                }}
                onClick={() =>
                  setSelectedGenre(
                    genre
                  )
                }
              >
                {genre}
              </button>
            )
          )}

          <button
            style={
              styles.addGenreBtn
            }
            onClick={
              handleAddGenre
            }
          >
            ＋ タブ追加
          </button>
        </div>
      </div>

      {/* ===============================================
          Members
      =============================================== */}

            {activeTab === 'shared' && (
        <>
          {!showMembersBar ? (
            <button
              type="button"
              onClick={() => setShowMembersBar(true)}
              style={{
                position: 'absolute',
                right: 14,
                top: 14,
                zIndex: 151,
                border: 'none',
                borderRadius: 16,
                padding: '6px 10px',
                background: 'rgba(0,0,0,0.45)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 'bold'
              }}
              title="参加人数を表示"
            >
              👥 参加中
            </button>
          ) : (
            <div
              style={{
                ...styles.membersBarFloating,
                right: 15,
                top: 15,
                padding: '6px 8px 6px 10px',
                gap: 7
              }}
            >
              <span style={{ fontWeight: 'bold' }}>
                👥 参加中 {roomMembers.length}人
              </span>

              <button
                type="button"
                onClick={() => setShowMembersBar(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: '2px 4px',
                  opacity: 0.85
                }}
                title="閉じる"
                aria-label="参加者表示を閉じる"
              >
                ×
              </button>
            </div>
          )}
        </>
      )}

      {/* ===============================================
          TOC
      =============================================== */}

      <div
        style={{
          ...styles.tocPanel,
          transform:
            isTocOpen
              ? 'translateX(0)'
              : 'translateX(-105%)'
        }}
      >
        <div
          style={
            styles.tocHeader
          }
        >
          <h2
            style={
              styles.tocTitle
            }
          >
            📖 目次メニュー
          </h2>

          <button
            style={
              styles.closeTocBtn
            }
            onClick={() =>
              setIsTocOpen(false)
            }
          >
            ✕
          </button>
        </div>

        <div
          style={
            styles.tocTabGroup
          }
        >
          <button
            style={
              styles.tocTabBtn
            }
            onClick={() =>
              setTocActiveTab(
                'photos'
              )
            }
          >
            📷 写真一覧
          </button>

          <button
            style={
              styles.tocTabBtn
            }
            onClick={() =>
              setTocActiveTab(
                'settings'
              )
            }
          >
            🎨 背景・設定
          </button>
        </div>

        <div
          style={
            styles.tocContent
          }
        >
          {tocActiveTab ===
            'photos' && (
            <>
              <div
                style={
                  styles.listHeader
                }
              >
                <span>
                  📷 写真一覧
                </span>

                {bubbles.length >
                  0 && (
                  <button
                    style={
                      styles.clearAllBtn
                    }
                    onClick={
                      handleClearAll
                    }
                  >
                    すべて削除
                  </button>
                )}
              </div>

              <div
                style={
                  styles.thumbGrid
                }
              >
                {bubbles
                  .filter(
                    b =>
                      b.type ===
                      'photo'
                  )
                  .map(
                    (b, index) => (
                      <div
                        key={b.id}
                        style={
                          styles.thumbCard
                        }
                      >
                        <img
                          src={
                            b.src
                          }
                          alt={`photo-${index}`}
                          style={
                            styles.thumbImg
                          }
                          onClick={() =>
                            setSelectedImage(
                              b.src
                            )
                          }
                        />

                        <span
                          style={
                            styles.thumbAuthorText
                          }
                        >
                          {b.author ||
                            '不明'}
                        </span>
                      </div>
                    )
                  )}
              </div>
            </>
          )}

          {tocActiveTab ===
            'settings' && (
            <>
              <div
                style={
                  styles.settingSection
                }
              >
                <div
                  style={
                    styles.settingLabel
                  }
                >
                  🎨 背景
                </div>

                <div
                  style={
                    styles.presetGroup
                  }
                >
                  <button
                    style={{
                      ...styles.presetBtn,
                      background:
                        'linear-gradient(180deg,#0f2027,#2c5364)'
                    }}
                    onClick={() =>
                      updateSettings({
                        presetBg:
                          'linear-gradient(180deg,#0f2027,#203a43,#2c5364)',
                        bgType:
                          'preset'
                      })
                    }
                  />

                  <button
                    style={{
                      ...styles.presetBtn,
                      background:
                        'linear-gradient(180deg,#1a2a6c,#b21f1f,#fdbb2d)'
                    }}
                    onClick={() =>
                      updateSettings({
                        presetBg:
                          'linear-gradient(180deg,#1a2a6c,#b21f1f,#fdbb2d)',
                        bgType:
                          'preset'
                      })
                    }
                  />

                  <button
                    style={{
                      ...styles.presetBtn,
                      background:
                        'linear-gradient(180deg,#130cb7,#52e5e7)'
                    }}
                    onClick={() =>
                      updateSettings({
                        presetBg:
                          'linear-gradient(180deg,#130cb7,#52e5e7)',
                        bgType:
                          'preset'
                      })
                    }
                  />

                  <button
                    style={{
                      ...styles.presetBtn,
                      background:
                        '#111'
                    }}
                    onClick={() =>
                      updateSettings({
                        bgColor:
                          '#111',
                        bgType:
                          'color'
                      })
                    }
                  />
                </div>

                <input
                  type="color"
                  value={
                    albumSettings.bgColor ||
                    '#0f2027'
                  }
                  onChange={e =>
                    updateSettings({
                      bgColor:
                        e.target.value,
                      bgType:
                        'color'
                    })
                  }
                />

                <br />

                <label
                  style={
                    styles.bgUploadBtn
                  }
                >
                  🖼️ 背景画像
                  <input
                    type="file"
                    accept="image/*"
                    onChange={
                      handleBgImageUpload
                    }
                    style={{
                      display:
                        'none'
                    }}
                  />
                </label>
              </div>

              <div
                style={
                  styles.settingSection
                }
              >
                <div
                  style={
                    styles.settingLabel
                  }
                >
                  🫧 浮遊速度
                </div>

                <div
                  style={
                    styles.speedGroup
                  }
                >
                  {[
                    ['slow', 'ゆったり'],
                    ['normal', '標準'],
                    ['fast', 'にぎやか']
                  ].map(
                    ([value, label]) => (
                      <button
                        key={
                          value
                        }
                        style={{
                          ...styles.speedBtn,
                          background:
                            speedMode ===
                            value
                              ? '#007bff'
                              : '#444'
                        }}
                        onClick={() =>
                          setSpeedMode(
                            value
                          )
                        }
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
      <div style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.14)'
      }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: 15,
          marginBottom: 8
        }}>
          🫧 バブル設定
        </div>

        <div style={{
          fontSize: 13,
          marginBottom: 8
        }}>
          空バブルの量：<strong>{emptyBubbleCount}</strong> 個
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <input
            type="range"
            min="0"
            max="120"
            value={emptyBubbleCount}
            onChange={e => {
              const n = Math.max(
                0,
                Math.min(120, Number(e.target.value))
              );
              setEmptyBubbleCount(n);
              try {
                localStorage.setItem(
                  'bubble-empty-count',
                  String(n)
                );
              } catch {}
            }}
            style={{ flex: 1 }}
          />

          <input
            type="number"
            min="0"
            max="120"
            value={emptyBubbleCount}
            onChange={e => {
              const n = Math.max(
                0,
                Math.min(
                  120,
                  Number(e.target.value) || 0
                )
              );
              setEmptyBubbleCount(n);
              try {
                localStorage.setItem(
                  'bubble-empty-count',
                  String(n)
                );
              } catch {}
            }}
            style={{
              width: 58,
              padding: '6px',
              borderRadius: 7,
              border: '1px solid #666',
              background: '#222',
              color: '#fff',
              textAlign: 'center'
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          marginTop: 9
        }}>
          {[0, 10, 20, 30, 50, 80, 120].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setEmptyBubbleCount(n);
                try {
                  localStorage.setItem(
                    'bubble-empty-count',
                    String(n)
                  );
                } catch {}
              }}
              style={{
                padding: '5px 9px',
                border: 'none',
                borderRadius: 7,
                background:
                  emptyBubbleCount === n
                    ? '#1683ff'
                    : 'rgba(255,255,255,0.16)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 11
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===============================================
          Stage
      =============================================== */}

      <div
        data-stage="true"
        style={
          styles.stage
        }
      >
        {/* 空バブル */}
        {emptyBubbles.map(
          bubble => (
            <div
              key={
                bubble.id
              }
              style={{
                ...styles.freeBubble,
                left: `${bubble.left}%`,
                top: `${bubble.top}%`,
                width:
                  bubble.size,
                height:
                  bubble.size,
                opacity:
                  bubble.opacity,
                zIndex: 1,

                '--dx':
                  `${bubble.dx}px`,

                '--dy':
                  `${bubble.dy}px`,

                '--rot':
                  `${bubble.rotation}deg`,

                animation:
                  isPaused
                    ? 'none'
                    : `freeFloat ${bubble.duration || 28}s cubic-bezier(.37,0,.63,1) ${bubble.delay || 0}s infinite`
              }}
            >
              <EmptyBubble
                size={
                  bubble.size
                }
                variant={
                  bubble.variant
                }
              />
            </div>
          )
        )}

        {/* 写真・文字バブル */}
        {filteredBubbles.map(
          bubble => {
            const textTarget =
              bubble.type ===
              'text'
                ? getTextTarget(
                    bubble
                  )
                : null;

            const isSelected =
              selectedBubbleId ===
              bubble.id;

            const targetLeft =
              textTarget?.left ??
              bubble.left;

            const targetTop =
              textTarget?.top ??
              bubble.top;

            const targetRotation =
              textTarget?.rotation ??
              bubble.rotation;

            return (
              <div
                key={
                  bubble.id
                }
                onPointerDown={e =>
                  handlePointerDown(
                    e,
                    bubble
                  )
                }
                onClick={() => {
                  if (!isPaused) {
                    setSelectedImage(
                      bubble.src
                    );
                  } else {
                    setSelectedBubbleId(
                      bubble.id
                    );
                  }
                }}
                style={{
                  ...styles.freeBubble,

                  left: `${targetLeft}%`,
                  top: `${targetTop}%`,

                  width:
                    bubble.size,
                  height:
                    bubble.size,

                  opacity:
                    bubble.opacity ??
                    1,

                  zIndex:
                    bubble.zIndex ??
                    10,

                  cursor:
                    isPaused
                      ? 'grab'
                      : 'pointer',

                  transformOrigin:
                    'center',

                  '--dx':
                    `${bubble.dx || 55}px`,

                  '--dy':
                    `${bubble.dy || 35}px`,

                  '--rot':
                    `${bubble.rotation || 0}deg`,

                  animation:
                    isPaused
                      ? 'none'
                      : bubble.type ===
                        'text'
                        ? `textFloat ${bubble.duration || 24}s cubic-bezier(.37,0,.63,1) ${bubble.delay || 0}s infinite`
                        : `freeFloat ${bubble.duration || 28}s cubic-bezier(.37,0,.63,1) ${bubble.delay || 0}s infinite`
                }}
              >
                {bubble.type ===
                  'photo' && (
                  <PhotoBubbleCanvas
                    src={
                      bubble.src
                    }
                    size={
                      bubble.size
                    }
                  />
                )}

                {bubble.type ===
                  'text' && (
                  <TextBubble
                    char={
                      bubble.text
                    }
                    size={
                      bubble.size
                    }
                  />
                )}

                {bubble.authorAvatar && (
                  <div
                    style={{
                      ...styles.bubbleAuthorBadge,
                      backgroundColor:
                        bubble
                          .authorAvatar
                          ?.bg ||
                        'rgba(0,0,0,0.4)'
                    }}
                  >
                    {renderAvatarIcon(
                      bubble.authorAvatar
                    )}
                  </div>
                )}

                {/* 選択中 */}
                {isSelected &&
                  isPaused && (
                    <BubbleEditor
                      bubble={
                        bubble
                      }
                      onChange={next =>
                        updateBubble(
                          bubble.id,
                          {
                            left:
                              next.left,
                            top:
                              next.top,
                            size:
                              next.size,
                            rotation:
                              next.rotation
                          }
                        )
                      }
                      onDelete={
                        deleteBubble
                      }
                      onClose={() =>
                        setSelectedBubbleId(
                          null
                        )
                      }
                    />
                  )}
              </div>
            );
          }
        )}
      </div>

      {/* ===============================================
          写真を呼ぶモーダル
      =============================================== */}

      {showPhotoPicker &&
        isPaused && (
          <div
            style={
              styles.modalOverlay
            }
            onClick={() =>
              setShowPhotoPicker(
                false
              )
            }
          >
            <div
              style={
                styles.photoPicker
              }
              onClick={e =>
                e.stopPropagation()
              }
            >
              <div
                style={
                  styles.modalHeader
                }
              >
                <strong>
                  📷 写真を呼ぶ
                </strong>

                <button
                  style={
                    styles.closeBtnSmall
                  }
                  onClick={() =>
                    setShowPhotoPicker(
                      false
                    )
                  }
                >
                  ✕
                </button>
              </div>

              <p
                style={{
                  color:
                    '#aaa',
                  fontSize:
                    12
                }}
              >
                好きな写真を選ぶと、現在の静止画面にバブルとして追加します。
              </p>

              <div
                style={
                  styles.photoPickerGrid
                }
              >
                {bubbles
                  .filter(
                    b =>
                      b.type ===
                      'photo'
                  )
                  .map(
                    bubble => (
                      <button
                        key={
                          bubble.id
                        }
                        style={
                          styles.photoChoice
                        }
                        onClick={() =>
                          callPhoto(
                            bubble
                          )
                        }
                      >
                        <img
                          src={
                            bubble.src
                          }
                          alt=""
                        />
                      </button>
                    )
                  )}
              </div>
            </div>
          </div>
        )}

      {/* ===============================================
          言葉入力
      =============================================== */}

      {showTextInput && (
        <div
          style={
            styles.modalOverlay
          }
          onClick={() =>
            setShowTextInput(
              false
            )
          }
        >
          <div
            style={
              styles.textDialog
            }
            onClick={e =>
              e.stopPropagation()
            }
          >
            <h3>
              💬 言葉を飛ばす
            </h3>

            <p
              style={{
                color:
                  '#aaa',
                fontSize:
                  12
              }}
            >
              入力した文字が1文字ずつバブルになって漂い、中央で言葉になります。
            </p>

            <textarea
              value={
                textInput
              }
              onChange={e =>
                setTextInput(
                  e.target.value
                )
              }
              placeholder="例：ありがとう"
              maxLength={30}
              style={
                styles.textarea
              }
              autoFocus
            />

            <div
              style={{
                display:
                  'flex',
                gap: 8
              }}
            >
              <button
                style={
                  styles.cancelBtn
                }
                onClick={() =>
                  setShowTextInput(
                    false
                  )
                }
              >
                キャンセル
              </button>

              <button
                style={
                  styles.createTextBtn
                }
                onClick={
                  createTextBubbles
                }
              >
                🫧 飛ばす
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===============================================
          写真拡大
      =============================================== */}

      {selectedImage && (
        <div
          style={
            styles.modalOverlay
          }
          onClick={() =>
            setSelectedImage(
              null
            )
          }
        >
          <div
            style={
              styles.modalCard
            }
            onClick={e =>
              e.stopPropagation()
            }
          >
            <img
              src={
                selectedImage
              }
              alt="selected"
              style={
                styles.modalImg
              }
            />

            <button
              style={
                styles.closeBtn
              }
              onClick={() =>
                setSelectedImage(
                  null
                )
              }
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ===============================================
          CSS
      =============================================== */}

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          html,
          body,
          #root {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }

          button,
          input,
          textarea {
            font-family: inherit;
          }

          @keyframes freeFloat {
            0% {
              opacity: 0;
              transform: translate3d(
                calc(var(--dx) * -1),
                48vh,
                0
              ) rotate(calc(var(--rot) - 14deg)) scale(.72);
            }

            12% {
              opacity: 1;
              transform: translate3d(
                calc(var(--dx) * .65),
                28vh,
                0
              ) rotate(calc(var(--rot) + 9deg)) scale(.88);
            }

            32% {
              opacity: 1;
              transform: translate3d(
                calc(var(--dx) * -1.15),
                5vh,
                0
              ) rotate(calc(var(--rot) - 11deg)) scale(1);
            }

            52% {
              opacity: .98;
              transform: translate3d(
                calc(var(--dx) * .9),
                -12vh,
                0
              ) rotate(calc(var(--rot) + 15deg)) scale(1.04);
            }

            72% {
              opacity: .78;
              transform: translate3d(
                calc(var(--dx) * -.8),
                -30vh,
                0
              ) rotate(calc(var(--rot) - 13deg)) scale(.96);
            }

            88% {
              opacity: .35;
              transform: translate3d(
                calc(var(--dx) * .55),
                -46vh,
                0
              ) rotate(calc(var(--rot) + 9deg)) scale(.86);
            }

            100% {
              opacity: 0;
              transform: translate3d(
                var(--dx),
                -64vh,
                0
              ) rotate(calc(var(--rot) - 17deg)) scale(.74);
            }
          }

          @keyframes textFloat {
            0% {
              opacity: 0;
              transform: translate3d(
                calc(var(--dx) * -1),
                48vh,
                0
              ) rotate(var(--rot)) scale(.72);
            }

            18% {
              opacity: .55;
              transform: translate3d(
                calc(var(--dx) * .7),
                24vh,
                0
              ) rotate(calc(var(--rot) + 8deg)) scale(.9);
            }

            40% {
              opacity: 1;
              transform: translate3d(
                calc(var(--dx) * .25),
                6vh,
                0
              ) rotate(calc(var(--rot) * .25)) scale(.98);
            }

            48% {
              opacity: 1;
              transform: translate3d(
                0,
                0,
                0
              ) rotate(0deg) scale(1);
            }

            68% {
              opacity: 1;
              transform: translate3d(
                0,
                0,
                0
              ) rotate(0deg) scale(1);
            }

            84% {
              opacity: .55;
              transform: translate3d(
                calc(var(--dx) * .6),
                -18vh,
                0
              ) rotate(calc(var(--rot) + 10deg)) scale(.92);
            }

            100% {
              opacity: 0;
              transform: translate3d(
                var(--dx),
                -64vh,
                0
              ) rotate(calc(var(--rot) - 12deg)) scale(.76);
            }
          }
        `}
      </style>
    </div>
  );
}

// =========================================================
// 9. Styles
// =========================================================

const styles = {
  authContainer: {
    width: '100vw',
    height: '100vh',
    background:
      'linear-gradient(135deg,#111e2e,#0a1118)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif'
  },

  authCard: {
    background:
      'rgba(255,255,255,0.05)',
    backdropFilter:
      'blur(10px)',
    padding: 30,
    borderRadius: 14,
    width: 340,
    boxShadow:
      '0 8px 32px rgba(0,0,0,0.3)',
    border:
      '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center'
  },

  appTitle: {
    color: '#fff',
    fontSize: 23,
    marginBottom: 20
  },

  authTabGroup: {
    display: 'flex',
    justifyContent:
      'space-around',
    marginBottom: 20
  },

  authTabBtn: {
    background: 'none',
    border: 'none',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold'
  },

  form: {
    display: 'flex',
    flexDirection:
      'column',
    gap: 12
  },

  avatarPickerSection: {
    display: 'flex',
    flexDirection:
      'column',
    gap: 8,
    marginBottom: 8
  },

  avatarGrid: {
    display: 'flex',
    justifyContent:
      'center',
    gap: 8,
    flexWrap: 'wrap'
  },

  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    cursor: 'pointer',
    fontSize: 19,
    overflow: 'hidden'
  },

  avatarBadgeSmall: {
    width: 23,
    height: 23,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    overflow: 'hidden',
    flexShrink: 0
  },

  input: {
    padding:
      '10px 12px',
    borderRadius: 7,
    border:
      '1px solid rgba(255,255,255,0.2)',
    background:
      'rgba(0,0,0,0.2)',
    color: '#fff',
    fontSize: 13,
    outline: 'none'
  },

  submitBtn: {
    padding: 10,
    background:
      '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  menuContainer: {
    width: '100vw',
    height: '100vh',
    background:
      'linear-gradient(135deg,#0f2027,#2c5364)',
    display: 'flex',
    flexDirection:
      'column',
    alignItems: 'center',
    justifyContent:
      'center',
    fontFamily:
      'sans-serif',
    position:
      'relative'
  },

  menuHeader: {
    position: 'absolute',
    top: 20,
    right: 20,
    color: '#fff',
    display: 'flex',
    gap: 15,
    alignItems:
      'center'
  },

  logoutBtn: {
    background:
      'rgba(255,255,255,0.2)',
    color: '#fff',
    border: 'none',
    padding:
      '5px 10px',
    borderRadius: 5,
    cursor: 'pointer'
  },

  menuGrid: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent:
      'center'
  },

  menuCard: {
    background:
      'rgba(255,255,255,0.08)',
    backdropFilter:
      'blur(8px)',
    width: 260,
    padding: 25,
    borderRadius: 14,
    border:
      '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    display: 'flex',
    flexDirection:
      'column',
    alignItems:
      'center',
    textAlign: 'center'
  },

  cardIcon: {
    fontSize: 42
  },

  enterBtn: {
    padding:
      '9px 20px',
    background:
      '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: 20,
    cursor: 'pointer',
    width: '100%'
  },

  container: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    fontFamily:
      'sans-serif',
    transition:
      'background 0.5s ease'
  },

  header: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 150,
    display: 'flex',
    flexDirection:
      'column',
    gap: 9
  },

  topControlRow: {
    display: 'flex',
    gap: 8,
    alignItems:
      'center',
    flexWrap: 'wrap'
  },

  backMenuBtn: {
    padding:
      '7px 12px',
    background:
      'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: 16,
    color: '#fff',
    cursor: 'pointer'
  },

  badge: {
    padding:
      '7px 12px',
    background:
      'rgba(0,0,0,0.4)',
    borderRadius: 16,
    color: '#fff',
    fontSize: 12
  },

  pauseBtn: {
    padding:
      '7px 14px',
    border: 'none',
    borderRadius: 16,
    color: '#fff',
    cursor: 'pointer',
    fontWeight:
      'bold'
  },

  uploadBtn: {
    padding:
      '7px 13px',
    background:
      '#28a745',
    borderRadius: 16,
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight:
      'bold'
  },

  callPhotoBtn: {
    padding:
      '7px 13px',
    background:
      '#9b59b6',
    border: 'none',
    borderRadius: 16,
    color: '#fff',
    cursor: 'pointer',
    fontWeight:
      'bold'
  },

  textBtn: {
    padding:
      '7px 13px',
    background:
      '#e67e22',
    border: 'none',
    borderRadius: 16,
    color: '#fff',
    cursor: 'pointer',
    fontWeight:
      'bold'
  },

  tocToggleBtn: {
    padding:
      '7px 13px',
    background:
      '#6c757d',
    border: 'none',
    borderRadius: 16,
    color: '#fff',
    cursor: 'pointer'
  },

  genreTabBar: {
    display: 'flex',
    gap: 6,
    alignItems:
      'center',
    flexWrap: 'wrap'
  },

  genreLabel: {
    color: '#fff',
    fontSize: 12
  },

  genreTabBtn: {
    padding:
      '5px 10px',
    border: 'none',
    borderRadius: 13,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 11
  },

  addGenreBtn: {
    padding:
      '5px 10px',
    background:
      'rgba(255,255,255,0.15)',
    border:
      '1px dashed rgba(255,255,255,0.7)',
    borderRadius: 13,
    color: '#fff',
    cursor: 'pointer'
  },

  membersBarFloating: {
    position: 'absolute',
    right: 15,
    top: 15,
    zIndex: 150,
    display: 'flex',
    alignItems:
      'center',
    gap: 5,
    background:
      'rgba(0,0,0,0.35)',
    padding:
      '5px 8px',
    borderRadius: 16,
    color: '#ccc',
    fontSize: 11
  },

  memberTag: {
    display: 'flex',
    alignItems:
      'center',
    gap: 3,
    background:
      'rgba(255,255,255,0.12)',
    padding:
      '2px 6px',
    borderRadius: 10
  },

  memberName: {
    fontSize: 10,
    color: '#fff'
  },

  stage: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden'
  },

  freeBubble: {
    position: 'absolute',
    transformOrigin:
      'center center',
    willChange:
      'transform',
    touchAction:
      'none'
  },

  bubbleAuthorBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 21,
    height: 21,
    borderRadius:
      '50%',
    display: 'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    zIndex: 10,
    boxShadow:
      '0 2px 5px rgba(0,0,0,0.5)',
    overflow:
      'hidden'
  },

  tocPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 340,
    height: '100%',
    background:
      'rgba(15,15,20,0.96)',
    backdropFilter:
      'blur(14px)',
    zIndex: 500,
    transition:
      'transform .3s ease',
    padding: 20,
    color: '#fff',
    display: 'flex',
    flexDirection:
      'column'
  },

  tocHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems:
      'center'
  },

  tocTitle: {
    fontSize: 17
  },

  closeTocBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer'
  },

  tocTabGroup: {
    display: 'flex',
    borderBottom:
      '1px solid #333',
    marginBottom: 15
  },

  tocTabBtn: {
    flex: 1,
    padding: 10,
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer'
  },

  tocContent: {
    flex: 1,
    overflowY: 'auto'
  },

  listHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    marginBottom: 10
  },

  thumbGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2,1fr)',
    gap: 10
  },

  thumbCard: {
    background:
      'rgba(255,255,255,0.06)',
    borderRadius: 7,
    padding: 6
  },

  thumbImg: {
    width: '100%',
    height: 90,
    objectFit: 'cover',
    borderRadius: 5,
    cursor: 'pointer'
  },

  thumbAuthorText: {
    fontSize: 10,
    color: '#bbb'
  },

  clearAllBtn: {
    background:
      '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding:
      '5px 8px',
    cursor: 'pointer'
  },

  settingSection: {
    marginBottom: 25
  },

  settingLabel: {
    fontSize: 13,
    fontWeight:
      'bold',
    marginBottom: 10
  },

  presetGroup: {
    display: 'flex',
    gap: 8,
    marginBottom: 10
  },

  presetBtn: {
    width: 34,
    height: 34,
    borderRadius:
      '50%',
    border:
      '1px solid #fff',
    cursor: 'pointer'
  },

  bgUploadBtn: {
    display:
      'inline-block',
    marginTop: 12,
    padding:
      '7px 12px',
    background:
      '#333',
    color: '#fff',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 11
  },

  speedGroup: {
    display: 'flex',
    gap: 6
  },

  speedBtn: {
    flex: 1,
    padding: 7,
    border: 'none',
    borderRadius: 5,
    color: '#fff',
    cursor: 'pointer'
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background:
      'rgba(0,0,0,0.82)',
    zIndex: 1000,
    display: 'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    padding: 20
  },

  photoPicker: {
    width: 'min(700px,95vw)',
    maxHeight: '85vh',
    overflowY: 'auto',
    background:
      '#151515',
    borderRadius: 14,
    padding: 20,
    color: '#fff'
  },

  modalHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    fontSize: 18
  },

  closeBtnSmall: {
    width: 32,
    height: 32,
    borderRadius:
      '50%',
    border: 'none',
    background:
      '#444',
    color: '#fff',
    cursor: 'pointer'
  },

  photoPickerGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill,minmax(120px,1fr))',
    gap: 10
  },

  photoChoice: {
    border: '2px solid transparent',
    background:
      'transparent',
    padding: 0,
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer'
  },

  textDialog: {
    width:
      'min(450px,95vw)',
    background:
      '#171717',
    color: '#fff',
    padding: 22,
    borderRadius: 14,
    boxShadow:
      '0 20px 60px rgba(0,0,0,.5)'
  },

  textarea: {
    width: '100%',
    minHeight: 110,
    resize: 'none',
    background:
      '#222',
    color: '#fff',
    border:
      '1px solid #444',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    outline: 'none',
    marginBottom: 12
  },

  cancelBtn: {
    flex: 1,
    padding: 10,
    background:
      '#555',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer'
  },

  createTextBtn: {
    flex: 1,
    padding: 10,
    background:
      '#e67e22',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight:
      'bold'
  },

  modalCard: {
    background:
      '#111',
    padding: 15,
    borderRadius: 10,
    maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection:
      'column',
    alignItems:
      'center',
    gap: 10
  },

  modalImg: {
    maxWidth: '85vw',
    maxHeight: '75vh',
    objectFit:
      'contain',
    borderRadius: 6
  },

  closeBtn: {
    padding:
      '7px 18px',
    background:
      '#666',
    border: 'none',
    color: '#fff',
    borderRadius: 5,
    cursor: 'pointer'
  }
};