import { useRef, useEffect, useState } from 'react';
import { FaceMesh, FACEMESH_TESSELATION } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors } from '@mediapipe/drawing_utils';

export const FaceMeshMirror = ({ windowWidth, windowHeight }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanLineRef = useRef(0);
  const scanDirectionRef = useRef(1); // 1 for down, -1 for up
  const [dimensions, setDimensions] = useState({ width: windowWidth, height: windowHeight });

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
    const calculateDimensions = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const aspectRatio = isMobile ? 3 / 4 : 4 / 3; // Invert aspect ratio for mobile
      let newWidth, newHeight;

      if (isMobile) {
        // For mobile, prioritize height
        newWidth = Math.min(windowWidth, 720);
        newHeight = newWidth / aspectRatio;
        
        // Ensure height doesn't exceed viewport
        if (newHeight > windowHeight) {
          newHeight = windowHeight;
          newWidth = newHeight * aspectRatio;
        }
      } else {
        // Desktop behavior remains the same
        if (windowWidth / windowHeight > aspectRatio) {
          newHeight = Math.min(windowHeight, 720);
          newWidth = newHeight * aspectRatio;
        } else {
          newWidth = Math.min(windowWidth, 960);
          newHeight = newWidth / aspectRatio;
        }
      }

      setDimensions({ width: newWidth, height: newHeight });
    };

    calculateDimensions();
    window.addEventListener('resize', calculateDimensions);

    return () => window.removeEventListener('resize', calculateDimensions);
  }, [windowWidth, windowHeight]);

  useEffect(() => {
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
      
      // Draw the tesselation with yellow color and lower opacity
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.15)'; // Reduced opacity to 15%
      
      // Draw face mesh lines
      for (let i = 0; i < FACEMESH_TESSELATION.length; i++) {
        const connection = FACEMESH_TESSELATION[i];
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];

        if (!isValidCoordinate(start.x) || !isValidCoordinate(start.y) ||
            !isValidCoordinate(end.x) || !isValidCoordinate(end.y)) {
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(
          start.x * canvasElement.width,
          start.y * canvasElement.height
        );
        ctx.lineTo(
          end.x * canvasElement.width,
          end.y * canvasElement.height
        );
        ctx.stroke();
      }

      // Get face bounds for scan line
      const { minX, minY, maxX, maxY } = getFaceBoundingBox(landmarks);
      const faceHeight = maxY - minY;
      const faceWidth = maxX - minX;
      const faceCenterX = minX + faceWidth / 2;

      // Update scan line position with direction change
      const scanSpeed = 4;
      scanLineRef.current += scanSpeed * scanDirectionRef.current;

      // Change direction when reaching bounds
      if (scanLineRef.current >= faceHeight) {
        scanDirectionRef.current = -1; // Start moving up
        scanLineRef.current = faceHeight;
      } else if (scanLineRef.current <= 0) {
        scanDirectionRef.current = 1; // Start moving down
        scanLineRef.current = 0;
      }

      const currentScanY = minY + scanLineRef.current;

      if (currentScanY >= minY && currentScanY <= maxY) {
        // Create curved scan line
        ctx.beginPath();
        ctx.filter = 'blur(15px)'; // Add blur effect to the scan line

        // Create curved path for scan line
        const curveHeight = 20; // Height of the curve
        const controlPoints = [];
        const numPoints = 50;

        for (let i = 0; i < numPoints; i++) {
          const x = minX + (i / (numPoints - 1)) * faceWidth;
          const distanceFromCenter = Math.abs(x - faceCenterX);
          const curveOffset = Math.cos((distanceFromCenter / faceWidth) * Math.PI) * curveHeight;
          controlPoints.push({
            x: x,
            y: currentScanY + curveOffset
          });
        }

        // Draw the curved path
        ctx.beginPath();
        ctx.moveTo(controlPoints[0].x, controlPoints[0].y);
        
        for (let i = 1; i < controlPoints.length - 2; i++) {
          const xc = (controlPoints[i].x + controlPoints[i + 1].x) / 2;
          const yc = (controlPoints[i].y + controlPoints[i + 1].y) / 2;
          ctx.quadraticCurveTo(controlPoints[i].x, controlPoints[i].y, xc, yc);
        }
        
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Bright yellow for scan line
        ctx.lineWidth = 4;
        ctx.stroke();

        // Add glow effect
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.lineWidth = 8;
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)';
        ctx.lineWidth = 12;
        ctx.stroke();

        ctx.filter = 'none'; // Reset blur filter
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
        
        console.log('Face Detection Data:', data);
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

      console.log('Face Detection Data:', {
        ...data,
        image: data.image ? 'base64_image_data' : null,
        timestamp: new Date().toISOString()
      });

      window.parent.postMessage(JSON.stringify(data), '*');

      canvasCtx.restore();
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      width: dimensions.width,
      height: dimensions.height,
      facingMode: 'user'
    });

    camera.start();

    return () => {
      camera.stop();
    };
  }, [dimensions.width, dimensions.height]);

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
        overflow: 'hidden'
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
          }}
        />
      </div>
    </div>
  );
};
