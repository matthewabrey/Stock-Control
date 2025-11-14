#!/usr/bin/env python3
"""
Migration script to fix orphaned field_id references in stock intakes.
Matches stock intakes to fields by field name.
"""
import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

async def migrate_stock_intakes():
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.stock_control
    
    print("=== Stock Intake Field ID Migration ===\n")
    
    # Get all fields
    fields = await db.fields.find({}, {"_id": 0}).to_list(length=None)
    print(f"📊 Found {len(fields)} fields in database")
    
    # Create a mapping: field_name -> list of field objects
    field_name_map = {}
    for field in fields:
        name = field.get('name', '')
        if name not in field_name_map:
            field_name_map[name] = []
        field_name_map[name].append(field)
    
    # Get all stock intakes
    intakes = await db.stock_intakes.find({}, {"_id": 0}).to_list(length=None)
    print(f"📦 Found {len(intakes)} stock intakes\n")
    
    # Track statistics
    stats = {
        'matched_single': 0,
        'matched_multiple': 0,
        'not_matched': 0,
        'updated': 0
    }
    
    updates_to_apply = []
    
    for intake in intakes:
        old_field_id = intake.get('field_id')
        field_name = intake.get('field_name', '')
        intake_id = intake.get('id')
        
        if not field_name:
            print(f"⚠️  Intake {intake_id}: No field_name stored")
            stats['not_matched'] += 1
            continue
        
        # Try to find matching field(s)
        if field_name in field_name_map:
            matching_fields = field_name_map[field_name]
            
            if len(matching_fields) == 1:
                # Perfect match - only one field with this name
                new_field = matching_fields[0]
                new_field_id = new_field['id']
                stats['matched_single'] += 1
                
            else:
                # Multiple fields with same name (different varieties)
                # Use the first one as default
                new_field = matching_fields[0]
                new_field_id = new_field['id']
                stats['matched_multiple'] += 1
                print(f"⚠️  Multiple fields named '{field_name}' - using first match (variety: {new_field.get('variety', 'Unknown')})")
            
            # Record update
            if old_field_id != new_field_id:
                updates_to_apply.append({
                    'intake_id': intake_id,
                    'old_field_id': old_field_id,
                    'new_field_id': new_field_id,
                    'field_name': field_name
                })
        else:
            print(f"❌ No matching field found for: '{field_name}'")
            stats['not_matched'] += 1
    
    print(f"\n=== Migration Summary ===")
    print(f"✅ Single matches: {stats['matched_single']}")
    print(f"⚠️  Multiple matches: {stats['matched_multiple']}")
    print(f"❌ Not matched: {stats['not_matched']}")
    print(f"📝 Updates to apply: {len(updates_to_apply)}")
    
    if len(updates_to_apply) > 0:
        print(f"\n{'='*60}")
        print("APPLYING UPDATES...")
        print(f"{'='*60}\n")
        
        for update in updates_to_apply:
            result = await db.stock_intakes.update_one(
                {"id": update['intake_id']},
                {"$set": {"field_id": update['new_field_id']}}
            )
            
            if result.modified_count > 0:
                stats['updated'] += 1
        
        print(f"✅ Successfully updated {stats['updated']} stock intakes")
        print(f"🎉 Migration complete!\n")
    else:
        print("\n⚠️  No updates needed\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_stock_intakes())
