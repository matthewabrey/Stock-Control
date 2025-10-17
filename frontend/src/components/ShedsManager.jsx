import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Map, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ExcelUpload from "@/components/ExcelUpload";
import ManualStoreCreator from "@/components/ManualStoreCreator";

const ShedsManager = () => {
  const navigate = useNavigate();
  const [sheds, setSheds] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newShed, setNewShed] = useState({
    name: "",
    width: 50,
    height: 30,
    description: ""
  });

  useEffect(() => {
    fetchSheds();
  }, []);

  const fetchSheds = async () => {
    try {
      const response = await axios.get(`${API}/sheds`);
      setSheds(response.data);
    } catch (error) {
      console.error("Error fetching sheds:", error);
      toast.error("Failed to load sheds");
    }
  };

  const handleCreateShed = async () => {
    if (!newShed.name || !newShed.width || !newShed.height) {
      toast.warning("Please fill all required fields");
      return;
    }

    try {
      await axios.post(`${API}/sheds`, newShed);
      toast.success("Shed created successfully");
      setIsDialogOpen(false);
      setNewShed({ name: "", width: 50, height: 30, description: "" });
      fetchSheds();
    } catch (error) {
      console.error("Error creating shed:", error);
      toast.error("Failed to create shed");
    }
  };

  const handleDeleteShed = async (shedId) => {
    try {
      await axios.delete(`${API}/sheds/${shedId}`);
      toast.success("Shed deleted successfully");
      fetchSheds();
    } catch (error) {
      console.error("Error deleting shed:", error);
      toast.error("Failed to delete shed");
    }
  };

  const handleExportToExcel = async () => {
    try {
      toast.info("Preparing Excel export...");
      const response = await axios.get(`${API}/export-excel`, {
        responseType: 'blob'
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stock-control-export-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Excel file downloaded successfully");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export to Excel");
    }
  };

  const handleClearAllStores = async () => {
    if (!window.confirm("Are you sure you want to clear ALL stores/sheds? This will delete all sheds and their zones. Stock intake records will be preserved.")) {
      return;
    }
    
    if (!window.confirm("This action cannot be undone. Are you absolutely sure?")) {
      return;
    }

    try {
      await axios.delete(`${API}/clear-stores`);
      toast.success("All stores cleared successfully");
      fetchSheds();
    } catch (error) {
      console.error("Error clearing stores:", error);
      toast.error("Failed to clear stores");
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="mb-4"
              data-testid="btn-back-dashboard"
            >
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-5xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
              Sheds Management
            </h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" data-testid="btn-add-shed">
                <Plus className="mr-2 w-4 h-4" />
                Add Shed
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-shed">
              <DialogHeader>
                <DialogTitle>Add New Shed</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Shed Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Warehouse A"
                    value={newShed.name}
                    onChange={(e) => setNewShed({ ...newShed, name: e.target.value })}
                    data-testid="input-shed-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="width">Width (meters)</Label>
                    <Input
                      id="width"
                      type="number"
                      placeholder="50"
                      value={newShed.width}
                      onChange={(e) => setNewShed({ ...newShed, width: parseFloat(e.target.value) })}
                      data-testid="input-shed-width"
                    />
                  </div>
                  <div>
                    <Label htmlFor="height">Height (meters)</Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="30"
                      value={newShed.height}
                      onChange={(e) => setNewShed({ ...newShed, height: parseFloat(e.target.value) })}
                      data-testid="input-shed-height"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Additional details about the shed"
                    value={newShed.description}
                    onChange={(e) => setNewShed({ ...newShed, description: e.target.value })}
                    data-testid="input-shed-description"
                  />
                </div>
                <Button onClick={handleCreateShed} className="w-full" data-testid="btn-submit-shed">
                  Create Shed
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ExcelUpload onUploadSuccess={fetchSheds} />
          <ManualStoreCreator onStoreCreated={fetchSheds} />
        </div>

        {/* Admin Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Download className="w-5 h-5" />
                Export to Excel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-700 mb-4">
                Download all your data (fields, sheds, zones, stock) to an Excel file
              </p>
              <Button 
                onClick={handleExportToExcel}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Download className="mr-2 w-4 h-4" />
                Download Excel
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-900">
                <AlertTriangle className="w-5 h-5" />
                Clear All Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-700 mb-4">
                Remove all stock from sheds. Keeps sheds and zones intact, only clears the stock.
              </p>
              <Button 
                onClick={handleClearAllStores}
                variant="destructive"
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="mr-2 w-4 h-4" />
                Clear All Stock
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sheds.map((shed) => (
            <Card key={shed.id} className="hover:shadow-lg transition-shadow" data-testid={`shed-card-${shed.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{shed.name}</span>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => navigate(`/floor-plan/${shed.id}`)}
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                      data-testid={`btn-view-floorplan-${shed.id}`}
                    >
                      <Map className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteShed(shed.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      data-testid={`btn-delete-shed-${shed.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Dimensions:</span> {shed.width}m × {shed.height}m
                  </p>
                  {shed.description && (
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Description:</span> {shed.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sheds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No sheds created yet. Add your first shed to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShedsManager;