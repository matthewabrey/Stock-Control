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
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showZoneDetails, setShowZoneDetails] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedZoneIntakes, setSelectedZoneIntakes] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState("");
  const [selectedField, setSelectedField] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [intakeQuantity, setIntakeQuantity] = useState("");
  const [intakeDate, setIntakeDate] = useState(new Date().toISOString().split('T')[0]);
  const [moveQuantity, setMoveQuantity] = useState("");
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetZone, setTargetZone] = useState(null);
  const [moveDestinationType, setMoveDestinationType] = useState(""); // "store", "grader", "customer"
  const [moveDestinationShed, setMoveDestinationShed] = useState("");
  const [moveQuantities, setMoveQuantities] = useState({}); // {zoneId: quantity}
  const [selectedDestinationZones, setSelectedDestinationZones] = useState([]); // zones selected in destination store
  const [sourceZonesForMove, setSourceZonesForMove] = useState([]); // copy of source zones
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
    // If zone has no quantity, it's empty regardless of intake records
    if (!zone.total_quantity || zone.total_quantity === 0) {
      return "#e5e7eb"; // Gray for empty
    }
    
    const zoneIntakes = getZoneIntakes(zone.id);
    if (zoneIntakes.length === 0) return "#e5e7eb"; // Gray for empty
    
    // Group by field to check for mixed stock
    const fieldGroups = {};
    zoneIntakes.forEach(intake => {
      if (!fieldGroups[intake.field_id]) {
        fieldGroups[intake.field_id] = [];
      }
      fieldGroups[intake.field_id].push(intake);
    });
    
    const uniqueFields = Object.keys(fieldGroups);
    
    // If only one field, return solid color
    if (uniqueFields.length === 1) {
      return fieldColorMap[uniqueFields[0]] || "#94a3b8";
    }
    
    // Multiple fields - return "mixed" indicator
    return "mixed";
  };
  
  const getZoneMixedFields = (zone) => {
    const zoneIntakes = getZoneIntakes(zone.id);
    const fieldGroups = {};
    
    zoneIntakes.forEach(intake => {
      if (!fieldGroups[intake.field_id]) {
        fieldGroups[intake.field_id] = {
          fieldId: intake.field_id,
          fieldName: intake.field_name,
          color: fieldColorMap[intake.field_id] || "#94a3b8",
          quantity: 0
        };
      }
      fieldGroups[intake.field_id].quantity += intake.quantity;
    });
    
    return Object.values(fieldGroups);
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

  const handleZoneClick = (zone, event) => {
    // Simple click to toggle selection
    if (selectedZones.find(z => z.id === zone.id)) {
      // Deselect if already selected
      setSelectedZones(selectedZones.filter(z => z.id !== zone.id));
    } else {
      // Add to selection
      setSelectedZones([...selectedZones, zone]);
    }
  };

  const handleAddStock = () => {
    setShowZoneDetails(false);
    setShowIntakeDialog(true);
  };

  const handleBulkAddStock = () => {
    if (selectedZones.length === 0) {
      toast.warning("Please select zones first (click to select multiple)");
      return;
    }
    setShowIntakeDialog(true);
  };

  const handleBulkMoveStock = () => {
    if (selectedZones.length === 0) {
      toast.warning("Please select zones first (click to select multiple)");
      return;
    }
    
    // Initialize move quantities and field selections
    const quantities = {};
    const fieldSelections = {};
    selectedZones.forEach(zone => {
      quantities[zone.id] = zone.total_quantity || 0;
      
      // Check if zone has mixed stock
      const zoneIntakes = getZoneIntakes(zone.id);
      const fieldGroups = {};
      zoneIntakes.forEach(intake => {
        if (!fieldGroups[intake.field_id]) {
          fieldGroups[intake.field_id] = 0;
        }
        fieldGroups[intake.field_id] += intake.quantity;
      });
      
      // If only one field, pre-select it
      const fieldIds = Object.keys(fieldGroups);
      if (fieldIds.length === 1) {
        fieldSelections[zone.id] = fieldIds[0];
      } else {
        fieldSelections[zone.id] = ""; // User needs to select
      }
    });
    
    setMoveQuantities(quantities);
    setMoveFieldSelections(fieldSelections);
    setMoveDestinationType("");
    setMoveDestinationShed("");
    setSourceZonesForMove([...selectedZones]);
    setSelectedDestinationZones([]);
    setShowBulkMoveDialog(true);
  };
  
  const [moveFieldSelections, setMoveFieldSelections] = useState({}); // {zoneId: fieldId}

  const handleBulkMoveSubmit = async () => {
    if (!moveDestinationType) {
      toast.warning("Please select a destination type");
      return;
    }

    // Validate quantities
    const totalToMove = Object.values(moveQuantities).reduce((sum, qty) => sum + parseFloat(qty || 0), 0);
    if (totalToMove === 0) {
      toast.warning("Please enter quantities to move");
      return;
    }
    
    // Validate field selections for mixed zones
    for (const zone of selectedZones) {
      const zoneIntakes = getZoneIntakes(zone.id);
      const fieldGroups = {};
      zoneIntakes.forEach(intake => {
        if (!fieldGroups[intake.field_id]) fieldGroups[intake.field_id] = true;
      });
      
      if (Object.keys(fieldGroups).length > 1 && !moveFieldSelections[zone.id]) {
        toast.warning(`Please select which field to move from ${zone.name}`);
        return;
      }
    }

    try {
      if (moveDestinationType === "grader" || moveDestinationType === "customer") {
        // Remove stock from zones (going out of facility)
        for (const zone of selectedZones) {
          const qtyToMove = parseFloat(moveQuantities[zone.id] || 0);
          if (qtyToMove > 0) {
            // Update zone quantity
            const newQuantity = Math.max(0, zone.total_quantity - qtyToMove);
            await axios.put(`${API}/zones/${zone.id}`, null, {
              params: { quantity: newQuantity }
            });
            
            // If moving from specific field in mixed zone, update intake records
            const selectedFieldId = moveFieldSelections[zone.id];
            if (selectedFieldId) {
              // Reduce intake quantity for this field proportionally
              const zoneIntakes = await axios.get(`${API}/stock-intakes/zone/${zone.id}`);
              const fieldIntakes = zoneIntakes.data.filter(i => i.field_id === selectedFieldId);
              const totalFieldQty = fieldIntakes.reduce((sum, i) => sum + i.quantity, 0);
              const reductionRatio = qtyToMove / totalFieldQty;
              
              for (const intake of fieldIntakes) {
                const newIntakeQty = intake.quantity * (1 - reductionRatio);
                if (newIntakeQty > 0.01) {
                  await axios.put(`${API}/stock-intakes/${intake.id}`, {
                    ...intake,
                    quantity: newIntakeQty
                  });
                } else {
                  // Delete intake if quantity becomes negligible
                  await axios.delete(`${API}/stock-intakes/${intake.id}`);
                }
              }
            }
          }
        }
        
        const destName = moveDestinationType === "grader" ? "Grader" : "Customer";
        toast.success(`Moved stock to ${destName}`);
        setShowBulkMoveDialog(false);
        setSelectedZones([]);
        
        // Force refresh
        await fetchZones();
        await fetchStockIntakes();
        
        setTimeout(() => {
          fetchZones();
          fetchStockIntakes();
        }, 500);
      } else if (moveDestinationType === "store") {
        // Show destination store picker
        if (!moveDestinationShed) {
          toast.warning("Please select a destination store");
          return;
        }
        // Show floor plan for zone selection
        setShowDestinationPicker(true);
      }
    } catch (error) {
      console.error("Error moving stock:", error);
      toast.error("Failed to move stock");
    }
  };

  const handleDestinationZoneClick = (destZone) => {
    // Check if already selected
    if (selectedDestinationZones.find(z => z.id === destZone.id)) {
      // Deselect
      setSelectedDestinationZones(selectedDestinationZones.filter(z => z.id !== destZone.id));
    } else {
      // Add to selection (only if we haven't reached the limit)
      if (selectedDestinationZones.length < sourceZonesForMove.length) {
        setSelectedDestinationZones([...selectedDestinationZones, destZone]);
      } else {
        toast.warning(`You can only select ${sourceZonesForMove.length} destination zones`);
      }
    }
  };

  const handleConfirmMove = async () => {
    if (selectedDestinationZones.length !== sourceZonesForMove.length) {
      toast.warning(`Please select exactly ${sourceZonesForMove.length} destination zones`);
      return;
    }

    try {
      // Move stock from each source zone to corresponding destination zone
      for (let i = 0; i < sourceZonesForMove.length; i++) {
        const sourceZone = sourceZonesForMove[i];
        const destZone = selectedDestinationZones[i];
        const qtyToMove = parseFloat(moveQuantities[sourceZone.id] || 0);
        const selectedFieldId = moveFieldSelections[sourceZone.id];
        
        if (qtyToMove > 0) {
          // Get stock intakes from source zone
          const sourceIntakesRes = await axios.get(`${API}/stock-intakes/zone/${sourceZone.id}`);
          const sourceIntakes = sourceIntakesRes.data;
          
          // If moving from specific field in mixed zone
          if (selectedFieldId) {
            // Only move the selected field
            const fieldIntakes = sourceIntakes.filter(i => i.field_id === selectedFieldId);
            const totalFieldIntakeQty = fieldIntakes.reduce((sum, i) => sum + i.quantity, 0);
            const reductionRatio = qtyToMove / totalFieldIntakeQty;
            
            // Update source zone quantity
            await axios.put(`${API}/zones/${sourceZone.id}`, null, {
              params: { quantity: Math.max(0, sourceZone.total_quantity - qtyToMove) }
            });
            
            // Reduce or delete field intakes from source
            for (const intake of fieldIntakes) {
              const newIntakeQty = intake.quantity * (1 - reductionRatio);
              if (newIntakeQty < 0.01) {
                // Delete intake if quantity becomes negligible
                await axios.delete(`${API}/stock-intakes/${intake.id}`);
              } else {
                // Update intake quantity
                await axios.put(`${API}/stock-intakes/${intake.id}`, {
                  ...intake,
                  quantity: newIntakeQty
                });
              }
            }
            
            // Get fresh destination zone data to avoid stale quantity
            const freshDestZoneRes = await axios.get(`${API}/zones?shed_id=${moveDestinationShed}`);
            const freshDestZone = freshDestZoneRes.data.find(z => z.id === destZone.id);
            const currentDestQty = freshDestZone ? freshDestZone.total_quantity : destZone.total_quantity;
            
            // Add to destination zone
            await axios.put(`${API}/zones/${destZone.id}`, null, {
              params: { quantity: currentDestQty + qtyToMove }
            });
            
            // Create or update intake record for destination
            if (fieldIntakes.length > 0) {
              const template = fieldIntakes[0];
              
              // Check if destination already has this field
              const destIntakesRes = await axios.get(`${API}/stock-intakes/zone/${destZone.id}`);
              const existingIntake = destIntakesRes.data.find(i => 
                i.field_id === template.field_id && i.grade === template.grade
              );
              
              if (existingIntake) {
                // Update existing intake
                await axios.put(`${API}/stock-intakes/${existingIntake.id}`, {
                  ...existingIntake,
                  quantity: existingIntake.quantity + qtyToMove
                });
              } else {
                // Create new intake
                await axios.post(`${API}/stock-intakes`, {
                  field_id: template.field_id,
                  field_name: template.field_name,
                  zone_id: destZone.id,
                  shed_id: moveDestinationShed,
                  quantity: qtyToMove,
                  date: new Date().toISOString().split('T')[0],
                  grade: template.grade
                });
              }
            }
          } else {
            // Moving all stock from zone (not field-specific)
            const totalSourceQty = sourceIntakes.reduce((sum, i) => sum + i.quantity, 0);
            const moveRatio = qtyToMove / totalSourceQty;
            
            // Update source zone quantity
            await axios.put(`${API}/zones/${sourceZone.id}`, null, {
              params: { quantity: Math.max(0, sourceZone.total_quantity - qtyToMove) }
            });
            
            // Reduce or delete source intakes
            for (const intake of sourceIntakes) {
              const newIntakeQty = intake.quantity * (1 - moveRatio);
              if (newIntakeQty < 0.01) {
                await axios.delete(`${API}/stock-intakes/${intake.id}`);
              } else {
                await axios.put(`${API}/stock-intakes/${intake.id}`, {
                  ...intake,
                  quantity: newIntakeQty
                });
              }
            }
            
            // Add to destination zone
            await axios.put(`${API}/zones/${destZone.id}`, null, {
              params: { quantity: destZone.total_quantity + qtyToMove }
            });

            // Group by field
            const intakesByField = {};
            sourceIntakes.forEach(intake => {
              if (!intakesByField[intake.field_id]) {
                intakesByField[intake.field_id] = [];
              }
              intakesByField[intake.field_id].push(intake);
            });

            // Create or update intake records for destination for each field
            // Get existing intakes in destination
            const destIntakesRes = await axios.get(`${API}/stock-intakes/zone/${destZone.id}`);
            const destIntakes = destIntakesRes.data;
            
            if (sourceIntakes.length === 1) {
              // Single field - use full quantity
              const template = sourceIntakes[0];
              const existingIntake = destIntakes.find(i => 
                i.field_id === template.field_id && i.grade === template.grade
              );
              
              if (existingIntake) {
                // Update existing intake
                await axios.put(`${API}/stock-intakes/${existingIntake.id}`, {
                  ...existingIntake,
                  quantity: existingIntake.quantity + qtyToMove
                });
              } else {
                // Create new intake
                await axios.post(`${API}/stock-intakes`, {
                  field_id: template.field_id,
                  field_name: template.field_name,
                  zone_id: destZone.id,
                  shed_id: moveDestinationShed,
                  quantity: qtyToMove,
                  date: new Date().toISOString().split('T')[0],
                  grade: template.grade
                });
              }
            } else {
              // Multiple fields - distribute proportionally based on CURRENT zone proportions
              for (const fieldId in intakesByField) {
                const fieldIntakes = intakesByField[fieldId];
                const fieldTotalQty = fieldIntakes.reduce((sum, i) => sum + i.quantity, 0);
                const proportion = fieldTotalQty / totalSourceQty;
                const qtyToMoveForField = qtyToMove * proportion;
                
                const latestIntake = fieldIntakes.sort((a, b) => 
                  new Date(b.created_at) - new Date(a.created_at)
                )[0];
                
                const existingIntake = destIntakes.find(i => 
                  i.field_id === latestIntake.field_id && i.grade === latestIntake.grade
                );
                
                if (existingIntake) {
                  // Update existing intake
                  await axios.put(`${API}/stock-intakes/${existingIntake.id}`, {
                    ...existingIntake,
                    quantity: existingIntake.quantity + qtyToMoveForField
                  });
                } else {
                  // Create new intake
                  await axios.post(`${API}/stock-intakes`, {
                    field_id: latestIntake.field_id,
                    field_name: latestIntake.field_name,
                    zone_id: destZone.id,
                    shed_id: moveDestinationShed,
                    quantity: qtyToMoveForField,
                    date: new Date().toISOString().split('T')[0],
                    grade: latestIntake.grade
                  });
                }
              }
            }
          }
        }
      }
      
      const destShed = sheds.find(s => s.id === moveDestinationShed);
      toast.success(`Moved stock to ${destShed?.name || 'store'}`);
      setShowDestinationPicker(false);
      setShowBulkMoveDialog(false);
      setSelectedZones([]);
      setSelectedDestinationZones([]);
      
      // Force refresh of zones and stock intakes
      await fetchZones();
      await fetchStockIntakes();
      
      // Small delay to ensure UI updates
      setTimeout(() => {
        fetchZones();
        fetchStockIntakes();
      }, 500);
    } catch (error) {
      console.error("Error moving stock:", error);
      toast.error("Failed to move stock");
    }
  };

  const handleStockIntake = async () => {
    if (!selectedField || !intakeQuantity || !selectedGrade) {
      toast.warning("Please fill all required fields including grade");
      return;
    }

    const qty = parseFloat(intakeQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.warning("Please enter a valid quantity");
      return;
    }

    const field = fields.find(f => f.id === selectedField);
    if (!field) return;

    // If multiple zones selected, add to all
    const zonesToUpdate = selectedZones.length > 0 ? selectedZones : [selectedZone];

    // Check available capacity
    const totalAvailable = zonesToUpdate.reduce((sum, z) => {
      const available = (z.max_capacity || 6) - (z.total_quantity || 0);
      return sum + Math.max(0, available);
    }, 0);

    if (qty > totalAvailable) {
      toast.error(`Quantity exceeds available capacity. Max available: ${totalAvailable} units`);
      return;
    }

    try {
      
      // Distribute quantity across selected zones
      const qtyPerZone = qty / zonesToUpdate.length;
      
      for (const zone of zonesToUpdate) {
        await axios.post(`${API}/stock-intakes`, {
          field_id: field.id,
          field_name: field.name,
          zone_id: zone.id,
          shed_id: shedId,
          quantity: qtyPerZone,
          date: intakeDate,
          grade: selectedGrade
        });
      }
      
      toast.success(`Stock added to ${zonesToUpdate.length} zone(s) from ${field.name} (${selectedGrade})`);
      setShowIntakeDialog(false);
      setSelectedCrop("");
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

  // Get the range of columns and rows (including gaps)
  const activeColumns = [...new Set(zones.map(z => Math.floor(z.x / 2)))].sort((a, b) => a - b);
  const activeRows = [...new Set(zones.map(z => Math.floor(z.y / 2)))].sort((a, b) => a - b);
  
  // Calculate full range (min to max, including empty spaces)
  const minCol = activeColumns.length > 0 ? Math.min(...activeColumns) : 0;
  const maxCol = activeColumns.length > 0 ? Math.max(...activeColumns) : 0;
  const minRow = activeRows.length > 0 ? Math.min(...activeRows) : 0;
  const maxRow = activeRows.length > 0 ? Math.max(...activeRows) : 0;
  
  // Create array of all columns/rows in range (preserving gaps)
  const allColumns = Array.from({ length: maxCol - minCol + 1 }, (_, i) => minCol + i);
  const allRows = Array.from({ length: maxRow - minRow + 1 }, (_, i) => minRow + i);

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
              <>
                <div className="text-sm text-gray-700 bg-blue-50 px-4 py-2 rounded-md border border-blue-200">
                  {selectedZones.length} zone{selectedZones.length > 1 ? 's' : ''} selected
                </div>
                <Button 
                  onClick={handleBulkAddStock} 
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="btn-bulk-add-stock"
                >
                  <Package className="mr-2 w-4 h-4" />
                  Add Stock
                </Button>
                <Button 
                  onClick={handleBulkMoveStock} 
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="btn-bulk-move-stock"
                >
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Move Stock
                </Button>
              </>
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
            <strong>How to use:</strong> Click zones to select/deselect them. Use "Add Stock" or "Move Stock" buttons for selected zones. Drag zones to move stock.
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
                    {/* Grid with labels */}
                    <div className="flex flex-col">
                      {/* Main grid area */}
                      <div className="flex">
                        {/* Grid canvas */}
                        <div 
                          className="relative bg-white border-4 border-gray-400 rounded-lg"
                          style={{ 
                            width: `${shed.width * scale + shedPadding * 2}px`, 
                            height: `${shed.height * scale + shedPadding * 2}px`,
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
                            width: `${shed.width * scale}px`,
                            height: `${shed.height * scale}px`,
                            backgroundImage: 'linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px)',
                            backgroundSize: `${gridCellSize}px ${gridCellSize}px`
                          }}
                        ></div>

                        {/* Zones */}
                        {zones.map((zone) => {
                          const zoneColor = getZoneColor(zone);
                          const isEmpty = zone.total_quantity === 0;
                          const isSelected = selectedZones.some(z => z.id === zone.id);
                          const isMixed = zoneColor === "mixed";
                          const mixedFields = isMixed ? getZoneMixedFields(zone) : [];
                          
                          const actualCol = Math.floor(zone.x / 2);
                          const actualRow = Math.floor(zone.y / 2);
                          const displayCol = actualCol - minCol;
                          const displayRow = actualRow - minRow;
                          
                          // Calculate display dimensions based on actual zone size
                          const zoneWidthCells = zone.width / 2;
                          const zoneHeightCells = zone.height / 2;
                          
                          return (
                            <div
                              key={zone.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, zone)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, zone)}
                              onClick={(e) => handleZoneClick(zone, e)}
                              className={`absolute cursor-pointer hover:shadow-2xl hover:z-10 transition-all rounded ${
                                isSelected ? 'border-4 border-blue-600 z-10' : 'border-2 border-gray-700'
                              }`}
                              style={{
                                left: `${shedPadding + displayCol * gridCellSize + boxPadding}px`,
                                top: `${shedPadding + displayRow * gridCellSize + boxPadding}px`,
                                width: `${zoneWidthCells * gridCellSize - boxPadding * 2}px`,
                                height: `${zoneHeightCells * gridCellSize - boxPadding * 2}px`,
                                backgroundColor: isMixed ? 'transparent' : zoneColor,
                                opacity: isEmpty ? 0.5 : 1,
                                boxShadow: isSelected ? '0 0 0 2px #fff, 0 0 0 6px #2563eb' : '0 2px 4px rgba(0,0,0,0.1)',
                                overflow: 'hidden'
                              }}
                              data-testid={`zone-${zone.id}`}
                            >
                              {/* Mixed stock - show split colors */}
                              {isMixed && mixedFields.length > 0 && (
                                <div className="w-full h-full flex">
                                  {mixedFields.map((field, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        flex: 1,
                                        backgroundColor: field.color,
                                        borderRight: idx < mixedFields.length - 1 ? '2px solid white' : 'none'
                                      }}
                                      title={`${field.fieldName}: ${field.quantity.toFixed(0)} units`}
                                    />
                                  ))}
                                </div>
                              )}
                              
                              {/* Mixed stock indicator */}
                              {isMixed && (
                                <div className="absolute top-1 left-1 bg-white px-1 rounded text-xs font-bold text-gray-800 border border-gray-400">
                                  MIX
                                </div>
                              )}
                              
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white"></div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                        
                        {/* Row numbers on RIGHT side */}
                        <div className="flex items-start ml-2" style={{ paddingTop: `${shedPadding}px` }}>
                          <div className="flex flex-col">
                            {allRows.map((row, i) => (
                              <div 
                                key={row}
                                className="flex items-center justify-center font-bold text-sm text-gray-700 flex-shrink-0"
                                style={{ height: `${gridCellSize}px` }}
                              >
                                {row + 1}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Column headers on BOTTOM */}
                      <div className="flex mt-2" style={{ paddingLeft: `${shedPadding}px` }}>
                        {allColumns.map((col, i) => (
                          <div 
                            key={col} 
                            className="text-center font-bold text-sm text-gray-700 flex-shrink-0"
                            style={{ width: `${gridCellSize}px` }}
                          >
                            {getColumnLetter(col)}
                          </div>
                        ))}
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
                            
                            // Get zones with this field that have stock
                            const fieldZonesData = zones.filter(zone => {
                              if (!zone.total_quantity || zone.total_quantity === 0) return false;
                              const zoneIntakes = getZoneIntakes(zone.id);
                              return zoneIntakes.some(intake => intake.field_id === field.id);
                            });
                            
                            // Calculate actual total considering mixed zones
                            let totalQty = 0;
                            fieldZonesData.forEach(zone => {
                              const zoneIntakes = getZoneIntakes(zone.id);
                              const totalIntakeQty = zoneIntakes.reduce((sum, i) => sum + i.quantity, 0);
                              const fieldIntakesInZone = zoneIntakes.filter(i => i.field_id === field.id);
                              const fieldIntakeQty = fieldIntakesInZone.reduce((sum, i) => sum + i.quantity, 0);
                              
                              if (totalIntakeQty > 0) {
                                // Calculate this field's proportional share of zone's actual quantity
                                const proportion = fieldIntakeQty / totalIntakeQty;
                                totalQty += zone.total_quantity * proportion;
                              }
                            });
                            
                            const fieldZones = fieldZonesData.map(zone => {
                              const col = Math.floor(zone.x / 2);
                              const row = Math.floor(zone.y / 2);
                              return `${getColumnLetter(col)}${row + 1}`;
                            });
                            
                            const latestDate = fieldIntakes.length > 0 ? 
                              new Date(Math.max(...fieldIntakes.map(i => new Date(i.date)))).toLocaleDateString() : '';
                            
                            // Only show field if it has stock in zones
                            if (fieldZones.length === 0 || totalQty === 0) return null;
                            
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
                  <h3 className="font-semibold mb-3">Stock Breakdown</h3>
                  <div className="space-y-3">
                    {(() => {
                      // Group by field
                      const fieldGroups = {};
                      selectedZoneIntakes.forEach(intake => {
                        if (!fieldGroups[intake.field_id]) {
                          const field = fields.find(f => f.id === intake.field_id);
                          fieldGroups[intake.field_id] = {
                            fieldId: intake.field_id,
                            fieldName: intake.field_name,
                            variety: field?.variety,
                            cropType: field?.crop_type,
                            color: fieldColorMap[intake.field_id],
                            grades: {}
                          };
                        }
                        if (!fieldGroups[intake.field_id].grades[intake.grade]) {
                          fieldGroups[intake.field_id].grades[intake.grade] = 0;
                        }
                        fieldGroups[intake.field_id].grades[intake.grade] += intake.quantity;
                      });
                      
                      return Object.values(fieldGroups).map((group, idx) => {
                        const totalQty = Object.values(group.grades).reduce((sum, q) => sum + q, 0);
                        return (
                          <div key={idx} className="p-4 bg-gray-50 rounded-lg border-l-4" style={{ borderColor: group.color }}>
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-gray-900">{group.fieldName}</p>
                                <p className="text-xs text-gray-600">{group.variety} - {group.cropType}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">{totalQty.toFixed(0)}</p>
                                <p className="text-xs text-gray-600">units</p>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-1">GRADES:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(group.grades).map(([grade, qty]) => (
                                  <span key={grade} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                                    {grade}: <span className="font-semibold">{qty.toFixed(0)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => {
                    setShowZoneDetails(false);
                    if (!selectedZones.find(z => z.id === selectedZone.id)) {
                      setSelectedZones([...selectedZones, selectedZone]);
                    }
                  }} 
                  variant="outline"
                  className="w-full"
                >
                  Select Zone
                </Button>
                <Button 
                  onClick={() => {
                    if (!selectedZones.find(z => z.id === selectedZone.id)) {
                      setSelectedZones([selectedZone]);
                    }
                    setShowZoneDetails(false);
                    setShowIntakeDialog(true);
                  }} 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  data-testid="btn-add-stock-from-details"
                >
                  <Plus className="mr-2 w-4 h-4" />
                  Add Stock
                </Button>
              </div>
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
                <Label htmlFor="crop">Select Crop Type</Label>
                <Select value={selectedCrop} onValueChange={(value) => { setSelectedCrop(value); setSelectedField(""); setSelectedGrade(""); }}>
                  <SelectTrigger id="crop" data-testid="select-crop">
                    <SelectValue placeholder="Choose a crop type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(fields.map(f => f.crop_type))].sort().map((cropType) => (
                      <SelectItem key={cropType} value={cropType} data-testid={`crop-option-${cropType}`}>
                        {cropType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedCrop && (
                <div>
                  <Label htmlFor="field">Select Field</Label>
                  <Select value={selectedField} onValueChange={(value) => { setSelectedField(value); setSelectedGrade(""); }}>
                    <SelectTrigger id="field" data-testid="select-field">
                      <SelectValue placeholder="Choose a field" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.filter(f => f.crop_type === selectedCrop).map((field) => (
                        <SelectItem key={field.id} value={field.id} data-testid={`field-option-${field.id}`}>
                          <div className="flex flex-col">
                            <span className="font-semibold">{field.name}</span>
                            <span className="text-xs text-gray-600">
                              {field.variety} - {field.area}
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
              )}
              
              {selectedField && fields.find(f => f.id === selectedField)?.available_grades?.length > 0 && (
                <div>
                  <Label htmlFor="grade">Select Grade *</Label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger id="grade" data-testid="select-grade">
                      <SelectValue placeholder="Choose a grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.find(f => f.id === selectedField).available_grades.map((grade) => (
                        <SelectItem key={grade} value={grade} data-testid={`grade-option-${grade}`}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                {(() => {
                  // Calculate total available capacity across selected zones
                  const totalCapacity = selectedZones.reduce((sum, z) => {
                    const available = (z.max_capacity || 6) - (z.total_quantity || 0);
                    return sum + Math.max(0, available);
                  }, 0);
                  
                  return (
                    <>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="Enter quantity"
                        min="1"
                        max={totalCapacity}
                        value={intakeQuantity}
                        onChange={(e) => setIntakeQuantity(e.target.value)}
                        data-testid="input-intake-quantity"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Available capacity: {totalCapacity} units across {selectedZones.length} zone{selectedZones.length > 1 ? 's' : ''}
                      </p>
                    </>
                  );
                })()}
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

        {/* Bulk Move Dialog */}
        <Dialog open={showBulkMoveDialog} onOpenChange={setShowBulkMoveDialog}>
          <DialogContent className="max-w-2xl" data-testid="dialog-bulk-move">
            <DialogHeader>
              <DialogTitle>Move Stock from {selectedZones.length} Zones</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Show selected zones with quantity inputs */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedZones.map((zone) => {
                  // Check if zone has mixed stock
                  const zoneIntakes = getZoneIntakes(zone.id);
                  const fieldGroups = {};
                  zoneIntakes.forEach(intake => {
                    if (!fieldGroups[intake.field_id]) {
                      fieldGroups[intake.field_id] = {
                        fieldId: intake.field_id,
                        fieldName: intake.field_name,
                        quantity: 0
                      };
                    }
                    fieldGroups[intake.field_id].quantity += intake.quantity;
                  });
                  
                  const fields = Object.values(fieldGroups);
                  const isMixed = fields.length > 1;
                  const selectedFieldId = moveFieldSelections[zone.id];
                  const maxQty = selectedFieldId && fieldGroups[selectedFieldId] 
                    ? fieldGroups[selectedFieldId].quantity 
                    : zone.total_quantity;
                  
                  return (
                    <div key={zone.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{zone.name}</p>
                            {isMixed && (
                              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                                MIX
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">Total: {zone.total_quantity?.toFixed(0) || 0} units</p>
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            placeholder="Qty"
                            min="0"
                            max={maxQty}
                            value={moveQuantities[zone.id] || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setMoveQuantities({
                                ...moveQuantities,
                                [zone.id]: Math.min(val, maxQty)
                              });
                            }}
                          />
                          <p className="text-xs text-gray-500 mt-0.5">Max: {maxQty?.toFixed(0) || 0}</p>
                        </div>
                      </div>
                      
                      {/* Field selector for mixed zones */}
                      {isMixed && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <Label className="text-xs text-gray-600">Move from which field?</Label>
                          <Select 
                            value={moveFieldSelections[zone.id] || ""} 
                            onValueChange={(value) => {
                              setMoveFieldSelections({
                                ...moveFieldSelections,
                                [zone.id]: value
                              });
                              // Update max quantity based on selected field
                              const fieldQty = fieldGroups[value]?.quantity || 0;
                              if (moveQuantities[zone.id] > fieldQty) {
                                setMoveQuantities({
                                  ...moveQuantities,
                                  [zone.id]: fieldQty
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              {fields.map((field) => (
                                <SelectItem key={field.fieldId} value={field.fieldId}>
                                  {field.fieldName} ({field.quantity.toFixed(0)} units)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Destination selection */}
              <div>
                <Label>Move To:</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Button
                    variant={moveDestinationType === "store" ? "default" : "outline"}
                    onClick={() => setMoveDestinationType("store")}
                    className="w-full"
                  >
                    Store
                  </Button>
                  <Button
                    variant={moveDestinationType === "grader" ? "default" : "outline"}
                    onClick={() => setMoveDestinationType("grader")}
                    className="w-full"
                  >
                    Grader
                  </Button>
                  <Button
                    variant={moveDestinationType === "customer" ? "default" : "outline"}
                    onClick={() => setMoveDestinationType("customer")}
                    className="w-full"
                  >
                    Customer
                  </Button>
                </div>
              </div>

              {/* Store selector if "store" is selected */}
              {moveDestinationType === "store" && (
                <div>
                  <Label htmlFor="dest-shed">Select Destination Store</Label>
                  <Select value={moveDestinationShed} onValueChange={setMoveDestinationShed}>
                    <SelectTrigger id="dest-shed">
                      <SelectValue placeholder="Choose a store" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheds.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handleBulkMoveSubmit} className="w-full">
                {moveDestinationType === "store" ? "Select Destination Zone" : "Confirm Move"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Destination Zone Picker Dialog */}
        <Dialog open={showDestinationPicker} onOpenChange={setShowDestinationPicker}>
          <DialogContent className="max-w-6xl max-h-[90vh]" data-testid="dialog-destination-picker">
            <DialogHeader>
              <DialogTitle>Select Destination Zones</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900">
                  Select {sourceZonesForMove.length} destination zones ({selectedDestinationZones.length} selected)
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Click on zones in the order you want stock moved. Click again to deselect.
                </p>
              </div>

              <div className="overflow-auto max-h-[60vh]">
                {moveDestinationShed && (() => {
                  const destShed = sheds.find(s => s.id === moveDestinationShed);
                  if (!destShed) return null;
                  
                  return (
                    <DestinationFloorPlan 
                      shed={destShed} 
                      onZoneClick={handleDestinationZoneClick}
                      selectedZones={selectedDestinationZones}
                    />
                  );
                })()}
              </div>

              <Button 
                onClick={handleConfirmMove} 
                className="w-full"
                disabled={selectedDestinationZones.length !== sourceZonesForMove.length}
              >
                Confirm Move ({selectedDestinationZones.length}/{sourceZonesForMove.length} zones selected)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

// Component to show destination floor plan for zone selection
const DestinationFloorPlan = ({ shed, onZoneClick, selectedZones = [] }) => {
  const [zones, setZones] = useState([]);
  
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await axios.get(`${API}/zones?shed_id=${shed.id}`);
        setZones(response.data);
      } catch (error) {
        console.error("Error fetching zones:", error);
      }
    };
    fetchZones();
  }, [shed.id]);

  const scale = 15;
  const gridCellSize = scale * 2;
  const boxPadding = 3;
  const shedPadding = 30;

  const activeColumns = [...new Set(zones.map(z => Math.floor(z.x / 2)))].sort((a, b) => a - b);
  const activeRows = [...new Set(zones.map(z => Math.floor(z.y / 2)))].sort((a, b) => a - b);
  
  const minCol = activeColumns.length > 0 ? Math.min(...activeColumns) : 0;
  const maxCol = activeColumns.length > 0 ? Math.max(...activeColumns) : 0;
  const minRow = activeRows.length > 0 ? Math.min(...activeRows) : 0;
  const maxRow = activeRows.length > 0 ? Math.max(...activeRows) : 0;

  return (
    <div className="inline-block">
      <h3 className="text-lg font-semibold mb-2">{shed.name}</h3>
      <div 
        className="relative bg-white border-4 border-gray-400 rounded-lg"
        style={{ 
          width: `${shed.width * scale + shedPadding * 2}px`, 
          height: `${shed.height * scale + shedPadding * 2}px`,
          padding: `${shedPadding}px`
        }}
      >
        {/* Grid lines */}
        <div 
          className="absolute"
          style={{
            left: `${shedPadding}px`,
            top: `${shedPadding}px`,
            width: `${shed.width * scale}px`,
            height: `${shed.height * scale}px`,
            backgroundImage: 'linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px)',
            backgroundSize: `${gridCellSize}px ${gridCellSize}px`
          }}
        ></div>

        {/* Zones */}
        {zones.map((zone) => {
          const actualCol = Math.floor(zone.x / 2);
          const actualRow = Math.floor(zone.y / 2);
          const displayCol = actualCol - minCol;
          const displayRow = actualRow - minRow;
          
          const zoneWidthCells = zone.width / 2;
          const zoneHeightCells = zone.height / 2;
          const isEmpty = zone.total_quantity === 0;
          const isSelected = selectedZones.find(z => z.id === zone.id);
          const selectionIndex = selectedZones.findIndex(z => z.id === zone.id);
          
          return (
            <div
              key={zone.id}
              onClick={() => onZoneClick(zone)}
              className={`absolute cursor-pointer hover:shadow-2xl hover:z-10 transition-all rounded ${
                isSelected ? 'border-4 border-blue-600 z-10' : 'border-2 border-gray-700 hover:border-blue-500'
              }`}
              style={{
                left: `${shedPadding + displayCol * gridCellSize + boxPadding}px`,
                top: `${shedPadding + displayRow * gridCellSize + boxPadding}px`,
                width: `${zoneWidthCells * gridCellSize - boxPadding * 2}px`,
                height: `${zoneHeightCells * gridCellSize - boxPadding * 2}px`,
                backgroundColor: isSelected ? '#3b82f6' : (isEmpty ? '#e5e7eb' : '#94a3b8'),
                opacity: isEmpty && !isSelected ? 0.5 : 1
              }}
            >
              <div className="text-xs text-center font-bold text-white pt-1">
                {zone.name}
                {isSelected && <span className="ml-1">#{selectionIndex + 1}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FloorPlan;