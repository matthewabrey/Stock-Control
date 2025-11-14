import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRightLeft, Search, Filter } from "lucide-react";
import { toast } from "sonner";

const MovementLog = () => {
  const navigate = useNavigate();
  const [movements, setMovements] = useState([]);
  const [sheds, setSheds] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    employee: "",
    fromShed: "",
    toShed: "",
    dateFrom: "",
    dateTo: "",
    search: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [movementsRes, shedsRes, usersRes] = await Promise.all([
        axios.get(`${API}/stock-movements`),
        axios.get(`${API}/sheds`),
        axios.get(`${API}/users`)
      ]);

      setMovements(movementsRes.data);
      setSheds(shedsRes.data);
      setUsers(usersRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load movement log");
      setLoading(false);
    }
  };

  const getShedName = (shedId) => {
    // Handle special destinations
    if (shedId === "GRADER") return "Grader";
    if (shedId === "CUSTOMER") return "Customer";
    if (shedId === "NO_LOCATION") return "No Location";
    
    const shed = sheds.find(s => s.id === shedId);
    return shed?.name || "Unknown";
  };

  const getUserName = (employeeNumber) => {
    const user = users.find(u => u.employee_number === employeeNumber);
    return user?.name || employeeNumber || "Unknown";
  };

  const filteredMovements = movements.filter(movement => {
    // Employee filter
    if (filters.employee && movement.employee_number !== filters.employee) {
      return false;
    }

    // From shed filter
    if (filters.fromShed && movement.from_shed_id !== filters.fromShed) {
      return false;
    }

    // To shed filter
    if (filters.toShed && movement.to_shed_id !== filters.toShed) {
      return false;
    }

    // Date from filter
    if (filters.dateFrom && movement.date < filters.dateFrom) {
      return false;
    }

    // Date to filter
    if (filters.dateTo && movement.date > filters.dateTo) {
      return false;
    }

    // Search filter (field name or grade)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const fieldNameMatch = movement.field_name?.toLowerCase().includes(searchLower);
      const gradeMatch = movement.grade?.toLowerCase().includes(searchLower);
      if (!fieldNameMatch && !gradeMatch) {
        return false;
      }
    }

    return true;
  });

  const clearFilters = () => {
    setFilters({
      employee: "",
      fromShed: "",
      toShed: "",
      dateFrom: "",
      dateTo: "",
      search: ""
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading movement log...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="bg-white shadow rounded-xl border border-gray-200 mb-6">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-2xl text-gray-900 flex items-center gap-2">
              <ArrowRightLeft className="w-6 h-6 text-blue-600" />
              Movement Log
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Filters */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Field/Grade
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder="Search..."
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Employee */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee
                  </label>
                  <select
                    value={filters.employee}
                    onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Employees</option>
                    {users.map(user => (
                      <option key={user.id} value={user.employee_number}>
                        {user.employee_number} - {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* From Shed */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Shed
                  </label>
                  <select
                    value={filters.fromShed}
                    onChange={(e) => setFilters({ ...filters, fromShed: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Sheds</option>
                    {sheds.map(shed => (
                      <option key={shed.id} value={shed.id}>{shed.name}</option>
                    ))}
                  </select>
                </div>

                {/* To Shed */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Shed
                  </label>
                  <select
                    value={filters.toShed}
                    onChange={(e) => setFilters({ ...filters, toShed: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Sheds</option>
                    {sheds.map(shed => (
                      <option key={shed.id} value={shed.id}>{shed.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date From
                  </label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date To
                  </label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
                <span className="text-sm text-gray-600 flex items-center">
                  Showing {filteredMovements.length} of {movements.length} movements
                </span>
              </div>
            </div>

            {/* Movements Table */}
            {filteredMovements.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                No movements found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Employee</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">What</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Grade</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">From</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">To</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((movement) => (
                        <tr key={movement.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{movement.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">{getUserName(movement.employee_number)}</div>
                            <div className="text-xs text-gray-500">{movement.employee_number}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{movement.field_name || "N/A"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{movement.grade || "N/A"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{getShedName(movement.from_shed_id)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{getShedName(movement.to_shed_id)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                            {movement.quantity.toFixed(0)} units
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MovementLog;
