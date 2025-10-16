import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse, Sprout, Map, Package } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalFields: 0,
    totalSheds: 0,
    totalZones: 0,
    totalStock: 0
  });
  const [sheds, setSheds] = useState([]);
  const [shedDetails, setShedDetails] = useState({});

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [fieldsRes, shedsRes, zonesRes] = await Promise.all([
        axios.get(`${API}/fields`),
        axios.get(`${API}/sheds`),
        axios.get(`${API}/zones`)
      ]);

      const totalStock = zonesRes.data.reduce((sum, zone) => sum + (zone.total_quantity || 0), 0);

      setStats({
        totalFields: fieldsRes.data.length,
        totalSheds: shedsRes.data.length,
        totalZones: zonesRes.data.length,
        totalStock: totalStock
      });

      setSheds(shedsRes.data);
      
      // Calculate details for each shed
      const details = {};
      shedsRes.data.forEach(shed => {
        const shedZones = zonesRes.data.filter(z => z.shed_id === shed.id);
        const shedStock = shedZones.reduce((sum, z) => sum + (z.total_quantity || 0), 0);
        const utilization = shedZones.length > 0 ? 
          ((shedZones.filter(z => z.total_quantity > 0).length / shedZones.length) * 100).toFixed(0) : 0;
        
        details[shed.id] = {
          zoneCount: shedZones.length,
          totalStock: shedStock,
          utilization: utilization
        };
      });
      setShedDetails(details);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load dashboard data");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold mb-2 text-gray-900">
            Stock Control System
          </h1>
          <p className="text-gray-600">
            Manage your crop inventory across fields and sheds
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow rounded-xl border border-gray-200 hover:shadow-lg transition-shadow" data-testid="stat-card-fields">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Sprout className="w-4 h-4" />
                Total Fields
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-gray-900">{stats.totalFields}</div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow rounded-xl border border-gray-200 hover:shadow-lg transition-shadow" data-testid="stat-card-sheds">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Warehouse className="w-4 h-4" />
                Total Sheds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-gray-900">{stats.totalSheds}</div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow rounded-xl border border-gray-200 hover:shadow-lg transition-shadow" data-testid="stat-card-zones">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Map className="w-4 h-4" />
                Storage Zones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-gray-900">{stats.totalZones}</div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow rounded-xl border border-gray-200 hover:shadow-lg transition-shadow" data-testid="stat-card-stock">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Package className="w-4 h-4" />
                Total Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-gray-900">{stats.totalStock.toFixed(0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your stock control system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => navigate('/fields')} 
                className="h-24 text-lg bg-emerald-600 hover:bg-emerald-700"
                data-testid="btn-manage-fields"
              >
                <Sprout className="mr-2 w-6 h-6" />
                Manage Fields
              </Button>
              <Button 
                onClick={() => navigate('/sheds')} 
                className="h-24 text-lg bg-blue-600 hover:bg-blue-700"
                data-testid="btn-manage-sheds"
              >
                <Warehouse className="mr-2 w-6 h-6" />
                Manage Sheds
              </Button>
              <Button 
                onClick={() => sheds.length > 0 ? navigate(`/floor-plan/${sheds[0].id}`) : toast.warning("Create a shed first")} 
                className="h-24 text-lg bg-purple-600 hover:bg-purple-700"
                data-testid="btn-view-floor-plans"
              >
                <Map className="mr-2 w-6 h-6" />
                View Floor Plans
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sheds List */}
        {sheds.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Sheds</CardTitle>
              <CardDescription>Click on a shed to view its floor plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sheds.map((shed) => {
                  const details = shedDetails[shed.id] || { zoneCount: 0, totalStock: 0, utilization: 0 };
                  
                  return (
                    <Card 
                      key={shed.id} 
                      className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-400"
                      onClick={() => navigate(`/floor-plan/${shed.id}`)}
                      data-testid={`shed-card-${shed.id}`}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Warehouse className="w-5 h-5" />
                          {shed.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            <strong>Dimensions:</strong> {shed.width}m × {shed.height}m
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Storage Zones:</strong> {details.zoneCount}
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Total Stock:</strong> {details.totalStock.toFixed(0)} units
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Utilization:</strong> {details.utilization}%
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;