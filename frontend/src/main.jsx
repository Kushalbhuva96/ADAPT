import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./services/AuthContext";
import { ThemeProvider } from "./services/ThemeContext";
import { registerAppServiceWorker } from "./services/serviceWorker";
import "./styles/index.css";

void registerAppServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider><AuthProvider><App /></AuthProvider></ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
