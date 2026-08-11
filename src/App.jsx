import React, {
  useState,
  useEffect,
  useRef
} from 'react';

import {
  initializeApp
} from 'firebase/app';

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
  {
    type: 'emoji',
    emoji: '🐱',
    bg: '#ff7675'
  },
  {
    type: 'emoji',
    emoji: '🐶',
    bg: '#74b9ff'
  },
  {
    type: 'emoji',
    emoji: '🐰',
    bg: '#fd79a8'
  },
  {
    type: 'emoji',
    emoji: '🦊',
    bg: '#ffeaa7'
  },
  {
    type: 'emoji',
    emoji: '🐼',
    bg: '#55efc4'
  },
  {
    type: 'emoji',
    emoji: '🦁',
    bg: '#e17055'
  }
];


// =========================================================
// 3. シャボン玉Canvas
//
// ・中央はほぼ歪ませない
// ・外周だけ球面屈折
// ・人物写真が壊れにくい
// ・虹色の膜
// ・外周リング
// ・ハイライト
// =========================================================

function BubbleCanvas({
  src,
  size
}) {
  const canvasRef = useRef(null);

  useEffect(() => {

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const img = new Image();

    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {

      const w = size;
      const h = size;

      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(
        0,
        0,
        w,
        h
      );

      const cx = w / 2;
      const cy = h / 2;

      const radius =
        Math.min(w, h) / 2 - 2;


      // ==================================================
      // 元画像を正方形キャンバスへ
      // object-fit: cover 相当
      // ==================================================

      const offCanvas =
        document.createElement('canvas');

      offCanvas.width = w;
      offCanvas.height = h;

      const offCtx =
        offCanvas.getContext('2d');

      const imgRatio =
        img.width / img.height;

      const canvasRatio =
        w / h;

      let drawW;
      let drawH;

      if (imgRatio > canvasRatio) {

        drawH = h;
        drawW = h * imgRatio;

      } else {

        drawW = w;
        drawH = w / imgRatio;

      }

      offCtx.drawImage(
        img,
        cx - drawW / 2,
        cy - drawH / 2,
        drawW,
        drawH
      );


      const srcImgData =
        offCtx.getImageData(
          0,
          0,
          w,
          h
        );

      const srcData =
        srcImgData.data;


      const output =
        ctx.createImageData(
          w,
          h
        );

      const outData =
        output.data;


      // ==================================================
      // 写真の屈折
      //
      // 中央82% → ほぼそのまま
      // 外側18% → 徐々に球面化
      // ==================================================

      const distortionStart = 0.78;

      for (
        let y = 0;
        y < h;
        y++
      ) {

        for (
          let x = 0;
          x < w;
          x++
        ) {

          const dx =
            x - cx;

          const dy =
            y - cy;

          const dist =
            Math.sqrt(
              dx * dx +
              dy * dy
            );

          const outIndex =
            (y * w + x) * 4;


          // 円の外
          if (dist > radius) {

            outData[
              outIndex + 3
            ] = 0;

            continue;
          }


          const normalized =
            dist / radius;


          // --------------------------------------------
          // 外周だけ歪ませる
          // --------------------------------------------

          let edgeFactor = 0;

          if (
            normalized >
            distortionStart
          ) {

            edgeFactor =
              (
                normalized -
                distortionStart
              ) /
              (
                1 -
                distortionStart
              );

            edgeFactor =
              Math.min(
                1,
                edgeFactor
              );

            // smoothstep
            edgeFactor =
              edgeFactor *
              edgeFactor *
              (
                3 -
                2 * edgeFactor
              );
          }


          /*
           * 歪みをかなり弱くする。
           *
           * 以前のような
           * 「人物の顔がグニャッとする」
           * 現象を抑える。
           */

          const strength =
            0.20 *
            edgeFactor;


          const lens =
            Math.sin(
              normalized *
              Math.PI /
              2
            );


          const nx =
            -dx *
            strength *
            lens;

          const ny =
            -dy *
            strength *
            lens;


          const sampleX =
            Math.floor(
              cx +
              dx +
              nx
            );

          const sampleY =
            Math.floor(
              cy +
              dy +
              ny
            );


          const sx =
            Math.max(
              0,
              Math.min(
                w - 1,
                sampleX
              )
            );

          const sy =
            Math.max(
              0,
              Math.min(
                h - 1,
                sampleY
              )
            );


          const srcIndex =
            (
              sy * w +
              sx
            ) * 4;


          outData[outIndex] =
            srcData[srcIndex];

          outData[outIndex + 1] =
            srcData[srcIndex + 1];

          outData[outIndex + 2] =
            srcData[srcIndex + 2];

          outData[outIndex + 3] =
            255;
        }
      }


      ctx.putImageData(
        output,
        0,
        0
      );


      // ==================================================
      // 球面の陰影
      // ==================================================

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


      const shade =
        ctx.createRadialGradient(
          cx - radius * 0.30,
          cy - radius * 0.35,
          radius * 0.05,

          cx,
          cy,
          radius
        );


      shade.addColorStop(
        0,
        'rgba(255,255,255,0.08)'
      );

      shade.addColorStop(
        0.55,
        'rgba(255,255,255,0.015)'
      );

      shade.addColorStop(
        0.82,
        'rgba(0,0,0,0.04)'
      );

      shade.addColorStop(
        1,
        'rgba(0,0,0,0.28)'
      );


      ctx.globalCompositeOperation =
        'multiply';

      ctx.fillStyle =
        shade;

      ctx.fill();

      ctx.restore();


      // ==================================================
      // 虹色の薄い膜
      // ==================================================

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


      const rainbow =
        ctx.createConicGradient(
          -Math.PI / 2,
          cx,
          cy
        );


      rainbow.addColorStop(
        0,
        'rgba(255,80,160,0.12)'
      );

      rainbow.addColorStop(
        0.18,
        'rgba(100,180,255,0.10)'
      );

      rainbow.addColorStop(
        0.35,
        'rgba(70,255,230,0.10)'
      );

      rainbow.addColorStop(
        0.52,
        'rgba(220,255,100,0.10)'
      );

      rainbow.addColorStop(
        0.68,
        'rgba(255,170,80,0.12)'
      );

      rainbow.addColorStop(
        0.84,
        'rgba(210,100,255,0.12)'
      );

      rainbow.addColorStop(
        1,
        'rgba(255,80,160,0.12)'
      );


      ctx.globalCompositeOperation =
        'screen';

      ctx.fillStyle =
        rainbow;

      ctx.fill();

      ctx.restore();


      // ==================================================
      // 外周の虹色リング
      // ==================================================

      ctx.save();


      const ring =
        ctx.createConicGradient(
          0,
          cx,
          cy
        );


      ring.addColorStop(
        0,
        'rgba(255,90,180,0.65)'
      );

      ring.addColorStop(
        0.16,
        'rgba(100,180,255,0.55)'
      );

      ring.addColorStop(
        0.32,
        'rgba(80,255,230,0.55)'
      );

      ring.addColorStop(
        0.48,
        'rgba(230,255,100,0.50)'
      );

      ring.addColorStop(
        0.64,
        'rgba(255,150,100,0.55)'
      );

      ring.addColorStop(
        0.80,
        'rgba(190,100,255,0.55)'
      );

      ring.addColorStop(
        1,
        'rgba(255,90,180,0.65)'
      );


      ctx.globalCompositeOperation =
        'screen';

      ctx.strokeStyle =
        ring;

      ctx.lineWidth =
        Math.max(
          2,
          size * 0.025
        );


      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        radius -
          ctx.lineWidth / 2,
        0,
        Math.PI * 2
      );

      ctx.stroke();

      ctx.restore();


      // ==================================================
      // 外周の透明膜
      // ==================================================

      ctx.save();


      const edge =
        ctx.createRadialGradient(
          cx,
          cy,
          radius * 0.70,

          cx,
          cy,
          radius
        );


      edge.addColorStop(
        0,
        'rgba(255,255,255,0)'
      );

      edge.addColorStop(
        0.78,
        'rgba(255,255,255,0)'
      );

      edge.addColorStop(
        0.92,
        'rgba(255,255,255,0.08)'
      );

      edge.addColorStop(
        0.98,
        'rgba(255,255,255,0.32)'
      );

      edge.addColorStop(
        1,
        'rgba(255,255,255,0.55)'
      );


      ctx.globalCompositeOperation =
        'screen';

      ctx.fillStyle =
        edge;

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


      // ==================================================
      // 大きなハイライト
      // ==================================================

      ctx.save();

      ctx.globalCompositeOperation =
        'screen';


      const hx =
        cx -
        radius * 0.30;

      const hy =
        cy -
        radius * 0.32;


      const highlight =
        ctx.createRadialGradient(
          hx,
          hy,
          0,

          hx,
          hy,
          radius * 0.45
        );


      highlight.addColorStop(
        0,
        'rgba(255,255,255,0.60)'
      );

      highlight.addColorStop(
        0.15,
        'rgba(255,255,255,0.28)'
      );

      highlight.addColorStop(
        0.40,
        'rgba(255,255,255,0.08)'
      );

      highlight.addColorStop(
        1,
        'rgba(255,255,255,0)'
      );


      ctx.fillStyle =
        highlight;

      ctx.beginPath();

      ctx.arc(
        hx,
        hy,
        radius * 0.45,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();


      // ==================================================
      // 小さい反射
      // ==================================================

      ctx.save();

      ctx.globalCompositeOperation =
        'screen';


      const sx =
        cx +
        radius * 0.25;

      const sy =
        cy -
        radius * 0.35;


      const small =
        ctx.createRadialGradient(
          sx,
          sy,
          0,

          sx,
          sy,
          radius * 0.18
        );


      small.addColorStop(
        0,
        'rgba(255,255,255,0.45)'
      );

      small.addColorStop(
        0.4,
        'rgba(255,255,255,0.15)'
      );

      small.addColorStop(
        1,
        'rgba(255,255,255,0)'
      );


      ctx.fillStyle =
        small;

      ctx.beginPath();

      ctx.arc(
        sx,
        sy,
        radius * 0.18,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

    };


    img.onerror = () => {
      console.error(
        '画像の読み込みに失敗しました'
      );
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

  // -------------------------------------------------------
  // ユーザー
  // -------------------------------------------------------

  const [
    currentUser,
    setCurrentUser
  ] = useState(() => {

    const savedUser =
      localStorage.getItem(
        'currentUser'
      );

    return savedUser
      ? JSON.parse(savedUser)
      : null;
  });


  // -------------------------------------------------------
  // 認証
  // -------------------------------------------------------

  const [
    authMode,
    setAuthMode
  ] = useState('login');

  const [
    usernameInput,
    setUsernameInput
  ] = useState('');

  const [
    passwordInput,
    setPasswordInput
  ] = useState('');


  // -------------------------------------------------------
  // アバター
  // -------------------------------------------------------

  const [
    selectedAvatarIdx,
    setSelectedAvatarIdx
  ] = useState(0);

  const [
    customAvatar,
    setCustomAvatar
  ] = useState(null);


  // -------------------------------------------------------
  // 画面
  // -------------------------------------------------------

  const [
    currentScreen,
    setCurrentScreen
  ] = useState(() => {

    return localStorage.getItem(
      'currentUser'
    )
      ? 'menu'
      : 'auth';
  });


  // -------------------------------------------------------
  // アルバム
  // -------------------------------------------------------

  const [
    activeTab,
    setActiveTab
  ] = useState('private');

  const [
    roomNumber,
    setRoomNumber
  ] = useState('');

  const [
    roomInput,
    setRoomInput
  ] = useState('');


  // -------------------------------------------------------
  // ジャンル
  // -------------------------------------------------------

  const [
    genres,
    setGenres
  ] = useState([
    'すべて',
    '日常',
    '旅行',
    'イベント'
  ]);

  const [
    selectedGenre,
    setSelectedGenre
  ] = useState('すべて');


  // -------------------------------------------------------
  // メンバー
  // -------------------------------------------------------

  const [
    roomMembers,
    setRoomMembers
  ] = useState([]);


  // -------------------------------------------------------
  // シャボン玉
  // -------------------------------------------------------

  const [
    bubbles,
    setBubbles
  ] = useState([]);


  // -------------------------------------------------------
  // 背景
  // -------------------------------------------------------

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


  // -------------------------------------------------------
  // モーダル
  // -------------------------------------------------------

  const [
    selectedImage,
    setSelectedImage
  ] = useState(null);


  // -------------------------------------------------------
  // 目次
  // -------------------------------------------------------

  const [
    isTocOpen,
    setIsTocOpen
  ] = useState(false);

  const [
    tocActiveTab,
    setTocActiveTab
  ] = useState('photos');


  // -------------------------------------------------------
  // 速度
  // -------------------------------------------------------

  const [
    speedMode,
    setSpeedMode
  ] = useState('normal');


  // -------------------------------------------------------
  // ★ 停止状態
  // -------------------------------------------------------

  const [
    isPaused,
    setIsPaused
  ] = useState(false);


  // =======================================================
  // Album Key
  // =======================================================

  const getAlbumKey = () => {

    if (
      activeTab === 'private'
    ) {

      return `private_${currentUser?.username}`;

    }

    return `shared_${roomNumber}`;
  };


  const albumKey =
    getAlbumKey();


  // =======================================================
  // Wake Lock
  // =======================================================

  useEffect(() => {

    let wakeLock = null;


    const requestWakeLock =
      async () => {

        try {

          if (
            'wakeLock' in navigator
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
      currentScreen === 'album'
    ) {

      requestWakeLock();

    }


    return () => {

      if (
        wakeLock !== null
      ) {

        wakeLock.release();

        wakeLock = null;
      }
    };

  }, [currentScreen]);


  // =======================================================
  // Firestore リアルタイム同期
  // =======================================================

  useEffect(() => {

    if (
      currentScreen !== 'album' ||
      !albumKey
    ) {

      return;
    }


    // -----------------------------------------------------
    // シャボン玉
    // -----------------------------------------------------

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

          const loadedBubbles =
            snapshot.docs.map(
              bubbleDoc => ({
                id: bubbleDoc.id,
                ...bubbleDoc.data()
              })
            );

          setBubbles(
            loadedBubbles
          );
        }
      );


    // -----------------------------------------------------
    // 設定
    // -----------------------------------------------------

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

          if (
            docSnap.exists()
          ) {

            const data =
              docSnap.data();

            setAlbumSettings(
              data
            );


            if (
              data.genres &&
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

              bgColor:
                '#0f2027',

              bgImage:
                null,

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


    // -----------------------------------------------------
    // メンバー
    // -----------------------------------------------------

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

            const loadedMembers =
              snapshot.docs.map(
                memberDoc =>
                  memberDoc.data()
              );

            setRoomMembers(
              loadedMembers
            );
          }
        );


      if (
        currentUser?.username
      ) {

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

  const updateSettings =
    async (newSettings) => {

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
  // ジャンル追加
  // =======================================================

  const handleAddGenre = () => {

    const newGenre =
      prompt(
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

        const nextGenres = [
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
  // アバターアップロード
  // =======================================================

  const handleCustomAvatarUpload =
    (e) => {

      const file =
        e.target.files[0];

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


  // =======================================================
  // 選択中アバター
  // =======================================================

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
  // 認証
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


        // -------------------------------------------------
        // 新規登録
        // -------------------------------------------------

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


          alert(
            'アカウントを作成しました！'
          );


          setCurrentScreen(
            'menu'
          );


        } else {

          // -----------------------------------------------
          // ログイン
          // -----------------------------------------------

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


      } catch (err) {

        console.error(err);

        alert(
          '認証処理中にエラーが発生しました。'
        );
      }
    };


  // =======================================================
  // ログアウト
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
  // プライベート
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


  // =======================================================
  // 共有ルーム
  // =======================================================

  const enterSharedAlbum =
    (e) => {

      e.preventDefault();


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
  // 写真追加
  // =======================================================

  const handleImageUpload =
    (e) => {

      const files =
        Array.from(
          e.target.files
        );


      if (
        files.length === 0
      ) {

        return;
      }


      const genreToAssign =
        selectedGenre === 'すべて'

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


      // 同じファイルを再選択できるようにする
      e.target.value = '';
    };


  // =======================================================
  // 背景画像
  // =======================================================

  const handleBgImageUpload =
    (e) => {

      const file =
        e.target.files[0];

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
  // 浮遊速度
  // =======================================================

  const getBaseDuration =
    () => {

      if (
        speedMode === 'slow'
      ) {

        return 55;
      }


      if (
        speedMode === 'fast'
      ) {

        return 25;
      }


      return 40;
    };


  // =======================================================
  // シャボン玉作成
  // =======================================================

  const createBubble =
    async (
      imgSrc,
      genre
    ) => {

      /*
       * 以前よりかなり大きく。
       *
       * depth:
       * 0 → 小さめ
       * 1 → 大きめ
       *
       * 120〜280px
       */

      const depth =
        Math.random();


      const size =
        Math.floor(
          depth * 160
        ) + 120;


      const opacity =
        0.58 +
        depth * 0.42;


      const zIndex =
        Math.floor(
          depth * 100
        );


      const newBubbleData = {

        src:
          imgSrc,

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
  // アニメーション終了
  // =======================================================

  const handleAnimationEnd =
    (id) => {

      /*
       * 停止中はbubbleRestなので
       * ここには基本的に来ない。
       */

      if (isPaused) {
        return;
      }


      setBubbles(
        prev =>
          prev.map(
            b => {

              if (
                b.id === id
              ) {

                const depth =
                  Math.random();


                return {

                  ...b,

                  depth,

                  left:
                    Math.floor(
                      Math.random() * 82
                    ) + 6,

                  size:
                    Math.floor(
                      depth * 160
                    ) + 120,

                  opacity:
                    0.58 +
                    depth * 0.42,

                  zIndex:
                    Math.floor(
                      depth * 100
                    )
                };
              }


              return b;
            }
          )
      );
    };


  // =======================================================
  // 写真削除
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
  // 全削除
  // =======================================================

  const handleClearAll =
    async () => {

      if (
        window.confirm(
          'このアルバムの写真をすべて削除しますか？'
        )
      ) {

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
          docSnap => {

            batch.delete(
              docSnap.ref
            );
          }
        );


        await batch.commit();


        setIsTocOpen(
          false
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
  // アバター表示
  // =======================================================

  const renderAvatarIcon =
    (
      avatarObj,
      sizeStyle = {}
    ) => {

      if (
        !avatarObj
      ) {

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
          b =>
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
                  authMode === 'login'
                    ? '2px solid #007bff'
                    : 'none',

                color:
                  authMode === 'login'
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
                  authMode === 'register'
                    ? '2px solid #007bff'
                    : 'none',

                color:
                  authMode === 'register'
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
                    fontSize: '12px'
                  }}
                >
                  アイコンを選択 / アップロード:
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
                            selectedAvatarIdx === idx

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

                      backgroundColor:
                        '#555',

                      border:
                        selectedAvatarIdx === -1

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
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
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

              gap:
                '8px'
            }}
          >

            <span
              style={{
                ...styles.avatarBadgeSmall,

                backgroundColor:
                  currentUser?.avatar?.bg ||
                  'transparent'
              }}
            >
              {renderAvatarIcon(
                currentUser?.avatar
              )}
            </span>


            <span>
              <strong>
                {currentUser?.username}
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
            marginBottom: '30px'
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
                width: '100%'
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
  // 画面3：アルバム
  // =======================================================

  return (

    <div
      style={
        getContainerStyle()
      }
    >

      {/* ==================================================
          ヘッダー
      ================================================== */}

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


          {/* =================================================
              メンバー
          ================================================= */}

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
                          m.avatar?.bg ||
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
                      {m.username}
                    </span>

                  </div>

                )
              )}

            </div>

          )}


          {/* =================================================
              目次
          ================================================= */}

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


          {/* =================================================
              停止ボタン
          ================================================= */}

          <button
            style={{
              ...styles.pauseBtn,

              backgroundColor:
                isPaused
                  ? '#007bff'
                  : 'rgba(255,255,255,0.20)'
            }}

            onClick={() =>
              setIsPaused(
                prev =>
                  !prev
              )
            }
          >
            {isPaused
              ? '▶ 再生'
              : 'Ⅱ 停止'}
          </button>


          {/* =================================================
              写真追加
          ================================================= */}

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


        {/* ==================================================
            ジャンル
        ================================================== */}

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
            g => (

              <button
                key={g}

                style={{
                  ...styles.genreTabBtn,

                  backgroundColor:
                    selectedGenre === g

                      ? '#007bff'

                      : 'rgba(255,255,255,0.15)',

                  color:
                    '#fff',

                  fontWeight:
                    selectedGenre === g
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


      {/* ==================================================
          目次パネル
      ================================================== */}

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
            {filteredBubbles.length}
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

          {/* =================================================
              写真一覧
          ================================================= */}

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
                  📷 [{selectedGenre}] の写真
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
                          src={b.src}
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
                                b.authorAvatar?.bg ||
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
                            {b.author ||
                              '不明'}
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


          {/* =================================================
              設定
          ================================================= */}

          {tocActiveTab ===
            'settings' && (

            <div>

              {/* ---------------------------------------------
                  背景
              --------------------------------------------- */}

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

                    onChange={e =>
                      updateSettings({
                        bgColor:
                          e.target.value,

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


              {/* ---------------------------------------------
                  速度
              --------------------------------------------- */}

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


              {/* ---------------------------------------------
                  停止状態
              --------------------------------------------- */}

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
                  ⏸️ シャボン玉の停止
                </div>


                <button
                  style={{
                    ...styles.pauseSettingBtn,

                    backgroundColor:
                      isPaused
                        ? '#007bff'
                        : '#444'
                  }}

                  onClick={() =>
                    setIsPaused(
                      prev =>
                        !prev
                    )
                  }
                >
                  {isPaused
                    ? '▶ 浮遊を再開'
                    : 'Ⅱ その場で停止'}
                </button>


                <p
                  style={
                    styles.settingDescription
                  }
                >
                  停止するとシャボン玉はその場に浮いたまま、ほんの少しだけ揺れ続けます。
                </p>

              </div>

            </div>

          )}

        </div>

      </div>


      {/* ==================================================
          写真なし
      ================================================== */}

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


      {/* ==================================================
          シャボン玉ステージ
      ================================================== */}

      <div
        style={
          styles.stage
        }
      >

        {filteredBubbles.map(
          b => {

            const duration =
              Math.floor(
                (
                  1.15 -
                  (
                    b.depth ||
                    0.5
                  ) * 0.30
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

                  animation:

                    isPaused

                      ? `
                        bubbleRest
                        ${(
                          b.swayDuration ||
                          4
                        ) * 2.5}s
                        ease-in-out
                        infinite
                        alternate
                      `

                      : `
                        floatUp
                        ${duration}s
                        linear
                        ${b.delay || 0}s
                        infinite,

                        sway
                        ${b.swayDuration || 4}s
                        ease-in-out
                        infinite
                        alternate
                      `,

                  transformOrigin:
                    'center center'

                }}
              >

                <div
                  style={
                    styles.bubbleGlass
                  }
                >

                  <BubbleCanvas
                    src={b.src}
                    size={b.size}
                  />


                  {/* 投稿者 */}
                  {b.authorAvatar && (

                    <div
                      title={`${b.author} (${b.genre || '未分類'})`}

                      style={{
                        ...styles.bubbleAuthorBadge,

                        backgroundColor:
                          b.authorAvatar.bg ||
                          'rgba(0,0,0,0.5)'
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


      {/* ==================================================
          写真モーダル
      ================================================== */}

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


      {/* ==================================================
          アニメーション
      ================================================== */}

      <style>{`

        @keyframes floatUp {

          0% {
            transform:
              translate3d(
                0,
                110vh,
                0
              );
          }

          100% {
            transform:
              translate3d(
                0,
                -300px,
                0
              );
          }

        }


        @keyframes sway {

          0% {
            margin-left:
              -25px;
          }

          50% {
            margin-left:
              5px;
          }

          100% {
            margin-left:
              25px;
          }

        }


        /*
         * 停止中
         *
         * 完全停止ではなく
         * その場で水中のように
         * ゆっくり揺れる
         */

        @keyframes bubbleRest {

          0% {

            transform:
              translate3d(
                -4px,
                -4px,
                0
              )
              rotate(
                -1deg
              )
              scale(
                1
              );

          }

          25% {

            transform:
              translate3d(
                2px,
                -1px,
                0
              )
              rotate(
                0.5deg
              )
              scale(
                1.008
              );

          }

          50% {

            transform:
              translate3d(
                4px,
                3px,
                0
              )
              rotate(
                1deg
              )
              scale(
                1.015
              );

          }

          75% {

            transform:
              translate3d(
                -2px,
                4px,
                0
              )
              rotate(
                -0.5deg
              )
              scale(
                1.008
              );

          }

          100% {

            transform:
              translate3d(
                -4px,
                -2px,
                0
              )
              rotate(
                -1deg
              )
              scale(
                1
              );

          }

        }


        /*
         * ボタンのホバー
         */

        button:hover {
          filter:
            brightness(1.12);
        }


        /*
         * スクロールバー
         */

        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background:
            rgba(255,255,255,0.03);
        }

        ::-webkit-scrollbar-thumb {
          background:
            rgba(255,255,255,0.20);

          border-radius:
            10px;
        }

      `}</style>

    </div>
  );
}


// =========================================================
// 5. スタイル
// =========================================================

const styles = {

  // =======================================================
  // Auth
  // =======================================================

  authContainer: {

    width:
      '100vw',

    height:
      '100vh',

    background:
      'linear-gradient(135deg, #111e2e, #0a1118)',

    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'center',

    fontFamily:
      'sans-serif'

  },


  authCard: {

    backgroundColor:
      'rgba(255,255,255,0.05)',

    backdropFilter:
      'blur(10px)',

    padding:
      '30px',

    borderRadius:
      '12px',

    width:
      '320px',

    boxShadow:
      '0 8px 32px rgba(0,0,0,0.3)',

    border:
      '1px solid rgba(255,255,255,0.1)',

    textAlign:
      'center'

  },


  appTitle: {

    color:
      '#fff',

    fontSize:
      '22px',

    marginBottom:
      '20px'

  },


  authTabGroup: {

    display:
      'flex',

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
      '18px',

    boxSizing:
      'border-box'

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
      'hidden',

    flexShrink:
      0

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


  // =======================================================
  // Menu
  // =======================================================

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
      'relative',

    overflow:
      'hidden'

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


  // =======================================================
  // Album
  // =======================================================

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
      'auto'

  },


  topControlRow: {

    display:
      'flex',

    gap:
      '10px',

    alignItems:
      'center',

    flexWrap:
      'wrap'

  },


  backMenuBtn: {

    padding:
      '6px 12px',

    backgroundColor:
      'rgba(255,255,255,0.2)',

    border:
      'none',

    borderRadius:
      '15px',

    color:
      '#fff',

    fontSize:
      '12px',

    cursor:
      'pointer',

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

    color:
      '#fff',

    fontSize:
      '12px',

    backdropFilter:
      'blur(5px)'

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


  tocToggleBtn: {

    padding:
      '6px 12px',

    backgroundColor:
      '#6c757d',

    border:
      'none',

    borderRadius:
      '15px',

    color:
      '#fff',

    fontSize:
      '12px',

    cursor:
      'pointer'

  },


  pauseBtn: {

    padding:
      '6px 12px',

    border:
      'none',

    borderRadius:
      '15px',

    color:
      '#fff',

    fontSize:
      '12px',

    cursor:
      'pointer',

    backdropFilter:
      'blur(5px)',

    fontWeight:
      'bold'

  },


  uploadBtn: {

    padding:
      '6px 12px',

    backgroundColor:
      '#28a745',

    borderRadius:
      '15px',

    color:
      '#fff',

    fontSize:
      '12px',

    cursor:
      'pointer',

    fontWeight:
      'bold'

  },


  // =======================================================
  // Genre
  // =======================================================

  genreTabBar: {

    display:
      'flex',

    gap:
      '6px',

    alignItems:
      'center',

    flexWrap:
      'wrap'

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
      '4px 10px',

    border:
      'none',

    borderRadius:
      '12px',

    fontSize:
      '11px',

    cursor:
      'pointer'

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

    color:
      '#fff',

    fontSize:
      '11px',

    cursor:
      'pointer'

  },


  // =======================================================
  // Bubble
  // =======================================================

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

    transformOrigin:
      'center center'

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
      'drop-shadow(0 10px 22px rgba(0,0,0,0.35))',

    overflow:
      'visible'

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
      'hidden',

    border:
      '1px solid rgba(255,255,255,0.7)'

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
      'rgba(255,255,255,0.6)',

    textAlign:
      'center',

    fontSize:
      '14px',

    pointerEvents:
      'none',

    lineHeight:
      '1.6',

    zIndex:
      20

  },


  // =======================================================
  // TOC
  // =======================================================

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
      'blur(10px)',

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

    paddingBottom:
      '20px'

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
      '90px',

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
      '3px 4px',

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


  // =======================================================
  // Settings
  // =======================================================

  settingSection: {

    marginBottom:
      '20px'

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


  settingDescription: {

    fontSize:
      '10px',

    color:
      '#888',

    lineHeight:
      '1.6',

    marginTop:
      '8px'

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
      '6px 12px',

    backgroundColor:
      '#333',

    border:
      '1px solid #555',

    borderRadius:
      '4px',

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
      '6px',

    borderRadius:
      '4px',

    fontSize:
      '11px',

    cursor:
      'pointer'

  },


  pauseSettingBtn: {

    width:
      '100%',

    border:
      'none',

    color:
      '#fff',

    padding:
      '9px',

    borderRadius:
      '6px',

    fontSize:
      '12px',

    cursor:
      'pointer',

    fontWeight:
      'bold'

  },


  // =======================================================
  // Modal
  // =======================================================

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
      300,

    padding:
      '20px',

    boxSizing:
      'border-box'

  },


  modalCard: {

    backgroundColor:
      '#111',

    padding:
      '15px',

    borderRadius:
      '8px',

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
      '10px'

  },


  modalImg: {

    maxWidth:
      '100%',

    maxHeight:
      '75vh',

    objectFit:
      'contain',

    borderRadius:
      '4px'

  },


  closeBtn: {

    padding:
      '6px 16px',

    backgroundColor:
      '#6c757d',

    border:
      'none',

    color:
      '#fff',

    borderRadius:
      '4px',

    cursor:
      'pointer',

    fontSize:
      '12px'

  }

};