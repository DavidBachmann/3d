import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HUD from "./components/HUD";

import Playground from "./scenes/playground";

import { useDroneCameraStore } from "./state";

const App = () => {
  const droneCameraState = useDroneCameraStore((state) => state.mutation);
  useEffect(() => {
    // Toggle drone camera
    document.addEventListener("keypress", (e) => {
      if (e.key === "c") {
        droneCameraState.isActive = !droneCameraState.isActive;
      }
    });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Playground />} />
      </Routes>
      <HUD />
    </BrowserRouter>
  );
};

export default App;
