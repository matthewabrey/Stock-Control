import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const FieldsManager = () => {
  const navigate = useNavigate();
  const [fields, setFields] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newField, setNewField] = useState({
    name: "",
    area: "",
    crop_type: "",
    grade: ""
  });

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      const response = await axios.get(`${API}/fields`);
      setFields(response.data);
    } catch (error) {
      console.error("Error fetching fields:", error);
      toast.error("Failed to load fields");
    }
  };

  const handleCreateField = async () => {
    if (!newField.name || !newField.area || !newField.crop_type) {
      toast.warning("Please fill all fields");
      return;
    }

    try {
      await axios.post(`${API}/fields`, newField);
      toast.success("Field created successfully");
      setIsDialogOpen(false);
      setNewField({ name: "", area: "", crop_type: "", grade: "" });
      fetchFields();
    } catch (error) {
      console.error("Error creating field:", error);
      toast.error("Failed to create field");
    }
  };

  const handleDeleteField = async (fieldId) => {
    try {
      await axios.delete(`${API}/fields/${fieldId}`);
      toast.success("Field deleted successfully");
      fetchFields();
    } catch (error) {
      console.error("Error deleting field:", error);
      toast.error("Failed to delete field");
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
              Fields Management
            </h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-add-field">
                <Plus className="mr-2 w-4 h-4" />
                Add Field
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-field">
              <DialogHeader>
                <DialogTitle>Add New Field</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Field Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Euston"
                    value={newField.name}
                    onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                    data-testid="input-field-name"
                  />
                </div>
                <div>
                  <Label htmlFor="area">Area Description</Label>
                  <Input
                    id="area"
                    placeholder="e.g., 36 Acres Maincrop Potato"
                    value={newField.area}
                    onChange={(e) => setNewField({ ...newField, area: e.target.value })}
                    data-testid="input-field-area"
                  />
                </div>
                <div>
                  <Label htmlFor="crop_type">Crop Type / Variety</Label>
                  <Input
                    id="crop_type"
                    placeholder="e.g., Marfona"
                    value={newField.crop_type}
                    onChange={(e) => setNewField({ ...newField, crop_type: e.target.value })}
                    data-testid="input-field-crop-type"
                  />
                </div>
                <div>
                  <Label htmlFor="grade">Grade (Optional)</Label>
                  <Input
                    id="grade"
                    placeholder="e.g., Grade A, Premium"
                    value={newField.grade}
                    onChange={(e) => setNewField({ ...newField, grade: e.target.value })}
                    data-testid="input-field-grade"
                  />
                </div>
                <Button onClick={handleCreateField} className="w-full" data-testid="btn-submit-field">
                  Create Field
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fields.map((field) => (
            <Card key={field.id} className="hover:shadow-lg transition-shadow" data-testid={`field-card-${field.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{field.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteField(field.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    data-testid={`btn-delete-field-${field.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Area:</span> {field.area}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Crop:</span> {field.crop_type}
                  </p>
                  {field.grade && (
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Grade:</span> {field.grade}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {fields.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No fields created yet. Add your first field to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldsManager;