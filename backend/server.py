from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
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

class FieldCreate(BaseModel):
    name: str
    area: str
    crop_type: str
    variety: str
    available_grades: List[str] = []

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
async def get_fields():
    fields = await db.fields.find({}, {"_id": 0}).to_list(1000)
    return fields

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
    zones = await db.zones.find(query, {"_id": 0}).to_list(1000)
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
        
        # Parse FRONT PAGE for fields with grades
        if "FRONT PAGE" in wb.sheetnames:
            ws = wb["FRONT PAGE"]
            
            # Clear existing fields
            await db.fields.delete_many({})
            
            # First, parse the grade tables from FRONT PAGE
            # Find OnionGradeTable, MaincropGradeTable, and SaladPotatoGradeTable
            grade_tables = {
                'onion': [],
                'maincrop': [],
                'salad': []
            }
            
            # Scan all cells to find grade table headers and their grades
            for row_idx in range(1, ws.max_row + 1):
                for col_idx in range(1, ws.max_column + 1):
                    cell_value = ws.cell(row_idx, col_idx).value
                    if cell_value and isinstance(cell_value, str):
                        cell_str = cell_value.strip().lower()
                        
                        # Found OnionGradeTable
                        if 'oniongradetable' in cell_str.replace(' ', ''):
                            # Read grades below this cell (skip header row, read data rows)
                            for grade_row in range(row_idx + 2, ws.max_row + 1):
                                grade_val = ws.cell(grade_row, col_idx).value
                                if grade_val and str(grade_val).strip():
                                    grade_str = str(grade_val).strip()
                                    # Stop if we hit another table or empty cells
                                    if 'table' in grade_str.lower() or not grade_str:
                                        break
                                    grade_tables['onion'].append(grade_str)
                                else:
                                    break
                        
                        # Found MaincropGradeTable
                        elif 'maincropgradetable' in cell_str.replace(' ', ''):
                            for grade_row in range(row_idx + 2, ws.max_row + 1):
                                grade_val = ws.cell(grade_row, col_idx).value
                                if grade_val and str(grade_val).strip():
                                    grade_str = str(grade_val).strip()
                                    if 'table' in grade_str.lower() or not grade_str:
                                        break
                                    grade_tables['maincrop'].append(grade_str)
                                else:
                                    break
                        
                        # Found SaladPotatoGradeTable
                        elif 'saladpotatogradetable' in cell_str.replace(' ', ''):
                            for grade_row in range(row_idx + 2, ws.max_row + 1):
                                grade_val = ws.cell(grade_row, col_idx).value
                                if grade_val and str(grade_val).strip():
                                    grade_str = str(grade_val).strip()
                                    if 'table' in grade_str.lower() or not grade_str:
                                        break
                                    grade_tables['salad'].append(grade_str)
                                else:
                                    break
            
            print(f"Parsed grade tables: {grade_tables}")
            
            # Parse fields from row 4 onwards (row 3 is header)
            for row_idx in range(4, ws.max_row + 1):
                farm = ws.cell(row_idx, 3).value  # Column C
                field_name = ws.cell(row_idx, 4).value  # Column D
                area = ws.cell(row_idx, 5).value  # Column E
                crop = ws.cell(row_idx, 6).value  # Column F
                variety = ws.cell(row_idx, 7).value  # Column G
                
                if not farm or not field_name:
                    continue
                
                # Assign grades based on crop type from parsed tables
                grades = ['Whole Crop']  # Always include Whole Crop
                crop_str = str(crop).lower() if crop else ""
                
                if 'onion' in crop_str:
                    grades.extend(grade_tables.get('onion', []))
                elif 'maincrop' in crop_str or 'main crop' in crop_str:
                    grades.extend(grade_tables.get('maincrop', []))
                elif 'salad' in crop_str:
                    grades.extend(grade_tables.get('salad', []))
                
                full_field_name = f"{farm} - {field_name}"
                area_str = f"{area} Acres" if area else "N/A"
                
                field_doc = {
                    "id": str(uuid.uuid4()),
                    "name": full_field_name,
                    "area": area_str,
                    "crop_type": str(crop) if crop else "Unknown",
                    "variety": str(variety) if variety else "Unknown",
                    "available_grades": grades
                }
                await db.fields.insert_one(field_doc)
                fields_created += 1
        
        # Parse Store Sheets (each sheet = one store)
        # Skip FRONT PAGE and other non-store sheets
        skip_sheets = ["FRONT PAGE", "Sheet1", "Sheet2", "Sheet3"]
        
        for sheet_name in wb.sheetnames:
            if sheet_name in skip_sheets:
                continue
            
            store_name = sheet_name.strip()
            
            # Check if store already exists
            existing_shed = await db.sheds.find_one({"name": store_name})
            if existing_shed:
                print(f"Store {store_name} already exists, skipping...")
                continue
            
            ws = wb[sheet_name]
            
            # Find all zones - either boxes ("6") or bulk storage (e.g., "175t")
            zone_positions = []  # Will store (row, col, capacity)
            max_col = 0
            max_row = 0
            min_col = float('inf')
            min_row = float('inf')
            
            for row_idx in range(1, ws.max_row + 1):
                for col_idx in range(1, ws.max_column + 1):
                    cell = ws.cell(row_idx, col_idx)
                    if cell.value is not None:
                        cell_str = str(cell.value).strip()
                        capacity = 6  # Default for box storage
                        
                        # Check for box storage (exact "6")
                        if cell_str == "6":
                            zone_positions.append((row_idx, col_idx, 6))
                            max_col = max(max_col, col_idx)
                            max_row = max(max_row, row_idx)
                            min_col = min(min_col, col_idx)
                            min_row = min(min_row, row_idx)
                        # Check for bulk storage (tonnage like "175t", "200t", etc.)
                        elif cell_str.lower().endswith('t') and len(cell_str) > 1:
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
            
            if not zone_positions:
                print(f"No zones found in {store_name}, skipping...")
                continue
            
            print(f"Store {store_name}: Found {len(zone_positions)} zones")
            print(f"  Bounds: rows {min_row}-{max_row}, cols {min_col}-{max_col}")
            
            # Calculate store dimensions accounting for zone widths
            # For bulk storage (capacity > 6), zones are 8m wide instead of 2m
            max_zone_right = 0
            max_zone_bottom = 0
            
            for row_idx, col_idx, capacity in zone_positions:
                zone_x = (col_idx - min_col) * 2
                zone_y = (row_idx - min_row) * 2
                zone_width = 8 if capacity > 6 else 2
                zone_height = 2
                
                max_zone_right = max(max_zone_right, zone_x + zone_width)
                max_zone_bottom = max(max_zone_bottom, zone_y + zone_height)
            
            store_width = max_zone_right
            store_height = max_zone_bottom
            
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
                            door_position = (col_idx - min_col) * 2
                        # Bottom: row is below zone area
                        elif row_idx > max_row and col_idx >= min_col and col_idx <= max_col:
                            door_side = 'bottom'
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
            for row_idx, col_idx, capacity in zone_positions:
                # Calculate position relative to store origin
                zone_x = (col_idx - min_col) * 2
                zone_y = (row_idx - min_row) * 2
                
                # Generate zone name (column letter + row number)
                col_letter = openpyxl.utils.get_column_letter(col_idx - min_col + 1)
                zone_name = f"{col_letter}{row_idx - min_row + 1}"
                
                # Bulk storage (tonnage) gets 4x width
                zone_width = 8 if capacity > 6 else 2
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