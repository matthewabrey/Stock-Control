import { useState } from "react";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Warehouse } from "lucide-react";
import { toast } from "sonner";

const ManualStoreCreator = ({ onStoreCreated }) => {
  const [storeName, setStoreName] = useState("");
  const [boxWidth, setBoxWidth] = useState(2);
  const [boxHeight, setBoxHeight] = useState(2);
  const [numberOfBoxes, setNumberOfBoxes] = useState(180);
  const [creating, setCreating] = useState(false);

  // Calculate optimal grid layout
  const calculateLayout = () => {
    const cols = Math.ceil(Math.sqrt(numberOfBoxes));
    const rows = Math.ceil(numberOfBoxes / cols);
    return { cols, rows, totalBoxes: cols * rows };
  };

  const layout = calculateLayout();
  const shedWidth = layout.cols * boxWidth;
  const shedHeight = layout.rows * boxHeight;

  const handleCreateStore = async () => {
    if (!storeName.trim()) {
      toast.warning("Please enter a store name");
      return;
    }

    if (numberOfBoxes < 1) {
      toast.warning("Number of boxes must be at least 1");
      return;
    }

    setCreating(true);

    try {
      // Create the shed
      const shedRes = await axios.post(`${API}/sheds`, {
        name: storeName.trim(),
        width: shedWidth,
        height: shedHeight,
        description: `${numberOfBoxes} boxes (${boxWidth}m × ${boxHeight}m each)`
      });

      const shedId = shedRes.data.id;

      // Create zones for entire grid
      const zonePromises = [];
      for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.cols; col++) {
          const colLetter = String.fromCharCode(65 + (col % 26));
          zonePromises.push(
            axios.post(`${API}/zones`, {
              shed_id: shedId,
              name: `${colLetter}${row + 1}`,
              x: col * boxWidth,
              y: row * boxHeight,
              width: boxWidth,
              height: boxHeight,
              max_capacity: 6
            })
          );
        }
      }

      await Promise.all(zonePromises);

      toast.success(
        `Store "${storeName}" created with ${numberOfBoxes} boxes arranged in ${layout.cols}×${layout.rows} grid`
      );
      
      setStoreName("");
      setNumberOfBoxes(180);
      
      if (onStoreCreated) {
        onStoreCreated();
      }
    } catch (error) {
      console.error("Error creating store:", error);
      toast.error(error.response?.data?.detail || "Failed to create store");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="w-5 h-5" />
          Quick Store Creator
        </CardTitle>
        <CardDescription>
          Create a new store with a simple grid layout
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="store-name">Store Name</Label>
            <Input
              id="store-name"
              placeholder="e.g., D2, Store A, Warehouse 1"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              data-testid="input-store-name"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="grid-cols">Columns (Width)</Label>
              <Input
                id="grid-cols"
                type="number"
                min="1"
                max="50"
                value={gridCols}
                onChange={(e) => setGridCols(parseInt(e.target.value) || 1)}
                data-testid="input-grid-cols"
              />
              <p className="text-xs text-gray-500 mt-1">A, B, C...</p>
            </div>
            
            <div>
              <Label htmlFor="grid-rows">Rows (Height)</Label>
              <Input
                id="grid-rows"
                type="number"
                min="1"
                max="50"
                value={gridRows}
                onChange={(e) => setGridRows(parseInt(e.target.value) || 1)}
                data-testid="input-grid-rows"
              />
              <p className="text-xs text-gray-500 mt-1">1, 2, 3...</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="text-blue-900">
              <strong>Preview:</strong> {storeName || "Store"} will have {gridCols} columns × {gridRows} rows 
              = <strong>{gridCols * gridRows} storage zones</strong>
            </p>
            <p className="text-blue-700 text-xs mt-1">
              Zones labeled: A1, A2, B1, B2... Each zone holds 6 boxes
            </p>
          </div>

          <Button 
            onClick={handleCreateStore} 
            disabled={creating}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            data-testid="btn-create-store"
          >
            <Plus className="mr-2 w-4 h-4" />
            {creating ? "Creating..." : "Create Store"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManualStoreCreator;
