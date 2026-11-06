#!/usr/bin/env python3
"""Convert seller-measured packed parcel CSV into the Cloudflare SHIPPING_PACKAGES_JSON value.

Only entries explicitly marked verified=true and containing valid physical measurements
are exported. No guessed weights or dimensions are generated.
"""
import csv, json, sys, re
from pathlib import Path

FIELD=('Packed weight kg','Packed length cm','Packed width cm','Packed height cm')

def build(path):
    result={}; skipped=0
    with Path(path).open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        required={'SKU','Measured and verified (true/false)',*FIELD}
        if not required.issubset(set(reader.fieldnames or [])):
            raise ValueError('CSV headers do not match SHIPPING_PACKAGE_MEASUREMENTS.csv')
        for line,row in enumerate(reader,start=2):
            sku=(row.get('SKU') or '').strip().upper()
            verified=(row.get('Measured and verified (true/false)') or '').strip().lower()
            if verified not in ('true','false',''):
                raise ValueError(f'Row {line}: verified must be true or false')
            if verified!='true':skipped+=1;continue
            if not re.fullmatch(r'[A-Z0-9-]{2,24}(?:\+[A-Z0-9-]{2,24})*',sku):
                raise ValueError(f'Row {line}: invalid SKU or bundle identifier')
            if sku in result:raise ValueError(f'Row {line}: duplicate verified SKU {sku}')
            try:weight,length,width,height=[float(row[key]) for key in FIELD]
            except (ValueError,TypeError):raise ValueError(f'Row {line}: all four measured numbers must be provided')
            if not 0<weight<=30 or any(not 0<x<=150 for x in (length,width,height)):
                raise ValueError(f'Row {line}: weight or package dimensions outside supported range')
            if '+' in sku and sku!='+'.join(sorted(sku.split('+'))):
                raise ValueError(f'Row {line}: multi-item SKU identifiers must be alphabetically sorted (e.g. CC-010+OH-003)')
            result[sku]={"weightKg":weight,"lengthCm":length,"widthCm":width,"heightCm":height,"verified":True}
    return result,skipped

if __name__=='__main__':
    try:
        data,skipped=build(sys.argv[1] if len(sys.argv)>1 else 'SHIPPING_PACKAGE_MEASUREMENTS.csv')
        if not data:raise ValueError('No verified parcel measurements yet; fill the CSV with actual packed sizes before enabling quotes')
        print(json.dumps(data,separators=(',',':')))
        print(f'Exported {len(data)} verified profiles; ignored {skipped} unverified entries',file=sys.stderr)
    except (OSError,ValueError) as e:
        print('Cannot build shipping profiles:',e,file=sys.stderr);sys.exit(2)
