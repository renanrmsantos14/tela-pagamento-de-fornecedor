import "./styles.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { APP_VERSION_LABEL } from "./build-info.js";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <small className="app-version" aria-label={`Versão do app ${APP_VERSION_LABEL}`}>
      {APP_VERSION_LABEL}
    </small>
  </React.StrictMode>,
);
