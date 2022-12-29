import { Canvas, RootState } from "@react-three/fiber";
import { Perf } from "r3f-perf";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { controller } from "./controller";

import Scene01 from "./scenes/01-follow-curve";
import Scene02 from "./scenes/02-snow-day";
import Scene03 from "./scenes/03-material-carousel";
import Scene04 from "./scenes/04-quadcopter";

const onCreated = (state: RootState) => {
  console.log("Hello world");
  console.log(state);
};

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
          <Route path="/03" element={<Scene03 />} />
          <Route path="/04" element={<Scene04 />} />
        </Routes>
      </BrowserRouter>
    </Canvas>
  );
};

export default App;
