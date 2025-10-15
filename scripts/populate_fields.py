import asyncio
import sys
sys.path.append('/app/backend')
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

# Field data from the Excel file
FIELDS_DATA = [
    {"name": "Wretham Cottage", "area": "Field Carrots", "crop_type": "Carrots"},
    {"name": "Euston", "area": "36 Acres Maincrop Potato", "crop_type": "Marfona"},
    {"name": "Euston", "area": "50 Acre Breck Maincrop Potato", "crop_type": "Marfona"},
    {"name": "Euston", "area": "Cornerways Maincrop Potato", "crop_type": "Marfona"},
    {"name": "Euston", "area": "Euston Breck (Headings) Maincrop Potato", "crop_type": "Marfona"},
    {"name": "Euston", "area": "Old Beyt Grove Maincrop Potato", "crop_type": "Marfona"},
    {"name": "Euston", "area": "The Clint A Maincrop Potato", "crop_type": "Marfona"},
    {"name": "Gooderham", "area": "Sandy Bettys North Maincrop Potato", "crop_type": "Maris Piper"},
    {"name": "Kilverstone", "area": "Gravel Pit (Kilv) Maincrop Potato", "crop_type": "Maris Piper"},
    {"name": "Pickenham", "area": "Daltons (34.03) Maincrop Potato", "crop_type": "Maris Piper"},
    {"name": "Pickenham", "area": "Hospital Maincrop Potato", "crop_type": "Maris Piper"},
    {"name": "Pickenham", "area": "North of Fen Maincrop Potato", "crop_type": "Maris Piper"},
    {"name": "Wretham", "area": "Big Brinks + Gregsons Maincrop Potato", "crop_type": "Maris Piper"},
    {"name": "Wretham", "area": "Coach Road Maincrop Potato", "crop_type": "Maris Piper"},
    {"name": "Blakeney", "area": "Blenheim/Francis Wood Onions", "crop_type": "Brown Seed Chandler"},
    {"name": "Lower Brandy", "area": "Onions", "crop_type": "Brown Seed Chandler"},
    {"name": "Lilac Row", "area": "Onions", "crop_type": "Red Seed Chandler"},
    {"name": "Park", "area": "38 Onions", "crop_type": "Red Sets"},
    {"name": "Euston", "area": "Heath Piece Onions", "crop_type": "Brown Seed"},
    {"name": "Euston", "area": "Tableland Onions", "crop_type": "Brown Seed"},
    {"name": "Blakeney", "area": "Chicken Run Salad Potato", "crop_type": "Maris Peer"},
    {"name": "Blakeney", "area": "Rail Crete Salad Potato", "crop_type": "Maris Peer"},
    {"name": "Chandler", "area": "37 Brek Salad Potato", "crop_type": "Maris Peer"},
]

async def populate_fields():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Clear existing fields
    await db.fields.delete_many({})
    
    # Insert new fields
    for field_data in FIELDS_DATA:
        field_doc = {
            "id": str(uuid.uuid4()),
            "name": field_data["name"],
            "area": field_data["area"],
            "crop_type": field_data["crop_type"]
        }
        await db.fields.insert_one(field_doc)
    
    print(f"✅ Successfully populated {len(FIELDS_DATA)} fields")
    client.close()

if __name__ == "__main__":
    asyncio.run(populate_fields())
