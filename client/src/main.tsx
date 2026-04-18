import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./state/auth";
import { BarProvider } from "./state/bar";
import { ThemeProvider } from "./state/theme";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BarProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </BarProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
