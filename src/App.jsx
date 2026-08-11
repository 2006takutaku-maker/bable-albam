import React, { useState, useEffect, useRef } from 'react';
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
// 1. Firebase設定
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
// 2. アバター
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
// 3. リアルなシャボン玉Canvas
// =========================================================

function BubbleCanvas({ src, size }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !src || !size) return;

    let cancelled = false;

    const render = async () => {
      const ctx = canvas.getContext('2d', {
        willReadFrequently: true
      });

      const img = new Image();

      // Firebase上のdataURLなら基本的に問題ありません。
      // 外部URL画像を使う場合にも対応。
      img.crossOrigin = 'anonymous';
      img.src = src;

      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      } catch (error) {
        console.error('画像読み込みエラー:', error);
        return;
      }

      if (cancelled) return;

      const w = Math.max(100, Math.floor(size));
      const h = w;

      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;
      const radius = w / 2 - 2;

      // -----------------------------------------------------
      // 元画像を正方形にトリミング
      // -----------------------------------------------------

      const sourceSize = Math.min(img.width, img.height);

      const sourceX = (img.width - sourceSize) / 2;
      const sourceY = (img.height - sourceSize) / 2;

      const offCanvas = document.createElement('canvas');

      // 処理量を抑える
      const sourceResolution = Math.min(600, sourceSize);

      offCanvas.width = sourceResolution;
      offCanvas.height = sourceResolution;

      const offCtx = offCanvas.getContext('2d', {
        willReadFrequently: true
      });

      offCtx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        sourceResolution,
        sourceResolution
      );

      let srcImgData;

      try {
        srcImgData = offCtx.getImageData(
          0,
          0,
          sourceResolution,
          sourceResolution
        );
      } catch (error) {
        console.error(
          '画像データ取得エラー。外部画像の場合CORSが原因の可能性があります。',
          error
        );
        return;
      }

      const srcData = srcImgData.data;

      // -----------------------------------------------------
      // 出力画像
      // -----------------------------------------------------

      const outImgData = ctx.createImageData(w, h);
      const outData = outImgData.data;

      // -----------------------------------------------------
      // 球面レンズ
      // -----------------------------------------------------

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - centerX;
          const dy = y - centerY;

          const distance = Math.sqrt(dx * dx + dy * dy);

          const outIndex = (y * w + x) * 4;

          if (distance > radius) {
            outData[outIndex] = 0;
            outData[outIndex + 1] = 0;
            outData[outIndex + 2] = 0;
            outData[outIndex + 3] = 0;
            continue;
          }

          // 0 = 中央
          // 1 = 外周
          const r = distance / radius;

          /*
           * 球面レンズの屈折。
           *
           * 中央：
           * ほぼ元画像
           *
           * 外周：
           * 強く引き伸ばして屈折
           */

          const sphere = Math.sqrt(
            Math.max(0, 1 - r * r)
          );

          const refractionStrength =
            0.18 +
            Math.pow(r, 1.8) * 0.95;

          // 外周に行くほど強く反転・圧縮
          const lensX =
            dx *
            (1 - refractionStrength * (0.72 + sphere * 0.18));

          const lensY =
            dy *
            (1 - refractionStrength * (0.72 + sphere * 0.18));

          // 少しだけ球面らしい中心寄り補正
          const curvedX =
            lensX * (0.72 + sphere * 0.28);

          const curvedY =
            lensY * (0.72 + sphere * 0.28);

          let sourceNX =
            (centerX - curvedX) / w;

          let sourceNY =
            (centerY - curvedY) / h;

          // 外周で少しだけ反転方向に強くする
          if (r > 0.72) {
            const edgeStrength = (r - 0.72) / 0.28;

            sourceNX =
              sourceNX * (1 - edgeStrength * 0.18) +
              (0.5 - sourceNX) * edgeStrength * 0.08;

            sourceNY =
              sourceNY * (1 - edgeStrength * 0.18) +
              (0.5 - sourceNY) * edgeStrength * 0.08;
          }

          const srcX = Math.floor(
            Math.max(
              0,
              Math.min(
                sourceResolution - 1,
                sourceNX * sourceResolution
              )
            )
          );

          const srcY = Math.floor(
            Math.max(
              0,
              Math.min(
                sourceResolution - 1,
                sourceNY * sourceResolution
              )
            )
          );

          const srcIndex =
            (srcY * sourceResolution + srcX) * 4;

          let red = srcData[srcIndex];
          let green = srcData[srcIndex + 1];
          let blue = srcData[srcIndex + 2];

          // -------------------------------------------------
          // 球面による明暗
          // -------------------------------------------------

          const lightX = -0.32;
          const lightY = -0.42;

          const normalizedX = dx / radius;
          const normalizedY = dy / radius;

          const normalZ = sphere;

          const dot =
            normalizedX * lightX +
            normalizedY * lightY +
            normalZ * 0.85;

          const lighting =
            Math.max(
              0.72,
              Math.min(1.18, 0.92 + dot * 0.18)
            );

          red *= lighting;
          green *= lighting;
          blue *= lighting;

          // -------------------------------------------------
          // 外周を少し暗くする
          // -------------------------------------------------

          const edgeDarkness =
            Math.max(0, (r - 0.72) / 0.28);

          const edgeFactor =
            1 - edgeDarkness * 0.22;

          red *= edgeFactor;
          green *= edgeFactor;
          blue *= edgeFactor;

          outData[outIndex] = Math.min(
            255,
            Math.max(0, red)
          );

          outData[outIndex + 1] = Math.min(
            255,
            Math.max(0, green)
          );

          outData[outIndex + 2] = Math.min(
            255,
            Math.max(0, blue)
          );

          // 球の透明感
          outData[outIndex + 3] = 235;
        }
      }

      ctx.putImageData(outImgData, 0, 0);

      // =====================================================
      // 4. シャボン玉の膜
      // =====================================================

      ctx.save();

      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
      );
      ctx.clip();

      // -----------------------------------------------------
      // 虹色の薄い膜
      // -----------------------------------------------------

      const rainbow = ctx.createConicGradient(
        -Math.PI / 2,
        centerX,
        centerY
      );

      rainbow.addColorStop(
        0.00,
        'rgba(255, 80, 130, 0.18)'
      );

      rainbow.addColorStop(
        0.16,
        'rgba(255, 210, 80, 0.14)'
      );

      rainbow.addColorStop(
        0.32,
        'rgba(80, 255, 180, 0.13)'
      );

      rainbow.addColorStop(
        0.48,
        'rgba(80, 220, 255, 0.15)'
      );

      rainbow.addColorStop(
        0.64,
        'rgba(100, 130, 255, 0.16)'
      );

      rainbow.addColorStop(
        0.80,
        'rgba(240, 90, 255, 0.16)'
      );

      rainbow.addColorStop(
        1.00,
        'rgba(255, 80, 130, 0.18)'
      );

      ctx.globalCompositeOperation = 'screen';

      ctx.fillStyle = rainbow;

      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // -----------------------------------------------------
      // 外周の虹色リム
      // -----------------------------------------------------

      const rimGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.72,
        centerX,
        centerY,
        radius
      );

      rimGradient.addColorStop(
        0,
        'rgba(255,255,255,0)'
      );

      rimGradient.addColorStop(
        0.72,
        'rgba(255,255,255,0)'
      );

      rimGradient.addColorStop(
        0.87,
        'rgba(150,230,255,0.06)'
      );

      rimGradient.addColorStop(
        0.94,
        'rgba(255,180,255,0.24)'
      );

      rimGradient.addColorStop(
        1,
        'rgba(255,255,255,0.52)'
      );

      ctx.fillStyle = rimGradient;

      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // =====================================================
      // 5. 大きな反射光
      // =====================================================

      const highlightX =
        centerX - radius * 0.32;

      const highlightY =
        centerY - radius * 0.34;

      const highlightGradient =
        ctx.createRadialGradient(
          highlightX,
          highlightY,
          0,
          highlightX,
          highlightY,
          radius * 0.48
        );

      highlightGradient.addColorStop(
        0,
        'rgba(255,255,255,0.92)'
      );

      highlightGradient.addColorStop(
        0.08,
        'rgba(255,255,255,0.75)'
      );

      highlightGradient.addColorStop(
        0.25,
        'rgba(255,255,255,0.28)'
      );

      highlightGradient.addColorStop(
        0.65,
        'rgba(255,255,255,0.06)'
      );

      highlightGradient.addColorStop(
        1,
        'rgba(255,255,255,0)'
      );

      ctx.globalCompositeOperation = 'screen';

      ctx.fillStyle = highlightGradient;

      ctx.beginPath();
      ctx.arc(
        highlightX,
        highlightY,
        radius * 0.46,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // =====================================================
      // 6. 小さい反射光
      // =====================================================

      const smallHighlight = ctx.createRadialGradient(
        centerX + radius * 0.28,
        centerY - radius * 0.34,
        0,
        centerX + radius * 0.28,
        centerY - radius * 0.34,
        radius * 0.18
      );

      smallHighlight.addColorStop(
        0,
        'rgba(255,255,255,0.72)'
      );

      smallHighlight.addColorStop(
        0.35,
        'rgba(255,255,255,0.25)'
      );

      smallHighlight.addColorStop(
        1,
        'rgba(255,255,255,0)'
      );

      ctx.fillStyle = smallHighlight;

      ctx.beginPath();

      ctx.arc(
        centerX + radius * 0.28,
        centerY - radius * 0.34,
        radius * 0.17,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // =====================================================
      // 7. 曲線状の反射
      // =====================================================

      ctx.strokeStyle =
        'rgba(255,255,255,0.48)';

      ctx.lineWidth = Math.max(
        2,
        radius * 0.018
      );

      ctx.beginPath();

      ctx.arc(
        centerX - radius * 0.04,
        centerY - radius * 0.02,
        radius * 0.82,
        Math.PI * 1.08,
        Math.PI * 1.63
      );

      ctx.stroke();

      // =====================================================
      // 8. 内側の陰影
      // =====================================================

      const shadowGradient =
        ctx.createRadialGradient(
          centerX,
          centerY,
          radius * 0.42,
          centerX,
          centerY,
          radius
        );

      shadowGradient.addColorStop(
        0,
        'rgba(0,0,0,0)'
      );

      shadowGradient.addColorStop(
        0.68,
        'rgba(0,0,0,0.015)'
      );

      shadowGradient.addColorStop(
        0.88,
        'rgba(0,0,0,0.12)'
      );

      shadowGradient.addColorStop(
        1,
        'rgba(0,0,0,0.42)'
      );

      ctx.globalCompositeOperation = 'multiply';

      ctx.fillStyle = shadowGradient;

      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // =====================================================
      // 9. 外周の白い輪郭
      // =====================================================

      ctx.globalCompositeOperation = 'screen';

      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        radius - 1,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        'rgba(255,255,255,0.58)';

      ctx.lineWidth =
        Math.max(1.5, radius * 0.012);

      ctx.stroke();

      // =====================================================
      // 10. 下側の淡い反射
      // =====================================================

      const bottomGlow =
        ctx.createRadialGradient(
          centerX + radius * 0.05,
          centerY + radius * 0.38,
          0,
          centerX + radius * 0.05,
          centerY + radius * 0.38,
          radius * 0.55
        );

      bottomGlow.addColorStop(
        0,
        'rgba(100,220,255,0.12)'
      );

      bottomGlow.addColorStop(
        0.5,
        'rgba(160,100,255,0.05)'
      );

      bottomGlow.addColorStop(
        1,
        'rgba(255,255,255,0)'
      );

      ctx.fillStyle = bottomGlow;

      ctx.beginPath();

      ctx.arc(
        centerX + radius * 0.05,
        centerY + radius * 0.38,
        radius * 0.55,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

      // =====================================================
      // 11. 最終的な薄い外側グロー
      // =====================================================

      ctx.save();

      ctx.shadowColor =
        'rgba(150,220,255,0.55)';

      ctx.shadowBlur =
        Math.max(5, radius * 0.06);

      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        radius - 2,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        'rgba(255,255,255,0.18)';

      ctx.lineWidth =
        Math.max(1, radius * 0.01);

      ctx.stroke();

      ctx.restore();
    };

    render();

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
        pointerEvents: 'none',
        borderRadius: '50%',
        display: 'block'
      }}
    />
  );
}

// =========================================================
// 4. メインアプリ
// =========================================================

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser =
      localStorage.getItem('currentUser');

    return savedUser
      ? JSON.parse(savedUser)
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
    useState(() => {
      return localStorage.getItem('currentUser')
        ? 'menu'
        : 'auth';
    });

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

  const [bubbles, setBubbles] =
    useState([]);

  const [albumSettings, setAlbumSettings] =
    useState({
      bgType: 'preset',
      bgColor: '#0f2027',
      bgImage: null,
      presetBg:
        'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
      genres: [
        'すべて',
        '日常',
        '旅行',
        'イベント'
      ]
    });

  const [selectedImage, setSelectedImage] =
    useState(null);

  const [isTocOpen, setIsTocOpen] =
    useState(false);

  const [tocActiveTab, setTocActiveTab] =
    useState('photos');

  const [speedMode, setSpeedMode] =
    useState('normal');

  // =======================================================
  // アルバムキー
  // =======================================================

  const getAlbumKey = () => {
    if (activeTab === 'private') {
      return `private_${currentUser?.username}`;
    }

    return `shared_${roomNumber}`;
  };

  const albumKey = getAlbumKey();

  // =======================================================
  // Wake Lock
  // =======================================================

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
      } catch (err) {
        console.log(
          'Wake Lock エラー:',
          err
        );
      }
    };

    if (currentScreen === 'album') {
      requestWakeLock();
    }

    return () => {
      if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
      }
    };
  }, [currentScreen]);

  // =======================================================
  // Firestoreリアルタイム同期
  // =======================================================

  useEffect(() => {
    if (
      currentScreen !== 'album' ||
      !albumKey ||
      !currentUser
    ) {
      return;
    }

    const bubblesRef = collection(
      db,
      'albums',
      albumKey,
      'bubbles'
    );

    const unsubscribeBubbles =
      onSnapshot(
        bubblesRef,
        (snapshot) => {
          const loadedBubbles =
            snapshot.docs.map(
              (docSnap) => ({
                id: docSnap.id,
                ...docSnap.data()
              })
            );

          setBubbles(loadedBubbles);
        },
        (error) => {
          console.error(
            'Bubble同期エラー:',
            error
          );
        }
      );

    const settingsRef = doc(
      db,
      'albums',
      albumKey
    );

    const unsubscribeSettings =
      onSnapshot(
        settingsRef,
        async (docSnap) => {
          if (docSnap.exists()) {
            const data =
              docSnap.data();

            setAlbumSettings(
              (prev) => ({
                ...prev,
                ...data
              })
            );

            if (
              data.genres &&
              Array.isArray(data.genres)
            ) {
              setGenres(data.genres);
            }
          } else {
            const defaultSettings = {
              bgType: 'preset',
              bgColor: '#0f2027',
              bgImage: null,
              presetBg:
                activeTab === 'private'
                  ? 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
                  : 'linear-gradient(180deg, #141e30 0%, #243b55 100%)',
              genres: [
                'すべて',
                '日常',
                '旅行',
                'イベント'
              ]
            };

            setAlbumSettings(
              defaultSettings
            );

            try {
              await setDoc(
                settingsRef,
                defaultSettings,
                { merge: true }
              );
            } catch (error) {
              console.error(
                '初期設定保存エラー:',
                error
              );
            }
          }
        },
        (error) => {
          console.error(
            '設定同期エラー:',
            error
          );
        }
      );

    let unsubscribeMembers =
      () => {};

    if (activeTab === 'shared') {
      const membersRef =
        collection(
          db,
          'albums',
          albumKey,
          'members'
        );

      unsubscribeMembers =
        onSnapshot(
          membersRef,
          (snapshot) => {
            const loadedMembers =
              snapshot.docs.map(
                (docSnap) =>
                  docSnap.data()
              );

            setRoomMembers(
              loadedMembers
            );
          }
        );

      const myMemberRef = doc(
        db,
        'albums',
        albumKey,
        'members',
        currentUser.username
      );

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
      ).catch((error) => {
        console.error(
          'メンバー登録エラー:',
          error
        );
      });
    }

    return () => {
      unsubscribeBubbles();
      unsubscribeSettings();
      unsubscribeMembers();
    };
  }, [
    currentScreen,
    albumKey,
    activeTab,
    currentUser
  ]);

  // =======================================================
  // 設定更新
  // =======================================================

  const updateSettings = async (
    newSettings
  ) => {
    const updated = {
      ...albumSettings,
      ...newSettings
    };

    setAlbumSettings(updated);

    try {
      const settingsRef = doc(
        db,
        'albums',
        albumKey
      );

      await setDoc(
        settingsRef,
        updated,
        { merge: true }
      );
    } catch (error) {
      console.error(
        '設定保存エラー:',
        error
      );
    }
  };

  // =======================================================
  // ジャンル追加
  // =======================================================

  const handleAddGenre = () => {
    const newGenre = window.prompt(
      '新しいジャンル名を入力してください:'
    );

    if (
      newGenre &&
      newGenre.trim()
    ) {
      const trimmed =
        newGenre.trim();

      if (!genres.includes(trimmed)) {
        const nextGenres = [
          ...genres,
          trimmed
        ];

        setGenres(nextGenres);
        setSelectedGenre(trimmed);

        updateSettings({
          genres: nextGenres
        });
      } else {
        window.alert(
          'そのジャンルは既に存在します。'
        );
      }
    }
  };

  // =======================================================
  // アバターアップロード
  // =======================================================

  const handleCustomAvatarUpload = (
    e
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = (event) => {
      setCustomAvatar({
        type: 'image',
        url: event.target.result
      });

      setSelectedAvatarIdx(-1);
    };

    reader.readAsDataURL(file);
  };

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

  // =======================================================
  // 認証
  // =======================================================

  const handleAuth = async (e) => {
    e.preventDefault();

    const username =
      usernameInput.trim();

    const password =
      passwordInput.trim();

    if (!username || !password) {
      window.alert(
        'ユーザー名とパスワードを入力してください'
      );
      return;
    }

    try {
      const userRef = doc(
        db,
        'users',
        username
      );

      const userSnap =
        await getDoc(userRef);

      if (authMode === 'register') {
        if (userSnap.exists()) {
          window.alert(
            'このユーザー名は既に使われています。'
          );
          return;
        }

        const newUser = {
          username,
          password,
          avatar:
            getSelectedAvatar()
        };

        await setDoc(
          userRef,
          newUser
        );

        const userObj = {
          username,
          avatar:
            newUser.avatar
        };

        setCurrentUser(userObj);

        localStorage.setItem(
          'currentUser',
          JSON.stringify(userObj)
        );

        window.alert(
          'アカウントを作成しました！'
        );

        setCurrentScreen('menu');
      } else {
        if (!userSnap.exists()) {
          window.alert(
            'ユーザーが存在しません。新規登録を行ってください。'
          );
          return;
        }

        const userData =
          userSnap.data();

        if (
          userData.password !==
          password
        ) {
          window.alert(
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
    } catch (err) {
      console.error(err);

      window.alert(
        '認証処理中にエラーが発生しました。'
      );
    }
  };

  // =======================================================
  // ログアウト
  // =======================================================

  const handleLogout = () => {
    setCurrentUser(null);

    localStorage.removeItem(
      'currentUser'
    );

    setCurrentScreen('auth');
    setIsTocOpen(false);
  };

  // =======================================================
  // アルバムへ
  // =======================================================

  const enterPrivateAlbum = () => {
    setActiveTab('private');
    setSelectedGenre('すべて');
    setCurrentScreen('album');
  };

  const enterSharedAlbum = (e) => {
    e.preventDefault();

    if (!roomInput.trim()) {
      window.alert(
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
  // 写真追加
  // =======================================================

  const handleImageUpload = (e) => {
    const files =
      Array.from(
        e.target.files || []
      );

    if (files.length === 0) return;

    const genreToAssign =
      selectedGenre === 'すべて'
        ? genres[1] || '未分類'
        : selectedGenre;

    files.forEach((file) => {
      const reader =
        new FileReader();

      reader.onload = (event) => {
        createBubble(
          event.target.result,
          genreToAssign
        );
      };

      reader.readAsDataURL(file);
    });

    // 同じファイルをもう一度選択可能にする
    e.target.value = '';
  };

  // =======================================================
  // 背景画像
  // =======================================================

  const handleBgImageUpload = (
    e
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = (event) => {
      updateSettings({
        bgImage:
          event.target.result,
        bgType: 'image'
      });
    };

    reader.readAsDataURL(file);
  };

  // =======================================================
  // 浮遊速度
  // =======================================================

  const getBaseDuration = () => {
    if (speedMode === 'slow') {
      return 48;
    }

    if (speedMode === 'fast') {
      return 22;
    }

    return 34;
  };

  // =======================================================
  // シャボン玉生成
  // =======================================================

  const createBubble = async (
    imgSrc,
    genre
  ) => {
    const depth =
      Math.random();

    /*
     * ここを大きく変更。
     *
     * 以前：
     * 80〜200px
     *
     * 現在：
     * 140〜360px
     */

    const size =
      Math.floor(
        depth * 220
      ) + 140;

    const opacity =
      0.55 + depth * 0.45;

    const zIndex =
      Math.floor(
        depth * 100
      );

    const newBubbleData = {
      src: imgSrc,

      genre:
        genre || '未分類',

      size,

      opacity,

      zIndex,

      depth,

      author:
        currentUser.username,

      authorAvatar:
        currentUser.avatar,

      left:
        Math.floor(
          Math.random() * 85
        ) + 5,

      swayDuration:
        Math.floor(
          Math.random() * 4
        ) + 3,

      delay:
        Math.random() * 3,

      createdAt:
        Date.now()
    };

    try {
      const bubblesRef =
        collection(
          db,
          'albums',
          albumKey,
          'bubbles'
        );

      await addDoc(
        bubblesRef,
        newBubbleData
      );
    } catch (error) {
      console.error(
        '写真追加エラー:',
        error
      );

      window.alert(
        '写真の保存に失敗しました。'
      );
    }
  };

  // =======================================================
  // アニメーション終了
  // =======================================================

  const handleAnimationEnd = (
    id
  ) => {
    setBubbles((prev) =>
      prev.map((b) => {
        if (b.id !== id) {
          return b;
        }

        const depth =
          Math.random();

        return {
          ...b,

          depth,

          left:
            Math.floor(
              Math.random() * 85
            ) + 5,

          // 大型サイズを維持
          size:
            Math.floor(
              depth * 220
            ) + 140,

          opacity:
            0.55 + depth * 0.45,

          zIndex:
            Math.floor(
              depth * 100
            )
        };
      })
    );
  };

  // =======================================================
  // 写真削除
  // =======================================================

  const handleDeleteBubble =
    async (id) => {
      try {
        const bubbleRef =
          doc(
            db,
            'albums',
            albumKey,
            'bubbles',
            id
          );

        await deleteDoc(
          bubbleRef
        );
      } catch (error) {
        console.error(
          '削除エラー:',
          error
        );
      }
    };

  // =======================================================
  // 全削除
  // =======================================================

  const handleClearAll =
    async () => {
      if (
        !window.confirm(
          'このアルバムの写真をすべて削除しますか？'
        )
      ) {
        return;
      }

      try {
        const bubblesRef =
          collection(
            db,
            'albums',
            albumKey,
            'bubbles'
          );

        const snapshot =
          await getDocs(
            bubblesRef
          );

        const batch =
          writeBatch(db);

        snapshot.docs.forEach(
          (docSnap) => {
            batch.delete(
              docSnap.ref
            );
          }
        );

        await batch.commit();

        setIsTocOpen(false);
      } catch (error) {
        console.error(
          '全削除エラー:',
          error
        );
      }
    };

  // =======================================================
  // 背景
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
          backgroundImage: `url(${albumSettings.bgImage})`,
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
  // アバター表示
  // =======================================================

  const renderAvatarIcon = (
    avatarObj,
    sizeStyle = {}
  ) => {
    if (!avatarObj) {
      return null;
    }

    if (
      avatarObj.type ===
      'image'
    ) {
      return (
        <img
          src={avatarObj.url}
          alt="avatar"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
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
        {avatarObj.emoji}
      </span>
    );
  };

  // =======================================================
  // ジャンルフィルター
  // =======================================================

  const filteredBubbles =
    selectedGenre === 'すべて'
      ? bubbles
      : bubbles.filter(
          (b) =>
            b.genre ===
            selectedGenre
        );

  // =======================================================
  // 画面1：ログイン
  // =======================================================

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
                borderBottom:
                  authMode ===
                  'login'
                    ? '2px solid #007bff'
                    : 'none',
                color:
                  authMode ===
                  'login'
                    ? '#fff'
                    : '#aaa'
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
                borderBottom:
                  authMode ===
                  'register'
                    ? '2px solid #007bff'
                    : 'none',
                color:
                  authMode ===
                  'register'
                    ? '#fff'
                    : '#aaa'
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
                    color:
                      '#ccc',
                    fontSize:
                      '12px'
                  }}
                >
                  アイコンを選択 /
                  アップロード:
                </span>

                <div
                  style={
                    styles.avatarGrid
                  }
                >
                  {AVATARS.map(
                    (
                      av,
                      idx
                    ) => (
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
                        {
                          av.emoji
                        }
                      </div>
                    )
                  )}

                  <label
                    style={{
                      ...styles.avatarBadge,
                      backgroundColor:
                        '#555',
                      border:
                        selectedAvatarIdx ===
                        -1
                          ? '2px solid #007bff'
                          : '2px solid transparent',
                      overflow:
                        'hidden'
                    }}
                    title="画像をアップロード"
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
                            'cover'
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
              onChange={(e) =>
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
              onChange={(e) =>
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

  // =======================================================
  // 画面2：メニュー
  // =======================================================

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
              gap: '8px'
            }}
          >
            <span
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
            </span>

            <span>
              <strong>
                {
                  currentUser?.username
                }
              </strong>
            </span>
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
            color:
              '#fff',
            marginBottom:
              '30px'
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
            onClick={
              enterPrivateAlbum
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
              自分だけの写真が入る専用のアルバムです。
            </p>

            <button
              style={
                styles.enterBtn
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
                onChange={(e) =>
                  setRoomInput(
                    e.target.value
                  )
                }
                style={{
                  ...styles.input,
                  marginBottom:
                    '10px',
                  width:
                    '100%',
                  boxSizing:
                    'border-box'
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
  // 画面3：シャボン玉アルバム
  // =======================================================

  return (
    <div
      style={
        getContainerStyle()
      }
    >
      {/* ================================================
          ヘッダー
      ================================================= */}

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
            ◀ メニューに戻る
          </button>

          <div
            style={
              styles.badge
            }
          >
            {activeTab ===
            'private'
              ? '🔒 プライベート'
              : `🌐 共有ルーム [${roomNumber}]`}
          </div>

          {activeTab ===
            'shared' && (
            <div
              style={
                styles.membersBar
              }
            >
              <span
                style={{
                  fontSize:
                    '11px',
                  color:
                    '#ccc',
                  marginRight:
                    '4px'
                }}
              >
                参加中:
              </span>

              {roomMembers.map(
                (m, i) => (
                  <div
                    key={i}
                    style={
                      styles.memberTag
                    }
                  >
                    <div
                      style={{
                        ...styles.avatarBadgeSmall,
                        backgroundColor:
                          m.avatar
                            ?.bg ||
                          'transparent'
                      }}
                    >
                      {renderAvatarIcon(
                        m.avatar
                      )}
                    </div>

                    <span
                      style={
                        styles.memberName
                      }
                    >
                      {
                        m.username
                      }
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          <button
            style={
              styles.tocToggleBtn
            }
            onClick={() =>
              setIsTocOpen(
                !isTocOpen
              )
            }
          >
            📖 もくじ・設定
          </button>

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
        </div>

        {/* =============================================
            ジャンル
        ============================================== */}

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
            (g) => (
              <button
                key={g}
                style={{
                  ...styles.genreTabBtn,
                  backgroundColor:
                    selectedGenre ===
                    g
                      ? '#007bff'
                      : 'rgba(255,255,255,0.15)',
                  color:
                    '#fff',
                  fontWeight:
                    selectedGenre ===
                    g
                      ? 'bold'
                      : 'normal'
                }}
                onClick={() =>
                  setSelectedGenre(
                    g
                  )
                }
              >
                {g}
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

      {/* ================================================
          目次パネル
      ================================================= */}

      <div
        style={{
          ...styles.tocPanel,
          transform:
            isTocOpen
              ? 'translateX(0)'
              : 'translateX(-100%)'
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
            style={{
              ...styles.tocTabBtn,
              borderBottom:
                tocActiveTab ===
                'photos'
                  ? '2px solid #007bff'
                  : 'none',
              color:
                tocActiveTab ===
                'photos'
                  ? '#fff'
                  : '#888',
              fontWeight:
                tocActiveTab ===
                'photos'
                  ? 'bold'
                  : 'normal'
            }}
            onClick={() =>
              setTocActiveTab(
                'photos'
              )
            }
          >
            📷 写真一覧 (
            {
              filteredBubbles.length
            }
            )
          </button>

          <button
            style={{
              ...styles.tocTabBtn,
              borderBottom:
                tocActiveTab ===
                'settings'
                  ? '2px solid #007bff'
                  : 'none',
              color:
                tocActiveTab ===
                'settings'
                  ? '#fff'
                  : '#888',
              fontWeight:
                tocActiveTab ===
                'settings'
                  ? 'bold'
                  : 'normal'
            }}
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
            <div
              style={
                styles.tocListContainer
              }
            >
              <div
                style={
                  styles.listHeader
                }
              >
                <span
                  style={
                    styles.settingLabel
                  }
                >
                  📷 [{selectedGenre}]
                  の写真
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

              {filteredBubbles.length ===
              0 ? (
                <p
                  style={
                    styles.emptyTocText
                  }
                >
                  このジャンルには写真がありません
                </p>
              ) : (
                <div
                  style={
                    styles.thumbGrid
                  }
                >
                  {filteredBubbles.map(
                    (b, idx) => (
                      <div
                        key={
                          b.id
                        }
                        style={
                          styles.thumbCard
                        }
                      >
                        <img
                          src={
                            b.src
                          }
                          alt={`photo-${idx}`}
                          style={
                            styles.thumbImg
                          }
                          onClick={() =>
                            setSelectedImage(
                              b.src
                            )
                          }
                        />

                        <div
                          style={
                            styles.thumbAuthorBox
                          }
                        >
                          <div
                            style={{
                              ...styles.avatarBadgeSmall,
                              backgroundColor:
                                b
                                  .authorAvatar
                                  ?.bg ||
                                'transparent'
                            }}
                          >
                            {renderAvatarIcon(
                              b.authorAvatar
                            )}
                          </div>

                          <span
                            style={
                              styles.thumbAuthorText
                            }
                          >
                            {
                              b.author ||
                              '不明'
                            }
                          </span>
                        </div>

                        <button
                          style={
                            styles.deleteThumbBtn
                          }
                          onClick={() =>
                            handleDeleteBubble(
                              b.id
                            )
                          }
                        >
                          削除
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {tocActiveTab ===
            'settings' && (
            <div>
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
                  🎨 背景スタイルの変更
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
                        'linear-gradient(180deg, #0f2027, #2c5364)'
                    }}
                    onClick={() =>
                      updateSettings({
                        presetBg:
                          'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
                        bgType:
                          'preset'
                      })
                    }
                  />

                  <button
                    style={{
                      ...styles.presetBtn,
                      background:
                        'linear-gradient(180deg, #1a2a6c, #b21f1f, #fdbb2d)'
                    }}
                    onClick={() =>
                      updateSettings({
                        presetBg:
                          'linear-gradient(180deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)',
                        bgType:
                          'preset'
                      })
                    }
                  />

                  <button
                    style={{
                      ...styles.presetBtn,
                      background:
                        'linear-gradient(180deg, #130cb7, #52e5e7)'
                    }}
                    onClick={() =>
                      updateSettings({
                        presetBg:
                          'linear-gradient(180deg, #130cb7 0%, #52e5e7 100%)',
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
                          '#111111',
                        bgType:
                          'color'
                      })
                    }
                  />
                </div>

                <div
                  style={
                    styles.colorPickerRow
                  }
                >
                  <span
                    style={
                      styles.subLabel
                    }
                  >
                    カラー単色指定:
                  </span>

                  <input
                    type="color"
                    value={
                      albumSettings.bgColor ||
                      '#0f2027'
                    }
                    onChange={(e) =>
                      updateSettings({
                        bgColor:
                          e.target
                            .value,
                        bgType:
                          'color'
                      })
                    }
                    style={
                      styles.colorInput
                    }
                  />
                </div>

                <div
                  style={{
                    marginTop:
                      '12px'
                  }}
                >
                  <label
                    style={
                      styles.bgUploadBtn
                    }
                  >
                    🖼️ 背景画像をアップロード

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
                  🫧 浮遊スピードの設定
                </div>

                <div
                  style={
                    styles.speedGroup
                  }
                >
                  <button
                    style={{
                      ...styles.speedBtn,
                      backgroundColor:
                        speedMode ===
                        'slow'
                          ? '#007bff'
                          : '#444'
                    }}
                    onClick={() =>
                      setSpeedMode(
                        'slow'
                      )
                    }
                  >
                    ゆったり
                  </button>

                  <button
                    style={{
                      ...styles.speedBtn,
                      backgroundColor:
                        speedMode ===
                        'normal'
                          ? '#007bff'
                          : '#444'
                    }}
                    onClick={() =>
                      setSpeedMode(
                        'normal'
                      )
                    }
                  >
                    標準
                  </button>

                  <button
                    style={{
                      ...styles.speedBtn,
                      backgroundColor:
                        speedMode ===
                        'fast'
                          ? '#007bff'
                          : '#444'
                    }}
                    onClick={() =>
                      setSpeedMode(
                        'fast'
                      )
                    }
                  >
                    にぎやか
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================
          写真なし
      ================================================= */}

      {filteredBubbles.length ===
        0 && (
        <div
          style={
            styles.emptyText
          }
        >
          【{selectedGenre}】ジャンルの写真はありません
          <br />
          「＋ 写真を追加」から選択中のジャンルに画像を追加できます✨
        </div>
      )}

      {/* ================================================
          シャボン玉
      ================================================= */}

      <div
        style={
          styles.stage
        }
      >
        {filteredBubbles.map(
          (b) => {
            const depth =
              b.depth ??
              0.5;

            const duration =
              Math.floor(
                (
                  1.2 -
                  depth *
                    0.4
                ) *
                  getBaseDuration()
              );

            const bubbleSize =
              b.size ||
              Math.floor(
                depth * 220
              ) + 140;

            return (
              <div
                key={b.id}
                onClick={() =>
                  setSelectedImage(
                    b.src
                  )
                }
                onAnimationEnd={() =>
                  handleAnimationEnd(
                    b.id
                  )
                }
                style={{
                  ...styles.bubbleWrapper,

                  left: `${b.left}%`,

                  width: `${bubbleSize}px`,

                  height: `${bubbleSize}px`,

                  zIndex:
                    b.zIndex,

                  opacity:
                    b.opacity,

                  animation: `
                    floatUp ${duration}s linear ${b.delay}s infinite,
                    sway ${b.swayDuration}s ease-in-out infinite alternate
                  `
                }}
              >
                <div
                  style={
                    styles.bubbleGlass
                  }
                >
                  <BubbleCanvas
                    src={b.src}
                    size={
                      bubbleSize
                    }
                  />

                  {b.authorAvatar && (
                    <div
                      title={`${b.author || '不明'} (${b.genre || '未分類'})`}
                      style={{
                        ...styles.bubbleAuthorBadge,
                        backgroundColor:
                          b
                            .authorAvatar
                            ?.bg ||
                          'transparent'
                      }}
                    >
                      {renderAvatarIcon(
                        b.authorAvatar,
                        {
                          fontSize:
                            '10px'
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* ================================================
          写真拡大モーダル
      ================================================= */}

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
            onClick={(e) =>
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

      {/* ================================================
          CSSアニメーション
      ================================================= */}

      <style>
        {`
          @keyframes floatUp {
            0% {
              transform: translateY(110vh);
            }

            100% {
              transform: translateY(-420px);
            }
          }

          @keyframes sway {
            0% {
              margin-left: -28px;
            }

            50% {
              margin-left: 12px;
            }

            100% {
              margin-left: 28px;
            }
          }
        `}
      </style>
    </div>
  );
}

// =========================================================
// 5. スタイル
// =========================================================

const styles = {
  authContainer: {
    width: '100vw',
    height: '100vh',
    background:
      'linear-gradient(135deg, #111e2e, #0a1118)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif'
  },

  authCard: {
    backgroundColor:
      'rgba(255,255,255,0.05)',
    backdropFilter:
      'blur(10px)',
    padding: '30px',
    borderRadius: '12px',
    width: '320px',
    boxShadow:
      '0 8px 32px rgba(0,0,0,0.3)',
    border:
      '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center'
  },

  appTitle: {
    color: '#fff',
    fontSize: '22px',
    marginBottom: '20px'
  },

  authTabGroup: {
    display: 'flex',
    justifyContent:
      'space-around',
    marginBottom: '20px'
  },

  authTabBtn: {
    background: 'none',
    border: 'none',
    padding:
      '8px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },

  form: {
    display: 'flex',
    flexDirection:
      'column',
    gap: '12px'
  },

  avatarPickerSection: {
    display: 'flex',
    flexDirection:
      'column',
    gap: '8px',
    marginBottom: '8px'
  },

  avatarGrid: {
    display: 'flex',
    justifyContent:
      'center',
    gap: '8px',
    flexWrap: 'wrap'
  },

  avatarBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    cursor: 'pointer',
    fontSize: '18px'
  },

  avatarBadgeSmall: {
    width: '22px',
    height: '22px',
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
    borderRadius: '6px',
    border:
      '1px solid rgba(255,255,255,0.2)',
    backgroundColor:
      'rgba(0,0,0,0.2)',
    color: '#fff',
    fontSize: '13px',
    outline: 'none'
  },

  submitBtn: {
    padding: '10px',
    backgroundColor:
      '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    marginTop: '10px'
  },

  // -------------------------------------------------------
  // Menu
  // -------------------------------------------------------

  menuContainer: {
    width: '100vw',
    height: '100vh',
    background:
      'linear-gradient(135deg, #0f2027, #2c5364)',
    display: 'flex',
    flexDirection:
      'column',
    alignItems:
      'center',
    justifyContent:
      'center',
    fontFamily: 'sans-serif',
    position: 'relative'
  },

  menuHeader: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    color: '#fff',
    fontSize: '13px',
    display: 'flex',
    gap: '15px',
    alignItems:
      'center'
  },

  logoutBtn: {
    backgroundColor:
      'rgba(255,255,255,0.2)',
    color: '#fff',
    border: 'none',
    padding:
      '4px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px'
  },

  menuGrid: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    justifyContent:
      'center'
  },

  menuCard: {
    backgroundColor:
      'rgba(255,255,255,0.08)',
    backdropFilter:
      'blur(8px)',
    width: '240px',
    padding: '24px',
    borderRadius: '12px',
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
    fontSize: '40px',
    marginBottom: '10px'
  },

  enterBtn: {
    padding:
      '8px 20px',
    backgroundColor:
      '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
    marginTop: '10px',
    width: '100%'
  },

  // -------------------------------------------------------
  // Album
  // -------------------------------------------------------

  container: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    fontFamily: 'sans-serif',
    transition:
      'background 0.5s ease'
  },

  header: {
    position: 'absolute',
    top: '15px',
    left: '15px',
    zIndex: 150,
    display: 'flex',
    flexDirection:
      'column',
    gap: '10px',
    maxWidth:
      'calc(100vw - 30px)'
  },

  topControlRow: {
    display: 'flex',
    gap: '10px',
    alignItems:
      'center',
    flexWrap: 'wrap'
  },

  backMenuBtn: {
    padding:
      '6px 12px',
    backgroundColor:
      'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius:
      '15px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    backdropFilter:
      'blur(5px)'
  },

  badge: {
    padding:
      '6px 12px',
    backgroundColor:
      'rgba(0,0,0,0.4)',
    borderRadius:
      '15px',
    color: '#fff',
    fontSize: '12px',
    backdropFilter:
      'blur(5px)'
  },

  membersBar: {
    display: 'flex',
    alignItems:
      'center',
    gap: '5px',
    backgroundColor:
      'rgba(0,0,0,0.3)',
    padding:
      '4px 8px',
    borderRadius:
      '15px',
    maxWidth:
      '60vw',
    overflowX:
      'auto'
  },

  memberTag: {
    display: 'flex',
    alignItems:
      'center',
    gap: '3px',
    backgroundColor:
      'rgba(255,255,255,0.15)',
    padding:
      '2px 6px',
    borderRadius:
      '10px',
    flexShrink: 0
  },

  memberName: {
    fontSize: '10px',
    color: '#fff'
  },

  tocToggleBtn: {
    padding:
      '6px 12px',
    backgroundColor:
      '#6c757d',
    border: 'none',
    borderRadius:
      '15px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer'
  },

  uploadBtn: {
    padding:
      '6px 12px',
    backgroundColor:
      '#28a745',
    borderRadius:
      '15px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  genreTabBar: {
    display: 'flex',
    gap: '6px',
    alignItems:
      'center',
    flexWrap: 'wrap'
  },

  genreLabel: {
    color: '#fff',
    fontSize: '12px',
    marginRight: '4px'
  },

  genreTabBtn: {
    padding:
      '4px 10px',
    border: 'none',
    borderRadius:
      '12px',
    fontSize: '11px',
    cursor: 'pointer'
  },

  addGenreBtn: {
    padding:
      '4px 10px',
    backgroundColor:
      'rgba(255,255,255,0.2)',
    border:
      '1px dashed #fff',
    borderRadius:
      '12px',
    color: '#fff',
    fontSize: '11px',
    cursor: 'pointer'
  },

  // -------------------------------------------------------
  // Bubble
  // -------------------------------------------------------

  stage: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden'
  },

  bubbleWrapper: {
    position: 'absolute',
    bottom: '-380px',
    cursor: 'pointer',
    willChange:
      'transform',
    transform:
      'translateZ(0)'
  },

  bubbleGlass: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    filter:
      'drop-shadow(0 10px 25px rgba(0,0,0,0.38))',
    overflow: 'visible'
  },

  bubbleAuthorBadge: {
    position: 'absolute',
    bottom: '5px',
    right: '5px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    boxShadow:
      '0 2px 6px rgba(0,0,0,0.5)',
    zIndex: 10,
    border:
      '1px solid rgba(255,255,255,0.65)'
  },

  emptyText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform:
      'translate(-50%, -50%)',
    color:
      'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontSize: '14px',
    pointerEvents: 'none',
    lineHeight: '1.6',
    zIndex: 2
  },

  // -------------------------------------------------------
  // TOC
  // -------------------------------------------------------

  tocPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '320px',
    height: '100%',
    backgroundColor:
      'rgba(20,20,20,0.95)',
    backdropFilter:
      'blur(10px)',
    zIndex: 200,
    transition:
      'transform 0.3s ease',
    padding: '20px',
    boxSizing:
      'border-box',
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
      'center',
    marginBottom: '15px'
  },

  tocTitle: {
    fontSize: '16px',
    margin: 0
  },

  closeTocBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer'
  },

  tocTabGroup: {
    display: 'flex',
    borderBottom:
      '1px solid #333',
    marginBottom: '15px'
  },

  tocTabBtn: {
    flex: 1,
    background: 'none',
    border: 'none',
    padding: '8px',
    cursor: 'pointer',
    fontSize: '12px'
  },

  tocContent: {
    flex: 1,
    overflowY: 'auto'
  },

  tocListContainer: {
    width: '100%'
  },

  listHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    marginBottom: '10px',
    gap: '8px'
  },

  emptyTocText: {
    fontSize: '12px',
    color: '#888',
    textAlign: 'center',
    marginTop: '20px'
  },

  thumbGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, 1fr)',
    gap: '10px'
  },

  thumbCard: {
    backgroundColor:
      'rgba(255,255,255,0.05)',
    borderRadius: '6px',
    padding: '6px',
    display: 'flex',
    flexDirection:
      'column',
    gap: '4px'
  },

  thumbImg: {
    width: '100%',
    height: '80px',
    objectFit: 'cover',
    borderRadius: '4px',
    cursor: 'pointer'
  },

  thumbAuthorBox: {
    display: 'flex',
    alignItems:
      'center',
    gap: '4px'
  },

  thumbAuthorText: {
    fontSize: '10px',
    color: '#ccc',
    overflow: 'hidden',
    textOverflow:
      'ellipsis',
    whiteSpace:
      'nowrap'
  },

  deleteThumbBtn: {
    backgroundColor:
      '#dc3545',
    border: 'none',
    color: '#fff',
    fontSize: '10px',
    borderRadius: '3px',
    padding:
      '2px 4px',
    cursor: 'pointer'
  },

  clearAllBtn: {
    backgroundColor:
      '#dc3545',
    border: 'none',
    color: '#fff',
    fontSize: '10px',
    borderRadius: '3px',
    padding:
      '4px 8px',
    cursor: 'pointer'
  },

  // -------------------------------------------------------
  // Settings
  // -------------------------------------------------------

  settingSection: {
    marginBottom: '20px'
  },

  settingLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#ddd'
  },

  subLabel: {
    fontSize: '11px',
    color: '#aaa'
  },

  presetGroup: {
    display: 'flex',
    gap: '8px',
    marginBottom: '10px'
  },

  presetBtn: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border:
      '1px solid #fff',
    cursor: 'pointer'
  },

  colorPickerRow: {
    display: 'flex',
    alignItems:
      'center',
    gap: '10px'
  },

  colorInput: {
    border: 'none',
    width: '30px',
    height: '30px',
    cursor: 'pointer',
    background:
      'none'
  },

  bgUploadBtn: {
    display:
      'inline-block',
    padding:
      '6px 12px',
    backgroundColor:
      '#333',
    border:
      '1px solid #555',
    borderRadius:
      '4px',
    fontSize: '11px',
    cursor: 'pointer',
    color: '#fff'
  },

  speedGroup: {
    display: 'flex',
    gap: '6px'
  },

  speedBtn: {
    flex: 1,
    border: 'none',
    color: '#fff',
    padding: '6px',
    borderRadius:
      '4px',
    fontSize: '11px',
    cursor: 'pointer'
  },

  // -------------------------------------------------------
  // Modal
  // -------------------------------------------------------

  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor:
      'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    zIndex: 300,
    padding: '20px',
    boxSizing:
      'border-box'
  },

  modalCard: {
    backgroundColor:
      '#111',
    padding: '15px',
    borderRadius: '8px',
    maxWidth:
      '90vw',
    maxHeight:
      '90vh',
    display: 'flex',
    flexDirection:
      'column',
    alignItems:
      'center',
    gap: '10px'
  },

  modalImg: {
    maxWidth: '100%',
    maxHeight: '75vh',
    objectFit:
      'contain',
    borderRadius: '4px'
  },

  closeBtn: {
    padding:
      '6px 16px',
    backgroundColor:
      '#6c757d',
    border: 'none',
    color: '#fff',
    borderRadius:
      '4px',
    cursor: 'pointer',
    fontSize: '12px'
  }
};