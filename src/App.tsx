import { Canvas, RootState } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { useEffect, useRef } from "react";
import { controller } from "./controller";

import ActiveScene from "./scenes/01-follow-curve";
//import ActiveScene from "./scenes/02-textures";

const onCreated = (state: RootState) => {};

const App = () => {
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  });

  return (
    <Canvas onCreated={onCreated} shadows dpr={[1, 2]}>
      <Perf position="top-left" />
      <OrbitControls makeDefault />
      <ActiveScene />
    </Canvas>
  );
};

export default App;
