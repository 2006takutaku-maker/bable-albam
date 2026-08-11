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
// 3. 数学ヘルパー
// =========================================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(v) {
  const length = Math.sqrt(
    v.x * v.x +
    v.y * v.y +
    v.z * v.z
  );

  if (length === 0) {
    return {
      x: 0,
      y: 0,
      z: 1
    };
  }

  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length
  };
}

function dot(a, b) {
  return (
    a.x * b.x +
    a.y * b.y +
    a.z * b.z
  );
}

// =========================================================
// 4. シャボン玉用の虹色
// =========================================================

function soapRainbow(t) {
  t = ((t % 1) + 1) % 1;

  const stops = [
    [255, 70, 150],
    [100, 150, 255],
    [60, 245, 230],
    [120, 255, 100],
    [255, 240, 70],
    [255, 120, 50],
    [255, 70, 180]
  ];

  const scaled = t * (stops.length - 1);
  const index = Math.floor(scaled);
  const factor = scaled - index;

  const a = stops[index];
  const b = stops[Math.min(index + 1, stops.length - 1)];

  return {
    r: a[0] + (b[0] - a[0]) * factor,
    g: a[1] + (b[1] - a[1]) * factor,
    b: a[2] + (b[2] - a[2]) * factor
  };
}

// =========================================================
// 5. 高品質シャボン玉Canvas
// =========================================================

function BubbleCanvas({ src, size }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !src || !size) {
      return;
    }

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true
    });

    const img = new Image();

    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const w = Math.max(2, Math.floor(size));
      const h = Math.max(2, Math.floor(size));

      canvas.width = w;
      canvas.height = h;

      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) / 2 - 2;

      // -------------------------------------------------
      // 元画像
      // -------------------------------------------------

      const sourceCanvas = document.createElement('canvas');

      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;

      const sourceCtx = sourceCanvas.getContext('2d');

      sourceCtx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height
      );

      let sourceData;

      try {
        sourceData = sourceCtx.getImageData(
          0,
          0,
          img.width,
          img.height
        ).data;
      } catch (error) {
        console.error(
          '画像をCanvasから読み込めませんでした。',
          error
        );
        return;
      }

      const output = ctx.createImageData(w, h);
      const data = output.data;

      // -------------------------------------------------
      // 光源
      // -------------------------------------------------

      const light = normalize({
        x: -0.45,
        y: -0.55,
        z: 0.95
      });

      // カメラ方向
      const view = {
        x: 0,
        y: 0,
        z: 1
      };

      // 空気 → 水に近い屈折率
      const eta = 1 / 1.33;

      // -------------------------------------------------
      // ピクセルごとの球面計算
      // -------------------------------------------------

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {

          const px = (x - centerX) / radius;
          const py = (y - centerY) / radius;

          const distanceSquared =
            px * px +
            py * py;

          const outputIndex =
            (y * w + x) * 4;

          // 球の外
          if (distanceSquared > 1) {
            data[outputIndex + 3] = 0;
            continue;
          }

          // ------------------------------------------------
          // 球面のZ
          // ------------------------------------------------

          const z = Math.sqrt(
            1 - distanceSquared
          );

          // 球面法線
          const normal = normalize({
            x: px,
            y: py,
            z
          });

          // ------------------------------------------------
          // Fresnel
          // ------------------------------------------------

          const cosTheta = clamp(
            dot(normal, view),
            0,
            1
          );

          const f0 = 0.04;

          const fresnel =
            f0 +
            (1 - f0) *
            Math.pow(1 - cosTheta, 5);

          // ------------------------------------------------
          // 屈折
          // ------------------------------------------------

          const cosI = dot(
            normal,
            view
          );

          const k =
            1 -
            eta * eta *
            (1 - cosI * cosI);

          let refractedX = px;
          let refractedY = py;

          if (k >= 0) {
            const sqrtK = Math.sqrt(k);

            const refracted = {
              x:
                eta * view.x -
                (eta * cosI + sqrtK) * normal.x,

              y:
                eta * view.y -
                (eta * cosI + sqrtK) * normal.y,

              z:
                eta * view.z -
                (eta * cosI + sqrtK) * normal.z
            };

            refractedX =
              refracted.x * 0.85;

            refractedY =
              refracted.y * 0.85;
          }

          // ------------------------------------------------
          // 画像UV
          // ------------------------------------------------

          let sourceX =
            ((refractedX + 1) * 0.5) *
            img.width;

          let sourceY =
            ((refractedY + 1) * 0.5) *
            img.height;

          // 球の中央が画像中央になるように調整
          sourceX = clamp(
            sourceX,
            0,
            img.width - 1
          );

          sourceY = clamp(
            sourceY,
            0,
            img.height - 1
          );

          const sx = Math.floor(sourceX);
          const sy = Math.floor(sourceY);

          const sourceIndex =
            (sy * img.width + sx) * 4;

          let r = sourceData[sourceIndex];
          let g = sourceData[sourceIndex + 1];
          let b = sourceData[sourceIndex + 2];

          // ------------------------------------------------
          // 薄膜干渉
          // ------------------------------------------------

          // 単純な虹色ではなく、
          // 球面位置 + 視線角度から干渉色を作る

          const surfacePattern =
            Math.sin(
              px * 8.0 +
              py * 5.0 +
              z * 11.0
            );

          const anglePattern =
            (1 - cosTheta) * 4.0;

          const interference =
            surfacePattern * 0.5 +
            anglePattern;

          const rainbow =
            soapRainbow(
              interference * 0.18
            );

          // ------------------------------------------------
          // 虹色の強さ
          // ------------------------------------------------

          const rainbowStrength =
            0.08 +
            fresnel * 0.72;

          r =
            r * (1 - rainbowStrength) +
            rainbow.r * rainbowStrength;

          g =
            g * (1 - rainbowStrength) +
            rainbow.g * rainbowStrength;

          b =
            b * (1 - rainbowStrength) +
            rainbow.b * rainbowStrength;

          // ------------------------------------------------
          // Half vector
          // ------------------------------------------------

          const half = normalize({
            x: light.x + view.x,
            y: light.y + view.y,
            z: light.z + view.z
          });

          // ------------------------------------------------
          // スペキュラハイライト
          // ------------------------------------------------

          const specular =
            Math.pow(
              Math.max(
                0,
                dot(normal, half)
              ),
              90
            );

          r += 255 * specular * 0.95;
          g += 255 * specular * 0.95;
          b += 255 * specular * 0.95;

          // ------------------------------------------------
          // Fresnelによる縁の光
          // ------------------------------------------------

          const edgeLight =
            Math.pow(fresnel, 0.7);

          r += 255 * edgeLight * 0.35;
          g += 255 * edgeLight * 0.35;
          b += 255 * edgeLight * 0.35;

          // ------------------------------------------------
          // 球の中心を少し暗くする
          // ------------------------------------------------

          const centerLight =
            0.82 +
            z * 0.18;

          r *= centerLight;
          g *= centerLight;
          b *= centerLight;

          // ------------------------------------------------
          // 外周の透明感
          // ------------------------------------------------

          const edge =
            1 - z;

          const alpha =
            185 +
            edge * 65;

          data[outputIndex] =
            clamp(r, 0, 255);

          data[outputIndex + 1] =
            clamp(g, 0, 255);

          data[outputIndex + 2] =
            clamp(b, 0, 255);

          data[outputIndex + 3] =
            clamp(alpha, 0, 255);
        }
      }

      ctx.putImageData(
        output,
        0,
        0
      );

      // ==================================================
      // 外周の虹色
      // ==================================================

      ctx.save();

      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        radius - 1,
        0,
        Math.PI * 2
      );

      ctx.clip();

      const rainbowRing =
        ctx.createConicGradient(
          -Math.PI / 2,
          centerX,
          centerY
        );

      rainbowRing.addColorStop(
        0.00,
        'rgba(255,100,170,0.45)'
      );

      rainbowRing.addColorStop(
        0.16,
        'rgba(110,160,255,0.40)'
      );

      rainbowRing.addColorStop(
        0.32,
        'rgba(60,255,220,0.38)'
      );

      rainbowRing.addColorStop(
        0.48,
        'rgba(150,255,100,0.34)'
      );

      rainbowRing.addColorStop(
        0.64,
        'rgba(255,240,80,0.40)'
      );

      rainbowRing.addColorStop(
        0.80,
        'rgba(255,100,80,0.38)'
      );

      rainbowRing.addColorStop(
        1,
        'rgba(255,100,170,0.45)'
      );

      ctx.globalCompositeOperation =
        'screen';

      ctx.strokeStyle =
        rainbowRing;

      ctx.lineWidth =
        Math.max(1.5, size * 0.025);

      ctx.stroke();

      ctx.restore();

      // ==================================================
      // 左上の強いハイライト
      // ==================================================

      ctx.save();

      const highlight =
        ctx.createRadialGradient(
          centerX - radius * 0.36,
          centerY - radius * 0.40,
          0,

          centerX - radius * 0.36,
          centerY - radius * 0.40,
          radius * 0.42
        );

      highlight.addColorStop(
        0,
        'rgba(255,255,255,0.98)'
      );

      highlight.addColorStop(
        0.12,
        'rgba(255,255,255,0.75)'
      );

      highlight.addColorStop(
        0.30,
        'rgba(255,255,255,0.22)'
      );

      highlight.addColorStop(
        0.60,
        'rgba(255,255,255,0.05)'
      );

      highlight.addColorStop(
        1,
        'rgba(255,255,255,0)'
      );

      ctx.globalCompositeOperation =
        'screen';

      ctx.fillStyle =
        highlight;

      ctx.beginPath();

      ctx.arc(
        centerX - radius * 0.36,
        centerY - radius * 0.40,
        radius * 0.42,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

      // ==================================================
      // 小さな反射点
      // ==================================================

      ctx.save();

      ctx.globalCompositeOperation =
        'screen';

      ctx.fillStyle =
        'rgba(255,255,255,0.75)';

      ctx.beginPath();

      ctx.arc(
        centerX - radius * 0.12,
        centerY - radius * 0.53,
        Math.max(1, radius * 0.045),
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

      // ==================================================
      // 下側の青紫反射
      // ==================================================

      ctx.save();

      const bottomReflection =
        ctx.createRadialGradient(
          centerX + radius * 0.25,
          centerY + radius * 0.38,
          0,

          centerX + radius * 0.25,
          centerY + radius * 0.38,
          radius * 0.58
        );

      bottomReflection.addColorStop(
        0,
        'rgba(70,220,255,0.22)'
      );

      bottomReflection.addColorStop(
        0.35,
        'rgba(160,100,255,0.12)'
      );

      bottomReflection.addColorStop(
        0.75,
        'rgba(255,100,200,0.04)'
      );

      bottomReflection.addColorStop(
        1,
        'rgba(0,0,0,0)'
      );

      ctx.globalCompositeOperation =
        'screen';

      ctx.fillStyle =
        bottomReflection;

      ctx.beginPath();

      ctx.arc(
        centerX + radius * 0.25,
        centerY + radius * 0.38,
        radius * 0.58,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

      // ==================================================
      // 外周の白い輪郭
      // ==================================================

      ctx.save();

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

      ctx.lineWidth = 1.1;

      ctx.globalCompositeOperation =
        'screen';

      ctx.stroke();

      ctx.restore();
    };

    img.onerror = () => {
      console.error(
        'BubbleCanvas: image loading failed'
      );
    };

  }, [src, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        pointerEvents: 'none',
        borderRadius: '50%',
        display: 'block',
        width: '100%',
        height: '100%'
      }}
    />
  );
}

// =========================================================
// 6. メインアプリ
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

  const [genres, setGenres] =
    useState([
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
        'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
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
  // Album key
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
        if (
          'wakeLock' in navigator
        ) {
          wakeLock =
            await navigator.wakeLock.request(
              'screen'
            );
        }
      } catch (error) {
        console.log(
          'Wake Lock エラー:',
          error
        );
      }
    };

    if (
      currentScreen === 'album'
    ) {
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
  // Firestore realtime
  // =======================================================

  useEffect(() => {
    if (
      currentScreen !== 'album' ||
      !albumKey ||
      !currentUser
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
            snapshot.docs.map(
              document => ({
                id: document.id,
                ...document.data()
              })
            );

          setBubbles(loaded);
        }
      );

    const settingsRef =
      doc(
        db,
        'albums',
        albumKey
      );

    const unsubscribeSettings =
      onSnapshot(
        settingsRef,
        snapshot => {
          if (snapshot.exists()) {
            const data =
              snapshot.data();

            setAlbumSettings(data);

            if (
              Array.isArray(
                data.genres
              )
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
          }
        }
      );

    let unsubscribeMembers =
      () => {};

    if (
      activeTab === 'shared'
    ) {
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
          snapshot => {
            const loaded =
              snapshot.docs.map(
                document =>
                  document.data()
              );

            setRoomMembers(
              loaded
            );
          }
        );

      const myMemberRef =
        doc(
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
          joinedAt:
            Date.now()
        },
        {
          merge: true
        }
      );
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
  // Settings
  // =======================================================

  const updateSettings = async (
    newSettings
  ) => {
    const updated = {
      ...albumSettings,
      ...newSettings
    };

    setAlbumSettings(
      updated
    );

    const settingsRef =
      doc(
        db,
        'albums',
        albumKey
      );

    await setDoc(
      settingsRef,
      updated,
      {
        merge: true
      }
    );
  };

  // =======================================================
  // Genre
  // =======================================================

  const handleAddGenre = () => {
    const newGenre =
      window.prompt(
        '新しいジャンル名を入力してください:'
      );

    if (
      newGenre &&
      newGenre.trim()
    ) {
      const trimmed =
        newGenre.trim();

      if (
        !genres.includes(
          trimmed
        )
      ) {
        const nextGenres =
          [
            ...genres,
            trimmed
          ];

        setGenres(
          nextGenres
        );

        setSelectedGenre(
          trimmed
        );

        updateSettings({
          genres:
            nextGenres
        });
      } else {
        alert(
          'そのジャンルは既に存在します。'
        );
      }
    }
  };

  // =======================================================
  // Avatar
  // =======================================================

  const handleCustomAvatarUpload =
    event => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      const reader =
        new FileReader();

      reader.onload =
        e => {
          setCustomAvatar({
            type: 'image',
            url: e.target.result
          });

          setSelectedAvatarIdx(
            -1
          );
        };

      reader.readAsDataURL(
        file
      );
    };

  const getSelectedAvatar = () => {
    if (
      selectedAvatarIdx === -1 &&
      customAvatar
    ) {
      return customAvatar;
    }

    return (
      AVATARS[
        selectedAvatarIdx
      ] ||
      AVATARS[0]
    );
  };

  // =======================================================
  // Auth
  // =======================================================

  const handleAuth = async event => {
    event.preventDefault();

    const username =
      usernameInput.trim();

    const password =
      passwordInput.trim();

    if (
      !username ||
      !password
    ) {
      alert(
        'ユーザー名とパスワードを入力してください'
      );

      return;
    }

    try {
      const userRef =
        doc(
          db,
          'users',
          username
        );

      const userSnap =
        await getDoc(
          userRef
        );

      if (
        authMode === 'register'
      ) {
        if (
          userSnap.exists()
        ) {
          alert(
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

        setCurrentUser(
          userObj
        );

        localStorage.setItem(
          'currentUser',
          JSON.stringify(
            userObj
          )
        );

        setCurrentScreen(
          'menu'
        );
      } else {
        if (
          !userSnap.exists()
        ) {
          alert(
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

        setCurrentUser(
          userObj
        );

        localStorage.setItem(
          'currentUser',
          JSON.stringify(
            userObj
          )
        );

        setCurrentScreen(
          'menu'
        );
      }

      setPasswordInput('');

    } catch (error) {
      console.error(error);

      alert(
        '認証処理中にエラーが発生しました。'
      );
    }
  };

  // =======================================================
  // Logout
  // =======================================================

  const handleLogout = () => {
    setCurrentUser(
      null
    );

    localStorage.removeItem(
      'currentUser'
    );

    setCurrentScreen(
      'auth'
    );

    setIsTocOpen(
      false
    );
  };

  // =======================================================
  // Album
  // =======================================================

  const enterPrivateAlbum =
    () => {
      setActiveTab(
        'private'
      );

      setSelectedGenre(
        'すべて'
      );

      setCurrentScreen(
        'album'
      );
    };

  const enterSharedAlbum =
    event => {
      event.preventDefault();

      if (
        !roomInput.trim()
      ) {
        alert(
          'ルーム番号を入力してください'
        );

        return;
      }

      setRoomNumber(
        roomInput.trim()
      );

      setActiveTab(
        'shared'
      );

      setSelectedGenre(
        'すべて'
      );

      setCurrentScreen(
        'album'
      );
    };

  // =======================================================
  // Photo upload
  // =======================================================

  const handleImageUpload =
    event => {
      const files =
        Array.from(
          event.target.files || []
        );

      if (
        files.length === 0
      ) {
        return;
      }

      const genreToAssign =
        selectedGenre ===
        'すべて'
          ? (
              genres[1] ||
              '未分類'
            )
          : selectedGenre;

      files.forEach(
        file => {
          const reader =
            new FileReader();

          reader.onload =
            e => {
              createBubble(
                e.target.result,
                genreToAssign
              );
            };

          reader.readAsDataURL(
            file
          );
        }
      );

      event.target.value = '';
    };

  // =======================================================
  // Background upload
  // =======================================================

  const handleBgImageUpload =
    event => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      const reader =
        new FileReader();

      reader.onload =
        e => {
          updateSettings({
            bgImage:
              e.target.result,
            bgType:
              'image'
          });
        };

      reader.readAsDataURL(
        file
      );

      event.target.value = '';
    };

  // =======================================================
  // Animation speed
  // =======================================================

  const getBaseDuration =
    () => {
      if (
        speedMode === 'slow'
      ) {
        return 45;
      }

      if (
        speedMode === 'fast'
      ) {
        return 15;
      }

      return 30;
    };

  // =======================================================
  // Create bubble
  // =======================================================

  const createBubble =
    async (
      imgSrc,
      genre
    ) => {
      const depth =
        Math.random();

      const size =
        Math.floor(
          depth * 120
        ) + 100;

      const opacity =
        0.65 +
        depth * 0.35;

      const zIndex =
        Math.floor(
          depth * 100
        );

      const newBubbleData = {
        src: imgSrc,

        genre:
          genre ||
          '未分類',

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
            Math.random() * 3
          ) + 2,

        delay:
          Math.random() * 2,

        createdAt:
          Date.now()
      };

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
    };

  // =======================================================
  // Animation restart
  // =======================================================

  const handleAnimationEnd =
    id => {
      setBubbles(
        previous =>
          previous.map(
            bubble => {
              if (
                bubble.id !== id
              ) {
                return bubble;
              }

              const depth =
                Math.random();

              return {
                ...bubble,

                depth,

                left:
                  Math.floor(
                    Math.random() *
                      85
                  ) + 5,

                size:
                  Math.floor(
                    depth * 120
                  ) + 100,

                opacity:
                  0.65 +
                  depth * 0.35,

                zIndex:
                  Math.floor(
                    depth * 100
                  )
              };
            }
          )
      );
    };

  // =======================================================
  // Delete
  // =======================================================

  const handleDeleteBubble =
    async id => {
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
    };

  // =======================================================
  // Clear all
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
        document => {
          batch.delete(
            document.ref
          );
        }
      );

      await batch.commit();

      setIsTocOpen(
        false
      );
    };

  // =======================================================
  // Background
  // =======================================================

  const getContainerStyle =
    () => {
      let backgroundStyle =
        {};

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
  // Avatar rendering
  // =======================================================

  const renderAvatarIcon =
    (
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
  // Filtering
  // =======================================================

  const filteredBubbles =
    selectedGenre ===
    'すべて'
      ? bubbles
      : bubbles.filter(
          bubble =>
            bubble.genre ===
            selectedGenre
        );

  // =======================================================
  // AUTH SCREEN
  // =======================================================

  if (
    currentScreen ===
    'auth'
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
                    color: '#ccc',
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
                      avatar,
                      index
                    ) => (
                      <div
                        key={index}
                        onClick={() => {
                          setSelectedAvatarIdx(
                            index
                          );
                          setCustomAvatar(
                            null
                          );
                        }}
                        style={{
                          ...styles.avatarBadge,
                          backgroundColor:
                            avatar.bg,
                          border:
                            selectedAvatarIdx ===
                            index
                              ? '2px solid #fff'
                              : '2px solid transparent'
                        }}
                      >
                        {
                          avatar.emoji
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
              onChange={event =>
                setUsernameInput(
                  event.target.value
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
              onChange={event =>
                setPasswordInput(
                  event.target.value
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
  // MENU SCREEN
  // =======================================================

  if (
    currentScreen ===
    'menu'
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
            color: '#fff',
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
              自分だけの写真が
              入る専用のアルバムです。
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
              同じルーム番号を入力した人と
              リアルタイム共有できます。
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
                onChange={event =>
                  setRoomInput(
                    event.target.value
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
  // ALBUM SCREEN
  // =======================================================

  return (
    <div
      style={
        getContainerStyle()
      }
    >

      {/* HEADER */}

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
                (
                  member,
                  index
                ) => (
                  <div
                    key={
                      index
                    }
                    style={
                      styles.memberTag
                    }
                  >
                    <div
                      style={{
                        ...styles.avatarBadgeSmall,
                        backgroundColor:
                          member
                            .avatar
                            ?.bg ||
                          'transparent'
                      }}
                    >
                      {renderAvatarIcon(
                        member.avatar
                      )}
                    </div>

                    <span
                      style={
                        styles.memberName
                      }
                    >
                      {
                        member.username
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

        {/* GENRE */}

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
                key={
                  genre
                }
                style={{
                  ...styles.genreTabBtn,
                  backgroundColor:
                    selectedGenre ===
                    genre
                      ? '#007bff'
                      : 'rgba(255,255,255,0.15)',
                  color:
                    '#fff',
                  fontWeight:
                    selectedGenre ===
                    genre
                      ? 'bold'
                      : 'normal'
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

      {/* TOC */}

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
              setIsTocOpen(
                false
              )
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
                  📷 [
                  {
                    selectedGenre
                  }
                  ] の写真
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
                    (
                      bubble,
                      index
                    ) => (
                      <div
                        key={
                          bubble.id
                        }
                        style={
                          styles.thumbCard
                        }
                      >
                        <img
                          src={
                            bubble.src
                          }
                          alt={`photo-${index}`}
                          style={
                            styles.thumbImg
                          }
                          onClick={() =>
                            setSelectedImage(
                              bubble.src
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
                                bubble
                                  .authorAvatar
                                  ?.bg ||
                                'transparent'
                            }}
                          >
                            {renderAvatarIcon(
                              bubble.authorAvatar
                            )}
                          </div>

                          <span
                            style={
                              styles.thumbAuthorText
                            }
                          >
                            {
                              bubble.author ||
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
                              bubble.id
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

              {/* BACKGROUND */}

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
                        'linear-gradient(180deg,#0f2027,#2c5364)'
                    }}
                    onClick={() =>
                      updateSettings({
                        presetBg:
                          'linear-gradient(180deg,#0f2027 0%,#203a43 50%,#2c5364 100%)',
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
                          'linear-gradient(180deg,#1a2a6c 0%,#b21f1f 50%,#fdbb2d 100%)',
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
                          'linear-gradient(180deg,#130cb7 0%,#52e5e7 100%)',
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
                    onChange={event =>
                      updateSettings({
                        bgColor:
                          event.target
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

              {/* SPEED */}

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

      {/* EMPTY */}

      {filteredBubbles.length ===
        0 && (
        <div
          style={
            styles.emptyText
          }
        >
          【
          {
            selectedGenre
          }
          】ジャンルの写真はありません
          <br />
          「＋ 写真を追加」から
          選択中のジャンルに画像を追加できます✨
        </div>
      )}

      {/* BUBBLES */}

      <div
        style={
          styles.stage
        }
      >
        {filteredBubbles.map(
          bubble => {
            const duration =
              Math.floor(
                (
                  1.2 -
                  (
                    bubble.depth ||
                    0.5
                  ) *
                    0.4
                ) *
                  getBaseDuration()
              );

            return (
              <div
                key={
                  bubble.id
                }
                onClick={() =>
                  setSelectedImage(
                    bubble.src
                  )
                }
                onAnimationEnd={() =>
                  handleAnimationEnd(
                    bubble.id
                  )
                }
                style={{
                  ...styles.bubbleWrapper,

                  left:
                    `${bubble.left}%`,

                  width:
                    `${bubble.size}px`,

                  height:
                    `${bubble.size}px`,

                  zIndex:
                    bubble.zIndex,

                  opacity:
                    bubble.opacity,

                  animation:
                    `floatUp ${duration}s linear ${bubble.delay}s infinite, sway ${bubble.swayDuration}s ease-in-out infinite alternate`
                }}
              >
                <div
                  style={
                    styles.bubbleGlass
                  }
                >
                  <BubbleCanvas
                    src={
                      bubble.src
                    }
                    size={
                      bubble.size
                    }
                  />

                  {bubble.authorAvatar && (
                    <div
                      title={`${bubble.author} (${bubble.genre || '未分類'})`}
                      style={{
                        ...styles.bubbleAuthorBadge,
                        backgroundColor:
                          bubble
                            .authorAvatar
                            ?.bg ||
                          'transparent'
                      }}
                    >
                      {renderAvatarIcon(
                        bubble.authorAvatar,
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

      {/* MODAL */}

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
            onClick={event =>
              event.stopPropagation()
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

      {/* ANIMATION */}

      <style>
        {`
          @keyframes floatUp {
            0% {
              transform: translateY(105vh);
            }

            100% {
              transform: translateY(-250px);
            }
          }

          @keyframes sway {
            0% {
              margin-left: -20px;
            }

            100% {
              margin-left: 20px;
            }
          }
        `}
      </style>
    </div>
  );
}

// =========================================================
// 7. Styles
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
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },

  avatarPickerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '8px'
  },

  avatarGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },

  avatarBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '18px'
  },

  avatarBadgeSmall: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0
  },

  input: {
    padding: '10px 12px',
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
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    marginTop: '10px'
  },

  menuContainer: {
    width: '100vw',
    height: '100vh',
    background:
      'linear-gradient(135deg,#0f2027,#2c5364)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center'
  },

  logoutBtn: {
    backgroundColor:
      'rgba(255,255,255,0.2)',
    color: '#fff',
    border: 'none',
    padding: '4px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px'
  },

  menuGrid: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    justifyContent: 'center'
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
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },

  cardIcon: {
    fontSize: '40px',
    marginBottom: '10px'
  },

  enterBtn: {
    padding: '8px 20px',
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
    flexDirection: 'column',
    gap: '10px'
  },

  topControlRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },

  backMenuBtn: {
    padding: '6px 12px',
    backgroundColor:
      'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '15px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    backdropFilter:
      'blur(5px)'
  },

  badge: {
    padding: '6px 12px',
    backgroundColor:
      'rgba(0,0,0,0.4)',
    borderRadius: '15px',
    color: '#fff',
    fontSize: '12px',
    backdropFilter:
      'blur(5px)'
  },

  membersBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor:
      'rgba(0,0,0,0.3)',
    padding: '4px 8px',
    borderRadius: '15px'
  },

  memberTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    backgroundColor:
      'rgba(255,255,255,0.15)',
    padding: '2px 6px',
    borderRadius: '10px'
  },

  memberName: {
    fontSize: '10px',
    color: '#fff'
  },

  tocToggleBtn: {
    padding: '6px 12px',
    backgroundColor: '#6c757d',
    border: 'none',
    borderRadius: '15px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer'
  },

  uploadBtn: {
    padding: '6px 12px',
    backgroundColor: '#28a745',
    borderRadius: '15px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },

  genreTabBar: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },

  genreLabel: {
    color: '#fff',
    fontSize: '12px',
    marginRight: '4px'
  },

  genreTabBtn: {
    padding: '4px 10px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '11px',
    cursor: 'pointer'
  },

  addGenreBtn: {
    padding: '4px 10px',
    backgroundColor:
      'rgba(255,255,255,0.2)',
    border:
      '1px dashed #fff',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '11px',
    cursor: 'pointer'
  },

  stage: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },

  bubbleWrapper: {
    position: 'absolute',
    bottom: '-150px',
    cursor: 'pointer',
    willChange:
      'transform'
  },

  bubbleGlass: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    filter:
      'drop-shadow(0 10px 20px rgba(0,0,0,0.35))',
    overflow: 'visible'
  },

  bubbleAuthorBadge: {
    position: 'absolute',
    bottom: '3px',
    right: '3px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow:
      '0 2px 5px rgba(0,0,0,0.5)',
    zIndex: 10,
    overflow: 'hidden'
  },

  emptyText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform:
      'translate(-50%,-50%)',
    color:
      'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontSize: '14px',
    pointerEvents: 'none',
    lineHeight: '1.6',
    zIndex: 1
  },

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
    boxSizing: 'border-box',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column'
  },

  tocHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
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
    alignItems: 'center',
    marginBottom: '10px'
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
      'repeat(2,1fr)',
    gap: '10px'
  },

  thumbCard: {
    backgroundColor:
      'rgba(255,255,255,0.05)',
    borderRadius: '6px',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
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
    alignItems: 'center',
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
    padding: '2px 4px',
    cursor: 'pointer'
  },

  clearAllBtn: {
    backgroundColor:
      '#dc3545',
    border: 'none',
    color: '#fff',
    fontSize: '10px',
    borderRadius: '3px',
    padding: '4px 8px',
    cursor: 'pointer'
  },

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
    alignItems: 'center',
    gap: '10px'
  },

  colorInput: {
    border: 'none',
    width: '30px',
    height: '30px',
    cursor: 'pointer',
    background: 'none'
  },

  bgUploadBtn: {
    display:
      'inline-block',
    padding: '6px 12px',
    backgroundColor:
      '#333',
    border:
      '1px solid #555',
    borderRadius: '4px',
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
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer'
  },

  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor:
      'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300
  },

  modalCard: {
    backgroundColor:
      '#111',
    padding: '15px',
    borderRadius: '8px',
    maxWidth: '80vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px'
  },

  modalImg: {
    maxWidth: '100%',
    maxHeight: '60vh',
    objectFit: 'contain',
    borderRadius: '4px'
  },

  closeBtn: {
    padding: '6px 16px',
    backgroundColor:
      '#6c757d',
    border: 'none',
    color: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  }
};