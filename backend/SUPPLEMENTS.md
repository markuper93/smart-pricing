# Supplements backend contract

- `POST /api/admin/price-lists/{id}/supplements`: admin-only multipart `file` (.xlsx; max 20 MiB). Atomic replacement of that month's supplements; old content survives invalid uploads. Returns `{price_list_id, supplements_uploaded, supplements_count, selectable_count, skipped_rows, ambiguous_keys, message}`. `skipped_rows` and `ambiguous_keys` must be surfaced as import warnings (vendor data is imperfect).
- `GET /api/user/car-codes/{code}/supplements?year=2024[&price_list_id=1]`: authenticated. Defaults to chronologically newest list, **not newest upload/ID or latest list with supplements**. Returns `{price_list_id: int|null, available: bool, items: [{key, description, percent: number|null, year_from, year_to, kind: 'variant'|'accessory'|'note', selectable: bool}]}`. Missing explicit list is 404. `available` means workbook uploaded, even if no applicable records exist.
- Admin list response adds `supplements_uploaded` and `supplements_count`.
- Group create/replace, individual add/update, and admin template items accept `supplements: {"2024": ["stable-key"], "2025": [...]}`, default `{}`. Group/template reads and individual add/update responses expose it. Inject-defaults copies selections unchanged. Validation uses the latest chronological list; invalid keys, notes, duplicate keys, out-of-year keys and multiple variants return 422. Explicit empty selection clears selections. Bulk replacement without selections retains legacy meaning (no selections).
- Existing comparison columns and base-price average remain unchanged. Added display-string columns: `תוספות` and `בסיס + תוספות`. Each selected description shows current percentage and change against month A in **percentage points**. New total excludes road tax, rounds to whole shekels (half-up), and shows change against month A. Accessories and the single variant use additive percentages of the base price, not compounding. COST is ignored.
- Missing selected record/workbook/base in month B => `לא ידוע` total. Missing month A data => known month B total with `שינוי: לא ידוע`. No selected keys => base value, independent of workbook availability; old base/road-tax columns and average are untouched.
- Stable key: SHA-256(car code + NUL + NFKC/casefold/whitespace-normalized full description). Not vendor ID4WS, row ID, percentage or year range. Description changes intentionally do not fuzzy-match (unknown is safer than a wrong match). No claim of verified ID4WS month-to-month stability.
- Only exact known accessory descriptions are cumulative: `גג שמש`, `חלון גג`, `ריפודי עור`, `וו גרירה`, `sunroof`, `tow bar`. Other numeric records are exclusive variants; null AHUZ records are nonselectable notes. Zero and negative AHUZ are retained.
- Invalid vendor rows are skipped, duplicate equal rows/ranges coalesced, identities with conflicting overlapping percentages quarantined. Never invert invalid year bounds. Uploaded November workbook produced 18,010 records / 14,581 selectable, 37 skipped rows, 69 ambiguous identities.

## Migration and testing

`app.migrations.migrate_supplements(engine)` adds `price_lists.supplements_uploaded`, `tracking_items.supplements` and the indexed `supplements` table. Existing selections default to `{}`; existing price lists default to no upload. It is called with the existing startup schema initialization. Additive SQLite/PostgreSQL SQL, idempotent; PostgreSQL workers use a transaction advisory lock. No production migration was executed during development.

Run from backend with its virtualenv:

```
python -m unittest discover -s tests -p test_supplements.py -v
```

Set `SUPPLEMENTS_TEST_XLSX` to a real XLSX path to exercise the optional full workbook upload and its sibling `מחירון נובמבר 26.csv`. Tests force a temporary SQLite DB before importing application modules; no live server/startup seed, DB or deployment is used. PDF/XLSX generation is exercised through the authenticated API. PostgreSQL compatibility is implemented but not integration-tested against a PostgreSQL server.
