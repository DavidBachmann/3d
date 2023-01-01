import { BrowserRouter, Routes, Route } from "react-router-dom";

import Scene01 from "./scenes/01-follow-curve";
import Scene02 from "./scenes/02-snow-day";
import Scene03 from "./scenes/03-material-carousel";
import Scene04 from "./scenes/04-quadcopter";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Scene04 />} />
        <Route path="/01" element={<Scene01 />} />
        <Route path="/02" element={<Scene02 />} />
        <Route path="/03" element={<Scene03 />} />
        <Route path="/04" element={<Scene04 />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
