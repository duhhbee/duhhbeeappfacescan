import { useRef, useEffect, useState } from 'react';
import { FaceMesh, FACEMESH_TESSELATION } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors } from '@mediapipe/drawing_utils';
import linhaImage from '../assets/linha.png';
import { FaceScanOverlay } from './FaceScanOverlay';
import { ScannerChrome } from './ScannerChrome';
import scanAudio from '../assets/duhhbeeaudioscan.mp3';
import { evaluateFaceQuality } from '../faceQuality';

export const FaceMeshMirror = ({ windowWidth, windowHeight }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanLineRef = useRef(0);
  const scanDirectionRef = useRef(1);
  const opacityRef = useRef(0.8);
  const opacityDirectionRef = useRef(1);
  const [dimensions, setDimensions] = useState({ width: windowWidth, height: windowHeight });
  const [scanUi, setScanUi] = useState({
    faceFound: false,
    lighting: false,
    qualityOk: false,
    rejectReason: 'no_face',
  });
  const [videoConstraints, setVideoConstraints] = useState(null);
  const scanLineImageRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Carregar a imagem da linha
    const img = new Image();
    img.src = linhaImage;
    img.onload = () => {
      scanLineImageRef.current = img;
    };

    // Configurar o áudio
    const audio = new Audio(scanAudio);
    audio.loop = true;
    audio.volume = 0.5; // Volume em 50%
    audioRef.current = audio;

    // Iniciar o áudio quando a face for detectada
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const lastPostRef = useRef({ at: 0, key: '' });

  const postToApp = (payload) => {
    const key = JSON.stringify(payload);
    const now = Date.now();
    if (key === lastPostRef.current.key && now - lastPostRef.current.at < 120) return;
    lastPostRef.current = { at: now, key };
    if (window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  };

  const captureImage = (canvas) => {
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  useEffect(() => {
    const isMobileDevice = () =>
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    /** Pick the first constraint set the browser actually accepts (avoids OverconstrainedError). */
    const resolveVideoConstraints = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        const insecure =
          typeof window !== 'undefined' &&
          !window.isSecureContext &&
          !/localhost|127\.0\.0\.1/.test(window.location.hostname);
        const msg = insecure
          ? 'Camera needs HTTPS on mobile. Open https://YOUR-MAC-IP:5173 (accept certificate) or use duhhbeeappfacescan-development.vercel.app'
          : 'Camera is not available in this browser.';
        console.error('[facescan]', msg);
        alert(msg);
        return null;
      }

      const mobile = isMobileDevice();
      const candidates = mobile
        ? [
            { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
            { facingMode: { ideal: 'user' } },
            true,
          ]
        : [
            { width: { ideal: 1280 }, height: { ideal: 720 } },
            { width: { ideal: 640 }, height: { ideal: 480 } },
            { facingMode: { ideal: 'user' } },
            true,
          ];

      for (const candidate of candidates) {
        try {
          const video = candidate === true ? true : candidate;
          const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
          stream.getTracks().forEach((track) => track.stop());
          return candidate === true ? {} : candidate;
        } catch (error) {
          console.warn('[facescan] camera constraints rejected:', candidate, error?.name || error);
        }
      }
      return {};
    };

    resolveVideoConstraints()
      .then((resolved) => {
        if (resolved !== null) setVideoConstraints(resolved);
      })
      .catch((error) => {
        console.error('[facescan] could not resolve camera constraints', error);
        setVideoConstraints({});
      });
  }, []);

  useEffect(() => {
    const calculateDimensions = () => {
      setDimensions({ width: windowWidth, height: windowHeight });
    };

    calculateDimensions();
    window.addEventListener('resize', calculateDimensions);
    return () => window.removeEventListener('resize', calculateDimensions);
  }, [windowWidth, windowHeight]);

  useEffect(() => {
    if (!videoConstraints) return;

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');

    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    const isValidCoordinate = (value) => {
      return typeof value === 'number' && isFinite(value) && value >= 0 && value <= 1;
    };

    const getFaceBoundingBox = (landmarks) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      landmarks.forEach(landmark => {
        if (isValidCoordinate(landmark.x) && isValidCoordinate(landmark.y)) {
          minX = Math.min(minX, landmark.x * canvasElement.width);
          minY = Math.min(minY, landmark.y * canvasElement.height);
          maxX = Math.max(maxX, landmark.x * canvasElement.width);
          maxY = Math.max(maxY, landmark.y * canvasElement.height);
        }
      });

      return { minX, minY, maxX, maxY };
    };

    const drawFaceMesh = (ctx, landmarks) => {
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      
      // Desenhar a malha facial em branco com menor opacidade
      drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
        color: 'rgba(255, 255, 255, 0.06)',
        lineWidth: 0.6
      });

      // Desenhar pontos de interseção mais brilhantes
      landmarks.forEach(point => {
        ctx.beginPath();
        ctx.arc(
          point.x * canvasElement.width,
          point.y * canvasElement.height,
          1.5,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fill();
      });

      const { minX, minY, maxX, maxY } = getFaceBoundingBox(landmarks);
      const faceHeight = maxY - minY;

      const scanSpeed = 1.5;
      scanLineRef.current += scanSpeed * scanDirectionRef.current;

      if (scanLineRef.current >= faceHeight) {
        scanDirectionRef.current = -1;
        scanLineRef.current = faceHeight;
      } else if (scanLineRef.current <= 0) {
        scanDirectionRef.current = 1;
        scanLineRef.current = 0;
      }

      // Atualizar opacidade
      const opacitySpeed = 0.03;
      opacityRef.current += opacitySpeed * opacityDirectionRef.current;

      if (opacityRef.current >= 1) {
        opacityDirectionRef.current = -1;
        opacityRef.current = 1;
      } else if (opacityRef.current <= 0.8) {
        opacityDirectionRef.current = 1;
        opacityRef.current = 0.8;
      }

      const currentScanY = minY + scanLineRef.current;

      // Desenhar a imagem da linha de scan
      if (currentScanY >= minY && currentScanY <= maxY && scanLineImageRef.current) {
        ctx.save();
        const lineWidth = (maxX - minX) * 1.2; // Aumentar a largura em 20%
        const lineHeight = scanLineImageRef.current.height * (lineWidth / scanLineImageRef.current.width);
        
        // Definir opacidade global com efeito de pulsação
        ctx.globalAlpha = opacityRef.current;
        
        // Desenhar a imagem da linha
        ctx.drawImage(
          scanLineImageRef.current,
          minX - (lineWidth - (maxX - minX)) / 2, // Centralizar a linha aumentada
          currentScanY - lineHeight / 2,
          lineWidth,
          lineHeight
        );
        
        ctx.restore();
      }
    };

    faceMesh.onResults((results) => {
      if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Pausar o áudio quando não houver face detectada
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const empty = {
          faceFound: false,
          lighting: false,
          position: false,
          faceClear: true,
          qualityOk: false,
          rejectReason: 'no_face',
          image: null,
        };
        setScanUi(empty);
        postToApp(empty);
        return;
      }

      // Iniciar ou retomar o áudio quando uma face for detectada
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(error => {
          console.log('Erro ao reproduzir áudio:', error);
        });
      }

      canvasCtx.save();
      const landmarks = results.multiFaceLandmarks[0];
      drawFaceMesh(canvasCtx, landmarks);

      const quality = evaluateFaceQuality(
        videoElement,
        landmarks,
        canvasElement.width,
        canvasElement.height,
      );

      const ready = quality.qualityOk;
      const image = ready ? captureImage(canvasElement) : null;

      const payload = {
        faceFound: quality.faceFound,
        lighting: quality.lighting,
        position: quality.position,
        faceClear: quality.faceClear,
        qualityOk: quality.qualityOk,
        rejectReason: quality.rejectReason,
        metrics: quality.metrics,
        image,
      };
      setScanUi({ ...payload, faceFound: true });
      postToApp(payload);


      canvasCtx.restore();
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      ...videoConstraints
    });

    camera.start();

    return () => {
      camera.stop();
    };
  }, [dimensions.width, dimensions.height, videoConstraints]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        backgroundColor: '#000000',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        <video
          ref={videoRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)',
            objectFit: 'cover'
          }}
          autoPlay
          playsInline
        />
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)'
          }}
        />
        <FaceScanOverlay
          width={dimensions.width}
          height={dimensions.height}
          ready={scanUi.qualityOk}
        />
        <ScannerChrome scan={scanUi} />
      </div>
    </div>
  );
};
