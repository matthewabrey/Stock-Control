import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse, ArrowLeft, Package, Printer } from "lucide-react";
import { toast } from "sonner";

const Overview = () => {
  const navigate = useNavigate();
  const [sheds, setSheds] = useState([]);
  const [zones, setZones] = useState([]);
  const [stockIntakes, setStockIntakes] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Always fetch ALL fields for overview (to show harvest year badges for all stock)
      // The year filter only affects which fields can be selected when adding NEW stock
      const [shedsRes, zonesRes, intakesRes, fieldsRes] = await Promise.all([
        axios.get(`${API}/sheds`),
        axios.get(`${API}/zones`),
        axios.get(`${API}/stock-intakes`),
        axios.get(`${API}/fields`) // Always get all fields
      ]);

      setSheds(shedsRes.data);
      setZones(zonesRes.data);
      setStockIntakes(intakesRes.data);
      setFields(fieldsRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load overview data");
      setLoading(false);
    }
  };

  const getShedStockDetails = (shedId) => {
    const shedZones = zones.filter(z => z.shed_id === shedId && z.total_quantity > 0);
    const shedIntakes = stockIntakes.filter(i => i.shed_id === shedId);
    
    // Group by field, calculating actual quantities from zones
    const fieldGroups = {};
    
    // Process each zone
    shedZones.forEach(zone => {
      const zoneIntakes = shedIntakes.filter(i => i.zone_id === zone.id);
      
      // Calculate total intake quantity for this zone to determine proportions
      const totalIntakeQty = zoneIntakes.reduce((sum, i) => sum + i.quantity, 0);
      
      if (totalIntakeQty === 0) return;
      
      // Distribute zone's actual quantity proportionally based on intake records
      zoneIntakes.forEach(intake => {
        const field = fields.find(f => f.id === intake.field_id);
        
        if (!fieldGroups[intake.field_id]) {
          fieldGroups[intake.field_id] = {
            fieldId: intake.field_id,
            fieldName: intake.field_name,
            cropType: field?.crop_type || 'Unknown',
            harvestYear: field?.harvest_year || '2025',
            grades: {},
            totalQuantity: 0
          };
        }
        
        // Calculate this field's share of the zone's actual quantity
        const proportion = intake.quantity / totalIntakeQty;
        const actualQtyForField = zone.total_quantity * proportion;
        
        if (!fieldGroups[intake.field_id].grades[intake.grade]) {
          fieldGroups[intake.field_id].grades[intake.grade] = 0;
        }
        
        fieldGroups[intake.field_id].grades[intake.grade] += actualQtyForField;
        fieldGroups[intake.field_id].totalQuantity += actualQtyForField;
      });
    });
    
    // Filter out fields with 0 quantity
    return Object.values(fieldGroups).filter(fg => fg.totalQuantity > 0);
  };

  const getOnionSummary = () => {
    // Calculate onion summary by variety and grade
    const onionSummary = {
      red: {},
      brown: {}
    };

    // Process all zones with stock
    zones.filter(z => z.total_quantity > 0).forEach(zone => {
      const zoneIntakes = stockIntakes.filter(i => i.zone_id === zone.id);
      
      // Calculate total intake quantity for this zone
      const totalIntakeQty = zoneIntakes.reduce((sum, i) => sum + i.quantity, 0);
      if (totalIntakeQty === 0) return;
      
      // Process each intake in the zone
      zoneIntakes.forEach(intake => {
        const field = fields.find(f => f.id === intake.field_id);
        if (!field) return;
        
        // Check if it's an onion crop
        const cropTypeLower = field.crop_type.toLowerCase();
        const varietyLower = field.variety ? field.variety.toLowerCase() : '';
        
        if (cropTypeLower.includes('onion')) {
          // Calculate this intake's share of the zone's actual quantity
          const proportion = intake.quantity / totalIntakeQty;
          const actualQty = zone.total_quantity * proportion;
          
          // Determine if it's red or brown onion
          let onionType = null;
          if (varietyLower.includes('red seed') || varietyLower.includes('red') || cropTypeLower.includes('red')) {
            onionType = 'red';
          } else if (varietyLower.includes('brown seed') || varietyLower.includes('brown') || cropTypeLower.includes('brown')) {
            onionType = 'brown';
          }
          
          // Add to summary
          if (onionType) {
            if (!onionSummary[onionType][intake.grade]) {
              onionSummary[onionType][intake.grade] = 0;
            }
            onionSummary[onionType][intake.grade] += actualQty;
          }
        }
      });
    });

    return onionSummary;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading overview...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          /* Hide UI elements */
          .no-print {
            display: none !important;
          }
          
          /* Show print-only elements */
          .print-only {
            display: block !important;
          }
          
          /* Reset page margins */
          @page {
            margin: 1cm;
            size: A4 portrait;
          }
          
          /* Each shed on new page */
          .print-page-break {
            page-break-after: always;
            page-break-inside: avoid;
          }
          
          /* Last shed no page break */
          .print-page-break:last-child {
            page-break-after: auto;
          }
          
          /* Ensure cards print nicely */
          .print-card {
            border: 1px solid #ddd;
            margin-bottom: 20px;
            padding: 15px;
            background: white;
          }
          
          /* Hide body background */
          body {
            background: white !important;
          }
        }
        
        @media screen {
          /* Hide floor plan on screen */
          .print-only {
            display: none !important;
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="bg-white no-print"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <Button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 no-print"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print All Stores
            </Button>
          </div>

        <div className="mb-8">
          <h1 className="text-4xl font-semibold mb-2 text-gray-900">
            Stock Overview
          </h1>
          <p className="text-gray-600">
            View all stock across your sheds
          </p>
        </div>

        {sheds.length === 0 ? (
          <Card className="bg-white shadow rounded-xl border border-gray-200">
            <CardContent className="py-12 text-center">
              <p className="text-gray-600">No sheds found. Upload your Excel file to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sheds.map((shed) => {
              const stockDetails = getShedStockDetails(shed.id);
              const totalStock = stockDetails.reduce((sum, fd) => sum + fd.totalQuantity, 0);
              
              return (
                <Card 
                  key={shed.id} 
                  className="bg-white shadow rounded-xl border border-gray-200 hover:shadow-lg transition-shadow print-page-break print-card"
                >
                  <CardHeader className="border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Warehouse className="w-6 h-6 text-gray-700" />
                        <div>
                          <CardTitle className="text-2xl text-gray-900">{shed.name}</CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            Total Stock: <span className="font-semibold">{(() => {
                              const shedZones = zones.filter(z => z.shed_id === shed.id);
                              const actualTotal = shedZones.reduce((sum, z) => sum + (z.total_quantity || 0), 0);
                              return actualTotal.toFixed(0);
                            })()} units</span>
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate(`/floor-plan/${shed.id}`)}
                        className="bg-green-600 hover:bg-green-700 no-print"
                      >
                        View Floor Plan
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {stockDetails.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No stock in this shed</p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 italic mb-4">
                          * Field quantities are estimated based on intake proportions in mixed zones
                        </p>
                        <div className="space-y-4">
                        {stockDetails.map((detail, idx) => (
                          <div 
                            key={idx}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-semibold text-gray-900">
                                  {detail.fieldName} - {detail.harvestYear}
                                </h3>
                                <p className="text-sm text-gray-600">{detail.cropType}</p>
                              </div>
                              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-md border border-gray-200">
                                <Package className="w-4 h-4 text-gray-600" />
                                <span className="font-semibold text-gray-900">
                                  {detail.totalQuantity.toFixed(0)} units
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase">Grades:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(detail.grades).map(([grade, qty]) => (
                                  qty > 0 && (
                                    <span 
                                      key={grade}
                                      className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm"
                                    >
                                      {grade}: <span className="font-semibold">{qty.toFixed(0)}</span>
                                    </span>
                                  )
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                        </div>
                      </>
                    )}
                    
                    {/* Floor Plan - Hidden on screen, shown when printing */}
                    <div className="print-only mt-8 pt-8 border-t-2 border-gray-300">
                      <h3 className="text-xl font-bold mb-4 text-gray-900">Floor Plan</h3>
                      <div className="bg-white border border-gray-300 p-4 rounded">
                        <svg 
                          width="100%" 
                          height="400" 
                          viewBox={`0 0 ${shed.width * 20} ${shed.height * 20}`}
                          className="border border-gray-200"
                          style={{ maxWidth: '100%' }}
                        >
                          {/* Draw zones */}
                          {zones.filter(z => z.shed_id === shed.id).map((zone) => {
                            const zoneIntakes = stockIntakes.filter(i => i.zone_id === zone.id);
                            const isEmpty = zone.total_quantity === 0;
                            
                            // Determine color
                            let fillColor = '#e5e7eb'; // gray for empty
                            if (!isEmpty && zoneIntakes.length > 0) {
                              // Use first field's color (simplified)
                              const fieldId = zoneIntakes[0].field_id;
                              const colorIndex = fields.findIndex(f => f.id === fieldId);
                              const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                              fillColor = colors[colorIndex % colors.length];
                            }
                            
                            return (
                              <g key={zone.id}>
                                <rect
                                  x={zone.x * 20}
                                  y={zone.y * 20}
                                  width={zone.width * 20}
                                  height={zone.height * 20}
                                  fill={fillColor}
                                  stroke="#374151"
                                  strokeWidth="2"
                                />
                                <text
                                  x={zone.x * 20 + (zone.width * 20) / 2}
                                  y={zone.y * 20 + (zone.height * 20) / 2}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="white"
                                  fontSize="14"
                                  fontWeight="bold"
                                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                                >
                                  {zone.name}
                                </text>
                                {!isEmpty && (
                                  <text
                                    x={zone.x * 20 + (zone.width * 20) / 2}
                                    y={zone.y * 20 + (zone.height * 20) / 2 + 18}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="white"
                                    fontSize="12"
                                    fontWeight="bold"
                                  >
                                    {zone.total_quantity % 1 === 0 ? zone.total_quantity.toFixed(0) : zone.total_quantity.toFixed(1)}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                          
                          {/* Draw doors */}
                          {shed.doors && shed.doors.map((door, idx) => {
                            let x1, y1, x2, y2;
                            const doorWidth = 4;
                            
                            if (door.side === 'top') {
                              x1 = door.position * 20;
                              y1 = 0;
                              x2 = x1 + doorWidth;
                              y2 = 0;
                            } else if (door.side === 'bottom') {
                              x1 = door.position * 20;
                              y1 = shed.height * 20;
                              x2 = x1 + doorWidth;
                              y2 = y1;
                            } else if (door.side === 'left') {
                              x1 = 0;
                              y1 = door.position * 20;
                              x2 = 0;
                              y2 = y1 + doorWidth;
                            } else {
                              x1 = shed.width * 20;
                              y1 = door.position * 20;
                              x2 = x1;
                              y2 = y1 + doorWidth;
                            }
                            
                            return (
                              <line
                                key={idx}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke="#ef4444"
                                strokeWidth="8"
                              />
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </>
  );
};

export default Overview;
