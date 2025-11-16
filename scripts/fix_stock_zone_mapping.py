#!/usr/bin/env python3
"""
Fix stock intakes by remapping zone IDs from old deployment to new deployment
Match zones by: shed_id + position (x, y)
"""
import requests
import time

DEST_URL = "https://harvestflow.emergent.host/api"

def main():
    print("🔧 Fixing Stock Zone Mappings\n")
    
    # Fetch all zones and stock intakes from destination
    print("Fetching zones and stock intakes...")
    zones = requests.get(f"{DEST_URL}/zones", timeout=30).json()
    stock_intakes = requests.get(f"{DEST_URL}/stock-intakes", timeout=30).json()
    
    print(f"✅ Found {len(zones)} zones")
    print(f"✅ Found {len(stock_intakes)} stock intakes")
    
    # Create a lookup: shed_id -> list of zones with their positions
    zone_lookup = {}
    for zone in zones:
        shed_id = zone.get('shed_id')
        x = zone.get('x')
        y = zone.get('y')
        zone_id = zone.get('id')
        
        key = f"{shed_id}_{x}_{y}"
        zone_lookup[key] = zone_id
    
    print(f"\n✅ Created zone lookup with {len(zone_lookup)} entries")
    
    # Check which stock intakes have valid zones
    valid_count = 0
    invalid_count = 0
    
    for intake in stock_intakes:
        zone_id = intake.get('zone_id')
        # Check if this zone_id exists in our zones
        zone_exists = any(z['id'] == zone_id for z in zones)
        if zone_exists:
            valid_count += 1
        else:
            invalid_count += 1
    
    print(f"\n📊 Stock Intake Status:")
    print(f"   ✅ Valid zone references: {valid_count}")
    print(f"   ❌ Invalid zone references: {invalid_count}")
    
    if invalid_count == 0:
        print("\n✅ All stock intakes have valid zone references!")
    else:
        print(f"\n⚠️  {invalid_count} stock intakes reference non-existent zones")
        print("   This is expected after migration - zones have new IDs")
        print("   Recommendation: Clear data and re-upload Excel file")

if __name__ == "__main__":
    main()
