import React from "react";
import { createRoot } from "react-dom/client";
import "@/css/main.css";
import { ConversationListApp } from "./app";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConversationListApp />
  </React.StrictMode>
);
