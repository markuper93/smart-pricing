import json
import re
from typing import List, Dict, Any, Optional

def parse_number(val) -> Optional[float]:
    """Parse a number from various formats."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        if val != val:  # NaN check
            return None
        return float(val)
    s = str(val).strip().replace(",", "").replace("₪", "").replace(" ", "")
    if s in ("", "-", "N/A", "nan", "NaN"):
        return None
    try:
        return float(s)
    except ValueError:
        return None

def parse_csv(file_path: str) -> List[Dict[str, Any]]:
    """Parse a Yitzhak Levy price list CSV into structured entries.
    
    Format: cp1255 encoded, columns include:
    קוד (car_code), תאור (description), שנ (year), מחיר (price), עלייה לכביש (road_tax)
    """
    encodings = ["cp1255", "windows-1255", "utf-8-sig", "utf-8", "iso-8859-8", "latin1"]
    
    content = None
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                content = f.read()
            if len(content) > 100:
                break
        except (UnicodeDecodeError, UnicodeError):
            continue
    
    if not content:
        raise ValueError("Could not read CSV file. Check encoding.")
    
    lines = content.strip().split('\n')
    if len(lines) < 2:
        raise ValueError("CSV file has no data rows")
    
    # Parse header
    header = [h.strip() for h in lines[0].split(',')]
    
    # Find column indices
    col_map = {}
    for i, h in enumerate(header):
        if h == 'קוד':
            col_map['car_code'] = i
        elif h == 'תאור':
            col_map['description'] = i
        elif h == 'שנ':
            col_map['year'] = i
        elif h == 'מחיר':
            col_map['price'] = i
        elif h in ('עלייה לכביש', 'עליה לכביש'):
            col_map['road_tax'] = i
    
    if 'car_code' not in col_map or 'price' not in col_map:
        raise ValueError(f"Required columns not found. Found: {list(col_map.keys())}")
    
    entries = []
    for line_num, line in enumerate(lines[1:], start=2):
        fields = line.split(',')
        
        # Extract car_code
        car_code = ""
        if 'car_code' in col_map and col_map['car_code'] < len(fields):
            car_code = fields[col_map['car_code']].strip().strip('"')
        
        if not car_code or car_code == "nan":
            continue
        
        # Clean car_code - remove .0 suffix if present
        try:
            car_code = str(int(float(car_code)))
        except (ValueError, OverflowError):
            pass
        
        # Extract description and split into manufacturer + model
        description = ""
        if 'description' in col_map and col_map['description'] < len(fields):
            description = fields[col_map['description']].strip().strip('"')
        
        manufacturer = ""
        model_name = ""
        if description and description != "nan":
            parts = description.split(" ", 1)
            manufacturer = parts[0] if parts else ""
            model_name = parts[1].strip() if len(parts) > 1 else ""
        
        # Extract year
        year_val = None
        if 'year' in col_map and col_map['year'] < len(fields):
            year_val = parse_number(fields[col_map['year']])
        
        # Extract price
        price_val = None
        if 'price' in col_map and col_map['price'] < len(fields):
            price_val = parse_number(fields[col_map['price']])
        
        # Extract road tax
        tax_val = None
        if 'road_tax' in col_map and col_map['road_tax'] < len(fields):
            tax_val = parse_number(fields[col_map['road_tax']])
        
        # Skip rows with no price
        if not price_val:
            continue
        
        entry = {
            "car_code": car_code,
            "manufacturer": manufacturer,
            "model_name": model_name,
            "year": int(year_val) if year_val else 0,
            "price": price_val,
            "road_tax": tax_val,
            "raw_data": json.dumps({"description": description}, ensure_ascii=False),
        }
        entries.append(entry)
    
    return entries
