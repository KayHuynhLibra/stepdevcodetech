import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { PlaySocketProvider } from "./socket/PlaySocketContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <PlaySocketProvider>
        <App />
      </PlaySocketProvider>
    </BrowserRouter>
  </StrictMode>,
);
