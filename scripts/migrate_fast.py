#!/usr/bin/env python3
"""
Fast migration script using batch processing
"""
import requests
import json
import time
from typing import List, Dict

SOURCE_URL = "https://harvest-manager-6.emergent.host/api"
DEST_URL = "https://harvestflow.emergent.host/api"

def migrate_collection(endpoint: str):
    """Migrate a collection"""
    print(f"\n{'='*60}")
    print(f"Migrating {endpoint}...")
    print(f"{'='*60}")
    
    # Fetch all data from source
    try:
        response = requests.get(f"{SOURCE_URL}/{endpoint}", timeout=30)
        response.raise_for_status()
        items = response.json()
        print(f"✅ Fetched {len(items)} items from source")
    except Exception as e:
        print(f"❌ Error fetching {endpoint}: {e}")
        return
    
    if not items:
        print(f"⚠️  No items to migrate")
        return
    
    # Post items in batches to avoid timeout
    BATCH_SIZE = 50
    success_count = 0
    fail_count = 0
    
    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(items) + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"  Processing batch {batch_num}/{total_batches} ({len(batch)} items)...")
        
        for item in batch:
            # Remove MongoDB _id if present
            if "_id" in item:
                del item["_id"]
            
            try:
                response = requests.post(f"{DEST_URL}/{endpoint}", json=item, timeout=10)
                response.raise_for_status()
                success_count += 1
            except Exception as e:
                fail_count += 1
                if fail_count <= 5:  # Only print first 5 errors
                    print(f"    ❌ Error: {str(e)[:100]}")
        
        # Small delay between batches to avoid overwhelming server
        time.sleep(0.1)
    
    print(f"\n📊 Migration Results:")
    print(f"   ✅ Success: {success_count}/{len(items)}")
    print(f"   ❌ Failed: {fail_count}/{len(items)}")

def main():
    print("🚀 Fast Data Migration Starting")
    print(f"📤 Source: {SOURCE_URL}")
    print(f"📥 Destination: {DEST_URL}\n")
    
    start_time = time.time()
    
    # Migration order (respects foreign key dependencies)
    collections = [
        "fields",
        "sheds",
        "zones",
        "stock-intakes",
        "users",
        "stock-movements",
    ]
    
    for endpoint in collections:
        migrate_collection(endpoint)
    
    elapsed = time.time() - start_time
    print("\n" + "="*60)
    print(f"🎉 Migration Complete! (took {elapsed:.1f} seconds)")
    print("="*60)

if __name__ == "__main__":
    main()
