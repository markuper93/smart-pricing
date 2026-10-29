"""Conservative monthly supplements: percentages only, never vendor COST.

Identity uses code + normalized *full* description, not unverified ID4WS.
Year bounds and percentage are not identity; changed descriptions intentionally
remain unmatched rather than silently guessing equivalence.
"""
import hashlib
import io
import json
import math
import re
import unicodedata
import zipfile
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from openpyxl import load_workbook
from ..models.price_data import PriceList, Supplement

MONTHS = {m: i for i, m in enumerate('ינואר פברואר מרץ אפריל מאי יוני יולי אוגוסט ספטמבר אוקטובר נובמבר דצמבר'.split(), 1)}
# Only exact, unambiguous accessory names are additive. Everything else is
# treated as a mutually exclusive variant; no fuzzy keyword classification.
ACCESSORIES = {'גג שמש', 'חלון גג', 'ריפודי עור', 'וו גרירה', 'sunroof', 'tow bar'}


def normalize(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', str(text))).strip().casefold()


def stable_key(code, description):
    return hashlib.sha256((str(code) + '\0' + normalize(description)).encode()).hexdigest()


def parse_supplements(content, diagnostics=None):
    diagnostics = diagnostics if diagnostics is not None else {}
    diagnostics.update(skipped_rows=0, ambiguous_keys=0)
    ambiguous = set()
    if len(content) > 20 * 1024 * 1024:
        raise ValueError('קובץ גדול מדי (20MB)')
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        if sum(f.file_size for f in archive.infolist()) > 150 * 1024 * 1024:
            raise ValueError('תוכן הקובץ גדול מדי')
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    try:
        rows = iter(wb.active.values)
        header = next(rows, ())
        names = [str(v).strip().upper() for v in header]
        required = ('KOD', 'TEUR', 'AHUZ', 'YEAR1', 'YEAR2')
        if any(names.count(k) != 1 for k in required):
            raise ValueError('חסרות כותרות חובה או קיימות כותרות כפולות')
        indexes = {k: names.index(k) for k in required}
        result = {}
        for line, row in enumerate(rows, 2):
            if line > 200002:
                raise ValueError('יותר מדי שורות')
            if not any(v is not None for v in row):
                continue
            values = {k: row[i] if i < len(row) else None for k, i in indexes.items()}
            try:
                code = str(int(values['KOD']))
                if float(values['KOD']) != int(values['KOD']):
                    raise ValueError()
                description = str(values['TEUR'] or '').strip()
                yf, yt = int(values['YEAR1']), int(values['YEAR2'])
                if not description or not 1900 <= yf <= yt <= 2200:
                    raise ValueError()
                raw = values['AHUZ']
                percent = None if raw is None or str(raw).strip() == '' else float(raw)
                if percent is not None and (not math.isfinite(percent) or percent < -100):
                    raise ValueError()
            except (TypeError, ValueError, OverflowError):
                diagnostics['skipped_rows'] += 1
                continue  # Invalid vendor ranges must never be guessed/reversed.
            key = stable_key(code, description)
            kind = 'note' if percent is None else ('accessory' if normalize(description) in ACCESSORIES else 'variant')
            record = dict(car_code=code, key=key, description=description, percent=percent,
                          year_from=yf, year_to=yt, kind=kind, selectable=percent is not None)
            identity = (code, key, yf, yt)
            if identity in result and result[identity]['percent'] != percent:
                ambiguous.add((code, key))
            result[identity] = record
        # Merge equal overlapping ranges; quarantine ambiguous percentages.
        by_key = {}
        for record in sorted(result.values(), key=lambda r: r['year_from']):
            identity = (record['car_code'], record['key'])
            merged = False
            for prev in by_key.get(identity, []):
                if max(prev['year_from'], record['year_from']) <= min(prev['year_to'], record['year_to']):
                    if prev['percent'] != record['percent']:
                        ambiguous.add(identity)
                    else:
                        prev['year_from'] = min(prev['year_from'], record['year_from'])
                        prev['year_to'] = max(prev['year_to'], record['year_to'])
                        merged = True
                        break
            if not merged:
                by_key.setdefault(identity, []).append(record)
        diagnostics['ambiguous_keys'] = len(ambiguous)
        return [r for identity, records in by_key.items() if identity not in ambiguous for r in records]
    finally:
        wb.close()


def latest_list(db):
    return max(db.query(PriceList).all(), key=lambda p: (p.year, MONTHS.get(p.month, int(p.month) if p.month.isdigit() else 0), p.id), default=None)


def applicable(db, list_id, code, year):
    return db.query(Supplement).filter(Supplement.price_list_id == list_id, Supplement.car_code == code,
                                      Supplement.year_from <= year, Supplement.year_to >= year).all()


def serialize(record):
    return {k: getattr(record, k) for k in ('key', 'description', 'percent', 'year_from', 'year_to', 'kind', 'selectable')}


def validate_selection(db, code, years, selections, existing_items=()):
    # Only persisted selections in this authorized group/template may survive
    # catalog changes. Bind the exemption to BOTH car code and original year.
    retained = {}
    for item in existing_items:
        if item.car_code == code:
            old_years = json.loads(item.years)
            for year, keys in json.loads(item.supplements or '{}').items():
                if int(year) in old_years:
                    retained.setdefault(year, set()).update(keys)
    if not isinstance(selections, dict):
        raise HTTPException(422, 'תוספות חייבות להיות מיפוי שנתון לרשימת מפתחות')
    pl = latest_list(db)
    clean = {}
    for year, keys in selections.items():
        if not isinstance(year, str) or not year.isdigit() or str(int(year)) != year or int(year) not in years:
            raise HTTPException(422, 'שנתון התוספות אינו בין השנתונים שנבחרו')
        if not isinstance(keys, list) or any(not isinstance(k, str) for k in keys) or len(set(keys)) != len(keys):
            raise HTTPException(422, 'מפתחות תוספות לא תקינים או כפולים')
        if not keys:
            continue
        new_keys = set(keys) - retained.get(year, set())
        if not new_keys:
            clean[year] = keys
            continue
        if not pl or not pl.supplements_uploaded:
            raise HTTPException(422, 'אין קובץ תוספות למחירון האחרון')
        records = {r.key: r for r in applicable(db, pl.id, code, int(year))}
        if any(k not in records or not records[k].selectable for k in new_keys):
            raise HTTPException(422, 'תוספת לא קיימת, אינה מתאימה לשנתון או אינה ניתנת לבחירה')
        if sum(records[k].kind == 'variant' for k in keys if k in records) > 1:
            raise HTTPException(422, 'ניתן לבחור רמת גימור חלופית אחת בלבד')
        clean[year] = keys
    return clean


def selection_json(db, item, existing_items=()):
    if not isinstance(item.get('car_code'), str) or not item['car_code'].strip():
        raise HTTPException(422, 'קוד רכב לא תקין')
    years = item.get('years', [])
    if not isinstance(years, list) or any(type(y) is not int or not 1900 <= y <= 2200 for y in years):
        raise HTTPException(422, 'שנתונים לא תקינים')
    return json.dumps(validate_selection(db, item['car_code'], years, item.get('supplements', {}), existing_items))


def comparison_columns(db, code, year, keys, pl_a, pl_b, base_a, base_b):
    if not keys:
        return {'תוספות': 'ללא תוספות', 'בסיס + תוספות': f'{base_b:,.0f}' if base_b is not None else 'לא ידוע'}
    def resolve(pl):
        if not pl.supplements_uploaded:
            return {}
        return {r.key: r for r in applicable(db, pl.id, code, year) if r.selectable}
    a, b = resolve(pl_a), resolve(pl_b)
    lines = []
    for key in keys:
        old, new = a.get(key), b.get(key)
        name = (new or old).description if new or old else f'תוספת {key[:12]}'
        if new is None:
            lines.append(f'{name}: לא ידוע (חסר במחירון {pl_b.label})')
        elif old is None:
            lines.append(f'{name}: {new.percent:g}% (מול {pl_a.label}: אין נתון להשוואה)')
        else:
            delta = new.percent - old.percent
            direction = 'עלה' if delta > 0 else 'ירד' if delta < 0 else 'ללא שינוי'
            lines.append(f'{name}: {new.percent:g}% ({direction}; מול {pl_a.label}: {delta:+g} נקודות אחוז)')
    def total(base, records):
        if base is None or any(k not in records for k in keys):
            return None
        if sum(records[k].kind == 'variant' for k in keys) > 1:
            return None
        value = Decimal(str(base)) * (1 + sum((Decimal(str(records[k].percent)) for k in keys), Decimal(0)) / 100)
        return value.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    ta, tb = total(base_a, a), total(base_b, b)
    display = 'לא ידוע' if tb is None else f'{tb:,.0f}'
    if tb is not None:
        display += f' ({tb-ta:+,.0f})' if ta is not None else ' (שינוי: לא ידוע)'
    return {'תוספות': '\n'.join(lines), 'בסיס + תוספות': display}
