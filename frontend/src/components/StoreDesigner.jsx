import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Trash2, DoorOpen, Refrigerator, Square } from "lucide-react";
import { toast } from "sonner";

const StoreDesigner = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  
  const GRID_SIZE = 50;
  const CELL_SIZE = 15; // pixels
  
  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState("box"); // "box" or "bulk"
  const [zones, setZones] = useState([]); // [{x, y, width, height, capacity}]
  const [doors, setDoors] = useState([]); // [{x, y}]
  const [fridges, setFridges] = useState([]); // [{x, y}]
  
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [mode, setMode] = useState("zone"); // "zone", "door", "fridge", "delete", "wall"
  
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [pendingZone, setPendingZone] = useState(null);
  const [zoneCapacity, setZoneCapacity] = useState("");
  
  const [selectedZoneIndexes, setSelectedZoneIndexes] = useState([]);
  const [isDraggingCopy, setIsDraggingCopy] = useState(false);
  const [draggedZonesCopy, setDraggedZonesCopy] = useState([]); // Array of zones being copied
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredZoneIndex, setHoveredZoneIndex] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Wall/perimeter state
  const [walls, setWalls] = useState([]); // [{x1, y1, x2, y2}]
  const [wallCells, setWallCells] = useState([]); // [{x, y}] cells selected for wall
  const [isSelectingWallCells, setIsSelectingWallCells] = useState(false);
  const [wallCellStart, setWallCellStart] = useState(null);
  const [wallCellEnd, setWallCellEnd] = useState(null);

  const drawGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const width = GRID_SIZE * CELL_SIZE;
    const height = GRID_SIZE * CELL_SIZE;
    
    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= GRID_SIZE; i++) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, height);
      ctx.stroke();
      
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(width, i * CELL_SIZE);
      ctx.stroke();
    }
    
    // Draw wall cells (cells selected for wall placement)
    wallCells.forEach(cell => {
      ctx.fillStyle = "rgba(31, 41, 55, 0.2)"; // semi-transparent dark gray
      ctx.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.strokeRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });
    
    // Draw current wall cell selection
    if (isSelectingWallCells && wallCellStart && wallCellEnd) {
      const x1 = Math.min(wallCellStart.x, wallCellEnd.x);
      const y1 = Math.min(wallCellStart.y, wallCellEnd.y);
      const x2 = Math.max(wallCellStart.x, wallCellEnd.x);
      const y2 = Math.max(wallCellStart.y, wallCellEnd.y);
      
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          ctx.fillStyle = "rgba(31, 41, 55, 0.3)"; // darker during selection
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
    
    // Draw walls/perimeter on grid lines
    ctx.strokeStyle = "#1f2937"; // dark gray
    ctx.lineWidth = 4;
    walls.forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(wall.x1 * CELL_SIZE, wall.y1 * CELL_SIZE);
      ctx.lineTo(wall.x2 * CELL_SIZE, wall.y2 * CELL_SIZE);
      ctx.stroke();
    });
    
    // Draw zones
    zones.forEach((zone, idx) => {
      const isSelected = selectedZoneIndexes.includes(idx);
      const isHovered = idx === hoveredZoneIndex;
      
      ctx.fillStyle = isSelected ? "rgba(59, 130, 246, 0.5)" : "rgba(59, 130, 246, 0.3)"; // blue
      ctx.fillRect(
        zone.x * CELL_SIZE,
        zone.y * CELL_SIZE,
        zone.width * CELL_SIZE,
        zone.height * CELL_SIZE
      );
      
      ctx.strokeStyle = isSelected ? "#dc2626" : "#2563eb"; // red if selected
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(
        zone.x * CELL_SIZE,
        zone.y * CELL_SIZE,
        zone.width * CELL_SIZE,
        zone.height * CELL_SIZE
      );
      
      // Draw capacity text
      ctx.fillStyle = "#1e40af";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        zone.capacity || "?",
        (zone.x + zone.width / 2) * CELL_SIZE,
        (zone.y + zone.height / 2) * CELL_SIZE
      );
      
      // Draw drag handle (small cross in bottom-right corner) when hovering or selected
      if ((isHovered || isSelected) && mode === "zone") {
        const handleX = (zone.x + zone.width) * CELL_SIZE;
        const handleY = (zone.y + zone.height) * CELL_SIZE;
        const handleSize = 10;
        
        // Draw filled square
        ctx.fillStyle = "#16a34a"; // green
        ctx.fillRect(handleX - handleSize, handleY - handleSize, handleSize, handleSize);
        
        // Draw white cross inside
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Horizontal line
        ctx.moveTo(handleX - handleSize + 2, handleY - handleSize / 2);
        ctx.lineTo(handleX - 2, handleY - handleSize / 2);
        // Vertical line
        ctx.moveTo(handleX - handleSize / 2, handleY - handleSize + 2);
        ctx.lineTo(handleX - handleSize / 2, handleY - 2);
        ctx.stroke();
      }
    });
    
    // Draw dragging copy zones
    if (isDraggingCopy && draggedZonesCopy.length > 0) {
      draggedZonesCopy.forEach((zone) => {
        ctx.fillStyle = "rgba(34, 197, 94, 0.4)"; // green
        ctx.fillRect(
          zone.x * CELL_SIZE,
          zone.y * CELL_SIZE,
          zone.width * CELL_SIZE,
          zone.height * CELL_SIZE
        );
        
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          zone.x * CELL_SIZE,
          zone.y * CELL_SIZE,
          zone.width * CELL_SIZE,
          zone.height * CELL_SIZE
        );
        ctx.setLineDash([]);
        
        // Draw capacity
        ctx.fillStyle = "#16a34a";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          zone.capacity || "?",
          (zone.x + zone.width / 2) * CELL_SIZE,
          (zone.y + zone.height / 2) * CELL_SIZE
        );
      });
    }
    
    // Draw doors
    doors.forEach((door) => {
      ctx.fillStyle = "#10b981"; // green
      ctx.fillRect(door.x * CELL_SIZE, door.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 2;
      ctx.strokeRect(door.x * CELL_SIZE, door.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });
    
    // Draw fridges
    fridges.forEach((fridge) => {
      ctx.fillStyle = "#8b5cf6"; // purple
      ctx.fillRect(fridge.x * CELL_SIZE, fridge.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 2;
      ctx.strokeRect(fridge.x * CELL_SIZE, fridge.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });
    
    // Draw current selection
    if (isSelecting && selectionStart && selectionEnd) {
      const x = Math.min(selectionStart.x, selectionEnd.x);
      const y = Math.min(selectionStart.y, selectionEnd.y);
      const w = Math.abs(selectionEnd.x - selectionStart.x) + 1;
      const h = Math.abs(selectionEnd.y - selectionStart.y) + 1;
      
      ctx.fillStyle = "rgba(34, 197, 94, 0.2)"; // light green
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, w * CELL_SIZE, h * CELL_SIZE);
      
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, w * CELL_SIZE, h * CELL_SIZE);
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    drawGrid();
  }, [zones, doors, fridges, walls, wallCells, isSelecting, selectionStart, selectionEnd, selectedZoneIndexes, isDraggingCopy, draggedZonesCopy, hoveredZoneIndex, mode, isSelectingWallCells, wallCellStart, wallCellEnd, mousePos]);

  const getCellFromMouse = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
    return { x: Math.max(0, Math.min(x, GRID_SIZE - 1)), y: Math.max(0, Math.min(y, GRID_SIZE - 1)) };
  };

  const getMousePixelPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const isMouseOverDragHandle = (zone, mousePixelPos) => {
    // Drag handle is in bottom-right corner (10x10 pixel area)
    const handleSize = 10;
    const zoneRight = (zone.x + zone.width) * CELL_SIZE;
    const zoneBottom = (zone.y + zone.height) * CELL_SIZE;
    
    return (
      mousePixelPos.x >= zoneRight - handleSize &&
      mousePixelPos.x <= zoneRight &&
      mousePixelPos.y >= zoneBottom - handleSize &&
      mousePixelPos.y <= zoneBottom
    );
  };

  const handleMouseDown = (e) => {
    const cell = getCellFromMouse(e);
    const pixelPos = getMousePixelPos(e);
    const isCtrlKey = e.ctrlKey || e.metaKey;
    
    // Check if clicking on drag handle of any selected zone
    if (mode === "zone" && selectedZoneIndexes.length > 0) {
      for (let idx of selectedZoneIndexes) {
        const zone = zones[idx];
        if (isMouseOverDragHandle(zone, pixelPos)) {
          // Start drag-to-copy all selected zones
          setIsDraggingCopy(true);
          
          // Calculate relative positions of all selected zones
          const minX = Math.min(...selectedZoneIndexes.map(i => zones[i].x));
          const minY = Math.min(...selectedZoneIndexes.map(i => zones[i].y));
          
          const copiedZones = selectedZoneIndexes.map(i => {
            const z = zones[i];
            return {
              ...z,
              x: z.x - minX + cell.x,
              y: z.y - minY + cell.y
            };
          });
          
          setDraggedZonesCopy(copiedZones);
          setDragOffset({
            x: cell.x - minX,
            y: cell.y - minY
          });
          return;
        }
      }
    }
    
    // Check if clicking on an existing zone to select it
    const clickedZoneIndex = zones.findIndex(zone => 
      cell.x >= zone.x && cell.x < zone.x + zone.width &&
      cell.y >= zone.y && cell.y < zone.y + zone.height
    );
    
    if (clickedZoneIndex !== -1 && mode === "zone") {
      if (isCtrlKey) {
        // Ctrl+Click: Toggle zone in selection
        if (selectedZoneIndexes.includes(clickedZoneIndex)) {
          setSelectedZoneIndexes(selectedZoneIndexes.filter(i => i !== clickedZoneIndex));
        } else {
          setSelectedZoneIndexes([...selectedZoneIndexes, clickedZoneIndex]);
        }
      } else {
        // Regular click: Select only this zone
        setSelectedZoneIndexes([clickedZoneIndex]);
      }
    } else if (mode === "zone") {
      // Start drawing new zone
      setIsSelecting(true);
      setSelectionStart(cell);
      setSelectionEnd(cell);
      if (!isCtrlKey) {
        setSelectedZoneIndexes([]);
      }
    } else if (mode === "door") {
      setDoors([...doors, cell]);
      setSelectedZoneIndexes([]);
    } else if (mode === "fridge") {
      setFridges([...fridges, cell]);
      setSelectedZoneIndexes([]);
    } else if (mode === "wall") {
      // Start selecting cells for wall placement
      setIsSelectingWallCells(true);
      setWallCellStart(cell);
      setWallCellEnd(cell);
      setSelectedZoneIndexes([]);
    } else if (mode === "delete") {
      // Delete zone at this cell
      setZones(zones.filter((zone, idx) => {
        return !(cell.x >= zone.x && cell.x < zone.x + zone.width &&
                 cell.y >= zone.y && cell.y < zone.y + zone.height);
      }));
      // Delete door at this cell
      setDoors(doors.filter(door => !(door.x === cell.x && door.y === cell.y)));
      // Delete fridge at this cell
      setFridges(fridges.filter(fridge => !(fridge.x === cell.x && fridge.y === cell.y)));
      // Delete wall cells at this position
      const updatedWallCells = wallCells.filter(wc => !(wc.x === cell.x && wc.y === cell.y));
      setWallCells(updatedWallCells);
      
      // Regenerate walls from remaining cells
      const generatedWalls = generateWallsFromCells(updatedWallCells);
      setWalls(generatedWalls);
      
      setSelectedZoneIndexes([]);
    }
  };

  const handleMouseMove = (e) => {
    const cell = getCellFromMouse(e);
    const pixelPos = getMousePixelPos(e);
    setMousePos(pixelPos);
    
    // Update cursor and hover state
    if (mode === "zone" && !isSelecting && !isDraggingCopy) {
      let foundHover = false;
      for (let idx = 0; idx < zones.length; idx++) {
        const zone = zones[idx];
        if (isMouseOverDragHandle(zone, pixelPos)) {
          setHoveredZoneIndex(idx);
          canvasRef.current.style.cursor = "crosshair";
          foundHover = true;
          break;
        } else if (
          cell.x >= zone.x && cell.x < zone.x + zone.width &&
          cell.y >= zone.y && cell.y < zone.y + zone.height
        ) {
          setHoveredZoneIndex(idx);
          canvasRef.current.style.cursor = "pointer";
          foundHover = true;
          break;
        }
      }
      if (!foundHover) {
        setHoveredZoneIndex(null);
        canvasRef.current.style.cursor = "crosshair";
      }
    }
    
    if (isSelectingWallCells && mode === "wall") {
      setWallCellEnd(cell);
    } else if (isSelecting && mode === "zone") {
      setSelectionEnd(cell);
    } else if (isDraggingCopy && draggedZonesCopy.length > 0) {
      // Update all copied zones' positions while dragging
      const minX = Math.min(...selectedZoneIndexes.map(i => zones[i].x));
      const minY = Math.min(...selectedZoneIndexes.map(i => zones[i].y));
      
      const updatedCopies = selectedZoneIndexes.map(i => {
        const zone = zones[i];
        return {
          ...zone,
          x: zone.x - minX + cell.x,
          y: zone.y - minY + cell.y
        };
      });
      
      setDraggedZonesCopy(updatedCopies);
    }
  };

  const generateWallsFromCells = (cells) => {
    if (cells.length === 0) return [];
    
    const newWalls = [];
    const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));
    
    // For each cell, check each of its 4 sides
    cells.forEach(cell => {
      // Top side
      if (!cellSet.has(`${cell.x},${cell.y - 1}`)) {
        newWalls.push({ x1: cell.x, y1: cell.y, x2: cell.x + 1, y2: cell.y });
      }
      // Bottom side
      if (!cellSet.has(`${cell.x},${cell.y + 1}`)) {
        newWalls.push({ x1: cell.x, y1: cell.y + 1, x2: cell.x + 1, y2: cell.y + 1 });
      }
      // Left side
      if (!cellSet.has(`${cell.x - 1},${cell.y}`)) {
        newWalls.push({ x1: cell.x, y1: cell.y, x2: cell.x, y2: cell.y + 1 });
      }
      // Right side
      if (!cellSet.has(`${cell.x + 1},${cell.y}`)) {
        newWalls.push({ x1: cell.x + 1, y1: cell.y, x2: cell.x + 1, y2: cell.y + 1 });
      }
    });
    
    return newWalls;
  };

  const handleMouseUp = () => {
    if (isDraggingCopy && draggedZonesCopy.length > 0) {
      // Finalize the copy - add all zones
      setZones([...zones, ...draggedZonesCopy]);
      setIsDraggingCopy(false);
      setDraggedZonesCopy([]);
      toast.success(`${draggedZonesCopy.length} zone${draggedZonesCopy.length > 1 ? 's' : ''} copied!`);
    } else if (isSelectingWallCells && wallCellStart && wallCellEnd) {
      // Add selected cells to wall cells
      const x1 = Math.min(wallCellStart.x, wallCellEnd.x);
      const y1 = Math.min(wallCellStart.y, wallCellEnd.y);
      const x2 = Math.max(wallCellStart.x, wallCellEnd.x);
      const y2 = Math.max(wallCellStart.y, wallCellEnd.y);
      
      const newCells = [];
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          // Check if cell already exists
          if (!wallCells.find(c => c.x === x && c.y === y)) {
            newCells.push({ x, y });
          }
        }
      }
      
      const updatedWallCells = [...wallCells, ...newCells];
      setWallCells(updatedWallCells);
      
      // Generate walls from all wall cells
      const generatedWalls = generateWallsFromCells(updatedWallCells);
      setWalls(generatedWalls);
      
      toast.success(`${newCells.length} cell${newCells.length > 1 ? 's' : ''} added to wall area`);
      
      setIsSelectingWallCells(false);
      setWallCellStart(null);
      setWallCellEnd(null);
    } else if (isSelecting && selectionStart && selectionEnd && mode === "zone") {
      const x = Math.min(selectionStart.x, selectionEnd.x);
      const y = Math.min(selectionStart.y, selectionEnd.y);
      const width = Math.abs(selectionEnd.x - selectionStart.x) + 1;
      const height = Math.abs(selectionEnd.y - selectionStart.y) + 1;
      
      // Show capacity dialog
      setPendingZone({ x, y, width, height });
      setShowCapacityDialog(true);
    }
    
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleAddZone = () => {
    if (!zoneCapacity || !pendingZone) {
      toast.error("Please enter a capacity");
      return;
    }
    
    const capacity = parseInt(zoneCapacity);
    if (isNaN(capacity) || capacity < 1) {
      toast.error("Please enter a valid capacity");
      return;
    }
    
    setZones([...zones, { ...pendingZone, capacity }]);
    setShowCapacityDialog(false);
    setPendingZone(null);
    setZoneCapacity("");
    toast.success("Zone added");
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSave = async () => {
    if (!storeName.trim()) {
      toast.error("Please enter a store name");
      return;
    }
    
    if (zones.length === 0) {
      toast.error("Please create at least one zone");
      return;
    }
    
    try {
      // Create shed
      const shedData = {
        id: generateUUID(),
        name: storeName,
        width: GRID_SIZE * 2, // Convert cells to meters (each cell = 2m)
        height: GRID_SIZE * 2,
        description: `${storeType} storage - ${zones.length} zones`,
        doors: doors.map(d => ({
          side: "top", // We can enhance this later
          position: d.x * 2
        }))
      };
      
      await axios.post(`${API}/sheds`, shedData);
      
      // Create zones
      for (const zone of zones) {
        const zoneData = {
          id: generateUUID(),
          shed_id: shedData.id,
          name: `Z${zones.indexOf(zone) + 1}`,
          x: zone.x * 2, // Convert to meters
          y: zone.y * 2,
          width: zone.width * 2,
          height: zone.height * 2,
          total_quantity: 0,
          max_capacity: zone.capacity
        };
        
        await axios.post(`${API}/zones`, zoneData);
      }
      
      toast.success("Store created successfully!");
      navigate("/");
    } catch (error) {
      console.error("Error creating store:", error);
      toast.error(`Failed to create store: ${error.response?.data?.detail || error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Store Designer</h1>
          </div>
          
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save Store
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Store Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Store Name</Label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g., E5"
                />
              </div>
              
              <div>
                <Label>Store Type</Label>
                <Select value={storeType} onValueChange={setStoreType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="box">Box Storage (1m × 2m)</SelectItem>
                    <SelectItem value="bulk">Bulk Storage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-4 border-t">
                <Label className="mb-3 block">Drawing Mode</Label>
                <div className="space-y-2">
                  <Button
                    variant={mode === "zone" ? "default" : "outline"}
                    onClick={() => setMode("zone")}
                    className="w-full justify-start"
                  >
                    Draw Zones
                  </Button>
                  <Button
                    variant={mode === "door" ? "default" : "outline"}
                    onClick={() => setMode("door")}
                    className="w-full justify-start"
                  >
                    <DoorOpen className="w-4 h-4 mr-2" />
                    Add Door
                  </Button>
                  <Button
                    variant={mode === "fridge" ? "default" : "outline"}
                    onClick={() => setMode("fridge")}
                    className="w-full justify-start"
                  >
                    <Refrigerator className="w-4 h-4 mr-2" />
                    Add Fridge
                  </Button>
                  <Button
                    variant={mode === "wall" ? "default" : "outline"}
                    onClick={() => setMode("wall")}
                    className="w-full justify-start"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Draw Walls
                  </Button>
                  <Button
                    variant={mode === "delete" ? "destructive" : "outline"}
                    onClick={() => setMode("delete")}
                    className="w-full justify-start"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm space-y-1">
                  <p><strong>Zones:</strong> {zones.length}</p>
                  <p><strong>Wall Cells:</strong> {wallCells.length}</p>
                  <p><strong>Walls:</strong> {walls.length}</p>
                  <p><strong>Doors:</strong> {doors.length}</p>
                  <p><strong>Fridges:</strong> {fridges.length}</p>
                  {selectedZoneIndexes.length > 0 && (
                    <p className="text-red-600"><strong>Selected:</strong> {selectedZoneIndexes.length} zone{selectedZoneIndexes.length > 1 ? 's' : ''}</p>
                  )}
                </div>
                {wallCells.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWallCells([]);
                      setWalls([]);
                      toast.success("All walls cleared");
                    }}
                    className="w-full mt-2"
                  >
                    Clear All Walls
                  </Button>
                )}
              </div>
              
              {selectedZoneIndexes.length > 0 && (
                <div className="pt-4 border-t">
                  <Label className="mb-2 block text-sm font-semibold">
                    Selected Zone{selectedZoneIndexes.length > 1 ? 's' : ''} Actions
                  </Label>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const minX = Math.min(...selectedZoneIndexes.map(i => zones[i].x));
                        const minY = Math.min(...selectedZoneIndexes.map(i => zones[i].y));
                        const duplicates = selectedZoneIndexes.map(i => {
                          const z = zones[i];
                          return { ...z, x: z.x - minX + z.x + z.width + 1, y: z.y - minY + z.y };
                        });
                        setZones([...zones, ...duplicates]);
                        toast.success(`${selectedZoneIndexes.length} zone${selectedZoneIndexes.length > 1 ? 's' : ''} duplicated!`);
                      }}
                      className="w-full justify-start"
                      size="sm"
                    >
                      Duplicate ({selectedZoneIndexes.length})
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setZones(zones.filter((_, idx) => !selectedZoneIndexes.includes(idx)));
                        setSelectedZoneIndexes([]);
                        toast.success(`${selectedZoneIndexes.length} zone${selectedZoneIndexes.length > 1 ? 's' : ''} deleted`);
                      }}
                      className="w-full justify-start"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete ({selectedZoneIndexes.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedZoneIndexes([]);
                        toast.success("Selection cleared");
                      }}
                      className="w-full justify-start"
                      size="sm"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t text-xs text-gray-600">
                <p className="font-semibold mb-1">Instructions:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Click & drag to create new zones</li>
                  <li>Click a zone to select it</li>
                  <li><strong>Ctrl+Click</strong> to select multiple zones</li>
                  <li><strong>Drag green cross</strong> to copy selected zone(s)</li>
                  <li><strong>Draw Walls:</strong> Click & drag to draw perimeter</li>
                  <li>Use buttons to delete/duplicate selected zones</li>
                  <li>Click cells to add doors or fridges</li>
                  <li>Each cell = 2m × 2m</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Canvas */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Design Grid (50×50 cells, each cell = 2m × 2m)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto border-2 border-gray-300 rounded">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="cursor-crosshair"
                  style={{ display: "block" }}
                />
              </div>
              
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-300 border-2 border-blue-600"></div>
                  <span>Zones</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-gray-800"></div>
                  <span>Walls</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 border-2 border-green-600"></div>
                  <span>Doors</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 border-2 border-purple-600"></div>
                  <span>Fridges</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Capacity Dialog */}
      {showCapacityDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Set Zone Capacity</h3>
            <p className="text-sm text-gray-600 mb-4">
              Zone size: {pendingZone?.width} × {pendingZone?.height} cells
              ({pendingZone?.width * 2}m × {pendingZone?.height * 2}m)
            </p>
            <div className="mb-4">
              <Label>Capacity ({storeType === "bulk" ? "tonnes" : "units"})</Label>
              <Input
                type="number"
                value={zoneCapacity}
                onChange={(e) => setZoneCapacity(e.target.value)}
                placeholder={storeType === "bulk" ? "e.g., 175" : "e.g., 6"}
                autoFocus
                onKeyPress={(e) => e.key === "Enter" && handleAddZone()}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddZone} className="flex-1">
                Add Zone
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCapacityDialog(false);
                  setPendingZone(null);
                  setZoneCapacity("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreDesigner;
