-- A bug in anno-frontend made it so when loading a draft, sometimes
-- the target ID was set to the scope. This query surveys the damage.
-- Kept here as an example for various array operations.

WITH tgt1 AS (
  SELECT
    ('https://anno.ub.uni-heidelberg.de/anno/' || (versid).baseid
      || '~' || (versid).vernum) AS url,
    details->'target'->>0 AS t0,
    details->'target'->0->>'id' AS t0id,
    details->'target'->0->>'scope' AS t0sc,
    regexp_replace(details->'target'->0->>'scope', '/[^/]+/[0-9]+$', '') AS svc,
    details->'target'->0->'selector'->>'type' AS t0st,
    *
  FROM anno_data
),
bysvc AS (
  SELECT t0st, svc,
     array_agg((t0id || ' <- ' || url) ORDER BY t0id, url) AS annos
  FROM tgt1
  WHERE t0id IS NOT NULL AND t0id <> '' AND t0id = t0sc
  GROUP BY svc, t0st
  ORDER BY svc, t0st
)
SELECT svc, t0st,
  cardinality(annos) AS n,
  array_to_string((annos)[1:5], E'\n') AS examples
FROM bysvc;

-- -*- coding: UTF-8, tab-width: 2 -*-
