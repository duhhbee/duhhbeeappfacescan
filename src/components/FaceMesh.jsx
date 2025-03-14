import { useRef, useEffect, useState } from 'react';
import { FaceMesh, FACEMESH_TESSELATION } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors } from '@mediapipe/drawing_utils';

export const FaceMeshMirror = ({ windowWidth, windowHeight }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanLineRef = useRef(0);
  const scanDirectionRef = useRef(1);
  const [dimensions, setDimensions] = useState({ width: windowWidth, height: windowHeight });
  const [videoConstraints, setVideoConstraints] = useState(null);

  const checkLighting = (landmarks) => {
    const avgBrightness = landmarks.reduce((sum, point) => sum + point.y, 0) / landmarks.length;
    return avgBrightness > 0.2 && avgBrightness < 0.8;
  };

  const checkPosition = (landmarks) => {
    const centerX = landmarks.reduce((sum, point) => sum + point.x, 0) / landmarks.length;
    const centerY = landmarks.reduce((sum, point) => sum + point.y, 0) / landmarks.length;
    return (centerX > 0.3 && centerX < 0.7 && centerY > 0.3 && centerY < 0.7);
  };

  const captureImage = (canvas) => {
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  useEffect(() => {
    const getVideoConstraints = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const frontCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('front') || 
          device.label.toLowerCase().includes('user') ||
          device.label.toLowerCase().includes('selfie')
        );

        const constraints = {
          deviceId: frontCamera ? { exact: frontCamera.deviceId } : undefined,
          facingMode: frontCamera ? undefined : { exact: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };

        setVideoConstraints(constraints);
      } catch (error) {
        console.error('Error getting video constraints:', error);
        setVideoConstraints({
          facingMode: { exact: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      }
    };

    getVideoConstraints();
  }, []);

  useEffect(() => {
    const calculateDimensions = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      let newWidth, newHeight;

      if (isMobile) {
        newHeight = windowHeight;
        newWidth = (windowHeight * 9) / 16;
        
        if (newWidth > windowWidth) {
          newWidth = windowWidth;
          newHeight = (windowWidth * 16) / 9;
        }
      } else {
        if (windowWidth / windowHeight > 16/9) {
          newHeight = windowHeight;
          newWidth = (windowHeight * 16) / 9;
        } else {
          newWidth = windowWidth;
          newHeight = (windowWidth * 9) / 16;
        }
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
      
      drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
        color: 'rgba(255, 255, 0, 0.08)',
        lineWidth: 1
      });

      const { minX, minY, maxX, maxY } = getFaceBoundingBox(landmarks);
      const faceHeight = maxY - minY;
      const faceWidth = maxX - minX;
      const faceCenterX = minX + faceWidth / 2;

      const scanSpeed = 1;
      scanLineRef.current += scanSpeed * scanDirectionRef.current;

      if (scanLineRef.current >= faceHeight) {
        scanDirectionRef.current = -1;
        scanLineRef.current = faceHeight;
      } else if (scanLineRef.current <= 0) {
        scanDirectionRef.current = 1;
        scanLineRef.current = 0;
      }

      const currentScanY = minY + scanLineRef.current;

      if (currentScanY >= minY && currentScanY <= maxY) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // Create multiple layers of glow using shadows
        for (let i = 0; i < 3; i++) {
          const curveHeight = 30 - (i * 5);
          const controlPoints = [];
          const numPoints = 50;

          for (let j = 0; j < numPoints; j++) {
            const x = minX + (j / (numPoints - 1)) * faceWidth;
            const distanceFromCenter = Math.abs(x - faceCenterX);
            const curveOffset = Math.cos((distanceFromCenter / faceWidth) * Math.PI) * curveHeight;
            controlPoints.push({
              x: x,
              y: currentScanY + curveOffset
            });
          }

          ctx.beginPath();
          ctx.moveTo(controlPoints[0].x, controlPoints[0].y);
          
          for (let k = 1; k < controlPoints.length - 2; k++) {
            const xc = (controlPoints[k].x + controlPoints[k + 1].x) / 2;
            const yc = (controlPoints[k].y + controlPoints[k + 1].y) / 2;
            ctx.quadraticCurveTo(controlPoints[k].x, controlPoints[k].y, xc, yc);
          }

          // Inner glow
          ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
          ctx.shadowBlur = 30 + (i * 15);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.strokeStyle = `rgba(255, 255, 0, ${0.6 - (i * 0.15)})`;
          ctx.lineWidth = 4 - i;
          ctx.stroke();

          // Outer glow
          ctx.shadowColor = 'rgba(255, 255, 100, 0.4)';
          ctx.shadowBlur = 50 + (i * 20);
          ctx.strokeStyle = `rgba(255, 255, 100, ${0.3 - (i * 0.08)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Add central bright line
        ctx.shadowColor = 'rgba(255, 255, 150, 0.9)';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(minX, currentScanY);
        ctx.lineTo(maxX, currentScanY);
        ctx.strokeStyle = 'rgba(255, 255, 150, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      }
    };

    faceMesh.onResults((results) => {
      if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        const data = {
          faceFound: false,
          lighting: false,
          position: false,
          image: null
        };
        
        window.parent.postMessage(JSON.stringify(data), '*');
        return;
      }

      canvasCtx.save();
      const landmarks = results.multiFaceLandmarks[0];
      drawFaceMesh(canvasCtx, landmarks);

      const lighting = checkLighting(landmarks);
      const position = checkPosition(landmarks);
      const faceFound = true;
      const image = (lighting && position) ? captureImage(canvasElement) : null;

      const data = {
        faceFound,
        lighting,
        position,
        image
      };

      window.parent.postMessage(JSON.stringify(data), '*');
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
        backgroundColor: 'rgb(242, 214, 104)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        WebkitPerspective: 1000,
        WebkitTransform: 'translate3d(0,0,0)',
        WebkitTransformStyle: 'preserve-3d'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: dimensions.width,
          height: dimensions.height,
          maxWidth: '100%',
          maxHeight: '100vh',
          WebkitBackfaceVisibility: 'hidden',
          WebkitPerspective: 1000,
          WebkitTransform: 'translate3d(0,0,0)',
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
            WebkitBackfaceVisibility: 'hidden',
            WebkitTransform: 'translate3d(0,0,0) scaleX(-1)'
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
            WebkitBackfaceVisibility: 'hidden',
            WebkitTransform: 'translate3d(0,0,0) scaleX(-1)'
          }}
        />
      </div>
    </div>
  );
};
