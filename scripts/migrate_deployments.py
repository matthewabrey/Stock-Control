#!/usr/bin/env python3
"""
Script to migrate data from harvest-manager-6.emergent.host to harvestflow.emergent.host
Copies all fields, sheds, zones, stock intakes, users, and stock movements.
"""
import requests
import json
from typing import List, Dict

# Source and destination URLs
SOURCE_URL = "https://harvest-manager-6.emergent.host/api"
DEST_URL = "https://harvestflow.emergent.host/api"

def get_data(url: str, endpoint: str) -> List[Dict]:
    """Fetch data from an endpoint"""
    try:
        response = requests.get(f"{url}/{endpoint}")
        response.raise_for_status()
        data = response.json()
        print(f"✅ Fetched {len(data)} items from {endpoint}")
        return data
    except Exception as e:
        print(f"❌ Error fetching {endpoint}: {e}")
        return []

def post_data(url: str, endpoint: str, data: Dict) -> bool:
    """Post data to an endpoint"""
    try:
        response = requests.post(f"{url}/{endpoint}", json=data)
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"❌ Error posting to {endpoint}: {e}")
        print(f"   Data: {json.dumps(data, indent=2)}")
        return False

def migrate_collection(source_url: str, dest_url: str, endpoint: str, id_field: str = "id"):
    """Migrate a collection from source to destination"""
    print(f"\n{'='*60}")
    print(f"Migrating {endpoint}...")
    print(f"{'='*60}")
    
    # Fetch data from source
    items = get_data(source_url, endpoint)
    if not items:
        print(f"⚠️  No items found in {endpoint}")
        return
    
    # Post each item to destination
    success_count = 0
    fail_count = 0
    
    for item in items:
        # Remove MongoDB _id if present
        if "_id" in item:
            del item["_id"]
        
        if post_data(dest_url, endpoint, item):
            success_count += 1
        else:
            fail_count += 1
    
    print(f"\n📊 Migration Results for {endpoint}:")
    print(f"   ✅ Success: {success_count}")
    print(f"   ❌ Failed: {fail_count}")
    print(f"   📦 Total: {len(items)}")

def main():
    print("🚀 Starting Data Migration")
    print(f"📤 Source: {SOURCE_URL}")
    print(f"📥 Destination: {DEST_URL}")
    print("\n⚠️  WARNING: This will add data to the destination. Make sure destination is clean!")
    
    # Migration order is important due to foreign key relationships
    # 1. Fields (no dependencies)
    # 2. Sheds (no dependencies)
    # 3. Zones (depends on sheds)
    # 4. Stock Intakes (depends on fields, zones, sheds)
    # 5. Users (no dependencies)
    # 6. Stock Movements (depends on users)
    
    collections = [
        ("fields", "id"),
        ("sheds", "id"),
        ("zones", "id"),
        ("stock-intakes", "id"),
        ("users", "employee_number"),
        ("stock-movements", "id"),
    ]
    
    for endpoint, id_field in collections:
        migrate_collection(SOURCE_URL, DEST_URL, endpoint, id_field)
    
    print("\n" + "="*60)
    print("🎉 Migration Complete!")
    print("="*60)
    print("\n📋 Next Steps:")
    print("   1. Verify data at https://harvestflow.emergent.host/")
    print("   2. Test all functionality")
    print("   3. Shut down old deployment if everything works")

if __name__ == "__main__":
    main()
