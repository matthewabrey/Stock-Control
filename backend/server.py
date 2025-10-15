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
    grade: Optional[str] = None

class FieldCreate(BaseModel):
    name: str
    area: str
    crop_type: str
    grade: Optional[str] = None

class Shed(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = PydanticField(default_factory=lambda: str(uuid.uuid4()))
    name: str
    width: float
    height: float
    description: Optional[str] = None

class ShedCreate(BaseModel):
    name: str
    width: float
    height: float
    description: Optional[str] = None

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
    created_at: str = PydanticField(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class StockIntakeCreate(BaseModel):
    field_id: str
    field_name: str
    zone_id: str
    shed_id: str
    quantity: float
    date: str

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


# Excel Upload for Store Plans
@api_router.post("/upload-store-plans")
async def upload_store_plans(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents))
        
        if "Store Plans" not in wb.sheetnames:
            raise HTTPException(status_code=400, detail="Store Plans sheet not found")
        
        ws = wb["Store Plans"]
        
        # Parse the store plans
        stores_created = 0
        zones_created = 0
        
        # Find store headers (row 3)
        store_headers = {}
        for col_idx in range(1, ws.max_column + 1):
            cell = ws.cell(3, col_idx)
            if cell.value and str(cell.value).strip():
                store_name = str(cell.value).strip()
                if store_name != "Line":
                    store_headers[col_idx] = store_name
        
        # Process each store
        for start_col, store_name in store_headers.items():
            # Determine store boundaries
            end_col = start_col
            for check_col in range(start_col + 1, ws.max_column + 1):
                if check_col in store_headers:
                    break
                end_col = check_col
            
            # Calculate store dimensions
            store_width = (end_col - start_col + 1) * 2  # 2 meters per column
            store_height = 0
            
            # Find zones with capacity (cells with "6")
            zone_positions = []
            for row_idx in range(4, ws.max_row + 1):
                for col_idx in range(start_col, end_col + 1):
                    cell = ws.cell(row_idx, col_idx)
                    if cell.value and str(cell.value).strip() == "6":
                        if store_height < (row_idx - 3):
                            store_height = (row_idx - 3)
                        
                        # Check if zone already recorded
                        zone_key = (row_idx, col_idx)
                        if zone_key not in [z[0] for z in zone_positions]:
                            zone_positions.append((zone_key, row_idx, col_idx))
            
            store_height = store_height * 2  # 2 meters per row
            
            # Create shed
            shed_id = str(uuid.uuid4())
            shed_doc = {
                "id": shed_id,
                "name": store_name,
                "width": store_width,
                "height": store_height,
                "description": f"Imported from Excel"
            }
            await db.sheds.insert_one(shed_doc)
            stores_created += 1
            
            # Get line number column (AD)
            line_col = None
            for col_idx in range(1, ws.max_column + 1):
                if ws.cell(3, col_idx).value == "Line":
                    line_col = col_idx
                    break
            
            # Create zones
            for _, row_idx, col_idx in zone_positions:
                # Get line number
                line_number = ""
                if line_col:
                    line_val = ws.cell(row_idx, line_col).value
                    if line_val:
                        line_number = f" L{line_val}"
                
                zone_name = f"Zone {openpyxl.utils.get_column_letter(col_idx)}{row_idx}{line_number}"
                zone_x = (col_idx - start_col) * 2
                zone_y = (row_idx - 4) * 2
                
                zone_doc = {
                    "id": str(uuid.uuid4()),
                    "shed_id": shed_id,
                    "name": zone_name,
                    "x": zone_x,
                    "y": zone_y,
                    "width": 2,
                    "height": 2,
                    "total_quantity": 0,
                    "max_capacity": 6
                }
                await db.zones.insert_one(zone_doc)
                zones_created += 1
        
        return {
            "message": "Store plans uploaded successfully",
            "stores_created": stores_created,
            "zones_created": zones_created
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


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