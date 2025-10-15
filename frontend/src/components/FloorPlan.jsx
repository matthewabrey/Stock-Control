import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Package } from "lucide-react";
import { toast } from "sonner";

const FloorPlan = () => {
  const navigate = useNavigate();
  const { shedId } = useParams();
  const [shed, setShed] = useState(null);
  const [zones, setZones] = useState([]);
  const [fields, setFields] = useState([]);
  const [sheds, setSheds] = useState([]);
  const [draggedZone, setDraggedZone] = useState(null);
  const [showIntakeDialog, setShowIntakeDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedField, setSelectedField] = useState("");
  const [intakeQuantity, setIntakeQuantity] = useState("");
  const [intakeDate, setIntakeDate] = useState(new Date().toISOString().split('T')[0]);
  const [moveQuantity, setMoveQuantity] = useState("");
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetZone, setTargetZone] = useState(null);
  const [newZone, setNewZone] = useState({
    name: "",
    x: 10,
    y: 10,
    width: 8,
    height: 8
  });

  useEffect(() => {
    fetchShed();
    fetchZones();
    fetchFields();
    fetchSheds();
  }, [shedId]);

  const fetchShed = async () => {
    try {
      const response = await axios.get(`${API}/sheds/${shedId}`);
      setShed(response.data);
    } catch (error) {
      console.error("Error fetching shed:", error);
      toast.error("Failed to load shed");
    }
  };

  const fetchZones = async () => {
    try {
      const response = await axios.get(`${API}/zones?shed_id=${shedId}`);
      setZones(response.data);
    } catch (error) {
      console.error("Error fetching zones:", error);
      toast.error("Failed to load zones");
    }
  };

  const fetchFields = async () => {
    try {
      const response = await axios.get(`${API}/fields`);
      setFields(response.data);
    } catch (error) {
      console.error("Error fetching fields:", error);
    }
  };

  const fetchSheds = async () => {
    try {
      const response = await axios.get(`${API}/sheds`);
      setSheds(response.data);
    } catch (error) {
      console.error("Error fetching sheds:", error);
    }
  };

  const handleCreateZone = async () => {
    if (!newZone.name) {
      toast.warning("Please provide a zone name");
      return;
    }

    try {
      await axios.post(`${API}/zones`, {
        ...newZone,
        shed_id: shedId
      });
      toast.success("Zone created successfully");
      setShowZoneDialog(false);
      setNewZone({ name: "", x: 10, y: 10, width: 8, height: 8 });
      fetchZones();
    } catch (error) {
      console.error("Error creating zone:", error);
      toast.error("Failed to create zone");
    }
  };

  const handleZoneClick = (zone) => {
    setSelectedZone(zone);
    setShowIntakeDialog(true);
  };

  const handleStockIntake = async () => {
    if (!selectedField || !intakeQuantity) {
      toast.warning("Please fill all fields");
      return;
    }

    const field = fields.find(f => f.id === selectedField);
    if (!field) return;

    try {
      await axios.post(`${API}/stock-intakes`, {
        field_id: field.id,
        field_name: field.name,
        zone_id: selectedZone.id,
        shed_id: shedId,
        quantity: parseFloat(intakeQuantity),
        date: intakeDate
      });
      toast.success(`Stock added from ${field.name}`);
      setShowIntakeDialog(false);
      setSelectedField("");
      setIntakeQuantity("");
      fetchZones();
    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error("Failed to add stock");
    }
  };

  const handleDragStart = (e, zone) => {
    setDraggedZone(zone);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, dropZone) => {
    e.preventDefault();
    if (draggedZone && draggedZone.id !== dropZone.id) {
      setTargetZone(dropZone);
      setShowMoveDialog(true);
    }
  };

  const handleStockMovement = async () => {
    if (!moveQuantity) {
      toast.warning("Please enter quantity to move");
      return;
    }

    try {
      await axios.post(`${API}/stock-movements`, {
        from_zone_id: draggedZone.id,
        to_zone_id: targetZone.id,
        from_shed_id: shedId,
        to_shed_id: shedId,
        quantity: parseFloat(moveQuantity),
        date: moveDate
      });
      toast.success(`Moved ${moveQuantity} units from ${draggedZone.name} to ${targetZone.name}`);
      setShowMoveDialog(false);
      setMoveQuantity("");
      setDraggedZone(null);
      setTargetZone(null);
      fetchZones();
    } catch (error) {
      console.error("Error moving stock:", error);
      toast.error(error.response?.data?.detail || "Failed to move stock");
    }
  };

  if (!shed) return <div className="p-8">Loading...</div>;

  const scale = 10; // 1 meter = 10 pixels

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
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
              {shed.name} - Floor Plan
            </h1>
            <p className="text-gray-600 mt-2">Dimensions: {shed.width}m × {shed.height}m</p>
          </div>
          <Button 
            onClick={() => setShowZoneDialog(true)} 
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="btn-add-zone"
          >
            <Plus className="mr-2 w-4 h-4" />
            Add Storage Zone
          </Button>
        </div>

        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>How to use:</strong> Click on a zone to add stock from a field. Drag and drop zones to move stock between locations.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div 
              className="relative bg-white border-4 border-gray-300 rounded-lg overflow-hidden"
              style={{ 
                width: `${shed.width * scale}px`, 
                height: `${shed.height * scale}px`,
                backgroundImage: 'linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px)',
                backgroundSize: `${scale}px ${scale}px`
              }}
              data-testid="floor-plan-canvas"
            >
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, zone)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, zone)}
                  onClick={() => handleZoneClick(zone)}
                  className="absolute cursor-pointer hover:shadow-2xl transition-shadow border-2 border-gray-400 rounded-lg flex flex-col items-center justify-center text-center p-2 bg-gradient-to-br from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300"
                  style={{
                    left: `${zone.x * scale}px`,
                    top: `${zone.y * scale}px`,
                    width: `${zone.width * scale}px`,
                    height: `${zone.height * scale}px`
                  }}
                  data-testid={`zone-${zone.id}`}
                >
                  <div className="font-semibold text-sm text-gray-800">{zone.name}</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-700">
                    <Package className="w-3 h-3" />
                    <span>{zone.total_quantity?.toFixed(0) || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shed Selector */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Switch Shed</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={shedId} onValueChange={(value) => navigate(`/floor-plan/${value}`)}>
                <SelectTrigger data-testid="select-shed">
                  <SelectValue placeholder="Select a shed" />
                </SelectTrigger>
                <SelectContent>
                  {sheds.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`shed-option-${s.id}`}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Add Zone Dialog */}
        <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
          <DialogContent data-testid="dialog-add-zone">
            <DialogHeader>
              <DialogTitle>Add Storage Zone</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="zone-name">Zone Name</Label>
                <Input
                  id="zone-name"
                  placeholder="e.g., Zone A1"
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  data-testid="input-zone-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zone-x">X Position (m)</Label>
                  <Input
                    id="zone-x"
                    type="number"
                    value={newZone.x}
                    onChange={(e) => setNewZone({ ...newZone, x: parseFloat(e.target.value) })}
                    data-testid="input-zone-x"
                  />
                </div>
                <div>
                  <Label htmlFor="zone-y">Y Position (m)</Label>
                  <Input
                    id="zone-y"
                    type="number"
                    value={newZone.y}
                    onChange={(e) => setNewZone({ ...newZone, y: parseFloat(e.target.value) })}
                    data-testid="input-zone-y"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zone-width">Width (m)</Label>
                  <Input
                    id="zone-width"
                    type="number"
                    value={newZone.width}
                    onChange={(e) => setNewZone({ ...newZone, width: parseFloat(e.target.value) })}
                    data-testid="input-zone-width"
                  />
                </div>
                <div>
                  <Label htmlFor="zone-height">Height (m)</Label>
                  <Input
                    id="zone-height"
                    type="number"
                    value={newZone.height}
                    onChange={(e) => setNewZone({ ...newZone, height: parseFloat(e.target.value) })}
                    data-testid="input-zone-height"
                  />
                </div>
              </div>
              <Button onClick={handleCreateZone} className="w-full" data-testid="btn-submit-zone">
                Create Zone
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stock Intake Dialog */}
        <Dialog open={showIntakeDialog} onOpenChange={setShowIntakeDialog}>
          <DialogContent data-testid="dialog-stock-intake">
            <DialogHeader>
              <DialogTitle>Add Stock to {selectedZone?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="field">Select Field</Label>
                <Select value={selectedField} onValueChange={setSelectedField}>
                  <SelectTrigger id="field" data-testid="select-field">
                    <SelectValue placeholder="Choose a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field.id} value={field.id} data-testid={`field-option-${field.id}`}>
                        {field.name} - {field.crop_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="Enter quantity"
                  value={intakeQuantity}
                  onChange={(e) => setIntakeQuantity(e.target.value)}
                  data-testid="input-intake-quantity"
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={intakeDate}
                  onChange={(e) => setIntakeDate(e.target.value)}
                  data-testid="input-intake-date"
                />
              </div>
              <Button onClick={handleStockIntake} className="w-full" data-testid="btn-submit-intake">
                Add Stock
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stock Movement Dialog */}
        <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
          <DialogContent data-testid="dialog-stock-movement">
            <DialogHeader>
              <DialogTitle>Move Stock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm"><strong>From:</strong> {draggedZone?.name} ({draggedZone?.total_quantity?.toFixed(0) || 0} units)</p>
                <p className="text-sm mt-2"><strong>To:</strong> {targetZone?.name}</p>
              </div>
              <div>
                <Label htmlFor="move-quantity">Quantity to Move</Label>
                <Input
                  id="move-quantity"
                  type="number"
                  placeholder="Enter quantity"
                  value={moveQuantity}
                  onChange={(e) => setMoveQuantity(e.target.value)}
                  data-testid="input-move-quantity"
                />
              </div>
              <div>
                <Label htmlFor="move-date">Date</Label>
                <Input
                  id="move-date"
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  data-testid="input-move-date"
                />
              </div>
              <Button onClick={handleStockMovement} className="w-full" data-testid="btn-submit-movement">
                Move Stock
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default FloorPlan;