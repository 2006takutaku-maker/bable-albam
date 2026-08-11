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
// 3. 写真バブル用Canvas
//    ・人物写真をなるべく歪ませない
//    ・球面の陰影
//    ・ガラス反射
//    ・薄い虹色の差し色
// =========================================================

function BubbleCanvas({
  src,
  size,
  rainbowAngle = 0,
  rainbowStrength = 0.08,
  highlightX = -0.25,
  highlightY = -0.3,
  distortion = 0.08
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true
    });

    const img = new Image();

    img.onload = () => {
      const w = Math.max(1, Math.floor(size));
      const h = Math.max(1, Math.floor(size));

      canvas.width = w;
      canvas.height = h;

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 2;

      // -----------------------------------------------------
      // 元画像を正方形にトリミング
      // -----------------------------------------------------

      const imageCanvas = document.createElement('canvas');
      const imageSize = Math.min(img.width, img.height);

      imageCanvas.width = imageSize;
      imageCanvas.height = imageSize;

      const imageCtx = imageCanvas.getContext('2d');

      const sx = (img.width - imageSize) / 2;
      const sy = (img.height - imageSize) / 2;

      imageCtx.drawImage(
        img,
        sx,
        sy,
        imageSize,
        imageSize,
        0,
        0,
        imageSize,
        imageSize
      );

      const srcImgData = imageCtx.getImageData(
        0,
        0,
        imageSize,
        imageSize
      );

      const srcData = srcImgData.data;

      const output = ctx.createImageData(w, h);
      const outputData = output.data;

      // -----------------------------------------------------
      // 写真描画
      //
      // 強い屈折ではなく、ほんの少しだけ球面感を出す。
      // 人物写真の顔が崩れないことを優先。
      // -----------------------------------------------------

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;

          const distance = Math.sqrt(
            dx * dx + dy * dy
          );

          const outputIndex =
            (y * w + x) * 4;

          if (distance <= radius) {
            const normalized =
              distance / radius;

            // 中央はほぼそのまま。
            // 外周だけほんの少し球面方向へ。
            const edgeFactor =
              Math.pow(normalized, 2.8);

            const refraction =
              distortion * edgeFactor;

            const nx =
              dx * (1 - refraction);

            const ny =
              dy * (1 - refraction);

            const sourceX =
              Math.floor(
                ((cx + nx) / w) * imageSize
              );

            const sourceY =
              Math.floor(
                ((cy + ny) / h) * imageSize
              );

            const clampedX =
              Math.max(
                0,
                Math.min(
                  imageSize - 1,
                  sourceX
                )
              );

            const clampedY =
              Math.max(
                0,
                Math.min(
                  imageSize - 1,
                  sourceY
                )
              );

            const sourceIndex =
              (clampedY * imageSize +
                clampedX) * 4;

            outputData[outputIndex] =
              srcData[sourceIndex];

            outputData[outputIndex + 1] =
              srcData[sourceIndex + 1];

            outputData[outputIndex + 2] =
              srcData[sourceIndex + 2];

            outputData[outputIndex + 3] =
              255;
          } else {
            outputData[outputIndex + 3] = 0;
          }
        }
      }

      ctx.putImageData(output, 0, 0);

      // -----------------------------------------------------
      // ① 球面の光
      // -----------------------------------------------------

      ctx.save();

      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
      );
      ctx.clip();

      const lightCenterX =
        cx + radius * highlightX;

      const lightCenterY =
        cy + radius * highlightY;

      const sphereLight =
        ctx.createRadialGradient(
          lightCenterX,
          lightCenterY,
          radius * 0.03,
          cx,
          cy,
          radius * 1.05
        );

      sphereLight.addColorStop(
        0,
        'rgba(255,255,255,0.16)'
      );

      sphereLight.addColorStop(
        0.3,
        'rgba(255,255,255,0.06)'
      );

      sphereLight.addColorStop(
        0.58,
        'rgba(255,255,255,0.00)'
      );

      sphereLight.addColorStop(
        0.82,
        'rgba(80,170,255,0.03)'
      );

      sphereLight.addColorStop(
        1,
        'rgba(0,0,0,0.24)'
      );

      ctx.globalCompositeOperation =
        'soft-light';

      ctx.fillStyle = sphereLight;

      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // -----------------------------------------------------
      // ② ガラスの斜め反射
      // -----------------------------------------------------

      const reflection =
        ctx.createLinearGradient(
          0,
          0,
          w,
          h
        );

      reflection.addColorStop(
        0,
        'rgba(255,255,255,0.14)'
      );

      reflection.addColorStop(
        0.20,
        'rgba(255,255,255,0.05)'
      );

      reflection.addColorStop(
        0.40,
        'rgba(255,255,255,0)'
      );

      reflection.addColorStop(
        0.70,
        'rgba(100,220,255,0.025)'
      );

      reflection.addColorStop(
        1,
        'rgba(255,255,255,0.08)'
      );

      ctx.globalCompositeOperation =
        'screen';

      ctx.fillStyle = reflection;

      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // -----------------------------------------------------
      // ③ 上部の小さな光
      // -----------------------------------------------------

      const highlight =
        ctx.createRadialGradient(
          lightCenterX,
          lightCenterY,
          1,
          lightCenterX,
          lightCenterY,
          radius * 0.42
        );

      highlight.addColorStop(
        0,
        'rgba(255,255,255,0.70)'
      );

      highlight.addColorStop(
        0.18,
        'rgba(255,255,255,0.25)'
      );

      highlight.addColorStop(
        0.55,
        'rgba(255,255,255,0.05)'
      );

      highlight.addColorStop(
        1,
        'rgba(255,255,255,0)'
      );

      ctx.globalCompositeOperation =
        'screen';

      ctx.fillStyle = highlight;

      ctx.beginPath();

      ctx.arc(
        lightCenterX,
        lightCenterY,
        radius * 0.42,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // -----------------------------------------------------
      // ④ 虹色
      //
      // 「虹色フレーム」ではなく
      // 一部分にだけ薄く出す。
      // -----------------------------------------------------

      ctx.save();

      ctx.translate(cx, cy);
      ctx.rotate(rainbowAngle);
      ctx.translate(-cx, -cy);

      const rainbow =
        ctx.createLinearGradient(
          cx - radius,
          cy - radius,
          cx + radius,
          cy + radius
        );

      const strength =
        Math.max(
          0.025,
          Math.min(
            0.16,
            rainbowStrength
          )
        );

      rainbow.addColorStop(
        0,
        `rgba(255,70,120,${strength})`
      );

      rainbow.addColorStop(
        0.18,
        `rgba(255,190,70,${strength * 0.8})`
      );

      rainbow.addColorStop(
        0.38,
        `rgba(80,255,190,${strength * 0.7})`
      );

      rainbow.addColorStop(
        0.58,
        `rgba(70,210,255,${strength})`
      );

      rainbow.addColorStop(
        0.78,
        `rgba(170,100,255,${strength * 0.7})`
      );

      rainbow.addColorStop(
        1,
        `rgba(255,70,180,${strength})`
      );

      ctx.globalCompositeOperation =
        'screen';

      ctx.globalAlpha = 0.75;

      ctx.fillStyle = rainbow;

      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.restore();

      // -----------------------------------------------------
      // ⑤ 外周のガラス陰影
      // -----------------------------------------------------

      const edgeShadow =
        ctx.createRadialGradient(
          cx,
          cy,
          radius * 0.42,
          cx,
          cy,
          radius
        );

      edgeShadow.addColorStop(
        0,
        'rgba(0,0,0,0)'
      );

      edgeShadow.addColorStop(
        0.60,
        'rgba(0,0,0,0.015)'
      );

      edgeShadow.addColorStop(
        0.82,
        'rgba(0,0,0,0.10)'
      );

      edgeShadow.addColorStop(
        1,
        'rgba(0,0,0,0.34)'
      );

      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation =
        'multiply';

      ctx.fillStyle = edgeShadow;

      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // -----------------------------------------------------
      // ⑥ 薄い外周ハイライト
      // -----------------------------------------------------

      ctx.globalCompositeOperation =
        'screen';

      ctx.strokeStyle =
        `rgba(255,255,255,0.38)`;

      ctx.lineWidth =
        Math.max(1, size * 0.012);

      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        radius - 1,
        0,
        Math.PI * 2
      );

      ctx.stroke();

      ctx.restore();
    };

    img.onerror = () => {
      console.warn(
        'BubbleCanvas image load error'
      );
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [
    src,
    size,
    rainbowAngle,
    rainbowStrength,
    highlightX,
    highlightY,
    distortion
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        borderRadius: '50%'
      }}
    />
  );
}

// =========================================================
// 4. 空バブル
// =========================================================

function EmptyBubble({
  size,
  rainbowAngle,
  rainbowStrength
}) {
  const bubbleRef = useRef(null);

  return (
    <div
      ref={bubbleRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        position: 'relative',
        overflow: 'hidden',

        background: `
          radial-gradient(
            circle at 30% 25%,
            rgba(255,255,255,0.20),
            rgba(255,255,255,0.055) 22%,
            rgba(255,255,255,0.018) 48%,
            rgba(80,180,255,0.025) 72%,
            rgba(255,255,255,0.08) 100%
          )
        `,

        border:
          '1px solid rgba(255,255,255,0.38)',

        boxShadow: `
          inset 5px 5px 13px
            rgba(255,255,255,0.18),

          inset -7px -9px 17px
            rgba(80,160,255,0.08),

          0 0 10px
            rgba(255,255,255,0.08)
        `
      }}
    >
      {/* 大きな透明反射 */}
      <div
        style={{
          position: 'absolute',
          left: '15%',
          top: '10%',
          width: '35%',
          height: '18%',
          borderRadius: '50%',
          background:
            'rgba(255,255,255,0.28)',
          filter: 'blur(3px)',
          transform:
            'rotate(-25deg)',
          pointerEvents: 'none'
        }}
      />

      {/* 小さな光 */}
      <div
        style={{
          position: 'absolute',
          left: '26%',
          top: '22%',
          width: '11%',
          height: '11%',
          borderRadius: '50%',
          background:
            'rgba(255,255,255,0.65)',
          filter: 'blur(1px)',
          pointerEvents: 'none'
        }}
      />

      {/* 虹色の差し色 */}
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          borderRadius: '50%',
          background: `
            conic-gradient(
              from ${rainbowAngle}rad,
              rgba(255,70,130,${rainbowStrength}),
              rgba(255,220,80,${rainbowStrength * 0.55}),
              rgba(70,255,190,${rainbowStrength * 0.45}),
              rgba(70,210,255,${rainbowStrength}),
              rgba(180,100,255,${rainbowStrength * 0.55}),
              rgba(255,70,130,${rainbowStrength})
            )
          `,
          mixBlendMode: 'screen',
          pointerEvents: 'none'
        }}
      />

      {/* 下側の青白い反射 */}
      <div
        style={{
          position: 'absolute',
          left: '20%',
          right: '20%',
          bottom: '4%',
          height: '13%',
          borderRadius: '50%',
          background:
            'rgba(100,210,255,0.08)',
          filter: 'blur(4px)',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}

// =========================================================
// 5. メインアプリ
// =========================================================

export default function App() {
  const [currentUser, setCurrentUser] =
    useState(() => {
      const saved =
        localStorage.getItem(
          'currentUser'
        );

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
    useState(() => {
      return localStorage.getItem(
        'currentUser'
      )
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

  const [
    decorativeBubbles,
    setDecorativeBubbles
  ] = useState([]);

  const [
    albumSettings,
    setAlbumSettings
  ] = useState({
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
  // 一時停止
  // =======================================================

  const [isPaused, setIsPaused] =
    useState(false);

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
  // Wake Lock
  // =======================================================

  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock =
      async () => {
        try {
          if (
            'wakeLock' in navigator &&
            currentScreen === 'album' &&
            !isPaused
          ) {
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

    if (
      currentScreen === 'album' &&
      !isPaused
    ) {
      requestWakeLock();
    }

    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    };
  }, [
    currentScreen,
    isPaused
  ]);

  // =======================================================
  // Firestore同期
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
        (snapshot) => {
          const loaded =
            snapshot.docs.map(
              (docSnap) => ({
                id: docSnap.id,
                ...docSnap.data()
              })
            );

          setBubbles(loaded);
        },
        (error) => {
          console.error(
            'bubbles snapshot error:',
            error
          );
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
        (docSnap) => {
          if (docSnap.exists()) {
            const data =
              docSnap.data();

            setAlbumSettings(
              data
            );

            if (
              Array.isArray(
                data.genres
              )
            ) {
              setGenres(
                data.genres
              );
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
        },
        (error) => {
          console.error(
            'settings snapshot error:',
            error
          );
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
          (snapshot) => {
            const loaded =
              snapshot.docs.map(
                (docSnap) =>
                  docSnap.data()
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
  // 空バブル生成
  // =======================================================

  useEffect(() => {
    if (
      currentScreen !== 'album'
    ) {
      return;
    }

    // 写真が少ないほど空バブルを増やす
    const targetCount =
      Math.max(
        16,
        Math.min(
          34,
          28 - Math.floor(
            bubbles.length * 0.7
          )
        )
      );

    const generated =
      Array.from(
        {
          length:
            targetCount
        },
        (_, index) => {
          const depth =
            Math.random();

          return {
            id:
              `decorative-${index}-${Math.random()}`,

            size:
              Math.floor(
                55 +
                depth * 75
              ),

            left:
              Math.floor(
                Math.random() * 90
              ) + 3,

            depth,

            opacity:
              0.16 +
              depth * 0.30,

            swayDuration:
              3 +
              Math.random() * 5,

            delay:
              Math.random() * 18,

            duration:
              30 +
              Math.random() * 22,

            rainbowAngle:
              Math.random() *
              Math.PI *
              2,

            rainbowStrength:
              0.035 +
              Math.random() *
              0.075
          };
        }
      );

    setDecorativeBubbles(
      generated
    );
  }, [
    currentScreen,
    bubbles.length
  ]);

  // =======================================================
  // 設定更新
  // =======================================================

  const updateSettings =
    async (
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

  const handleAddGenre =
    () => {
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
          window.alert(
            'そのジャンルは既に存在します。'
          );
        }
      }
    };

  // =======================================================
  // Avatar
  // =======================================================

  const handleCustomAvatarUpload =
    (e) => {
      const file =
        e.target.files?.[0];

      if (!file) return;

      const reader =
        new FileReader();

      reader.onload =
        (event) => {
          setCustomAvatar({
            type: 'image',
            url:
              event.target.result
          });

          setSelectedAvatarIdx(
            -1
          );
        };

      reader.readAsDataURL(
        file
      );
    };

  const getSelectedAvatar =
    () => {
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
  // Authentication
  // =======================================================

  const handleAuth =
    async (e) => {
      e.preventDefault();

      const username =
        usernameInput.trim();

      const password =
        passwordInput.trim();

      if (
        !username ||
        !password
      ) {
        window.alert(
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
          authMode ===
          'register'
        ) {
          if (
            userSnap.exists()
          ) {
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

          setCurrentUser(
            userObj
          );

          localStorage.setItem(
            'currentUser',
            JSON.stringify(
              userObj
            )
          );

          window.alert(
            'アカウントを作成しました！'
          );

          setCurrentScreen(
            'menu'
          );
        } else {
          if (
            !userSnap.exists()
          ) {
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
      } catch (err) {
        console.error(err);

        window.alert(
          '認証処理中にエラーが発生しました。'
        );
      }
    };

  // =======================================================
  // Logout
  // =======================================================

  const handleLogout =
    () => {
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
  // Album navigation
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
    (e) => {
      e.preventDefault();

      if (
        !roomInput.trim()
      ) {
        window.alert(
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
  // Image upload
  // =======================================================

  const handleImageUpload =
    (e) => {
      const files =
        Array.from(
          e.target.files || []
        );

      if (
        files.length === 0
      ) {
        return;
      }

      const genreToAssign =
        selectedGenre ===
        'すべて'
          ? genres[1] ||
            '未分類'
          : selectedGenre;

      files.forEach(
        (file) => {
          const reader =
            new FileReader();

          reader.onload =
            (event) => {
              createBubble(
                event.target.result,
                genreToAssign
              );
            };

          reader.readAsDataURL(
            file
          );
        }
      );

      e.target.value = '';
    };

  // =======================================================
  // Background
  // =======================================================

  const handleBgImageUpload =
    (e) => {
      const file =
        e.target.files?.[0];

      if (!file) return;

      const reader =
        new FileReader();

      reader.onload =
        (event) => {
          updateSettings({
            bgImage:
              event.target.result,

            bgType:
              'image'
          });
        };

      reader.readAsDataURL(
        file
      );
    };

  // =======================================================
  // Speed
  // =======================================================

  const getBaseDuration =
    () => {
      if (
        speedMode ===
        'slow'
      ) {
        return 48;
      }

      if (
        speedMode ===
        'fast'
      ) {
        return 24;
      }

      return 36;
    };

  // =======================================================
  // Bubble creation
  // =======================================================

  const createBubble =
    async (
      imgSrc,
      genre
    ) => {
      const depth =
        Math.random();

      // 今までより大きく
      const size =
        Math.floor(
          150 +
          depth * 150
        );

      const opacity =
        0.72 +
        depth * 0.28;

      const zIndex =
        45 +
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
            Math.random() * 82
          ) + 6,

        swayDuration:
          Math.floor(
            Math.random() * 4
          ) + 3,

        delay:
          Math.random() * 4,

        // 虹色の個体差
        rainbowAngle:
          Math.random() *
          Math.PI *
          2,

        rainbowStrength:
          0.045 +
          Math.random() *
          0.075,

        // 光の位置
        highlightX:
          -0.38 +
          Math.random() *
          0.35,

        highlightY:
          -0.42 +
          Math.random() *
          0.25,

        // 人物写真を考慮して弱め
        distortion:
          0.045 +
          Math.random() *
          0.045,

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
  // Animation End
  // =======================================================

  const handleAnimationEnd =
    (id) => {
      setBubbles(
        (prev) =>
          prev.map(
            (b) => {
              if (
                b.id !== id
              ) {
                return b;
              }

              const depth =
                Math.random();

              return {
                ...b,

                depth,

                left:
                  Math.floor(
                    Math.random() *
                    82
                  ) + 6,

                size:
                  Math.floor(
                    150 +
                    depth * 150
                  ),

                opacity:
                  0.72 +
                  depth * 0.28,

                zIndex:
                  45 +
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
    async (id) => {
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
  // Clear
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
        (docSnap) => {
          batch.delete(
            docSnap.ref
          );
        }
      );

      await batch.commit();

      setIsTocOpen(
        false
      );
    };

  // =======================================================
  // Container background
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
  // Avatar render
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
              borderRadius:
                '50%',
              objectFit:
                'cover',
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
  // Filter
  // =======================================================

  const filteredBubbles =
    selectedGenre ===
    'すべて'
      ? bubbles
      : bubbles.filter(
          (b) =>
            b.genre ===
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
  // MENU
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
  // ALBUM
  // =======================================================

  return (
    <div
      style={
        getContainerStyle()
      }
    >
      {/* ================================================ */}
      {/* HEADER */}
      {/* ================================================ */}

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
                  m,
                  i
                ) => (
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
                          m
                            .avatar
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

          {/* 停止ボタン */}
          <button
            style={{
              ...styles.pauseBtn,

              backgroundColor:
                isPaused
                  ? '#28a745'
                  : 'rgba(0,0,0,0.45)'
            }}
            onClick={() =>
              setIsPaused(
                (prev) =>
                  !prev
              )
            }
          >
            {isPaused
              ? '▶ 再生'
              : '⏸ 停止'}
          </button>

          <button
            style={
              styles.tocToggleBtn
            }
            onClick={() =>
              setIsTocOpen(
                (prev) =>
                  !prev
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

        {/* ジャンル */}
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

      {/* ================================================ */}
      {/* TOC */}
      {/* ================================================ */}

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
                      b,
                      idx
                    ) => (
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
              {/* 背景 */}
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

              {/* Speed */}
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
                  🫧 浮遊スピード
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

              {/* Bubble information */}
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
                  🫧 バブル情報
                </div>

                <div
                  style={{
                    color:
                      '#aaa',
                    fontSize:
                      '11px',
                    lineHeight:
                      1.7
                  }}
                >
                  写真入り:
                  {' '}
                  {
                    filteredBubbles.length
                  }
                  個
                  <br />
                  空バブル:
                  {' '}
                  {
                    decorativeBubbles.length
                  }
                  個
                  <br />
                  状態:
                  {' '}
                  {isPaused
                    ? '停止中'
                    : '浮遊中'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================ */}
      {/* EMPTY MESSAGE */}
      {/* ================================================ */}

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
          「＋ 写真を追加」から写真を追加できます ✨
          <br />
          <span
            style={{
              fontSize:
                '12px',
              opacity:
                0.7
            }}
          >
            🫧 写真がなくてもシャボン玉が浮遊します
          </span>
        </div>
      )}

      {/* ================================================ */}
      {/* STAGE */}
      {/* ================================================ */}

      <div
        style={{
          ...styles.stage,

          animationPlayState:
            isPaused
              ? 'paused'
              : 'running'
        }}
      >
        {/* ---------------------------------------------- */}
        {/* 空バブル */}
        {/* ---------------------------------------------- */}

        {decorativeBubbles.map(
          (b) => (
            <div
              key={b.id}
              style={{
                ...styles.decorativeBubble,

                left:
                  `${b.left}%`,

                width:
                  `${b.size}px`,

                height:
                  `${b.size}px`,

                opacity:
                  b.opacity,

                zIndex:
                  Math.floor(
                    b.depth *
                      40
                  ),

                animation: `
                  floatUp
                  ${b.duration}s
                  linear
                  ${b.delay}s
                  infinite,

                  sway
                  ${b.swayDuration}s
                  ease-in-out
                  infinite
                  alternate
                `,

                animationPlayState:
                  isPaused
                    ? 'paused'
                    : 'running'
              }}
            >
              <EmptyBubble
                size={
                  b.size
                }
                rainbowAngle={
                  b.rainbowAngle
                }
                rainbowStrength={
                  b.rainbowStrength
                }
              />
            </div>
          )
        )}

        {/* ---------------------------------------------- */}
        {/* 写真バブル */}
        {/* ---------------------------------------------- */}

        {filteredBubbles.map(
          (b) => {
            const duration =
              Math.floor(
                (
                  1.15 -
                  (b.depth ||
                    0.5) *
                    0.30
                ) *
                  getBaseDuration()
              );

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

                  left:
                    `${b.left}%`,

                  width:
                    `${b.size}px`,

                  height:
                    `${b.size}px`,

                  zIndex:
                    b.zIndex,

                  opacity:
                    b.opacity,

                  animation: `
                    floatUp
                    ${duration}s
                    linear
                    ${b.delay}s
                    infinite,

                    sway
                    ${b.swayDuration}s
                    ease-in-out
                    infinite
                    alternate
                  `,

                  animationPlayState:
                    isPaused
                      ? 'paused'
                      : 'running'
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
                      b.size
                    }

                    rainbowAngle={
                      b.rainbowAngle ??
                      0
                    }

                    rainbowStrength={
                      b.rainbowStrength ??
                      0.08
                    }

                    highlightX={
                      b.highlightX ??
                      -0.25
                    }

                    highlightY={
                      b.highlightY ??
                      -0.3
                    }

                    distortion={
                      b.distortion ??
                      0.06
                    }
                  />

                  {b.authorAvatar && (
                    <div
                      title={`${b.author} (${b.genre || '未分類'})`}
                      style={{
                        ...styles.bubbleAuthorBadge,

                        backgroundColor:
                          b
                            .authorAvatar
                            .bg ||
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

      {/* ================================================ */}
      {/* MODAL */}
      {/* ================================================ */}

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

      {/* ================================================ */}
      {/* CSS */}
      {/* ================================================ */}

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          html,
          body,
          #root {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }

          @keyframes floatUp {
            0% {
              transform:
                translate3d(0, 115vh, 0)
                scale(0.92);
            }

            12% {
              transform:
                translate3d(0, 90vh, 0)
                scale(0.96);
            }

            50% {
              transform:
                translate3d(0, 25vh, 0)
                scale(1);
            }

            85% {
              transform:
                translate3d(0, -45vh, 0)
                scale(1.02);
            }

            100% {
              transform:
                translate3d(0, -150vh, 0)
                scale(1.05);
            }
          }

          @keyframes sway {
            0% {
              margin-left: -28px;
            }

            50% {
              margin-left: 8px;
            }

            100% {
              margin-left: 28px;
            }
          }

          @keyframes bubbleShimmer {
            0% {
              opacity: 0.35;
            }

            45% {
              opacity: 0.65;
            }

            100% {
              opacity: 0.35;
            }
          }

          button,
          label {
            user-select: none;
            -webkit-tap-highlight-color:
              transparent;
          }

          ::-webkit-scrollbar {
            width: 6px;
          }

          ::-webkit-scrollbar-track {
            background: transparent;
          }

          ::-webkit-scrollbar-thumb {
            background:
              rgba(255,255,255,0.25);
            border-radius: 10px;
          }
        `}
      </style>
    </div>
  );
}

// =========================================================
// 6. Styles
// =========================================================

const styles = {
  // -------------------------------------------------------
  // Auth
  // -------------------------------------------------------

  authContainer: {
    width: '100vw',
    height: '100vh',
    background:
      'linear-gradient(135deg, #111e2e, #0a1118)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily:
      'sans-serif'
  },

  authCard: {
    backgroundColor:
      'rgba(255,255,255,0.05)',
    backdropFilter:
      'blur(10px)',
    padding: '30px',
    borderRadius:
      '12px',
    width: '320px',
    boxShadow:
      '0 8px 32px rgba(0,0,0,0.3)',
    border:
      '1px solid rgba(255,255,255,0.1)',
    textAlign:
      'center'
  },

  appTitle: {
    color: '#fff',
    fontSize: '22px',
    marginBottom:
      '20px'
  },

  authTabGroup: {
    display: 'flex',
    justifyContent:
      'space-around',
    marginBottom:
      '20px'
  },

  authTabBtn: {
    background:
      'none',
    border:
      'none',
    padding:
      '8px 16px',
    cursor:
      'pointer',
    fontSize:
      '14px',
    fontWeight:
      'bold'
  },

  form: {
    display:
      'flex',
    flexDirection:
      'column',
    gap:
      '12px'
  },

  avatarPickerSection: {
    display:
      'flex',
    flexDirection:
      'column',
    gap:
      '8px',
    marginBottom:
      '8px'
  },

  avatarGrid: {
    display:
      'flex',
    justifyContent:
      'center',
    gap:
      '8px',
    flexWrap:
      'wrap'
  },

  avatarBadge: {
    width:
      '36px',
    height:
      '36px',
    borderRadius:
      '50%',
    display:
      'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    cursor:
      'pointer',
    fontSize:
      '18px'
  },

  avatarBadgeSmall: {
    width:
      '22px',
    height:
      '22px',
    borderRadius:
      '50%',
    display:
      'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    overflow:
      'hidden'
  },

  input: {
    padding:
      '10px 12px',
    borderRadius:
      '6px',
    border:
      '1px solid rgba(255,255,255,0.2)',
    backgroundColor:
      'rgba(0,0,0,0.2)',
    color:
      '#fff',
    fontSize:
      '13px',
    outline:
      'none'
  },

  submitBtn: {
    padding:
      '10px',
    backgroundColor:
      '#007bff',
    color:
      '#fff',
    border:
      'none',
    borderRadius:
      '6px',
    cursor:
      'pointer',
    fontWeight:
      'bold',
    fontSize:
      '14px',
    marginTop:
      '10px'
  },

  // -------------------------------------------------------
  // Menu
  // -------------------------------------------------------

  menuContainer: {
    width:
      '100vw',
    height:
      '100vh',
    background:
      'linear-gradient(135deg, #0f2027, #2c5364)',
    display:
      'flex',
    flexDirection:
      'column',
    alignItems:
      'center',
    justifyContent:
      'center',
    fontFamily:
      'sans-serif',
    position:
      'relative'
  },

  menuHeader: {
    position:
      'absolute',
    top:
      '20px',
    right:
      '20px',
    color:
      '#fff',
    fontSize:
      '13px',
    display:
      'flex',
    gap:
      '15px',
    alignItems:
      'center'
  },

  logoutBtn: {
    backgroundColor:
      'rgba(255,255,255,0.2)',
    color:
      '#fff',
    border:
      'none',
    padding:
      '4px 10px',
    borderRadius:
      '4px',
    cursor:
      'pointer',
    fontSize:
      '11px'
  },

  menuGrid: {
    display:
      'flex',
    gap:
      '20px',
    flexWrap:
      'wrap',
    justifyContent:
      'center'
  },

  menuCard: {
    backgroundColor:
      'rgba(255,255,255,0.08)',
    backdropFilter:
      'blur(8px)',
    width:
      '240px',
    padding:
      '24px',
    borderRadius:
      '12px',
    border:
      '1px solid rgba(255,255,255,0.1)',
    color:
      '#fff',
    display:
      'flex',
    flexDirection:
      'column',
    alignItems:
      'center',
    textAlign:
      'center'
  },

  cardIcon: {
    fontSize:
      '40px',
    marginBottom:
      '10px'
  },

  enterBtn: {
    padding:
      '8px 20px',
    backgroundColor:
      '#28a745',
    color:
      '#fff',
    border:
      'none',
    borderRadius:
      '20px',
    cursor:
      'pointer',
    fontWeight:
      'bold',
    fontSize:
      '13px',
    marginTop:
      '10px',
    width:
      '100%'
  },

  // -------------------------------------------------------
  // Album
  // -------------------------------------------------------

  container: {
    width:
      '100vw',
    height:
      '100vh',
    overflow:
      'hidden',
    position:
      'relative',
    fontFamily:
      'sans-serif',
    transition:
      'background 0.5s ease'
  },

  header: {
    position:
      'absolute',
    top:
      '15px',
    left:
      '15px',
    right:
      '15px',
    zIndex:
      150,
    display:
      'flex',
    flexDirection:
      'column',
    gap:
      '10px',
    pointerEvents:
      'none'
  },

  topControlRow: {
    display:
      'flex',
    gap:
      '10px',
    alignItems:
      'center',
    flexWrap:
      'wrap',
    pointerEvents:
      'auto'
  },

  backMenuBtn: {
    padding:
      '7px 13px',
    backgroundColor:
      'rgba(255,255,255,0.18)',
    border:
      'none',
    borderRadius:
      '18px',
    color:
      '#fff',
    fontSize:
      '12px',
    cursor:
      'pointer',
    backdropFilter:
      'blur(8px)'
  },

  badge: {
    padding:
      '7px 13px',
    backgroundColor:
      'rgba(0,0,0,0.42)',
    borderRadius:
      '18px',
    color:
      '#fff',
    fontSize:
      '12px',
    backdropFilter:
      'blur(8px)'
  },

  membersBar: {
    display:
      'flex',
    alignItems:
      'center',
    gap:
      '5px',
    backgroundColor:
      'rgba(0,0,0,0.3)',
    padding:
      '4px 8px',
    borderRadius:
      '15px'
  },

  memberTag: {
    display:
      'flex',
    alignItems:
      'center',
    gap:
      '3px',
    backgroundColor:
      'rgba(255,255,255,0.15)',
    padding:
      '2px 6px',
    borderRadius:
      '10px'
  },

  memberName: {
    fontSize:
      '10px',
    color:
      '#fff'
  },

  pauseBtn: {
    padding:
      '7px 13px',
    border:
      '1px solid rgba(255,255,255,0.25)',
    borderRadius:
      '18px',
    color:
      '#fff',
    fontSize:
      '12px',
    cursor:
      'pointer',
    backdropFilter:
      'blur(8px)',
    fontWeight:
      'bold'
  },

  tocToggleBtn: {
    padding:
      '7px 13px',
    backgroundColor:
      '#6c757d',
    border:
      'none',
    borderRadius:
      '18px',
    color:
      '#fff',
    fontSize:
      '12px',
    cursor:
      'pointer'
  },

  uploadBtn: {
    padding:
      '7px 13px',
    backgroundColor:
      '#28a745',
    borderRadius:
      '18px',
    color:
      '#fff',
    fontSize:
      '12px',
    cursor:
      'pointer',
    fontWeight:
      'bold'
  },

  genreTabBar: {
    display:
      'flex',
    gap:
      '6px',
    alignItems:
      'center',
    flexWrap:
      'wrap',
    pointerEvents:
      'auto'
  },

  genreLabel: {
    color:
      '#fff',
    fontSize:
      '12px',
    marginRight:
      '4px'
  },

  genreTabBtn: {
    padding:
      '5px 11px',
    border:
      'none',
    borderRadius:
      '14px',
    fontSize:
      '11px',
    cursor:
      'pointer'
  },

  addGenreBtn: {
    padding:
      '5px 11px',
    backgroundColor:
      'rgba(255,255,255,0.2)',
    border:
      '1px dashed #fff',
    borderRadius:
      '14px',
    color:
      '#fff',
    fontSize:
      '11px',
    cursor:
      'pointer'
  },

  // -------------------------------------------------------
  // Stage
  // -------------------------------------------------------

  stage: {
    width:
      '100%',
    height:
      '100%',
    position:
      'relative',
    overflow:
      'hidden'
  },

  bubbleWrapper: {
    position:
      'absolute',
    bottom:
      '-180px',
    cursor:
      'pointer',
    willChange:
      'transform',
    transform:
      'translateZ(0)'
  },

  bubbleGlass: {
    position:
      'relative',
    width:
      '100%',
    height:
      '100%',
    borderRadius:
      '50%',
    filter:
      'drop-shadow(0 12px 20px rgba(0,0,0,0.32))'
  },

  decorativeBubble: {
    position:
      'absolute',
    bottom:
      '-180px',
    pointerEvents:
      'none',
    willChange:
      'transform',
    transform:
      'translateZ(0)',
    filter:
      'drop-shadow(0 7px 13px rgba(0,0,0,0.15))'
  },

  bubbleAuthorBadge: {
    position:
      'absolute',
    bottom:
      '4px',
    right:
      '4px',
    width:
      '22px',
    height:
      '22px',
    borderRadius:
      '50%',
    display:
      'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    boxShadow:
      '0 2px 5px rgba(0,0,0,0.5)',
    zIndex:
      10,
    overflow:
      'hidden'
  },

  emptyText: {
    position:
      'absolute',
    top:
      '50%',
    left:
      '50%',
    transform:
      'translate(-50%, -50%)',
    color:
      'rgba(255,255,255,0.62)',
    textAlign:
      'center',
    fontSize:
      '14px',
    pointerEvents:
      'none',
    lineHeight:
      '1.7',
    zIndex:
      100
  },

  // -------------------------------------------------------
  // TOC
  // -------------------------------------------------------

  tocPanel: {
    position:
      'absolute',
    top:
      0,
    left:
      0,
    width:
      '340px',
    height:
      '100%',
    backgroundColor:
      'rgba(20,20,20,0.95)',
    backdropFilter:
      'blur(14px)',
    zIndex:
      200,
    transition:
      'transform 0.3s ease',
    padding:
      '20px',
    boxSizing:
      'border-box',
    color:
      '#fff',
    display:
      'flex',
    flexDirection:
      'column'
  },

  tocHeader: {
    display:
      'flex',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    marginBottom:
      '15px'
  },

  tocTitle: {
    fontSize:
      '16px',
    margin:
      0
  },

  closeTocBtn: {
    background:
      'none',
    border:
      'none',
    color:
      '#fff',
    fontSize:
      '18px',
    cursor:
      'pointer'
  },

  tocTabGroup: {
    display:
      'flex',
    borderBottom:
      '1px solid #333',
    marginBottom:
      '15px'
  },

  tocTabBtn: {
    flex:
      1,
    background:
      'none',
    border:
      'none',
    padding:
      '8px',
    cursor:
      'pointer',
    fontSize:
      '12px'
  },

  tocContent: {
    flex:
      1,
    overflowY:
      'auto'
  },

  tocListContainer: {
    width:
      '100%'
  },

  listHeader: {
    display:
      'flex',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    marginBottom:
      '10px'
  },

  emptyTocText: {
    fontSize:
      '12px',
    color:
      '#888',
    textAlign:
      'center',
    marginTop:
      '20px'
  },

  thumbGrid: {
    display:
      'grid',
    gridTemplateColumns:
      'repeat(2, 1fr)',
    gap:
      '10px'
  },

  thumbCard: {
    backgroundColor:
      'rgba(255,255,255,0.05)',
    borderRadius:
      '6px',
    padding:
      '6px',
    display:
      'flex',
    flexDirection:
      'column',
    gap:
      '4px'
  },

  thumbImg: {
    width:
      '100%',
    height:
      '80px',
    objectFit:
      'cover',
    borderRadius:
      '4px',
    cursor:
      'pointer'
  },

  thumbAuthorBox: {
    display:
      'flex',
    alignItems:
      'center',
    gap:
      '4px'
  },

  thumbAuthorText: {
    fontSize:
      '10px',
    color:
      '#ccc',
    overflow:
      'hidden',
    textOverflow:
      'ellipsis',
    whiteSpace:
      'nowrap'
  },

  deleteThumbBtn: {
    backgroundColor:
      '#dc3545',
    border:
      'none',
    color:
      '#fff',
    fontSize:
      '10px',
    borderRadius:
      '3px',
    padding:
      '3px 5px',
    cursor:
      'pointer'
  },

  clearAllBtn: {
    backgroundColor:
      '#dc3545',
    border:
      'none',
    color:
      '#fff',
    fontSize:
      '10px',
    borderRadius:
      '3px',
    padding:
      '4px 8px',
    cursor:
      'pointer'
  },

  // -------------------------------------------------------
  // Settings
  // -------------------------------------------------------

  settingSection: {
    marginBottom:
      '22px'
  },

  settingLabel: {
    fontSize:
      '12px',
    fontWeight:
      'bold',
    marginBottom:
      '8px',
    color:
      '#ddd'
  },

  subLabel: {
    fontSize:
      '11px',
    color:
      '#aaa'
  },

  presetGroup: {
    display:
      'flex',
    gap:
      '8px',
    marginBottom:
      '10px'
  },

  presetBtn: {
    width:
      '30px',
    height:
      '30px',
    borderRadius:
      '50%',
    border:
      '1px solid #fff',
    cursor:
      'pointer'
  },

  colorPickerRow: {
    display:
      'flex',
    alignItems:
      'center',
    gap:
      '10px'
  },

  colorInput: {
    border:
      'none',
    width:
      '30px',
    height:
      '30px',
    cursor:
      'pointer',
    background:
      'none'
  },

  bgUploadBtn: {
    display:
      'inline-block',
    padding:
      '7px 12px',
    backgroundColor:
      '#333',
    border:
      '1px solid #555',
    borderRadius:
      '5px',
    fontSize:
      '11px',
    cursor:
      'pointer',
    color:
      '#fff'
  },

  speedGroup: {
    display:
      'flex',
    gap:
      '6px'
  },

  speedBtn: {
    flex:
      1,
    border:
      'none',
    color:
      '#fff',
    padding:
      '7px',
    borderRadius:
      '5px',
    fontSize:
      '11px',
    cursor:
      'pointer'
  },

  // -------------------------------------------------------
  // Modal
  // -------------------------------------------------------

  modalOverlay: {
    position:
      'fixed',
    top:
      0,
    left:
      0,
    width:
      '100vw',
    height:
      '100vh',
    backgroundColor:
      'rgba(0,0,0,0.88)',
    display:
      'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    zIndex:
      300
  },

  modalCard: {
    backgroundColor:
      '#111',
    padding:
      '15px',
    borderRadius:
      '10px',
    maxWidth:
      '90vw',
    maxHeight:
      '90vh',
    display:
      'flex',
    flexDirection:
      'column',
    alignItems:
      'center',
    gap:
      '10px',
    boxShadow:
      '0 20px 60px rgba(0,0,0,0.6)'
  },

  modalImg: {
    maxWidth:
      '100%',
    maxHeight:
      '75vh',
    objectFit:
      'contain',
    borderRadius:
      '5px'
  },

  closeBtn: {
    padding:
      '7px 18px',
    backgroundColor:
      '#6c757d',
    border:
      'none',
    color:
      '#fff',
    borderRadius:
      '5px',
    cursor:
      'pointer',
    fontSize:
      '12px'
  }
};