import { useRef, useEffect, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import {
  advanceScanState,
  createScanState,
  drawFaceScanMesh,
  smoothLandmarks,
} from '../faceMeshDraw';
import scanAudio from '../assets/duhhbeeaudioscan.mp3';
import { evaluateFaceQuality } from '../faceQuality';
import { FaceScanOverlay } from './FaceScanOverlay';

export const FaceMeshMirror = ({ windowWidth, windowHeight }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: windowWidth, height: windowHeight });
  const [videoConstraints, setVideoConstraints] = useState(null);
  const [frameReady, setFrameReady] = useState(false);
  const audioRef = useRef(null);
  const lastPostRef = useRef({ at: 0, key: '' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.__duhhGuideTopPad == null) window.__duhhGuideTopPad = 0.11;
      if (window.__duhhGuideBottomPad == null) window.__duhhGuideBottomPad = 0.3;
      if (window.__duhhGuideBandCenter == null) window.__duhhGuideBandCenter = 0.58;
    }
  }, []);

  useEffect(() => {
    const audio = new Audio(scanAudio);
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const postToApp = (payload) => {
    const key = JSON.stringify(payload);
    const now = Date.now();
    if (key === lastPostRef.current.key && now - lastPostRef.current.at < 100) return;
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
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        setDimensions({ width: windowWidth, height: windowHeight });
        return;
      }
      let newWidth;
      let newHeight;
      if (windowWidth / windowHeight > 16 / 9) {
        newHeight = windowHeight;
        newWidth = (windowHeight * 16) / 9;
      } else {
        newWidth = windowWidth;
        newHeight = (windowWidth * 9) / 16;
      }
      setDimensions({ width: newWidth, height: newHeight });
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

    let smoothedLandmarks = null;
    let scanState = createScanState();

    faceMesh.onResults((results) => {
      if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

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
        setFrameReady(false);
        smoothedLandmarks = null;
        postToApp(empty);
        return;
      }

      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch((error) => {
          console.log('Erro ao reproduzir áudio:', error);
        });
      }

      canvasCtx.save();
      const raw = results.multiFaceLandmarks[0];
      smoothedLandmarks = smoothLandmarks(smoothedLandmarks, raw);
      const landmarks = smoothedLandmarks;

      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of landmarks) {
        const y = p.y * canvasElement.height;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      scanState = advanceScanState(scanState, maxY - minY);
      drawFaceScanMesh(
        canvasCtx,
        landmarks,
        canvasElement.width,
        canvasElement.height,
        scanState,
      );

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
      setFrameReady(ready);
      postToApp(payload);

      canvasCtx.restore();
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      ...videoConstraints,
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
        backgroundColor: '#0a0a0a',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: dimensions.width,
          height: dimensions.height,
          maxWidth: '100%',
          maxHeight: '100vh',
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
            objectFit: 'cover',
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
            transform: 'scaleX(-1)',
            mixBlendMode: 'soft-light',
          }}
        />
        <FaceScanOverlay
          width={dimensions.width}
          height={dimensions.height}
          ready={frameReady}
        />
      </div>
    </div>
  );
};
