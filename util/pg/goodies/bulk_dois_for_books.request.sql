/*

While this script is preferable over human labor for manually requesting
a lot of DOIs, consider instead mass-registering the DOIs upfront and then
mass-patching the `dc:identifier` field directly into `anno_data`
as shown in `bulk_dois_for_books.patch_insert.sql`
for hopefully much better performance
and (after table cleanup) less disk space wasted.

*/

WITH
books_list AS (SELECT unnest(ARRAY[
  'petau1610_paris_bm_4_16333',
  'petau1610_rom_bc',
  'petau1610a_paris_bm_4_16333',
  'petau1610a_rom_bc',
  'petau1718',
  'petau1757',

  '// no comma allowed here ->']) AS book_name),

requests AS (
  SELECT DISTINCT ON (da.versid) da.versid,
    '_ubhd:doiAssign' AS st_type,
    (now() AT TIME ZONE 'UTC') AS st_at,
    '' AS st_by
  FROM anno_data AS da
  JOIN anno_links AS al ON al.versid = da.versid
  CROSS JOIN books_list bl
  WHERE al.rel = 'subject'
    AND al.url LIKE 'https://digi.ub.uni-heidelberg.de/diglit/%'
    AND split_part(al.url, '/', 5) = bl.book_name
    AND NOT EXISTS (SELECT 1 FROM anno_stamps WHERE versid = da.versid
      AND st_type IN ('dc:identifier', '_ubhd:doiAssign', 'as:deleted'))
    AND (da.details->>'dc:identifier' IS NULL
       OR da.details->>'dc:identifier' = '')
)

-- INSERT INTO anno_stamps (versid, st_type, st_at, st_by)
SELECT * FROM requests LIMIT 10;




-- -*- coding: UTF-8, tab-width: 2 -*-
