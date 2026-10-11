# Pinamalayan location picker

The shared picker applies to student, employer and household registration and edit profile.
Search results, GPS fixes, map clicks, marker drags and confirmation must be inside the bundled municipal polygon. The map shows its outline and limits panning to its extent. Invalid selections keep the last valid pin. Saved coordinates outside the polygon reopen at Pinamalayan town centre and ask the user to choose a new location.

Coordinates are checked offline. Geocoding and map tiles still need a connection. Address requests and searches use revision checks so old responses cannot overwrite a newer selection. The WebView source remains stable when React state changes.

## Boundary data

- Source: [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps), revision `8eeead560246863c8c820c31ca6fbca81a279477`.
- File: `2023/geojson/provdists/hires/municities-provdist-1705200000.0.1.json`, feature `adm3_psgc=1705209000` (Pinamalayan).
- Snapshot: 31 December 2023; high resolution municipal polygon, 737 vertices. This is a dataset boundary, not a cadastral/legal survey. Near-border decisions follow this snapshot.
- MIT license is included beside `assets/data/pinamalayan-boundary.json`.
- The backend has an identical file in `resources/data/`, with coordinate checks in `App\Support\PinamalayanLocation`. When replacing the source snapshot, update both files and run the boundary tests.

Deploy the backend changes for server enforcement; no migration is needed. Registration and profile updates reject supplied outside coordinates, malformed or incomplete coordinate pairs, and markup in location text. Requests without new coordinates retain existing data.

## Checks

Frontend: `node scripts/test-pinamalayan-location.cjs`, `npx tsc --noEmit`.
Backend: `php artisan test --filter=PinamalayanLocationTest`.
On a device: open each registration/edit-profile picker, search a local barangay and another town, drag/tap across the outline, try GPS outside Pinamalayan, rapidly move the pin, close/reopen with saved coordinates, then confirm a valid address.
