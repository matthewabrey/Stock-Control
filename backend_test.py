#!/usr/bin/env python3
"""
Backend API Testing for Stock Control System
Tests Excel upload with grade parsing, Field API, and basic CRUD operations
"""

import requests
import json
import io
import openpyxl
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://harvestflow.preview.emergentagent.com/api"

class StockControlTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
    
    def create_test_excel_with_type(self):
        """Create a test Excel file with Type column for testing Type column integration"""
        wb = openpyxl.Workbook()
        
        # Create Grade Options Page
        ws_grades = wb.create_sheet("Grade Options Page")
        
        # Add grade tables
        ws_grades['A1'] = "Onion"
        ws_grades['A2'] = "50/60"
        ws_grades['A3'] = "70/80"
        ws_grades['A4'] = "O Whole Crop"
        
        ws_grades['B1'] = "Onion Special"
        ws_grades['B2'] = "Special Grade 1"
        ws_grades['B3'] = "Special Grade 2"
        
        ws_grades['C1'] = "Maincrop Potato"
        ws_grades['C2'] = "40/50"
        ws_grades['C3'] = "50/60"
        ws_grades['C4'] = "70/80"
        ws_grades['C5'] = "80+"
        
        # Create Master Harvest 25 sheet with Type column
        ws = wb.create_sheet("Master Harvest 25")
        
        # Headers in row 3 (Master Harvest 25 format)
        ws['C3'] = "Farm"
        ws['D3'] = "Field"
        ws['E3'] = "Area"
        ws['F3'] = "Crop"
        ws['G3'] = "Variety"
        ws['H3'] = "Type"  # Type column (Column H for Harvest 25)
        
        # Test field data with Type values (starting from row 4)
        test_fields = [
            ("Greenfield Farm", "Field A", "25", "Onion", "Red Baron", "Red"),
            ("Hillside Farm", "Field B", "30", "Onion", "Brown Variety", "Brown"),
            ("Valley Farm", "Field C", "15", "Onion", "Special Shallot", "Special"),
            ("Riverside Farm", "Field D", "20", "Maincrop Potato", "King Edward", "Brown"),
            ("Westside Farm", "Field E", "18", "Onion", "White Variety", None)  # No Type value
        ]
        
        for i, (farm, field, area, crop, variety, type_val) in enumerate(test_fields, start=4):
            ws[f'C{i}'] = farm
            ws[f'D{i}'] = field
            ws[f'E{i}'] = area
            ws[f'F{i}'] = crop
            ws[f'G{i}'] = variety
            if type_val:
                ws[f'H{i}'] = type_val
        
        # Create a simple store sheet
        store_ws = wb.create_sheet("Test Store")
        # Add some zones
        store_ws['B2'] = "6"  # Box storage
        store_ws['C2'] = "6"
        store_ws['B3'] = "175t"  # Bulk storage
        store_ws['A1'] = "DOOR"  # Door marker
        
        # Remove default sheet
        wb.remove(wb['Sheet'])
        
        # Save to bytes
        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        return excel_buffer.getvalue()
    
    def create_test_excel(self):
        """Create a test Excel file with grade tables and field data (legacy method)"""
        return self.create_test_excel_with_type()
    
    def test_api_health(self):
        """Test if API is accessible"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                self.log_test("API Health Check", True, "API is accessible")
                return True
            else:
                self.log_test("API Health Check", False, f"API returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_test("API Health Check", False, f"Failed to connect: {str(e)}")
            return False
    
    def test_excel_upload_grade_parsing(self):
        """Test Excel upload with grade table parsing"""
        try:
            # Create test Excel file
            excel_data = self.create_test_excel()
            
            # Upload Excel file
            files = {'file': ('test_fields.xlsx', excel_data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            response = self.session.post(f"{self.base_url}/upload-excel", files=files)
            
            if response.status_code == 200:
                result = response.json()
                fields_created = result.get('fields_created', 0)
                stores_created = result.get('stores_created', 0)
                zones_created = result.get('zones_created', 0)
                
                self.log_test(
                    "Excel Upload", 
                    True, 
                    f"Successfully uploaded Excel file",
                    f"Created {fields_created} fields, {stores_created} stores, {zones_created} zones"
                )
                return True
            else:
                self.log_test("Excel Upload", False, f"Upload failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Excel Upload", False, f"Exception during upload: {str(e)}")
            return False
    
    def test_fields_api_grades(self):
        """Test Fields API and verify grade assignment"""
        try:
            response = self.session.get(f"{self.base_url}/fields")
            
            if response.status_code != 200:
                self.log_test("Fields API", False, f"Failed to get fields, status: {response.status_code}")
                return False
            
            fields = response.json()
            
            if not fields:
                self.log_test("Fields API", False, "No fields found after Excel upload")
                return False
            
            # Test grade assignment logic
            grade_tests = []
            for field in fields:
                field_name = field.get('name', 'Unknown')
                crop_type = field.get('crop_type', 'Unknown')
                available_grades = field.get('available_grades', [])
                
                # Check if at least one grade is available (Whole Crop or crop-specific grades)
                if not available_grades:
                    grade_tests.append(f"❌ {field_name}: No grades available")
                    continue
                
                # Check crop-specific grades
                if 'Onion' in crop_type:
                    expected_grades = ['O1', 'O2', 'O3', 'O4']
                    missing_grades = [g for g in expected_grades if g not in available_grades]
                    if missing_grades:
                        grade_tests.append(f"❌ {field_name} (Onion): Missing grades {missing_grades}")
                    else:
                        grade_tests.append(f"✅ {field_name} (Onion): Correct grades {[g for g in available_grades if g.startswith('O')]}")
                
                elif 'Maincrop' in crop_type:
                    expected_grades = ['MC1', 'MC2', 'MC3', 'MC4', 'MC5', 'MC6', 'MC7']
                    missing_grades = [g for g in expected_grades if g not in available_grades]
                    if missing_grades:
                        grade_tests.append(f"❌ {field_name} (Maincrop): Missing grades {missing_grades}")
                    else:
                        grade_tests.append(f"✅ {field_name} (Maincrop): Correct grades {[g for g in available_grades if g.startswith('MC')]}")
                
                elif 'Salad' in crop_type:
                    expected_grades = ['SP1', 'SP2', 'SP3']
                    missing_grades = [g for g in expected_grades if g not in available_grades]
                    if missing_grades:
                        grade_tests.append(f"❌ {field_name} (Salad): Missing grades {missing_grades}")
                    else:
                        grade_tests.append(f"✅ {field_name} (Salad): Correct grades {[g for g in available_grades if g.startswith('SP')]}")
            
            # Check if any grade assignment failed
            failed_tests = [test for test in grade_tests if test.startswith('❌')]
            
            if failed_tests:
                self.log_test(
                    "Grade Assignment", 
                    False, 
                    f"Grade assignment issues found",
                    "\n".join(grade_tests)
                )
                return False
            else:
                self.log_test(
                    "Grade Assignment", 
                    True, 
                    f"All {len(fields)} fields have correct grades",
                    "\n".join(grade_tests)
                )
                return True
                
        except Exception as e:
            self.log_test("Fields API", False, f"Exception: {str(e)}")
            return False
    
    def test_shed_crud(self):
        """Test Shed CRUD operations"""
        try:
            # Create shed
            shed_data = {
                "name": "Test Shed API",
                "width": 50.0,
                "height": 30.0,
                "description": "Test shed for API testing",
                "doors": [{"side": "top", "position": 10.0}]
            }
            
            response = self.session.post(f"{self.base_url}/sheds", json=shed_data)
            if response.status_code != 200:
                self.log_test("Shed Creation", False, f"Failed to create shed, status: {response.status_code}")
                return False
            
            shed = response.json()
            shed_id = shed.get('id')
            
            # Get sheds
            response = self.session.get(f"{self.base_url}/sheds")
            if response.status_code != 200:
                self.log_test("Shed Retrieval", False, f"Failed to get sheds, status: {response.status_code}")
                return False
            
            sheds = response.json()
            test_shed = next((s for s in sheds if s.get('id') == shed_id), None)
            
            if not test_shed:
                self.log_test("Shed Retrieval", False, "Created shed not found in list")
                return False
            
            # Delete shed
            response = self.session.delete(f"{self.base_url}/sheds/{shed_id}")
            if response.status_code != 200:
                self.log_test("Shed Deletion", False, f"Failed to delete shed, status: {response.status_code}")
                return False
            
            self.log_test("Shed CRUD", True, "All shed operations successful")
            return True
            
        except Exception as e:
            self.log_test("Shed CRUD", False, f"Exception: {str(e)}")
            return False
    
    def test_zone_crud(self):
        """Test Zone CRUD operations"""
        try:
            # First create a shed for the zone
            shed_data = {
                "name": "Zone Test Shed",
                "width": 20.0,
                "height": 15.0
            }
            
            response = self.session.post(f"{self.base_url}/sheds", json=shed_data)
            if response.status_code != 200:
                self.log_test("Zone Test Setup", False, "Failed to create test shed for zones")
                return False
            
            shed = response.json()
            shed_id = shed.get('id')
            
            # Create zone
            zone_data = {
                "shed_id": shed_id,
                "name": "A1",
                "x": 5.0,
                "y": 5.0,
                "width": 2.0,
                "height": 2.0,
                "max_capacity": 6
            }
            
            response = self.session.post(f"{self.base_url}/zones", json=zone_data)
            if response.status_code != 200:
                self.log_test("Zone Creation", False, f"Failed to create zone, status: {response.status_code}")
                return False
            
            zone = response.json()
            zone_id = zone.get('id')
            
            # Get zones
            response = self.session.get(f"{self.base_url}/zones?shed_id={shed_id}")
            if response.status_code != 200:
                self.log_test("Zone Retrieval", False, f"Failed to get zones, status: {response.status_code}")
                return False
            
            zones = response.json()
            if not zones or zones[0].get('id') != zone_id:
                self.log_test("Zone Retrieval", False, "Created zone not found")
                return False
            
            # Update zone quantity
            response = self.session.put(f"{self.base_url}/zones/{zone_id}?quantity=100")
            if response.status_code != 200:
                self.log_test("Zone Update", False, f"Failed to update zone, status: {response.status_code}")
                return False
            
            # Clean up
            self.session.delete(f"{self.base_url}/zones/{zone_id}")
            self.session.delete(f"{self.base_url}/sheds/{shed_id}")
            
            self.log_test("Zone CRUD", True, "All zone operations successful")
            return True
            
        except Exception as e:
            self.log_test("Zone CRUD", False, f"Exception: {str(e)}")
            return False
    
    def test_type_column_integration(self):
        """Test Type column parsing and storage from Excel"""
        try:
            # First clear all data
            response = self.session.delete(f"{self.base_url}/clear-all-data")
            if response.status_code != 200:
                self.log_test("Clear Data", False, f"Failed to clear data, status: {response.status_code}")
                return False
            
            # Create and upload Excel with Type column
            excel_data = self.create_test_excel_with_type()
            files = {'file': ('test_type_fields.xlsx', excel_data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            response = self.session.post(f"{self.base_url}/upload-excel", files=files)
            
            if response.status_code != 200:
                self.log_test("Type Column Upload", False, f"Upload failed with status {response.status_code}", response.text)
                return False
            
            # Get fields and verify Type column values
            response = self.session.get(f"{self.base_url}/fields")
            if response.status_code != 200:
                self.log_test("Type Column Fields API", False, f"Failed to get fields, status: {response.status_code}")
                return False
            
            fields = response.json()
            if not fields:
                self.log_test("Type Column Fields API", False, "No fields found after upload")
                return False
            
            # Expected Type values from our test data
            expected_types = {
                "Greenfield Farm - Field A": "Red",
                "Hillside Farm - Field B": "Brown", 
                "Valley Farm - Field C": "Special",
                "Riverside Farm - Field D": "Brown",
                "Westside Farm - Field E": None  # No Type value in Excel
            }
            
            type_tests = []
            for field in fields:
                field_name = field.get('name', 'Unknown')
                field_type = field.get('type')
                
                if field_name in expected_types:
                    expected_type = expected_types[field_name]
                    if field_type == expected_type:
                        type_tests.append(f"✅ {field_name}: Type='{field_type}' (correct)")
                    else:
                        type_tests.append(f"❌ {field_name}: Expected Type='{expected_type}', Got='{field_type}'")
                else:
                    type_tests.append(f"⚠️ {field_name}: Unexpected field (Type='{field_type}')")
            
            # Check if any Type tests failed
            failed_type_tests = [test for test in type_tests if test.startswith('❌')]
            
            if failed_type_tests:
                self.log_test(
                    "Type Column Integration", 
                    False, 
                    f"Type column parsing issues found",
                    "\n".join(type_tests)
                )
                return False
            else:
                self.log_test(
                    "Type Column Integration", 
                    True, 
                    f"All {len(fields)} fields have correct Type values",
                    "\n".join(type_tests)
                )
                return True
                
        except Exception as e:
            self.log_test("Type Column Integration", False, f"Exception: {str(e)}")
            return False
    
    def test_stock_intake_with_grade(self):
        """Test Stock Intake with grade field"""
        try:
            # Get existing fields to use for stock intake
            response = self.session.get(f"{self.base_url}/fields")
            if response.status_code != 200:
                self.log_test("Stock Intake Setup", False, "Failed to get fields for stock intake test")
                return False
            
            fields = response.json()
            if not fields:
                self.log_test("Stock Intake Setup", False, "No fields available for stock intake test")
                return False
            
            # Get existing sheds and zones
            response = self.session.get(f"{self.base_url}/sheds")
            if response.status_code != 200:
                self.log_test("Stock Intake Setup", False, "Failed to get sheds")
                return False
            
            sheds = response.json()
            if not sheds:
                self.log_test("Stock Intake Setup", False, "No sheds available for stock intake test")
                return False
            
            shed = sheds[0]
            shed_id = shed.get('id')
            
            # Get zones for this shed
            response = self.session.get(f"{self.base_url}/zones?shed_id={shed_id}")
            if response.status_code != 200:
                self.log_test("Stock Intake Setup", False, "Failed to get zones")
                return False
            
            zones = response.json()
            if not zones:
                self.log_test("Stock Intake Setup", False, "No zones available for stock intake test")
                return False
            
            field = fields[0]
            zone = zones[0]
            available_grades = field.get('available_grades', [])
            
            if not available_grades:
                self.log_test("Stock Intake Setup", False, "Field has no available grades")
                return False
            
            # Create stock intake with grade - use a specific grade if available
            selected_grade = available_grades[0]  # Default to first grade
            # Try to use a crop-specific grade if available
            for grade in available_grades:
                if grade.startswith(('O', 'MC', 'SP')) and grade != 'Whole Crop':
                    selected_grade = grade
                    break
            
            intake_data = {
                "field_id": field.get('id'),
                "field_name": field.get('name'),
                "zone_id": zone.get('id'),
                "shed_id": shed_id,
                "quantity": 50.0,
                "date": "2024-01-15",
                "grade": selected_grade
            }
            
            response = self.session.post(f"{self.base_url}/stock-intakes", json=intake_data)
            if response.status_code != 200:
                self.log_test("Stock Intake Creation", False, f"Failed to create stock intake, status: {response.status_code}")
                return False
            
            intake = response.json()
            
            # Verify grade was saved
            if intake.get('grade') != selected_grade:
                self.log_test("Stock Intake Grade", False, f"Grade not saved correctly. Expected: {selected_grade}, Got: {intake.get('grade')}")
                return False
            
            # Get stock intakes
            response = self.session.get(f"{self.base_url}/stock-intakes")
            if response.status_code != 200:
                self.log_test("Stock Intake Retrieval", False, f"Failed to get stock intakes, status: {response.status_code}")
                return False
            
            self.log_test("Stock Intake with Grade", True, f"Successfully created stock intake with grade '{selected_grade}'")
            return True
            
        except Exception as e:
            self.log_test("Stock Intake with Grade", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🧪 Starting Stock Control Backend API Tests")
        print(f"🔗 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("API Health Check", self.test_api_health),
            ("Type Column Integration", self.test_type_column_integration),
            ("Fields API and Grade Assignment", self.test_fields_api_grades),
            ("Shed CRUD Operations", self.test_shed_crud),
            ("Zone CRUD Operations", self.test_zone_crud),
            ("Stock Intake with Grade", self.test_stock_intake_with_grade)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🔍 Running: {test_name}")
            if test_func():
                passed += 1
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print("\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['message']}")
                if test['details']:
                    print(f"     Details: {test['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = StockControlTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)