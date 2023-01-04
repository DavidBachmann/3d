import { BrowserRouter, Routes, Route } from "react-router-dom";

import Playground from "./scenes/playground";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Playground />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
