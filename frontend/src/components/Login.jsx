import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User } from "lucide-react";

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!employeeNumber.trim()) {
      toast.error("Please enter your employee number");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/login`, {
        employee_number: employeeNumber.trim()
      });

      const user = response.data;

      // Check if user has stock movement permission
      if (user.stock_movement.toLowerCase() !== "yes") {
        toast.error("You do not have permission to access this application");
        setLoading(false);
        return;
      }

      // Store user in localStorage
      localStorage.setItem("user", JSON.stringify(user));
      
      // Call onLogin callback
      if (onLogin) {
        onLogin(user);
      }

      toast.success(`Welcome, ${user.name}!`);
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      if (error.response?.status === 404) {
        toast.error("Employee number not found");
      } else {
        toast.error("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">
            Stock Control System
          </CardTitle>
          <p className="text-gray-600">Enter your employee number to continue</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="employeeNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Employee Number
              </label>
              <Input
                id="employeeNumber"
                type="text"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="Enter your employee number"
                className="w-full text-lg py-6"
                disabled={loading}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg font-semibold"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
