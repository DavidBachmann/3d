import { Canvas, RootState } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { controller } from "./controller";

import Scene01 from "./scenes/01-follow-curve";
import Scene02 from "./scenes/02-snow-day";

const onCreated = (state: RootState) => {};

const App = () => {
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  });

  return (
    <Canvas onCreated={onCreated} shadows dpr={[1, 2]}>
      <Perf position="top-left" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Scene02 />} />
          <Route path="/01" element={<Scene01 />} />
          <Route path="/02" element={<Scene02 />} />
        </Routes>
      </BrowserRouter>
    </Canvas>
  );
};

export default App;
