import React from "react";
import { createRoot } from "react-dom/client";
import "@/css/main.css";
import { TweetPreviewApp } from "./app";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TweetPreviewApp />
  </React.StrictMode>
);
