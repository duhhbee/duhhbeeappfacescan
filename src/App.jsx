import { FaceMeshMirror } from './components/FaceMesh';

const App = () => {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  return (
    <FaceMeshMirror windowWidth={windowWidth} windowHeight={windowHeight} />
  );
};

export default App;
