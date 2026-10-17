/**
 * Map MediaPipe landmarks (normalized to camera frame) onto the on-screen box
 * using the same math as CSS `object-fit: cover` on the video preview.
 */
export const mapLandmarksForCover = (landmarks, videoWidth, videoHeight, displayWidth, displayHeight) => {
  if (!landmarks?.length || !videoWidth || !videoHeight || !displayWidth || !displayHeight) {
    return landmarks;
  }

  const videoAspect = videoWidth / videoHeight;
  const displayAspect = displayWidth / displayHeight;

  let scale;
  let cropX;
  let cropY;

  if (videoAspect > displayAspect) {
    scale = displayHeight / videoHeight;
    const scaledW = videoWidth * scale;
    cropX = (scaledW - displayWidth) / 2;
    cropY = 0;
  } else {
    scale = displayWidth / videoWidth;
    const scaledH = videoHeight * scale;
    cropX = 0;
    cropY = (scaledH - displayHeight) / 2;
  }

  return landmarks.map((p) => {
    const px = p.x * videoWidth * scale - cropX;
    const py = p.y * videoHeight * scale - cropY;
    return {
      ...p,
      x: px / displayWidth,
      y: py / displayHeight,
    };
  });
};
