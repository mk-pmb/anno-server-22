// -*- coding: utf-8, tab-width: 2 -*-

import loMapValues from 'lodash.mapvalues';
import pgDumpWriter from 'postgres-dump-writer-helpers-220524-pmb';


let outputSql = '';
function wrSql(add) { outputSql += add + '\n'; }

const externalDefs = { /*
  These definitions have their authoritative source in other files of the
  project which usually should be `import`ed rather than defined here.
  However, avoiding any parent directory dependencies in the DB schema
  generator might make it easier to mount less directory scope into a
  DB-related docker container, so I'm not entirely decided yet. */

  // from `../../src/hnd/anno/miscMetaFieldInfos.mjs`:
  doiStampName: 'dc:identifier',
  unappStamp: '_ubhd:unapproved',
};


wrSql('-- -*- coding: UTF-8, tab-width: 2 -*-\n');
wrSql('-- $date$ File generated at ' + (new Date()).toString() + '\n');


function createSimpleTable(name, fields, opt, ...unsupp) {
  if (unsupp.length) { throw new Error('Unsupported extra arguments!'); }
  wrSql(pgDumpWriter.fmtCreateSimpleTable(name, fields, opt));
}


const { schemaName } = pgDumpWriter.fmtCreateSimpleTable.dfOpt;
const indexColumnFlag = ' B'; // btree


const annoDataOpt = {
  primKeyName: 'versid',
  primKeyType: 'public.anno_version_id',
};

const annoAddrTypes = {
  [annoDataOpt.primKeyName]: annoDataOpt.primKeyType,
};
const annoAddrUniq = loMapValues(annoAddrTypes, v => v + ' ¹addr');

const annoDataFields = {
  time_created: 'ts',
  author_local_userid: 'char* B',
  details: 'json',
};


const visibilityViews = (function compile() {
  const colsGlued = 'versid';
  const selCols = 'SELECT ' + colsGlued + ' FROM ';
  const wrapOrder = [].join.bind(['SELECT * FROM (\n',
    '\n) AS input ORDER BY versid ASC']);
  const selStByType = selCols + 'anno_stamps WHERE st_type ';
  const selUnappSt = `${selStByType}= '${externalDefs.unappStamp}'`;
  const selSunsetSt = `${selStByType}= 'as:deleted'`;
  const selUndecided = (selUnappSt + ' EXCEPT ' + selSunsetSt
    + '\n  -- Ignore st_effts: A future sunset date counts as decision.');
  return {
    views: {
      anno_unapproved: wrapOrder(selUnappSt),
      anno_disclosed: wrapOrder(selCols + 'anno_data EXCEPT ' + selUnappSt),
      anno_undecided: wrapOrder(selUndecided),
    },
    wrapOrder,
    colsGlued,
  };
}());


const effUtsExpr = 'extract(epoch from COALESCE(st_effts, st_at))';
const effUtsZeroHint = ['',
  'COALESCE-ing with 0 here would be useless for most JOINs because',
  'a non-existing stamp would still produce either NULL or row omission,',
  'never number 0.',
];


const views = { // in order of creation – will be dropped in reverse order.

  ...visibilityViews.views,

  anno_stamps_effuts: `
    SELECT *, ${effUtsExpr} AS st_effuts${effUtsZeroHint.join('\n    -- ')}
    FROM anno_stamps
    `,

  anno_stamps_json: visibilityViews.wrapOrder(`
    SELECT ${visibilityViews.colsGlued}, json_agg(
      jsonb_build_object(
        'type', st_type,
        'ts', COALESCE(${effUtsExpr}, 0),
        'detail', st_detail)
      ORDER BY st_type ASC
      ) AS stamps, MAX(st_at) AS latest_st_at
    FROM anno_stamps
    GROUP BY versid
    `),

  anno_subjtargets_json: `
    SELECT versid,
      json_agg(DISTINCT url) AS subject_target_rel_urls
    FROM anno_links WHERE rel = 'subject' GROUP BY versid
    `,

  anno_dois: (function compile() {
    const { doiStampName } = externalDefs;
    const dataRowsGlued = [
      "details->>'" + doiStampName + "'::text AS da_ident",
      ...Object.keys(annoDataFields),
    ].map(f => '\n        , da.' + f).join('');
    return `
      WITH extracted AS (
        -- Extract both ways a DOI can be assigned: In data, and as stamp.
        SELECT st.st_detail::text AS st_ident${dataRowsGlued}
        FROM anno_data AS da LEFT JOIN anno_stamps AS st USING (versid)
        WHERE ( st.st_type = '${doiStampName}' OR st.st_type IS NULL )
        ), combined AS (
        -- Find the stronger DOI assignment.
        SELECT COALESCE(st_ident, da_ident) AS ident
          , ((da_ident IS NOT NULL)
              AND (st_ident IS NOT NULL)
              AND (st_ident != da_ident)
            ) AS conflict
          , *
          FROM extracted
        )
      SELECT * FROM combined WHERE ident IS NOT NULL
      `;
  }()),


};

// We have to drop all views before we can drop their tables.
Object.keys(views).reverse().forEach(
  name => wrSql('DROP VIEW IF EXISTS "' + schemaName + '"."' + name + '";'));

wrSql('DROP TYPE IF EXISTS ' + annoDataOpt.primKeyType + ' CASCADE;');
wrSql('CREATE TYPE ' + annoDataOpt.primKeyType + ' AS ('
  + '\n    baseid character varying,'
  + '\n    vernum smallint);');

createSimpleTable('anno_data', annoDataFields, annoDataOpt);

wrSql("COMMENT ON COLUMN public.anno_data.details IS '"
  + 'Web Annotation Data Model representation'
  + ' (https://www.w3.org/TR/annotation-model/)'
  + ' minus static meta data'
  + ' (i.e. constant values prescribed by the standard'
  + ' plus URLs that we can generate on-the-fly from versid)'
  + "';");
wrSql('');

createSimpleTable('anno_links', {
  ...annoAddrTypes,
  rel: 'char*' + indexColumnFlag,
  url: 'char*' + indexColumnFlag,
}, { noDuplicateRows: true });


createSimpleTable('anno_stamps', {
  ...annoAddrUniq,
  st_type: 'char* ¹addr',
  st_at: 'ts',
  st_effts: 'ts ?',   // effective timestamp, if different from st_at
  st_by: 'char*',
  st_detail: 'json ?',
});


wrSql("COMMENT ON COLUMN public.anno_stamps.st_type IS '"
  + 'Reminder: Imported stamps may instead occurr as top-level fields'
  + ' (with the st_type as key) of anno_data.details!'
  + "';");
wrSql("COMMENT ON COLUMN public.anno_stamps.st_effts IS '"
  + 'When the stamp will (or has) become effective; overrides st_at.'
  + ' See view anno_stamps_json for how to COALESCE.'
  + "';");
wrSql('');




const defineViewCmd = 'CREATE OR REPLACE VIEW ';
loMapValues(views, function createView(recipe, name) {
  wrSql(defineViewCmd + schemaName + '.' + name + ' AS '
    + String(recipe || '').trimEnd() + ';\n');
});


wrSql('\nSELECT \'Done.\' AS "DB structure initialization:";');
outputSql = outputSql.trim();

const fails = [];
if (outputSql.includes('undef')) { fails.push('undef'); }
if (!outputSql.includes('CREATE TABLE ')) { fails.push('no table'); }
if (!outputSql.includes(defineViewCmd)) { fails.push('no view'); }

if (fails.length) {
  console.error('SQL that failed the self test:', outputSql);
  throw new Error('Generated SQL failed the self test: ' + fails.join(', '));
}







console.log(outputSql);
