import React from "react";
import { createRoot } from "react-dom/client";
import "@/css/main.css";
import { TimelineDigestApp } from "./app";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TimelineDigestApp />
  </React.StrictMode>
);
