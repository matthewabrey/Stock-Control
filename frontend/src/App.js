import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import Dashboard from "@/components/Dashboard";
import FieldsManager from "@/components/FieldsManager";
import ShedsManager from "@/components/ShedsManager";
import FloorPlan from "@/components/FloorPlan";
import { Toaster } from "@/components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  return (
    <div className="App">
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/fields" element={<FieldsManager />} />
          <Route path="/sheds" element={<ShedsManager />} />
          <Route path="/floor-plan/:shedId" element={<FloorPlan />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;