import { useState } from "react";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

const ExcelUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error("Please select an Excel file (.xlsx or .xls)");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.warning("Please select a file first");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/upload-store-plans`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast.success(
        `Upload successful! Created ${response.data.stores_created} stores with ${response.data.zones_created} zones`
      );
      setFile(null);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Upload Store Plans from Excel
        </CardTitle>
        <CardDescription>
          Upload your Store Plans sheet to automatically create sheds and storage zones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="flex-1"
              data-testid="input-excel-file"
            />
            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="btn-upload-excel"
            >
              <Upload className="mr-2 w-4 h-4" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
          {file && (
            <div className="text-sm text-gray-600" data-testid="selected-file-name">
              Selected: {file.name}
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <p className="font-semibold text-blue-900 mb-2">Excel Format Requirements:</p>
            <ul className="list-disc list-inside text-blue-800 space-y-1">
              <li>Sheet name must be "Store Plans"</li>
              <li>Store names in Row 3 (surrounded by green borders)</li>
              <li>Cells with "6" indicate storage zones with 6-box capacity</li>
              <li>"Line" column (if present) adds line numbers to zones</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExcelUpload;