  import React, {
  useState,
  useEffect,
  useRef,
  useCallback
} from 'react';

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

import {
  FilesetResolver,
  FaceDetector
} from '@mediapipe/tasks-vision';


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
// 3. MediaPipe Face Detector
// =========================================================

let faceDetectorPromise = null;

const getFaceDetector = async () => {
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {

      const vision = await FilesetResolver.forVisionTasks(
        '/mediapipe/wasm'
      );

      const detector = await FaceDetector.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              '/models/blaze_face_short_range.tflite'
          },

          runningMode: 'IMAGE',

          minDetectionConfidence: 0.45
        }
      );

      return detector;
    })();
  }

  return faceDetectorPromise;
};


// =========================================================
// 4. 顔検出
// =========================================================

const detectFaces = async (img) => {

  try {

    const detector = await getFaceDetector();

    const result = detector.detect(img);

    if (!result || !result.detections) {
      return [];
    }

    return result.detections.map((detection) => {

      const box = detection.boundingBox;

      if (!box) {
        return null;
      }

      return {
        x: box.originX / img.width,
        y: box.originY / img.height,
        width: box.width / img.width,
        height: box.height / img.height
      };

    }).filter(Boolean);

  } catch (error) {

    console.warn(
      '顔検出に失敗しました。通常の球面屈折を使用します。',
      error
    );

    return [];
  }
};


// =========================================================
// 5. 画像を圧縮
// Firestoreに巨大な画像を直接入れないため
// =========================================================

const compressImage = (
  src,
  maxSize = 1600,
  quality = 0.84
) => {

  return new Promise((resolve, reject) => {

    const img = new Image();

    img.onload = () => {

      let width = img.width;
      let height = img.height;

      const scale =
        Math.min(
          1,
          maxSize / Math.max(width, height)
        );

      width = Math.floor(width * scale);
      height = Math.floor(height * scale);

      const canvas =
        document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      const ctx =
        canvas.getContext('2d');

      ctx.drawImage(
        img,
        0,
        0,
        width,
        height
      );

      resolve(
        canvas.toDataURL(
          'image/jpeg',
          quality
        )
      );
    };

    img.onerror = reject;

    img.src = src;
  });
};


// =========================================================
// 6. シャボン玉 Canvas
// =========================================================

function BubbleCanvas({
  src,
  size,
  faces = [],
  paused = false
}) {

  const canvasRef = useRef(null);

  useEffect(() => {

    const canvas = canvasRef.current;

    if (!canvas) return;

    let cancelled = false;

    const render = async () => {

      const img = new Image();

      img.onload = async () => {

        if (cancelled) return;

        const w = size;
        const h = size;

        canvas.width = w;
        canvas.height = h;

        const ctx =
          canvas.getContext('2d');

        if (!ctx) return;


        // -------------------------------------------------
        // 元画像
        // -------------------------------------------------

        const sourceCanvas =
          document.createElement('canvas');

        sourceCanvas.width = img.width;
        sourceCanvas.height = img.height;

        const sourceCtx =
          sourceCanvas.getContext('2d');

        sourceCtx.drawImage(
          img,
          0,
          0
        );

        const sourceData =
          sourceCtx.getImageData(
            0,
            0,
            img.width,
            img.height
          );

        const srcData =
          sourceData.data;


        // -------------------------------------------------
        // 出力
        // -------------------------------------------------

        const output =
          ctx.createImageData(
            w,
            h
          );

        const outData =
          output.data;


        const centerX = w / 2;
        const centerY = h / 2;

        const radius =
          Math.min(w, h) / 2 - 3;


        // -------------------------------------------------
        // 顔保護関数
        //
        // 顔の中心ほど 1
        // 顔の外側ほど 0
        // -------------------------------------------------

        const getFaceProtection =
          (nx, ny) => {

            let protection = 0;

            for (const face of faces) {

              const fx =
                face.x * w;

              const fy =
                face.y * h;

              const fw =
                face.width * w;

              const fh =
                face.height * h;

              // 顔の中心
              const cx =
                fx + fw / 2;

              const cy =
                fy + fh / 2;

              const dx =
                (nx - cx) / (fw * 0.72);

              const dy =
                (ny - cy) / (fh * 0.78);

              const distance =
                Math.sqrt(
                  dx * dx +
                  dy * dy
                );

              // 顔の中心から離れるほど弱く
              const p =
                Math.max(
                  0,
                  Math.min(
                    1,
                    1 - distance
                  )
                );

              protection =
                Math.max(
                  protection,
                  p
                );
            }

            return protection;
          };


        // -------------------------------------------------
        // 球面屈折
        // -------------------------------------------------

        for (let y = 0; y < h; y++) {

          for (let x = 0; x < w; x++) {

            const dx =
              x - centerX;

            const dy =
              y - centerY;

            const distance =
              Math.sqrt(
                dx * dx +
                dy * dy
              );

            const index =
              (y * w + x) * 4;


            if (distance < radius) {

              const r =
                distance / radius;


              // -------------------------------------------
              // 基本球面
              // -------------------------------------------

              const sphere =
                Math.sqrt(
                  Math.max(
                    0,
                    1 - r * r
                  )
                );


              // 外周ほど屈折を強く
              const edgePower =
                Math.pow(
                  r,
                  1.75
                );


              // -------------------------------------------
              // 軽い非対称性
              // 完全なCG円にならないようにする
              // -------------------------------------------

              const asymmetry =
                1 +
                Math.sin(
                  Math.atan2(dy, dx) * 3
                ) * 0.035;


              // -------------------------------------------
              // 通常の屈折
              // -------------------------------------------

              let refraction =
                0.42 +
                edgePower * 0.78;


              refraction *= asymmetry;


              // -------------------------------------------
              // 顔保護
              //
              // 顔がある場所は
              // 屈折率をかなり下げる
              // -------------------------------------------

              const protection =
                getFaceProtection(
                  x,
                  y
                );


              const protectedRefraction =
                refraction *
                (
                  1 -
                  protection * 0.78
                );


              // -------------------------------------------
              // 球面マッピング
              // -------------------------------------------

              let nx =
                -dx *
                protectedRefraction *
                (0.48 + sphere * 0.52);

              let ny =
                -dy *
                protectedRefraction *
                (0.48 + sphere * 0.52);


              // -------------------------------------------
              // 顔部分はさらに少し中心寄せ
              // -------------------------------------------

              if (protection > 0) {

                nx *=
                  1 -
                  protection * 0.15;

                ny *=
                  1 -
                  protection * 0.15;
              }


              const srcX =
                Math.floor(
                  (
                    centerX + nx
                  ) /
                  w *
                  img.width
                );

              const srcY =
                Math.floor(
                  (
                    centerY + ny
                  ) /
                  h *
                  img.height
                );


              const clampedX =
                Math.max(
                  0,
                  Math.min(
                    img.width - 1,
                    srcX
                  )
                );

              const clampedY =
                Math.max(
                  0,
                  Math.min(
                    img.height - 1,
                    srcY
                  )
                );


              const srcIndex =
                (
                  clampedY *
                  img.width +
                  clampedX
                ) * 4;


              outData[index] =
                srcData[srcIndex];

              outData[index + 1] =
                srcData[srcIndex + 1];

              outData[index + 2] =
                srcData[srcIndex + 2];

              outData[index + 3] =
                255;


            } else {

              outData[index + 3] =
                0;
            }
          }
        }


        ctx.putImageData(
          output,
          0,
          0
        );


        // =================================================
        // 7. シャボン玉の膜
        // =================================================

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


        // -------------------------------------------------
        // 虹色の薄膜
        // -------------------------------------------------

        const rainbow =
          ctx.createConicGradient(
            -0.5,
            centerX,
            centerY
          );

        rainbow.addColorStop(
          0.00,
          'rgba(255,80,150,0.20)'
        );

        rainbow.addColorStop(
          0.16,
          'rgba(255,220,70,0.16)'
        );

        rainbow.addColorStop(
          0.32,
          'rgba(80,255,180,0.14)'
        );

        rainbow.addColorStop(
          0.48,
          'rgba(60,220,255,0.16)'
        );

        rainbow.addColorStop(
          0.64,
          'rgba(120,100,255,0.17)'
        );

        rainbow.addColorStop(
          0.82,
          'rgba(255,80,220,0.18)'
        );

        rainbow.addColorStop(
          1,
          'rgba(255,80,150,0.20)'
        );


        ctx.globalCompositeOperation =
          'screen';

        ctx.fillStyle =
          rainbow;

        ctx.globalAlpha =
          0.55;

        ctx.fillRect(
          0,
          0,
          w,
          h
        );


        // -------------------------------------------------
        // 外周の虹色リング
        // -------------------------------------------------

        ctx.globalAlpha =
          0.9;

        ctx.lineWidth =
          Math.max(
            2,
            size * 0.035
          );

        ctx.strokeStyle =
          rainbow;

        ctx.beginPath();

        ctx.arc(
          centerX,
          centerY,
          radius - 1,
          0,
          Math.PI * 2
        );

        ctx.stroke();


        // -------------------------------------------------
        // もう一段細いハイライトリング
        // -------------------------------------------------

        const edgeGradient =
          ctx.createLinearGradient(
            0,
            0,
            w,
            h
          );

        edgeGradient.addColorStop(
          0,
          'rgba(255,255,255,0.75)'
        );

        edgeGradient.addColorStop(
          0.25,
          'rgba(180,240,255,0.15)'
        );

        edgeGradient.addColorStop(
          0.55,
          'rgba(255,255,255,0.02)'
        );

        edgeGradient.addColorStop(
          0.82,
          'rgba(255,180,240,0.45)'
        );

        edgeGradient.addColorStop(
          1,
          'rgba(255,255,255,0.7)'
        );

        ctx.lineWidth =
          Math.max(
            1,
            size * 0.012
          );

        ctx.strokeStyle =
          edgeGradient;

        ctx.beginPath();

        ctx.arc(
          centerX,
          centerY,
          radius - 2,
          0,
          Math.PI * 2
        );

        ctx.stroke();


        // =================================================
        // 8. 大きな環境反射
        // =================================================

        const reflection =
          ctx.createRadialGradient(
            centerX - radius * 0.34,
            centerY - radius * 0.38,
            2,
            centerX - radius * 0.28,
            centerY - radius * 0.30,
            radius * 0.58
          );

        reflection.addColorStop(
          0,
          'rgba(255,255,255,0.82)'
        );

        reflection.addColorStop(
          0.13,
          'rgba(255,255,255,0.40)'
        );

        reflection.addColorStop(
          0.38,
          'rgba(220,245,255,0.13)'
        );

        reflection.addColorStop(
          1,
          'rgba(255,255,255,0)'
        );


        ctx.globalAlpha =
          0.9;

        ctx.fillStyle =
          reflection;

        ctx.beginPath();

        ctx.ellipse(
          centerX - radius * 0.27,
          centerY - radius * 0.32,
          radius * 0.26,
          radius * 0.19,
          -0.35,
          0,
          Math.PI * 2
        );

        ctx.fill();


        // -------------------------------------------------
        // 小さい白反射
        // -------------------------------------------------

        const smallReflection =
          ctx.createRadialGradient(
            centerX + radius * 0.25,
            centerY - radius * 0.18,
            1,
            centerX + radius * 0.25,
            centerY - radius * 0.18,
            radius * 0.22
          );

        smallReflection.addColorStop(
          0,
          'rgba(255,255,255,0.65)'
        );

        smallReflection.addColorStop(
          0.35,
          'rgba(255,255,255,0.20)'
        );

        smallReflection.addColorStop(
          1,
          'rgba(255,255,255,0)'
        );

        ctx.fillStyle =
          smallReflection;

        ctx.beginPath();

        ctx.arc(
          centerX + radius * 0.25,
          centerY - radius * 0.18,
          radius * 0.22,
          0,
          Math.PI * 2
        );

        ctx.fill();


        // =================================================
        // 9. 球体の内側の陰影
        // =================================================

        const shadow =
          ctx.createRadialGradient(
            centerX,
            centerY,
            radius * 0.35,
            centerX,
            centerY,
            radius
          );

        shadow.addColorStop(
          0,
          'rgba(0,0,0,0)'
        );

        shadow.addColorStop(
          0.68,
          'rgba(0,0,0,0.03)'
        );

        shadow.addColorStop(
          0.86,
          'rgba(0,0,0,0.14)'
        );

        shadow.addColorStop(
          1,
          'rgba(0,0,0,0.38)'
        );


        ctx.globalCompositeOperation =
          'multiply';

        ctx.globalAlpha =
          0.85;

        ctx.fillStyle =
          shadow;

        ctx.beginPath();

        ctx.arc(
          centerX,
          centerY,
          radius,
          0,
          Math.PI * 2
        );

        ctx.fill();


        // =================================================
        // 10. 外周の光
        // =================================================

        ctx.globalCompositeOperation =
          'screen';

        ctx.globalAlpha =
          0.8;

        const rim =
          ctx.createRadialGradient(
            centerX,
            centerY,
            radius * 0.75,
            centerX,
            centerY,
            radius
          );

        rim.addColorStop(
          0,
          'rgba(255,255,255,0)'
        );

        rim.addColorStop(
          0.8,
          'rgba(255,255,255,0.02)'
        );

        rim.addColorStop(
          1,
          'rgba(190,235,255,0.42)'
        );

        ctx.fillStyle =
          rim;

        ctx.beginPath();

        ctx.arc(
          centerX,
          centerY,
          radius,
          0,
          Math.PI * 2
        );

        ctx.fill();


        ctx.restore();

      };

      img.src = src;
    };


    render();

    return () => {
      cancelled = true;
    };

  }, [
    src,
    size,
    JSON.stringify(faces)
  ]);


  return (
    <canvas
      ref={canvasRef}
      style={{
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
        borderRadius: '50%'
      }}
    />
  );
}


// =========================================================
// 11. App
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
    useState(() =>
      localStorage.getItem(
        'currentUser'
      )
        ? 'menu'
        : 'auth'
    );


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
        'linear-gradient(180deg,#0f2027 0%,#203a43 50%,#2c5364 100%)'
    });


  const [selectedImage, setSelectedImage] =
    useState(null);

  const [isTocOpen, setIsTocOpen] =
    useState(false);

  const [tocActiveTab, setTocActiveTab] =
    useState('photos');


  const [speedMode, setSpeedMode] =
    useState('normal');


  // 全体停止
  const [isPaused, setIsPaused] =
    useState(false);


  // 顔検出中
  const [isDetectingFace, setIsDetectingFace] =
    useState(false);


  const getAlbumKey = () => {

    if (activeTab === 'private') {

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
          'Wake Lock:',
          error
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

        wakeLock.release();

        wakeLock = null;
      }
    };

  }, [
    currentScreen,
    isPaused
  ]);


  // =======================================================
  // Firestore
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
            snapshot.docs.map(
              docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
              })
            );

          setBubbles(
            loaded
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
        docSnap => {

          if (
            docSnap.exists()
          ) {

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

            const defaults = {
              bgType: 'preset',
              bgColor: '#0f2027',
              bgImage: null,
              presetBg:
                activeTab === 'private'
                  ? 'linear-gradient(180deg,#0f2027 0%,#203a43 50%,#2c5364 100%)'
                  : 'linear-gradient(180deg,#141e30 0%,#243b55 100%)',

              genres: [
                'すべて',
                '日常',
                '旅行',
                'イベント'
              ]
            };

            setAlbumSettings(
              defaults
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

            setRoomMembers(
              snapshot.docs.map(
                d => d.data()
              )
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
  // Settings
  // =======================================================

  const updateSettings =
    async newSettings => {

      const updated = {
        ...albumSettings,
        ...newSettings
      };

      setAlbumSettings(
        updated
      );

      await setDoc(
        doc(
          db,
          'albums',
          albumKey
        ),
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
          genres: nextGenres
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
    e => {

      const file =
        e.target.files?.[0];

      if (!file) return;


      const reader =
        new FileReader();


      reader.onload =
        event => {

          setCustomAvatar({
            type: 'image',
            url: event.target.result
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
  // Auth
  // =======================================================

  const handleAuth =
    async e => {

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

          if (
            !userSnap.exists()
          ) {

            alert(
              'ユーザーが存在しません。'
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

        console.error(
          error
        );

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
    e => {

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
  // Image Upload
  // =======================================================

  const handleImageUpload =
    async e => {

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
        selectedGenre === 'すべて'
          ? (
              genres[1] ||
              '未分類'
            )
          : selectedGenre;


      setIsDetectingFace(
        true
      );


      try {

        for (
          const file of files
        ) {

          const rawSrc =
            await new Promise(
              (resolve, reject) => {

                const reader =
                  new FileReader();

                reader.onload =
                  e =>
                    resolve(
                      e.target.result
                    );

                reader.onerror =
                  reject;

                reader.readAsDataURL(
                  file
                );
              }
            );


          const compressed =
            await compressImage(
              rawSrc
            );


          const img =
            await new Promise(
              (resolve, reject) => {

                const image =
                  new Image();

                image.onload =
                  () =>
                    resolve(
                      image
                    );

                image.onerror =
                  reject;

                image.src =
                  compressed;
              }
            );


          // 顔検出
          const faces =
            await detectFaces(
              img
            );


          await createBubble(
            compressed,
            genreToAssign,
            faces
          );
        }

      } catch (error) {

        console.error(
          error
        );

        alert(
          '画像の追加中にエラーが発生しました。'
        );

      } finally {

        setIsDetectingFace(
          false
        );

        e.target.value =
          '';
      }
    };


  // =======================================================
  // Background Image
  // =======================================================

  const handleBgImageUpload =
    e => {

      const file =
        e.target.files?.[0];

      if (!file) return;


      const reader =
        new FileReader();


      reader.onload =
        event => {

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
  // Animation speed
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
  // Create Bubble
  // =======================================================

  const createBubble =
    async (
      imgSrc,
      genre,
      faces = []
    ) => {

      const depth =
        Math.random();


      // 前より大きく
      const size =
        Math.floor(
          depth * 180
        ) + 180;


      const opacity =
        0.58 +
        depth * 0.42;


      const zIndex =
        Math.floor(
          depth * 100
        );


      const newBubble = {

        src:
          imgSrc,

        genre:
          genre ||
          '未分類',

        size,

        opacity,

        zIndex,

        depth,

        faces,

        author:
          currentUser.username,

        authorAvatar:
          currentUser.avatar,

        left:
          Math.floor(
            Math.random() * 84
          ) + 4,

        swayDuration:
          Math.floor(
            Math.random() * 4
          ) + 3,

        delay:
          Math.random() * 4,

        // 飛距離をかなり長くする
        travel:
          125 +
          Math.random() * 60,

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
        newBubble
      );
    };


  // =======================================================
  // Animation restart
  // =======================================================

  const handleAnimationEnd =
    id => {

      if (isPaused) {
        return;
      }


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
                    Math.random() * 84
                  ) + 4,

                size:
                  Math.floor(
                    depth * 180
                  ) + 180,

                opacity:
                  0.58 +
                  depth * 0.42,

                zIndex:
                  Math.floor(
                    depth * 100
                  ),

                delay:
                  0
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

      await deleteDoc(
        doc(
          db,
          'albums',
          albumKey,
          'bubbles',
          id
        )
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
        writeBatch(
          db
        );


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
  // Avatar render
  // =======================================================

  const renderAvatarIcon =
    (
      avatar,
      sizeStyle = {}
    ) => {

      if (!avatar) {
        return null;
      }


      if (
        avatar.type ===
        'image'
      ) {

        return (
          <img
            src={avatar.url}
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
          {avatar.emoji}
        </span>
      );
    };


  // =======================================================
  // Filter
  // =======================================================

  const filteredBubbles =
    selectedGenre === 'すべて'
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
                    color:
                      '#ccc',
                    fontSize:
                      '12px'
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
                        {avatar.emoji}
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
  // MENU
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
  // ALBUM
  // =======================================================

  return (

    <div
      style={
        getContainerStyle()
      }
    >

      {/* ===============================================
          HEADER
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
                    '#ccc'
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
                    key={index}
                    style={
                      styles.memberTag
                    }
                  >

                    <div
                      style={{
                        ...styles.avatarBadgeSmall,

                        backgroundColor:
                          member.avatar?.bg ||
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


          {/* 一時停止 */}

          <button
            style={{
              ...styles.pauseBtn,

              backgroundColor:
                isPaused
                  ? '#ffc107'
                  : 'rgba(255,255,255,0.18)',

              color:
                isPaused
                  ? '#111'
                  : '#fff'
            }}

            onClick={() =>
              setIsPaused(
                previous =>
                  !previous
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
                previous =>
                  !previous
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

            {isDetectingFace
              ? '👤 顔を確認中...'
              : '＋ 写真を追加'}

            <input
              type="file"
              accept="image/*"
              multiple

              disabled={
                isDetectingFace
              }

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
            genre => (

              <button
                key={genre}

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


      {/* ===============================================
          TOC
      =============================================== */}

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
                  : '#888'
            }}

            onClick={() =>
              setTocActiveTab(
                'photos'
              )
            }
          >
            📷 写真一覧 ({
              filteredBubbles.length
            })
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
                  : '#888'
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

          {/* 写真 */}

          {tocActiveTab ===
            'photos' && (

            <div>

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
                  {selectedGenre}
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

                          alt={
                            `photo-${index}`
                          }

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
                                bubble.authorAvatar?.bg ||
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


          {/* 設定 */}

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
                  🎨 背景スタイル
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
                    カラー単色:
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


              {/* スピード */}

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


              {/* 顔検出説明 */}

              <div
                style={
                  styles.faceInfo
                }
              >
                👤 人物写真では顔を検出して、
                顔周辺の歪みを弱めています。
                <br />
                風景写真は通常の球面屈折になります。
              </div>

            </div>
          )}

        </div>

      </div>


      {/* ===============================================
          Empty
      =============================================== */}

      {filteredBubbles.length ===
        0 && (

        <div
          style={
            styles.emptyText
          }
        >
          【
          {selectedGenre}
          】ジャンルの写真はありません
          <br />
          「＋ 写真を追加」から画像を追加できます✨
        </div>
      )}


      {/* ===============================================
          BUBBLE STAGE
      =============================================== */}

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
                  1.15 -
                  (
                    bubble.depth ||
                    0.5
                  ) *
                    0.35
                ) *
                  getBaseDuration()
              );


            const travel =
              bubble.travel ||
              150;


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
                    `floatUp ${duration}s linear ${bubble.delay}s infinite, sway ${bubble.swayDuration}s ease-in-out infinite alternate`,

                  animationPlayState:
                    isPaused
                      ? 'paused'
                      : 'running',

                  '--travel':
                    `${travel}vh`
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

                    faces={
                      bubble.faces ||
                      []
                    }

                    paused={
                      isPaused
                    }
                  />


                  {/* 作者 */}

                  {bubble.authorAvatar && (

                    <div
                      title={
                        `${bubble.author} (${bubble.genre || '未分類'})`
                      }

                      style={{
                        ...styles.bubbleAuthorBadge,

                        backgroundColor:
                          bubble.authorAvatar.bg ||
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


      {/* ===============================================
          MODAL
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
          Animation
      =============================================== */}

      <style>{`

        @keyframes floatUp {

          0% {
            transform:
              translateY(115vh);
          }

          100% {
            transform:
              translateY(-300px);
          }
        }


        @keyframes sway {

          0% {
            margin-left:
              -25px;
          }

          50% {
            margin-left:
              10px;
          }

          100% {
            margin-left:
              30px;
          }
        }


        * {
          box-sizing:
            border-box;
        }


        body {
          margin:
            0;

          overflow:
            hidden;

          background:
            #0f2027;
        }


        button,
        input {
          font-family:
            sans-serif;
        }

      `}</style>

    </div>
  );
}


// =========================================================
// 12. Styles
// =========================================================

const styles = {

  // -------------------------------------------------------
  // Auth
  // -------------------------------------------------------

  authContainer: {
    width:
      '100vw',

    height:
      '100vh',

    background:
      'linear-gradient(135deg,#111e2e,#0a1118)',

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


  // -------------------------------------------------------
  // Menu
  // -------------------------------------------------------

  menuContainer: {
    width:
      '100vw',

    height:
      '100vh',

    background:
      'linear-gradient(135deg,#0f2027,#2c5364)',

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

    zIndex:
      150,

    display:
      'flex',

    flexDirection:
      'column',

    gap:
      '10px',

    maxWidth:
      'calc(100vw - 30px)'
  },


  topControlRow: {
    display:
      'flex',

    gap:
      '8px',

    alignItems:
      'center',

    flexWrap:
      'wrap'
  },


  backMenuBtn: {
    padding:
      '7px 12px',

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
      '7px 12px',

    backgroundColor:
      'rgba(0,0,0,0.4)',

    borderRadius:
      '15px',

    color:
      '#fff',

    fontSize:
      '12px'
  },


  pauseBtn: {
    padding:
      '7px 12px',

    border:
      'none',

    borderRadius:
      '15px',

    fontSize:
      '12px',

    cursor:
      'pointer',

    fontWeight:
      'bold'
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
      '7px 12px',

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


  uploadBtn: {
    padding:
      '7px 12px',

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
      '12px'
  },


  genreTabBtn: {
    padding:
      '5px 10px',

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
      '5px 10px',

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
      '-220px',

    cursor:
      'pointer',

    willChange:
      'transform'
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
      'drop-shadow(0 12px 22px rgba(0,0,0,0.30))'
  },


  bubbleAuthorBadge: {
    position:
      'absolute',

    bottom:
      '4px',

    right:
      '4px',

    width:
      '24px',

    height:
      '24px',

    borderRadius:
      '50%',

    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'center',

    boxShadow:
      '0 2px 6px rgba(0,0,0,0.5)',

    zIndex:
      10,

    border:
      '1px solid rgba(255,255,255,0.6)'
  },


  emptyText: {
    position:
      'absolute',

    top:
      '50%',

    left:
      '50%',

    transform:
      'translate(-50%,-50%)',

    color:
      'rgba(255,255,255,0.6)',

    textAlign:
      'center',

    fontSize:
      '14px',

    pointerEvents:
      'none',

    lineHeight:
      '1.6'
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
      'rgba(20,20,20,0.96)',

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
      'repeat(2,1fr)',

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
      '34px',

    height:
      '34px',

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
      '34px',

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
      '7px',

    borderRadius:
      '4px',

    fontSize:
      '11px',

    cursor:
      'pointer'
  },


  faceInfo: {
    padding:
      '10px',

    backgroundColor:
      'rgba(0,123,255,0.12)',

    border:
      '1px solid rgba(0,123,255,0.25)',

    borderRadius:
      '6px',

    color:
      '#9ecfff',

    fontSize:
      '10px',

    lineHeight:
      '1.6'
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
      '7px 18px',

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