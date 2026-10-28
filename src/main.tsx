import "./themes/store";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadProjects } from "./lib/data";
import "./index.css";

loadProjects();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
