#!/usr/bin/env python3
"""
Migrate users and stock movements manually by directly inserting into MongoDB
"""
import requests
import os
from pymongo import MongoClient

SOURCE_URL = "https://harvest-manager-6.emergent.host/api"

# Connect to local MongoDB
client = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017/'))
db = client.stock_control

def migrate_users():
    """Migrate users by directly inserting into MongoDB"""
    print("\n" + "="*60)
    print("Migrating users...")
    print("="*60)
    
    # Fetch users from source
    response = requests.get(f"{SOURCE_URL}/users")
    users = response.json()
    print(f"✅ Fetched {len(users)} users from source")
    
    # Clear existing users
    db.users.delete_many({})
    print("✅ Cleared existing users")
    
    # Insert directly into MongoDB
    for user in users:
        if "_id" in user:
            del user["_id"]
        db.users.insert_one(user)
    
    print(f"✅ Migrated {len(users)} users")

def migrate_stock_movements():
    """Migrate stock movements by directly inserting into MongoDB"""
    print("\n" + "="*60)
    print("Migrating stock movements...")
    print("="*60)
    
    # Fetch stock movements from source
    response = requests.get(f"{SOURCE_URL}/stock-movements")
    movements = response.json()
    print(f"✅ Fetched {len(movements)} stock movements from source")
    
    # Clear existing movements
    db.stock_movements.delete_many({})
    print("✅ Cleared existing stock movements")
    
    # Insert directly into MongoDB
    for movement in movements:
        if "_id" in movement:
            del movement["_id"]
        db.stock_movements.insert_one(movement)
    
    print(f"✅ Migrated {len(movements)} stock movements")

def main():
    print("🚀 Migrating Remaining Data (Users & Stock Movements)")
    
    migrate_users()
    migrate_stock_movements()
    
    print("\n" + "="*60)
    print("🎉 Migration Complete!")
    print("="*60)

if __name__ == "__main__":
    main()
