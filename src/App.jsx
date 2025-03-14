import { FaceMeshMirror } from './components/FaceMesh';
import { useState, useEffect } from 'react';

const App = () => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <FaceMeshMirror 
      windowWidth={dimensions.width} 
      windowHeight={dimensions.height} 
    />
  );
};

export default App;
