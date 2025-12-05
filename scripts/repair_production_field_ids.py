#!/usr/bin/env python3
"""
Repair orphaned field_id references in stock_intakes collection.

This script fixes stock intakes that reference field_ids that no longer exist
in the fields collection (which happens when Excel is re-uploaded with new UUIDs).

Usage:
    cd /app/backend
    python3 ../scripts/repair_production_field_ids.py
"""

import os
import sys
sys.path.insert(0, '/app/backend')
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def repair_field_ids():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL or DB_NAME not set")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("="*70)
    print("REPAIRING FIELD_ID REFERENCES IN STOCK INTAKES")
    print("="*70)
    
    # Get all fields
    fields = await db.fields.find({}, {"_id": 0}).to_list(length=None)
    field_ids = set(f['id'] for f in fields)
    print(f"\nTotal fields in database: {len(fields)}")
    
    # Create mapping: field_name+variety -> field
    field_map = {}
    field_name_map = {}
    for f in fields:
        name = f['name']
        variety = f.get('variety', 'Unknown')
        # Primary key: name + variety
        key = f"{name}|{variety}"
        field_map[key] = f
        # Secondary key: just name (fallback)
        if name not in field_name_map:
            field_name_map[name] = []
        field_name_map[name].append(f)
    
    # Get all stock intakes
    intakes = await db.stock_intakes.find({}, {"_id": 0}).to_list(length=None)
    print(f"Total stock intakes: {len(intakes)}")
    
    # Find orphaned intakes
    orphaned = [i for i in intakes if i.get('field_id') not in field_ids]
    print(f"Orphaned intakes (field_id not in fields): {len(orphaned)}")
    
    if len(orphaned) == 0:
        print("\n✅ No orphaned intakes found. Database is healthy!")
        client.close()
        return
    
    # Repair orphaned intakes
    repaired = 0
    no_match = 0
    
    for intake in orphaned:
        field_name = intake.get('field_name')
        intake_variety = intake.get('variety')
        
        # Try to find matching field by name + variety
        key = f"{field_name}|{intake_variety}" if intake_variety else None
        matching_field = field_map.get(key) if key else None
        
        # Fallback: try just field name
        if not matching_field and field_name in field_name_map:
            candidates = field_name_map[field_name]
            if len(candidates) == 1:
                matching_field = candidates[0]
            elif intake_variety:
                # Try to match by variety
                matching_field = next((f for f in candidates if f.get('variety') == intake_variety), None)
        
        if matching_field:
            # Update the field_id
            await db.stock_intakes.update_one(
                {"id": intake['id']},
                {"$set": {"field_id": matching_field['id']}}
            )
            repaired += 1
            if repaired % 100 == 0:
                print(f"  Repaired {repaired}/{len(orphaned)} intakes...")
        else:
            no_match += 1
            print(f"  ⚠ No match for: {field_name} (variety: {intake_variety})")
    
    print(f"\n{'='*70}")
    print(f"REPAIR COMPLETE")
    print(f"{'='*70}")
    print(f"  Successfully repaired: {repaired}")
    print(f"  No matching field found: {no_match}")
    
    # Now update zone totals
    print(f"\n{'='*70}")
    print("UPDATING ZONE TOTALS")
    print(f"{'='*70}")
    
    zones = await db.zones.find({}, {"_id": 0}).to_list(length=None)
    updated_zones = 0
    
    for zone in zones:
        # Calculate total from stock intakes
        pipeline = [
            {"$match": {"zone_id": zone['id']}},
            {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
        ]
        result = await db.stock_intakes.aggregate(pipeline).to_list(length=1)
        total_quantity = result[0]['total'] if result else 0
        
        # Update zone
        await db.zones.update_one(
            {"id": zone['id']},
            {"$set": {"total_quantity": total_quantity}}
        )
        updated_zones += 1
        
        if updated_zones % 500 == 0:
            print(f"  Updated {updated_zones}/{len(zones)} zones...")
    
    print(f"\n✅ Updated totals for {updated_zones} zones")
    print(f"\n{'='*70}")
    print("ALL REPAIRS COMPLETED SUCCESSFULLY!")
    print(f"{'='*70}")
    
    client.close()

if __name__ == "__main__":
    print("\n🔧 Field ID Repair Script")
    print("This script will repair orphaned field_id references in stock_intakes\n")
    
    try:
        asyncio.run(repair_field_ids())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
