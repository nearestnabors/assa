import React from "react";
import { createRoot } from "react-dom/client";
import "@/css/main.css";
import { AuthButtonApp } from "./app";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthButtonApp />
  </React.StrictMode>
);
