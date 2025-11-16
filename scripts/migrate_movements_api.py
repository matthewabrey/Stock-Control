#!/usr/bin/env python3
"""
Migrate stock movements using the /log-movement API endpoint
"""
import requests
import time

SOURCE_URL = "https://harvest-manager-6.emergent.host/api"
DEST_URL = "https://harvestflow.emergent.host/api"

def main():
    print("🚀 Migrating Stock Movements via API")
    print(f"📤 Source: {SOURCE_URL}")
    print(f"📥 Destination: {DEST_URL}\n")
    
    # Fetch movements from source
    response = requests.get(f"{SOURCE_URL}/stock-movements", timeout=30)
    movements = response.json()
    print(f"✅ Fetched {len(movements)} movements\n")
    
    # Post each movement using /log-movement endpoint
    success = 0
    failed = 0
    BATCH_SIZE = 50
    
    for i in range(0, len(movements), BATCH_SIZE):
        batch = movements[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(movements) + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"Processing batch {batch_num}/{total_batches}...")
        
        for movement in batch:
            # Remove id and created_at as they'll be auto-generated
            movement_data = {
                "from_zone_id": movement.get("from_zone_id"),
                "to_zone_id": movement.get("to_zone_id"),
                "from_shed_id": movement.get("from_shed_id"),
                "to_shed_id": movement.get("to_shed_id"),
                "quantity": movement.get("quantity"),
                "date": movement.get("date"),
                "employee_number": movement.get("employee_number"),
                "field_id": movement.get("field_id"),
                "field_name": movement.get("field_name"),
                "grade": movement.get("grade")
            }
            
            try:
                response = requests.post(
                    f"{DEST_URL}/log-movement",
                    json=movement_data,
                    timeout=10
                )
                response.raise_for_status()
                success += 1
            except Exception as e:
                failed += 1
                if failed <= 5:
                    print(f"  ❌ Error: {str(e)[:100]}")
        
        time.sleep(0.1)
    
    print(f"\n📊 Results:")
    print(f"   ✅ Success: {success}/{len(movements)}")
    print(f"   ❌ Failed: {failed}/{len(movements)}")

if __name__ == "__main__":
    main()
