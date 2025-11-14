#!/usr/bin/env python3
"""
Migration script to fix orphaned field_id references in stock intakes.
Uses the REST API to work with production data.
"""
import requests
import sys

# Production API URL
API_URL = "https://harvest-manager-6.emergent.host/api"

def migrate_via_api():
    print("=== Stock Intake Field ID Migration (API) ===\n")
    
    # Get all fields
    print("📊 Fetching fields...")
    fields_response = requests.get(f"{API_URL}/fields")
    if fields_response.status_code != 200:
        print(f"❌ Failed to fetch fields: {fields_response.status_code}")
        return
    fields = fields_response.json()
    print(f"✅ Found {len(fields)} fields")
    
    # Create a mapping: field_name -> list of field objects
    field_name_map = {}
    for field in fields:
        name = field.get('name', '')
        if name not in field_name_map:
            field_name_map[name] = []
        field_name_map[name].append(field)
    
    # Get all stock intakes
    print("📦 Fetching stock intakes...")
    intakes_response = requests.get(f"{API_URL}/stock-intakes")
    if intakes_response.status_code != 200:
        print(f"❌ Failed to fetch stock intakes: {intakes_response.status_code}")
        return
    intakes = intakes_response.json()
    print(f"✅ Found {len(intakes)} stock intakes\n")
    
    # Track statistics
    stats = {
        'matched_single': 0,
        'matched_multiple': 0,
        'not_matched': 0,
        'updated': 0,
        'failed': 0
    }
    
    updates_to_apply = []
    
    print("🔍 Analyzing stock intakes...\n")
    
    for intake in intakes:
        old_field_id = intake.get('field_id')
        field_name = intake.get('field_name', '')
        intake_id = intake.get('id')
        
        if not field_name:
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
                # Try to match by variety if available
                new_field = matching_fields[0]
                new_field_id = new_field['id']
                stats['matched_multiple'] += 1
            
            # Record update
            if old_field_id != new_field_id:
                updates_to_apply.append({
                    'intake_id': intake_id,
                    'old_field_id': old_field_id,
                    'new_field_id': new_field_id,
                    'field_name': field_name,
                    'intake': intake
                })
        else:
            stats['not_matched'] += 1
    
    print(f"=== Migration Summary ===")
    print(f"✅ Single matches: {stats['matched_single']}")
    print(f"⚠️  Multiple matches: {stats['matched_multiple']}")
    print(f"❌ Not matched: {stats['not_matched']}")
    print(f"📝 Updates to apply: {len(updates_to_apply)}\n")
    
    if len(updates_to_apply) > 0:
        print(f"{'='*60}")
        print(f"APPLYING {len(updates_to_apply)} UPDATES...")
        print(f"{'='*60}\n")
        
        for i, update in enumerate(updates_to_apply, 1):
            intake = update['intake']
            intake['field_id'] = update['new_field_id']
            
            # Update via API
            response = requests.put(
                f"{API_URL}/stock-intakes/{update['intake_id']}",
                json=intake
            )
            
            if response.status_code == 200:
                stats['updated'] += 1
                if i % 50 == 0:
                    print(f"✅ Updated {i}/{len(updates_to_apply)} intakes...")
            else:
                stats['failed'] += 1
                print(f"❌ Failed to update intake {update['intake_id']}: {response.status_code}")
        
        print(f"\n{'='*60}")
        print(f"✅ Successfully updated {stats['updated']} stock intakes")
        if stats['failed'] > 0:
            print(f"❌ Failed to update {stats['failed']} stock intakes")
        print(f"🎉 Migration complete!")
        print(f"{'='*60}\n")
    else:
        print("⚠️  No updates needed\n")

if __name__ == "__main__":
    try:
        migrate_via_api()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
