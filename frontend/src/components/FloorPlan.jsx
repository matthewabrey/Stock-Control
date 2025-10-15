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
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Plus, Package, Calendar, Sprout } from "lucide-react";
import { toast } from "sonner";

// Color palette for different fields
const FIELD_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", 
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
  "#6366f1", "#f43f5e", "#22c55e", "#eab308", "#a855f7",
  "#0ea5e9", "#fb923c", "#34d399", "#fbbf24", "#c084fc"
];

const FloorPlan = () => {
  const navigate = useNavigate();
  const { shedId } = useParams();
  const [shed, setShed] = useState(null);
  const [zones, setZones] = useState([]);
  const [fields, setFields] = useState([]);
  const [sheds, setSheds] = useState([]);
  const [stockIntakes, setStockIntakes] = useState([]);
  const [fieldColorMap, setFieldColorMap] = useState({});
  const [draggedZone, setDraggedZone] = useState(null);
  const [selectedZones, setSelectedZones] = useState([]);
  const [showIntakeDialog, setShowIntakeDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showZoneDetails, setShowZoneDetails] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedZoneIntakes, setSelectedZoneIntakes] = useState([]);
  const [selectedField, setSelectedField] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
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
    fetchStockIntakes();
  }, [shedId]);

  useEffect(() => {
    // Create field color mapping
    const colorMap = {};
    fields.forEach((field, index) => {
      colorMap[field.id] = FIELD_COLORS[index % FIELD_COLORS.length];
    });
    setFieldColorMap(colorMap);
  }, [fields]);

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

  const fetchStockIntakes = async () => {
    try {
      const response = await axios.get(`${API}/stock-intakes`);
      setStockIntakes(response.data);
    } catch (error) {
      console.error("Error fetching stock intakes:", error);
    }
  };

  const getZoneIntakes = (zoneId) => {
    return stockIntakes.filter(intake => intake.zone_id === zoneId);
  };

  const getZoneColor = (zone) => {
    const zoneIntakes = getZoneIntakes(zone.id);
    if (zoneIntakes.length === 0) return "#e5e7eb"; // Gray for empty
    
    // If multiple fields, use gradient or most recent
    const latestIntake = zoneIntakes.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )[0];
    
    return fieldColorMap[latestIntake.field_id] || "#94a3b8";
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

  const handleZoneClick = async (zone, event) => {
    // Check if Ctrl/Cmd key is pressed for multi-select
    if (event?.ctrlKey || event?.metaKey) {
      // Multi-select mode
      const isAlreadySelected = selectedZones.some(z => z.id === zone.id);
      if (isAlreadySelected) {
        setSelectedZones(selectedZones.filter(z => z.id !== zone.id));
      } else {
        setSelectedZones([...selectedZones, zone]);
      }
    } else {
      // Single select mode - show details
      setSelectedZone(zone);
      const intakes = await axios.get(`${API}/stock-intakes/zone/${zone.id}`);
      setSelectedZoneIntakes(intakes.data);
      setShowZoneDetails(true);
    }
  };

  const handleAddStock = () => {
    setShowZoneDetails(false);
    setShowIntakeDialog(true);
  };

  const handleBulkAddStock = () => {
    if (selectedZones.length === 0) {
      toast.warning("Please select zones first (Ctrl+Click to select multiple)");
      return;
    }
    setShowIntakeDialog(true);
  };

  const handleStockIntake = async () => {
    if (!selectedField || !intakeQuantity || !selectedGrade) {
      toast.warning("Please fill all required fields including grade");
      return;
    }

    const field = fields.find(f => f.id === selectedField);
    if (!field) return;

    try {
      // If multiple zones selected, add to all
      const zonesToUpdate = selectedZones.length > 0 ? selectedZones : [selectedZone];
      
      for (const zone of zonesToUpdate) {
        await axios.post(`${API}/stock-intakes`, {
          field_id: field.id,
          field_name: field.name,
          zone_id: zone.id,
          shed_id: shedId,
          quantity: parseFloat(intakeQuantity),
          date: intakeDate,
          grade: selectedGrade
        });
      }
      
      toast.success(`Stock added to ${zonesToUpdate.length} zone(s) from ${field.name} (${selectedGrade})`);
      setShowIntakeDialog(false);
      setSelectedField("");
      setSelectedGrade("");
      setIntakeQuantity("");
      setSelectedZones([]);
      fetchZones();
      fetchStockIntakes();
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

  const scale = 20; // Scale for better visibility
  const gridCellSize = scale * 2; // Each grid cell is 2 meters
  const boxPadding = 4; // Padding between boxes in pixels
  const shedPadding = 40; // Padding between boxes and shed boundary (gray border)

  // Get unique fields with stock in this shed
  const fieldsInShed = [...new Set(stockIntakes
    .filter(intake => intake.shed_id === shedId)
    .map(intake => intake.field_id))]
    .map(fieldId => fields.find(f => f.id === fieldId))
    .filter(f => f);

  // Calculate grid dimensions
  const cols = Math.ceil(shed.width / 2);
  const rows = Math.ceil(shed.height / 2);

  // Helper to get column letter (A, B, C, ...)
  const getColumnLetter = (index) => {
    let letter = '';
    let num = index;
    while (num >= 0) {
      letter = String.fromCharCode(65 + (num % 26)) + letter;
      num = Math.floor(num / 26) - 1;
    }
    return letter;
  };

  // Helper to get zone at position
  const getZoneAt = (col, row) => {
    const x = col * 2;
    const y = row * 2;
    return zones.find(z => 
      Math.floor(z.x / 2) === col && Math.floor(z.y / 2) === row
    );
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-full mx-auto">
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
          <div className="flex gap-2">
            {selectedZones.length > 0 && (
              <Button 
                onClick={handleBulkAddStock} 
                className="bg-green-600 hover:bg-green-700"
                data-testid="btn-bulk-add-stock"
              >
                <Package className="mr-2 w-4 h-4" />
                Add Stock to {selectedZones.length} Selected
              </Button>
            )}
            {selectedZones.length > 0 && (
              <Button 
                onClick={() => setSelectedZones([])} 
                variant="outline"
                data-testid="btn-clear-selection"
              >
                Clear Selection
              </Button>
            )}
            <Button 
              onClick={() => setShowZoneDialog(true)} 
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="btn-add-zone"
            >
              <Plus className="mr-2 w-4 h-4" />
              Add Storage Zone
            </Button>
          </div>
        </div>

        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>How to use:</strong> Click to view details. <strong>Ctrl+Click</strong> to select multiple zones. Drag zones to move stock.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Floor Plan */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <div className="overflow-auto">
                  {/* Grid with labels */}
                  <div className="inline-block">
                    {/* Column headers */}
                    <div className="flex mb-1">
                      <div style={{ width: `${gridCellSize}px` }} className="flex-shrink-0"></div>
                      {Array.from({ length: cols }).map((_, i) => (
                        <div 
                          key={i} 
                          className="text-center font-bold text-sm text-gray-700 flex-shrink-0"
                          style={{ width: `${gridCellSize}px` }}
                        >
                          {getColumnLetter(i)}
                        </div>
                      ))}
                    </div>

                    {/* Grid rows */}
                    <div className="flex">
                      {/* Row numbers */}
                      <div className="flex flex-col">
                        {Array.from({ length: rows }).map((_, i) => (
                          <div 
                            key={i}
                            className="flex items-center justify-center font-bold text-sm text-gray-700 flex-shrink-0"
                            style={{ height: `${gridCellSize}px` }}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>

                      {/* Grid cells */}
                      <div 
                        className="relative bg-white border-4 border-gray-400 rounded-lg"
                        style={{ 
                          width: `${cols * gridCellSize + shedPadding * 2}px`, 
                          height: `${rows * gridCellSize + shedPadding * 2}px`,
                          padding: `${shedPadding}px`
                        }}
                        data-testid="floor-plan-canvas"
                      >
                        {/* Door markers */}
                        {shed.doors && shed.doors.map((door, idx) => {
                          const doorWidth = 60; // Width of door marker
                          const doorHeight = 30; // Height of door marker
                          let style = {};
                          
                          if (door.side === 'top') {
                            style = {
                              top: '0px',
                              left: `${shedPadding + door.position * scale}px`,
                              transform: 'translateY(-50%)'
                            };
                          } else if (door.side === 'bottom') {
                            style = {
                              bottom: '0px',
                              left: `${shedPadding + door.position * scale}px`,
                              transform: 'translateY(50%)'
                            };
                          } else if (door.side === 'left') {
                            style = {
                              left: '0px',
                              top: `${shedPadding + door.position * scale}px`,
                              transform: 'translateX(-50%) rotate(-90deg)'
                            };
                          } else if (door.side === 'right') {
                            style = {
                              right: '0px',
                              top: `${shedPadding + door.position * scale}px`,
                              transform: 'translateX(50%) rotate(90deg)'
                            };
                          }
                          
                          return (
                            <div
                              key={idx}
                              className="absolute bg-red-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-lg z-20"
                              style={style}
                              data-testid={`door-marker-${idx}`}
                            >
                              <span>DOOR</span>
                            </div>
                          );
                        })}
                        
                        {/* Grid lines */}
                        <div 
                          className="absolute"
                          style={{
                            left: `${shedPadding}px`,
                            top: `${shedPadding}px`,
                            width: `${cols * gridCellSize}px`,
                            height: `${rows * gridCellSize}px`,
                            backgroundImage: 'linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px)',
                            backgroundSize: `${gridCellSize}px ${gridCellSize}px`
                          }}
                        ></div>

                        {/* Zones */}
                        {Array.from({ length: rows }).map((_, rowIdx) =>
                          Array.from({ length: cols }).map((_, colIdx) => {
                            const zone = getZoneAt(colIdx, rowIdx);
                            if (!zone) return null;

                            const zoneColor = getZoneColor(zone);
                            const isEmpty = zone.total_quantity === 0;
                            const isSelected = selectedZones.some(z => z.id === zone.id);
                            
                            return (
                              <div
                                key={`${colIdx}-${rowIdx}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, zone)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, zone)}
                                onClick={(e) => handleZoneClick(zone, e)}
                                className={`absolute cursor-pointer hover:shadow-2xl hover:z-10 transition-all rounded ${
                                  isSelected ? 'border-4 border-blue-600 z-10' : 'border-2 border-gray-700'
                                }`}
                                style={{
                                  left: `${shedPadding + colIdx * gridCellSize + boxPadding}px`,
                                  top: `${shedPadding + rowIdx * gridCellSize + boxPadding}px`,
                                  width: `${gridCellSize - boxPadding * 2}px`,
                                  height: `${gridCellSize - boxPadding * 2}px`,
                                  backgroundColor: zoneColor,
                                  opacity: isEmpty ? 0.5 : 1,
                                  boxShadow: isSelected ? '0 0 0 2px #fff, 0 0 0 6px #2563eb' : '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                                data-testid={`zone-${zone.id}`}
                              >
                                {isSelected && (
                                  <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white"></div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Legend Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg">Stock Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {/* Color Legend */}
                    <div>
                      <h3 className="font-semibold text-sm mb-3 text-gray-700">Color Key</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded border-2 border-gray-400" style={{ backgroundColor: "#e5e7eb", opacity: 0.5 }}></div>
                          <span className="text-xs text-gray-600">Empty</span>
                        </div>
                        {fieldsInShed.map((field) => (
                          <div key={field.id} className="flex items-center gap-2">
                            <div 
                              className="w-5 h-5 rounded border-2 border-gray-800 flex-shrink-0" 
                              style={{ backgroundColor: fieldColorMap[field.id] }}
                            ></div>
                            <span className="text-xs text-gray-900 font-medium truncate">{field.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stock Details */}
                    {fieldsInShed.length > 0 && (
                      <div className="pt-3 border-t">
                        <h3 className="font-semibold text-sm mb-3 text-gray-700">Stock Details</h3>
                        <div className="space-y-3">
                          {fieldsInShed.map((field) => {
                            const fieldIntakes = stockIntakes.filter(i => i.field_id === field.id && i.shed_id === shedId);
                            const totalQty = fieldIntakes.reduce((sum, i) => sum + i.quantity, 0);
                            const latestDate = fieldIntakes.length > 0 ? 
                              new Date(Math.max(...fieldIntakes.map(i => new Date(i.date)))).toLocaleDateString() : '';
                            
                            // Get zones with this field
                            const fieldZones = zones.filter(zone => {
                              const zoneIntakes = getZoneIntakes(zone.id);
                              return zoneIntakes.some(intake => intake.field_id === field.id);
                            }).map(zone => {
                              const col = Math.floor(zone.x / 2);
                              const row = Math.floor(zone.y / 2);
                              return `${getColumnLetter(col)}${row + 1}`;
                            });
                            
                            return (
                              <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-start gap-2 mb-2">
                                  <div 
                                    className="w-4 h-4 rounded border-2 border-gray-800 flex-shrink-0 mt-0.5" 
                                    style={{ backgroundColor: fieldColorMap[field.id] }}
                                  ></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-gray-900 truncate">{field.name}</div>
                                    <div className="text-xs text-gray-600 truncate">{field.crop_type}</div>
                                  </div>
                                </div>
                                <div className="ml-6 space-y-1">
                                  <div className="flex items-center gap-1 text-xs">
                                    <Package className="w-3 h-3 text-gray-600" />
                                    <span className="font-semibold text-gray-900">{totalQty.toFixed(0)} units</span>
                                  </div>
                                  {latestDate && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <Calendar className="w-3 h-3 text-gray-600" />
                                      <span className="text-gray-600">{latestDate}</span>
                                    </div>
                                  )}
                                  {fieldZones.length > 0 && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      <span className="font-medium">Locations:</span> {fieldZones.join(', ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {fieldsInShed.length === 0 && (
                      <p className="text-sm text-gray-500 italic">No stock in this shed yet. Click a zone to add stock.</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Shed Selector */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Switch Shed</CardTitle>
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
        </div>

        {/* Zone Details Dialog */}
        <Dialog open={showZoneDetails} onOpenChange={setShowZoneDetails}>
          <DialogContent data-testid="dialog-zone-details" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedZone?.name} - Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Current Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedZone?.total_quantity?.toFixed(0) || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Max Capacity</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedZone?.max_capacity || 6}</p>
                </div>
              </div>

              {selectedZoneIntakes.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Stock History</h3>
                  <ScrollArea className="h-[200px] border rounded-lg p-2">
                    <div className="space-y-2">
                      {selectedZoneIntakes.map((intake) => {
                        const field = fields.find(f => f.id === intake.field_id);
                        return (
                          <div key={intake.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                            <div 
                              className="w-4 h-4 rounded flex-shrink-0" 
                              style={{ backgroundColor: fieldColorMap[intake.field_id] }}
                            ></div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{field?.name || intake.field_name}</p>
                              <p className="text-xs text-gray-600">{field?.variety} - {field?.crop_type}</p>
                              {intake.grade && (
                                <p className="text-xs font-medium text-blue-600">Grade: {intake.grade}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{intake.quantity} units</p>
                              <p className="text-xs text-gray-500">{new Date(intake.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Button onClick={handleAddStock} className="w-full" data-testid="btn-add-stock-from-details">
                <Plus className="mr-2 w-4 h-4" />
                Add Stock to This Zone
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
              <DialogTitle>
                {selectedZones.length > 0 
                  ? `Add Stock to ${selectedZones.length} Selected Zones` 
                  : `Add Stock to ${selectedZone?.name}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedZones.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <p className="font-semibold text-blue-900">Selected Zones: {selectedZones.length}</p>
                  <p className="text-blue-700 text-xs mt-1">Stock will be added to all selected zones</p>
                </div>
              )}
              
              <div>
                <Label htmlFor="field">Select Field</Label>
                <Select value={selectedField} onValueChange={(value) => { setSelectedField(value); setSelectedGrade(""); }}>
                  <SelectTrigger id="field" data-testid="select-field">
                    <SelectValue placeholder="Choose a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field.id} value={field.id} data-testid={`field-option-${field.id}`}>
                        <div className="flex flex-col">
                          <span className="font-semibold">{field.name}</span>
                          <span className="text-xs text-gray-600">
                            {field.variety} - {field.crop_type}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedField && fields.find(f => f.id === selectedField) && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-1">
                    <p><strong>Area:</strong> {fields.find(f => f.id === selectedField).area}</p>
                    <p><strong>Crop Type:</strong> {fields.find(f => f.id === selectedField).crop_type}</p>
                    <p><strong>Variety:</strong> {fields.find(f => f.id === selectedField).variety}</p>
                  </div>
                )}
              </div>
              
              {selectedField && fields.find(f => f.id === selectedField)?.available_grades?.length > 0 && (
                <div>
                  <Label htmlFor="grade">Select Grade *</Label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger id="grade" data-testid="select-grade">
                      <SelectValue placeholder="Choose a grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const field = fields.find(f => f.id === selectedField);
                        const cropType = field.crop_type.toLowerCase();
                        
                        // Filter grades based on crop type
                        let filteredGrades = field.available_grades;
                        if (cropType.includes('onion')) {
                          filteredGrades = field.available_grades.filter(g => 
                            g.startsWith('O') || g.includes('Whole Crop')
                          );
                        } else if (cropType.includes('maincrop')) {
                          filteredGrades = field.available_grades.filter(g => 
                            g.startsWith('MC') || g.includes('Whole Crop')
                          );
                        } else if (cropType.includes('salad')) {
                          filteredGrades = field.available_grades.filter(g => 
                            g.startsWith('SP') || g.includes('Whole Crop')
                          );
                        }
                        
                        return filteredGrades.map((grade) => (
                          <SelectItem key={grade} value={grade} data-testid={`grade-option-${grade}`}>
                            {grade}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              )}
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