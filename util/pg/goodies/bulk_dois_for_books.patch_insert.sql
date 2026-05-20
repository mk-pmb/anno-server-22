WITH
books_list AS (SELECT unnest(ARRAY[
  'petau1610_paris_bm_4_16333',
  'petau1610_rom_bc',
  'petau1610a_paris_bm_4_16333',
  'petau1610a_rom_bc',
  'petau1718',
  'petau1757',

  '// no comma allowed here ->']) AS book_name),

constval AS (SELECT
  E'\n  "dc:language":' AS ins_mark,
  'dc:identifier' AS ins_key,
  'https://doi.org/10.11588/anno.diglit.' AS doi_namespace,
  NULL AS dummy), -- to allow comma at end of previous line

candidates AS (
  SELECT da.versid, da.details,
    ('"' || doi_namespace || (da.versid).baseid
      || '_' || (da.versid).vernum || '"') AS ins_val_json,
    al.url,
    ib.*
  FROM anno_data   AS da
  JOIN anno_links  AS al ON al.versid = da.versid
  CROSS JOIN books_list AS bl
  CROSS JOIN constval AS ib
  WHERE al.rel = 'subject'
    AND al.url LIKE 'https://digi.ub.uni-heidelberg.de/diglit/%'
    AND split_part(al.url, '/', 5) = bl.book_name
    -- al.url format for rel=subject is
    -- https://digi.ub.uni-heidelberg.de/diglit/$book_name/$page_num
    AND (da.details->>ib.ins_key IS NULL OR da.details->>ib.ins_key = '')
    AND NOT EXISTS (SELECT 1 FROM anno_stamps s WHERE s.versid = da.versid
      AND s.st_type = 'as:deleted')
  ),

patch AS (SELECT versid,
  replace(details::text, ins_mark,
    -- Insert at text level to ensure it keeps the original indentations.
    E'\n  "' || ins_key || '": ' || ins_val_json || ','
    || ins_mark) AS new_det
  FROM candidates)

-- Preview a sample of the changes to be made:
SELECT * FROM patch LIMIT 10

-- Then. apply the patch:
-- UPDATE anno_data SET details=new_det FROM patch p WHERE versid=p.versid;






-- -*- coding: UTF-8, tab-width: 2 -*-
