import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import Dashboard from "@/components/Dashboard";
import FieldsManager from "@/components/FieldsManager";
import ShedsManager from "@/components/ShedsManager";
import FloorPlan from "@/components/FloorPlan";
import Overview from "@/components/Overview";
import Login from "@/components/Login";
import MovementLog from "@/components/MovementLog";
import StoreDesigner from "@/components/StoreDesigner";
import { Toaster } from "@/components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Protected Route Component
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    
    // Check if user has stock movement permission
    if (user.stock_movement?.toLowerCase() !== "yes") {
      localStorage.removeItem("user");
      return <Navigate to="/login" replace />;
    }

    // Check admin permission if required
    if (requireAdmin && user.admin_control?.toUpperCase() !== "YES") {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">You do not have permission to access this page.</p>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return children;
  } catch (error) {
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }
};

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (error) {
        localStorage.removeItem("user");
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <div className="App">
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/fields" 
            element={
              <ProtectedRoute>
                <FieldsManager />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/sheds" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <ShedsManager />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/overview" 
            element={
              <ProtectedRoute>
                <Overview />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/movement-log" 
            element={
              <ProtectedRoute>
                <MovementLog />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/floor-plan/:shedId" 
            element={
              <ProtectedRoute>
                <FloorPlan user={user} />
              </ProtectedRoute>
            } 
          />

          {/* Redirect any unknown route to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;