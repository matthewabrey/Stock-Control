"""
Repair script to fix orphaned stock intakes by matching field_name to actual fields
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

async def repair_field_references():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.harvest_manager
    
    print("=== Repairing Field References ===\n")
    
    # Get all fields
    fields = await db.fields.find({}, {"_id": 0}).to_list(length=None)
    print(f"Found {len(fields)} fields in database")
    
    # Create mapping: field_name -> field_id
    field_name_to_id = {f['name']: f['id'] for f in fields}
    
    # Get all stock intakes
    intakes = await db.stock_intakes.find({}, {"_id": 0}).to_list(length=None)
    print(f"Found {len(intakes)} stock intakes\n")
    
    # Check each intake
    fixed = 0
    already_correct = 0
    no_match_found = []
    
    for intake in intakes:
        field_id = intake.get('field_id')
        field_name = intake.get('field_name')
        
        # Check if field_id is valid
        field_exists = any(f['id'] == field_id for f in fields)
        
        if field_exists:
            already_correct += 1
            continue
        
        # Field ID is invalid/orphaned, try to fix using field_name
        if field_name in field_name_to_id:
            correct_field_id = field_name_to_id[field_name]
            
            # Update the intake
            await db.stock_intakes.update_one(
                {"id": intake['id']},
                {"$set": {"field_id": correct_field_id}}
            )
            fixed += 1
            print(f"Fixed: '{field_name}' -> {correct_field_id}")
        else:
            no_match_found.append({
                'field_name': field_name,
                'intake_id': intake['id'],
                'quantity': intake.get('quantity')
            })
    
    print(f"\n=== Summary ===")
    print(f"Already correct: {already_correct}")
    print(f"Fixed: {fixed}")
    print(f"No match found: {len(no_match_found)}")
    
    if no_match_found:
        print(f"\nStock intakes without matching fields:")
        for item in no_match_found[:10]:  # Show first 10
            print(f"  - {item['field_name']} (qty: {item['quantity']})")
        if len(no_match_found) > 10:
            print(f"  ... and {len(no_match_found) - 10} more")
    
    client.close()
    print("\nDone!")

if __name__ == "__main__":
    asyncio.run(repair_field_references())
