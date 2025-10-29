from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field as PydanticField, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import openpyxl
import io


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Field(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = PydanticField(default_factory=lambda: str(uuid.uuid4()))
    name: str
    area: str
    crop_type: str
    variety: str
    available_grades: List[str] = []
    harvest_year: str = "2025"  # Default harvest year

class FieldCreate(BaseModel):
    name: str
    area: str
    crop_type: str
    variety: str
    available_grades: List[str] = []
    harvest_year: str = "2025"

class DoorPosition(BaseModel):
    side: str  # "top", "bottom", "left", "right"
    position: float  # Position along that side (in meters)

class Shed(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = PydanticField(default_factory=lambda: str(uuid.uuid4()))
    name: str
    width: float
    height: float
    description: Optional[str] = None
    doors: List[DoorPosition] = []

class ShedCreate(BaseModel):
    name: str
    width: float
    height: float
    description: Optional[str] = None
    doors: List[DoorPosition] = []

class Zone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = PydanticField(default_factory=lambda: str(uuid.uuid4()))
    shed_id: str
    name: str
    x: float
    y: float
    width: float
    height: float
    total_quantity: float = 0
    max_capacity: int = 6

class ZoneCreate(BaseModel):
    shed_id: str
    name: str
    x: float
    y: float
    width: float
    height: float
    max_capacity: int = 6

class StockIntake(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = PydanticField(default_factory=lambda: str(uuid.uuid4()))
    field_id: str
    field_name: str
    zone_id: str
    shed_id: str
    quantity: float
    date: str
    grade: Optional[str] = None
    created_at: str = PydanticField(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class StockIntakeCreate(BaseModel):
    field_id: str
    field_name: str
    zone_id: str
    shed_id: str
    quantity: float
    date: str
    grade: Optional[str] = None

class StockMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = PydanticField(default_factory=lambda: str(uuid.uuid4()))
    from_zone_id: str
    to_zone_id: str
    from_shed_id: str
    to_shed_id: str
    quantity: float
    date: str
    created_at: str = PydanticField(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class StockMovementCreate(BaseModel):
    from_zone_id: str
    to_zone_id: str
    from_shed_id: str
    to_shed_id: str
    quantity: float
    date: str


# Field Routes
@api_router.post("/fields", response_model=Field)
async def create_field(input: FieldCreate):
    field_obj = Field(**input.model_dump())
    doc = field_obj.model_dump()
    await db.fields.insert_one(doc)
    return field_obj

@api_router.get("/fields", response_model=List[Field])
async def get_fields(harvest_year: Optional[str] = None):
    query = {}
    if harvest_year:
        query["harvest_year"] = harvest_year
    fields = await db.fields.find(query, {"_id": 0}).to_list(length=None)
    return fields

@api_router.get("/harvest-years")
async def get_harvest_years():
    """Get list of available harvest years from fields"""
    fields = await db.fields.find({}, {"_id": 0, "harvest_year": 1}).to_list(length=None)
    years = list(set([f.get("harvest_year", "2025") for f in fields]))
    years.sort()
    return {"harvest_years": years}

@api_router.delete("/fields/{field_id}")
async def delete_field(field_id: str):
    result = await db.fields.delete_one({"id": field_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Field not found")
    return {"message": "Field deleted"}


# Shed Routes
@api_router.post("/sheds", response_model=Shed)
async def create_shed(input: ShedCreate):
    shed_obj = Shed(**input.model_dump())
    doc = shed_obj.model_dump()
    await db.sheds.insert_one(doc)
    return shed_obj

@api_router.get("/sheds", response_model=List[Shed])
async def get_sheds():
    sheds = await db.sheds.find({}, {"_id": 0}).to_list(1000)
    return sheds

@api_router.get("/sheds/{shed_id}", response_model=Shed)
async def get_shed(shed_id: str):
    shed = await db.sheds.find_one({"id": shed_id}, {"_id": 0})
    if not shed:
        raise HTTPException(status_code=404, detail="Shed not found")
    return shed

@api_router.delete("/sheds/{shed_id}")
async def delete_shed(shed_id: str):
    result = await db.sheds.delete_one({"id": shed_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shed not found")
    # Delete all zones in this shed
    await db.zones.delete_many({"shed_id": shed_id})
    return {"message": "Shed deleted"}


# Zone Routes
@api_router.post("/zones", response_model=Zone)
async def create_zone(input: ZoneCreate):
    zone_obj = Zone(**input.model_dump())
    doc = zone_obj.model_dump()
    await db.zones.insert_one(doc)
    return zone_obj

@api_router.get("/zones", response_model=List[Zone])
async def get_zones(shed_id: Optional[str] = None):
    query = {"shed_id": shed_id} if shed_id else {}
    zones = await db.zones.find(query, {"_id": 0}).to_list(length=None)
    return zones

@api_router.put("/zones/{zone_id}", response_model=Zone)
async def update_zone(zone_id: str, quantity: float):
    zone = await db.zones.find_one({"id": zone_id}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    await db.zones.update_one(
        {"id": zone_id},
        {"$set": {"total_quantity": quantity}}
    )
    
    zone["total_quantity"] = quantity
    return zone

@api_router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str):
    result = await db.zones.delete_one({"id": zone_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"message": "Zone deleted"}


# Stock Intake Routes
@api_router.post("/stock-intakes", response_model=StockIntake)
async def create_stock_intake(input: StockIntakeCreate):
    intake_obj = StockIntake(**input.model_dump())
    doc = intake_obj.model_dump()
    await db.stock_intakes.insert_one(doc)
    
    # Update zone quantity
    zone = await db.zones.find_one({"id": input.zone_id})
    if zone:
        new_quantity = zone.get("total_quantity", 0) + input.quantity
        await db.zones.update_one(
            {"id": input.zone_id},
            {"$set": {"total_quantity": new_quantity}}
        )
    
    return intake_obj

@api_router.get("/stock-intakes", response_model=List[StockIntake])
async def get_stock_intakes():
    intakes = await db.stock_intakes.find({}, {"_id": 0}).to_list(1000)
    return intakes

@api_router.get("/stock-intakes/zone/{zone_id}", response_model=List[StockIntake])
async def get_zone_stock_intakes(zone_id: str):
    intakes = await db.stock_intakes.find({"zone_id": zone_id}, {"_id": 0}).to_list(1000)
    return intakes

@api_router.put("/stock-intakes/{intake_id}", response_model=StockIntake)
async def update_stock_intake(intake_id: str, input: StockIntakeCreate):
    # Get existing intake
    existing = await db.stock_intakes.find_one({"id": intake_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Stock intake not found")
    
    # Update the intake
    intake_obj = StockIntake(**input.model_dump())
    intake_obj.id = intake_id  # Keep same ID
    doc = intake_obj.model_dump()
    await db.stock_intakes.update_one({"id": intake_id}, {"$set": doc})
    
    return intake_obj

@api_router.delete("/stock-intakes/{intake_id}")
async def delete_stock_intake(intake_id: str):
    result = await db.stock_intakes.delete_one({"id": intake_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Stock intake not found")
    return {"message": "Stock intake deleted"}


# Stock Movement Routes
@api_router.post("/stock-movements", response_model=StockMovement)
async def create_stock_movement(input: StockMovementCreate):
    # Check if source zone has enough quantity
    from_zone = await db.zones.find_one({"id": input.from_zone_id})
    if not from_zone:
        raise HTTPException(status_code=404, detail="Source zone not found")
    
    if from_zone.get("total_quantity", 0) < input.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock in source zone")
    
    # Create movement record
    movement_obj = StockMovement(**input.model_dump())
    doc = movement_obj.model_dump()
    await db.stock_movements.insert_one(doc)
    
    # Update zone quantities
    await db.zones.update_one(
        {"id": input.from_zone_id},
        {"$inc": {"total_quantity": -input.quantity}}
    )
    
    to_zone = await db.zones.find_one({"id": input.to_zone_id})
    if to_zone:
        await db.zones.update_one(
            {"id": input.to_zone_id},
            {"$inc": {"total_quantity": input.quantity}}
        )
    
    return movement_obj

@api_router.get("/stock-movements", response_model=List[StockMovement])
async def get_stock_movements():
    movements = await db.stock_movements.find({}, {"_id": 0}).to_list(1000)
    return movements


# Excel Upload for Fields and Store Plans
@api_router.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents))
        
        fields_created = 0
        stores_created = 0
        zones_created = 0
        
        # Parse grade tables from "Grade Options Page" sheet
        grade_tables = {
            'onion': [],
            'onion_special': [],
            'maincrop': [],
            'salad': [],
            'carrot': []
        }
        
        if "Grade Options Page" in wb.sheetnames:
            ws_grades = wb["Grade Options Page"]
            print("=== Parsing Grade Options Page ===")
            
            # Row 1 contains headers (crop types)
            # Find which column corresponds to which crop type
            crop_columns = {}
            for col_idx in range(1, ws_grades.max_column + 1):
                header = ws_grades.cell(1, col_idx).value
                if header:
                    header_str = str(header).strip().lower()
                    print(f"Column {col_idx}: '{header}'")
                    
                    if 'onion' in header_str and 'special' in header_str:
                        crop_columns['onion_special'] = col_idx
                    elif 'onion' in header_str:
                        crop_columns['onion'] = col_idx
                    elif 'maincrop' in header_str or 'main crop' in header_str:
                        crop_columns['maincrop'] = col_idx
                    elif 'salad' in header_str:
                        crop_columns['salad'] = col_idx
                    elif 'carrot' in header_str:
                        crop_columns['carrot'] = col_idx
            
            print(f"Found crop columns: {crop_columns}")
            
            # Read grades from row 2 onwards for each crop type
            for crop_type, col_idx in crop_columns.items():
                grades = []
                for row_idx in range(2, ws_grades.max_row + 1):
                    grade_val = ws_grades.cell(row_idx, col_idx).value
                    if grade_val:
                        grade_str = str(grade_val).strip()
                        if grade_str:
                            grades.append(grade_str)
                
                grade_tables[crop_type] = grades
                print(f"{crop_type}: {len(grades)} grades - {grades[:3]}...")
            
            print(f"Final grade tables: {grade_tables}")
        else:
            print("Warning: 'Grade Options Page' sheet not found")
        
        # Parse harvest year sheets for fields
        harvest_sheets = []
        
        # Check for field data sheets (various possible names)
        for sheet_name in wb.sheetnames:
            sheet_lower = sheet_name.lower()
            if any(keyword in sheet_lower for keyword in ["master harvest", "master harevst", "master cropping", "front page", "fields"]):
                harvest_sheets.append(sheet_name)
        
        # If no recognized sheets, skip field import
        if not harvest_sheets:
            print("Warning: No field sheets found (looking for 'Master Harvest', 'Master Cropping', 'FRONT PAGE', etc.)")
        
        # Clear existing fields
        await db.fields.delete_many({})
        
        for sheet_name in harvest_sheets:
            ws = wb[sheet_name]
            
            print(f"\n=== Processing {sheet_name} ===")
            
            # Detect column layout by checking row 3 or row 4 for headers
            # Master Harvest 25: Row 3 has headers, data starts row 4, columns C-G
            # Master Harvest 26: Row 4 has headers, data starts row 5, columns D-H (or more if Year column exists)
            
            farm_col = 3  # Default: Column C
            field_col = 4  # Default: Column D
            area_col = 5  # Default: Column E
            crop_col = 6  # Default: Column F
            variety_col = 7  # Default: Column G
            year_col = None  # Will be detected if exists
            start_row = 4  # Default data start row
            
            # Check if row 4 has header values (indicates Master Harvest 26 format)
            row4_field = ws.cell(4, 5).value  # Check column E in row 4
            if row4_field and str(row4_field).lower() in ['field', 'farm']:
                # Master Harvest 26 format: columns shifted right, headers in row 4
                farm_col = 4  # Column D
                field_col = 5  # Column E
                area_col = 6  # Column F
                crop_col = 7  # Column G
                variety_col = 8  # Column H
                start_row = 5  # Data starts row 5
                
                # Check for Year column (could be column I or beyond)
                for col_idx in range(9, ws.max_column + 1):
                    header_val = ws.cell(4, col_idx).value
                    if header_val and 'year' in str(header_val).lower():
                        year_col = col_idx
                        break
                
                print(f"Detected Harvest 26 format: columns D-H, starting row 5, year_col={year_col}")
            else:
                # Check for Year column in row 3 (Master Harvest 25 format)
                for col_idx in range(8, ws.max_column + 1):
                    header_val = ws.cell(3, col_idx).value
                    if header_val and 'year' in str(header_val).lower():
                        year_col = col_idx
                        break
                
                print(f"Detected Harvest 25 format: columns C-G, starting row 4, year_col={year_col}")
            
            # Parse fields from data start row onwards
            for row_idx in range(start_row, ws.max_row + 1):
                farm = ws.cell(row_idx, farm_col).value
                field_name = ws.cell(row_idx, field_col).value
                area = ws.cell(row_idx, area_col).value
                crop = ws.cell(row_idx, crop_col).value
                variety = ws.cell(row_idx, variety_col).value
                
                # Read year from column if it exists, otherwise use sheet name
                if year_col:
                    year_value = ws.cell(row_idx, year_col).value
                    harvest_year = str(year_value) if year_value else "2025"
                else:
                    # Fallback: extract from sheet name
                    if "25" in sheet_name:
                        harvest_year = "2025"
                    elif "26" in sheet_name:
                        harvest_year = "2026"
                    else:
                        harvest_year = "2025"
                
                if not farm or not field_name:
                    continue
                
                # Assign grades based on crop type from parsed tables
                grades = []
                crop_str = str(crop).lower() if crop else ""
                variety_str = str(variety).lower() if variety else ""
                
                # Match crop type to grade table
                if 'onion' in crop_str:
                    # Check if it's a special onion variety
                    if 'special' in variety_str or 'shallot' in variety_str:
                        grades = grade_tables.get('onion_special', grade_tables.get('onion', []))
                    else:
                        grades = grade_tables.get('onion', [])
                elif 'maincrop' in crop_str or 'main crop' in crop_str or 'potato' in crop_str:
                    grades = grade_tables.get('maincrop', [])
                elif 'salad' in crop_str:
                    grades = grade_tables.get('salad', [])
                elif 'carrot' in crop_str:
                    grades = grade_tables.get('carrot', [])
                
                # If no grades found, add a default
                if not grades:
                    grades = ['Whole Crop']
                
                full_field_name = f"{farm} - {field_name}"
                area_str = f"{area} Acres" if area else "N/A"
                
                field_doc = {
                    "id": str(uuid.uuid4()),
                    "name": full_field_name,
                    "area": area_str,
                    "crop_type": str(crop) if crop else "Unknown",
                    "variety": str(variety) if variety else "Unknown",
                    "available_grades": grades,
                    "harvest_year": harvest_year
                }
                await db.fields.insert_one(field_doc)
                fields_created += 1
                print(f"  Created field: {full_field_name} (Harvest {harvest_year})")
        
        # Parse Store Sheets (each sheet = one store)
        # Skip field sheets, Grade Options Page, and other non-store sheets
        skip_sheets = ["FRONT PAGE", "Master Harvest 25", "Master Harevst 26", "Master Harvest 26", "Master Cropping", "Grade Options Page", "Sheet1", "Sheet2", "Sheet3"]
        
        print(f"=== Processing Store Sheets ===")
        print(f"All sheets in workbook: {wb.sheetnames}")
        print(f"Skip list: {skip_sheets}")
        
        for sheet_name in wb.sheetnames:
            if sheet_name in skip_sheets:
                print(f"Skipping sheet: '{sheet_name}' (in skip list)")
                continue
            
            store_name = sheet_name.strip()
            
            # Check if store already exists
            existing_shed = await db.sheds.find_one({"name": store_name})
            if existing_shed:
                print(f"Store '{store_name}' already exists in database, skipping...")
                continue
            
            print(f"Processing new store: '{store_name}'")
            
            ws = wb[sheet_name]
            
            # First, scan for storage type indicator (Box or Bulk)
            # Look for cells containing "Box" or "Bulk" keywords
            storage_type = "box"  # Default to box storage
            for row_idx in range(1, min(20, ws.max_row + 1)):  # Check first 20 rows
                for col_idx in range(1, ws.max_column + 1):
                    cell = ws.cell(row_idx, col_idx)
                    if cell.value:
                        cell_str = str(cell.value).lower()
                        if 'bulk' in cell_str:
                            storage_type = "bulk"
                            print(f"  Detected BULK storage type")
                            break
                        elif 'box' in cell_str:
                            storage_type = "box"
                            print(f"  Detected BOX storage type")
                            break
                if storage_type == "bulk":
                    break
            
            # Find all zones and doors - scan the entire sheet
            zone_positions = []  # Will store (row, col, capacity)
            door_positions = []  # Will store (row, col) for doors inside grid
            max_col = 0
            max_row = 0
            min_col = float('inf')
            min_row = float('inf')
            
            for row_idx in range(1, ws.max_row + 1):
                for col_idx in range(1, ws.max_column + 1):
                    cell = ws.cell(row_idx, col_idx)
                    if cell.value is not None:
                        cell_str = str(cell.value).strip()
                        
                        # Check for DOOR markers (skip these cells, don't create zones)
                        if 'door' in cell_str.lower():
                            door_positions.append((row_idx, col_idx))
                            print(f"  Found door inside grid at {openpyxl.utils.get_column_letter(col_idx)}{row_idx}")
                            continue
                        
                        # Check for bulk storage (tonnage like "175t", "200t", etc.)
                        if cell_str.lower().endswith('t') and len(cell_str) > 1:
                            try:
                                # Extract the number before 't'
                                tonnage = int(cell_str[:-1])
                                zone_positions.append((row_idx, col_idx, tonnage))
                                max_col = max(max_col, col_idx)
                                max_row = max(max_row, row_idx)
                                min_col = min(min_col, col_idx)
                                min_row = min(min_row, row_idx)
                            except ValueError:
                                pass  # Not a valid tonnage format
                        # Check for numeric capacity (box storage like "5", "6", "7", "8", etc.)
                        else:
                            try:
                                capacity = int(cell_str)
                                # Only accept reasonable capacity numbers (1-50)
                                if 1 <= capacity <= 50:
                                    zone_positions.append((row_idx, col_idx, capacity))
                                    max_col = max(max_col, col_idx)
                                    max_row = max(max_row, row_idx)
                                    min_col = min(min_col, col_idx)
                                    min_row = min(min_row, row_idx)
                            except ValueError:
                                pass  # Not a number
            
            if not zone_positions:
                print(f"No zones found in {store_name}, skipping...")
                continue
            
            print(f"Store {store_name}: Found {len(zone_positions)} zones")
            print(f"  Bounds: rows {min_row}-{max_row}, cols {min_col}-{max_col}")
            
            # Calculate column positions (used for both zones and doors)
            # Group zones by column to get proper widths
            zones_by_col_temp = {}
            for row_idx, col_idx, capacity in zone_positions:
                if col_idx not in zones_by_col_temp:
                    zones_by_col_temp[col_idx] = []
                zones_by_col_temp[col_idx].append((row_idx, capacity))
            
            # Calculate x positions for each column
            sorted_cols_temp = sorted(zones_by_col_temp.keys())
            col_x_positions = {}
            current_x = 0
            
            for col_idx in sorted_cols_temp:
                col_x_positions[col_idx] = current_x
                # Determine column width based on storage type
                if storage_type == "bulk":
                    # Bulk storage gets 8m width (elongated)
                    col_width = 8
                else:
                    # Box storage gets 2m width (square)
                    col_width = 2
                current_x += col_width
            
            # Calculate total store dimensions
            store_width = current_x
            store_height = (max_row - min_row + 1) * 2
            
            # Detect doors - look for cells containing "DOOR" text
            doors = []
            for row_idx in range(1, ws.max_row + 1):
                for col_idx in range(1, ws.max_column + 1):
                    cell = ws.cell(row_idx, col_idx)
                    if cell.value and 'door' in str(cell.value).lower():
                        # Determine which side this door is on relative to the zone area
                        door_side = None
                        door_position = 0
                        
                        # Top: row is above zone area
                        if row_idx < min_row and col_idx >= min_col and col_idx <= max_col:
                            door_side = 'top'
                            # Use the column x position we calculated earlier
                            if col_idx in col_x_positions:
                                door_position = col_x_positions[col_idx]
                            else:
                                door_position = (col_idx - min_col) * 2
                        # Bottom: row is below zone area
                        elif row_idx > max_row and col_idx >= min_col and col_idx <= max_col:
                            door_side = 'bottom'
                            # Use the column x position we calculated earlier
                            if col_idx in col_x_positions:
                                door_position = col_x_positions[col_idx]
                            else:
                                door_position = (col_idx - min_col) * 2
                        # Left: column is left of zone area
                        elif col_idx < min_col and row_idx >= min_row and row_idx <= max_row:
                            door_side = 'left'
                            door_position = (row_idx - min_row) * 2
                        # Right: column is right of zone area
                        elif col_idx > max_col and row_idx >= min_row and row_idx <= max_row:
                            door_side = 'right'
                            door_position = (row_idx - min_row) * 2
                        
                        if door_side:
                            door_dict = {"side": door_side, "position": door_position}
                            if door_dict not in doors:
                                doors.append(door_dict)
                                print(f"  Found door: {door_side} at {door_position}m (cell {openpyxl.utils.get_column_letter(col_idx)}{row_idx})")
            
            # Create shed
            shed_id = str(uuid.uuid4())
            shed_doc = {
                "id": shed_id,
                "name": store_name,
                "width": store_width,
                "height": store_height,
                "description": f"Imported from Excel - {len(zone_positions)} zones",
                "doors": doors
            }
            await db.sheds.insert_one(shed_doc)
            stores_created += 1
            
            # Create zones
            # Use the col_x_positions we already calculated above
            for row_idx, col_idx, capacity in zone_positions:
                # Calculate position relative to store origin
                zone_x = col_x_positions[col_idx]
                zone_y = (row_idx - min_row) * 2
                
                # Generate zone name (column letter + row number)
                col_letter = openpyxl.utils.get_column_letter(col_idx - min_col + 1)
                zone_name = f"{col_letter}{row_idx - min_row + 1}"
                
                # Use storage_type to determine zone width (not capacity)
                if storage_type == "bulk":
                    zone_width = 8  # Bulk storage gets 8m width (elongated)
                else:
                    zone_width = 2  # Box storage gets 2m width (square)
                zone_height = 2
                
                zone_doc = {
                    "id": str(uuid.uuid4()),
                    "shed_id": shed_id,
                    "name": zone_name,
                    "x": zone_x,
                    "y": zone_y,
                    "width": zone_width,
                    "height": zone_height,
                    "total_quantity": 0,
                    "max_capacity": capacity  # Use the capacity from the cell (6 for boxes, tonnage for bulk)
                }
                await db.zones.insert_one(zone_doc)
                zones_created += 1
        
        return {
            "message": "Excel uploaded successfully",
            "fields_created": fields_created,
            "stores_created": stores_created,
            "zones_created": zones_created
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


# Database integrity check endpoint
@api_router.get("/database-integrity")
async def check_database_integrity():
    """Check database integrity and report any inconsistencies"""
    try:
        issues = []
        stats = {}
        
        # Count documents
        sheds_count = await db.sheds.count_documents({})
        zones_count = await db.zones.count_documents({})
        intakes_count = await db.stock_intakes.count_documents({})
        fields_count = await db.fields.count_documents({})
        
        stats["sheds"] = sheds_count
        stats["zones"] = zones_count
        stats["stock_intakes"] = intakes_count
        stats["fields"] = fields_count
        
        # Check for orphaned zones (zones whose shed_id doesn't exist)
        zones = await db.zones.find({}).to_list(length=None)
        shed_ids = set([s["id"] for s in await db.sheds.find({}).to_list(length=None)])
        
        orphaned_zones = []
        for zone in zones:
            if zone["shed_id"] not in shed_ids:
                orphaned_zones.append({"zone_id": zone["id"], "zone_name": zone["name"], "invalid_shed_id": zone["shed_id"]})
        
        if orphaned_zones:
            issues.append({
                "type": "orphaned_zones",
                "count": len(orphaned_zones),
                "message": f"Found {len(orphaned_zones)} zones with invalid shed_id",
                "examples": orphaned_zones[:5]
            })
        
        # Check for stock intakes with invalid zone_id or shed_id
        intakes = await db.stock_intakes.find({}).to_list(length=None)
        zone_ids = set([z["id"] for z in zones])
        
        invalid_intakes = []
        for intake in intakes:
            if intake["zone_id"] not in zone_ids:
                invalid_intakes.append({
                    "intake_id": intake["id"],
                    "invalid_zone_id": intake["zone_id"],
                    "shed_id": intake["shed_id"]
                })
            elif intake["shed_id"] not in shed_ids:
                invalid_intakes.append({
                    "intake_id": intake["id"],
                    "zone_id": intake["zone_id"],
                    "invalid_shed_id": intake["shed_id"]
                })
        
        if invalid_intakes:
            issues.append({
                "type": "invalid_stock_intakes",
                "count": len(invalid_intakes),
                "message": f"Found {len(invalid_intakes)} stock intakes with invalid zone_id or shed_id",
                "examples": invalid_intakes[:5]
            })
        
        # Check for zone quantity mismatches
        quantity_mismatches = []
        for zone in zones:
            zone_intakes = [i for i in intakes if i["zone_id"] == zone["id"]]
            expected_qty = sum(i["quantity"] for i in zone_intakes)
            actual_qty = zone.get("total_quantity", 0)
            
            if abs(expected_qty - actual_qty) > 0.01:  # Allow small floating point differences
                quantity_mismatches.append({
                    "zone_id": zone["id"],
                    "zone_name": zone["name"],
                    "shed_id": zone["shed_id"],
                    "expected_quantity": expected_qty,
                    "actual_quantity": actual_qty,
                    "difference": expected_qty - actual_qty
                })
        
        if quantity_mismatches:
            issues.append({
                "type": "quantity_mismatches",
                "count": len(quantity_mismatches),
                "message": f"Found {len(quantity_mismatches)} zones where total_quantity doesn't match sum of intakes",
                "examples": quantity_mismatches[:10]
            })
        
        return {
            "status": "healthy" if len(issues) == 0 else "issues_found",
            "stats": stats,
            "issues": issues,
            "message": "No issues found" if len(issues) == 0 else f"Found {len(issues)} types of issues"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking integrity: {str(e)}")


# Clear all data endpoint
@api_router.delete("/clear-all-data")
async def clear_all_data():
    """Clear all data from the database"""
    try:
        # Delete all documents from each collection
        await db.fields.delete_many({})
        await db.sheds.delete_many({})
        await db.zones.delete_many({})
        await db.stock_intakes.delete_many({})
        await db.stock_movements.delete_many({})
        
        return {
            "message": "All data cleared successfully",
            "collections_cleared": ["fields", "sheds", "zones", "stock_intakes", "stock_movements"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing data: {str(e)}")


@api_router.delete("/clear-stores")
async def clear_stores():
    """Clear all stock from sheds/zones, but keep the shed and zone structure intact"""
    try:
        # Delete all stock intakes and movements
        await db.stock_intakes.delete_many({})
        await db.stock_movements.delete_many({})
        
        # Reset all zone quantities to 0
        await db.zones.update_many({}, {"$set": {"total_quantity": 0}})
        
        return {
            "message": "All stock cleared successfully. Sheds and zones preserved.",
            "actions": ["stock_intakes cleared", "stock_movements cleared", "zone quantities reset to 0"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing stock: {str(e)}")


@api_router.get("/export-excel")
async def export_excel():
    """Export all data to Excel file"""
    try:
        # Create a new workbook
        wb = openpyxl.Workbook()
        
        # Remove default sheet
        wb.remove(wb.active)
        
        # Export Fields
        ws_fields = wb.create_sheet("Fields")
        ws_fields.append(["ID", "Name", "Area", "Crop Type", "Variety", "Harvest Year", "Available Grades"])
        
        fields = await db.fields.find({}).to_list(length=None)
        for field in fields:
            ws_fields.append([
                field.get('id', ''),
                field.get('name', ''),
                field.get('area', ''),
                field.get('crop_type', ''),
                field.get('variety', ''),
                field.get('harvest_year', ''),
                ', '.join(field.get('available_grades', []))
            ])
        
        # Export Sheds
        ws_sheds = wb.create_sheet("Sheds")
        ws_sheds.append(["ID", "Name", "Width", "Height", "Description"])
        
        sheds = await db.sheds.find({}).to_list(length=None)
        for shed in sheds:
            ws_sheds.append([
                shed.get('id', ''),
                shed.get('name', ''),
                shed.get('width', 0),
                shed.get('height', 0),
                shed.get('description', '')
            ])
        
        # Export Zones
        ws_zones = wb.create_sheet("Zones")
        ws_zones.append(["ID", "Shed ID", "Name", "X", "Y", "Width", "Height", "Total Quantity", "Max Capacity"])
        
        zones = await db.zones.find({}).to_list(length=None)
        for zone in zones:
            ws_zones.append([
                zone.get('id', ''),
                zone.get('shed_id', ''),
                zone.get('name', ''),
                zone.get('x', 0),
                zone.get('y', 0),
                zone.get('width', 0),
                zone.get('height', 0),
                zone.get('total_quantity', 0),
                zone.get('max_capacity', 6)
            ])
        
        # Export Stock Intakes
        ws_intakes = wb.create_sheet("Stock Intakes")
        ws_intakes.append(["ID", "Field ID", "Field Name", "Zone ID", "Shed ID", "Quantity", "Grade", "Date"])
        
        intakes = await db.stock_intakes.find({}).to_list(length=None)
        for intake in intakes:
            ws_intakes.append([
                intake.get('id', ''),
                intake.get('field_id', ''),
                intake.get('field_name', ''),
                intake.get('zone_id', ''),
                intake.get('shed_id', ''),
                intake.get('quantity', 0),
                intake.get('grade', ''),
                intake.get('date', '')
            ])
        
        # Save to bytes
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Return as downloadable file
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=stock-control-export.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting to Excel: {str(e)}")


# Root route
@api_router.get("/")
async def root():
    return {"message": "Stock Control API"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()