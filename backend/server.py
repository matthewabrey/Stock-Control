from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


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
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    area: str
    crop_type: str

class FieldCreate(BaseModel):
    name: str
    area: str
    crop_type: str

class Shed(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shed_id: str
    name: str
    x: float
    y: float
    width: float
    height: float
    total_quantity: float = 0

class ZoneCreate(BaseModel):
    shed_id: str
    name: str
    x: float
    y: float
    width: float
    height: float

class StockIntake(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    field_id: str
    field_name: str
    zone_id: str
    shed_id: str
    quantity: float
    date: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class StockIntakeCreate(BaseModel):
    field_id: str
    field_name: str
    zone_id: str
    shed_id: str
    quantity: float
    date: str

class StockMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_zone_id: str
    to_zone_id: str
    from_shed_id: str
    to_shed_id: str
    quantity: float
    date: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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