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


function createSimpleTable(name, fields) {
  wrSql(pgDumpWriter.fmtCreateSimpleTable(name, fields));
}


const { schemaName } = pgDumpWriter.fmtCreateSimpleTable.dfOpt;


const annoAddrTypes = {
  base_id: 'char*',
  version_num: 'smallint',
};

const annoAddrUniq = loMapValues(annoAddrTypes, v => v + ' ¹addr');

const indexColumnFlag = ' B'; // btree

const annoDataFields = {
  ...annoAddrUniq,
  time_created: 'ts',
  author_local_userid: 'char* B',
  details: 'json',
};


const visibilityViews = (function compile() {
  const colsGlued = 'base_id, version_num';
  const selCols = 'SELECT ' + colsGlued + ' FROM ';
  const wrapOrder = [].join.bind(['SELECT * FROM (\n',
    '\n) AS input ORDER BY base_id ASC, version_num ASC']);
  const stampType = selCols + 'anno_stamps WHERE st_type ';
  const unappSt = `${stampType}= '${externalDefs.unappStamp}'`;
  return {
    views: {
      anno_unapproved: wrapOrder(unappSt),
      anno_disclosed: wrapOrder(selCols + 'anno_data EXCEPT ' + unappSt),
      anno_undecided: wrapOrder(unappSt
        + ` EXCEPT ${stampType} = 'as:deleted'`),
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
    GROUP BY base_id, version_num
    `),

  anno_subjtargets_json: `
    SELECT base_id, version_num,
      json_agg(DISTINCT url) AS subject_target_rel_urls
    FROM anno_links WHERE rel = 'subject' GROUP BY base_id, version_num
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
        FROM anno_data AS da NATURAL LEFT JOIN anno_stamps AS st
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


createSimpleTable('anno_data', annoDataFields);


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




loMapValues(views, function createView(recipe, name) {
  wrSql('DROP VIEW IF EXISTS "' + schemaName + '"."' + name + '";'); /*
    ^-- This drop is useless if you import the entire file, as we already
    deleted all views above. However, it's useful if you want to recreate
    a single view as part of an update. */
  wrSql('CREATE VIEW ' + schemaName + '.' + name + ' AS '
    + recipe.trimEnd() + ';\n');
});


wrSql('\n-- End of generated DB structure initialization file. --');
outputSql = outputSql.trim();

const fails = [];
if (outputSql.includes('undef')) { fails.push('undef'); }
if (!outputSql.includes('CREATE TABLE ')) { fails.push('no table'); }
if (!outputSql.includes('CREATE VIEW ')) { fails.push('no view'); }

if (fails.length) {
  console.error('SQL that failed the self test:', outputSql);
  throw new Error('Generated SQL failed the self test: ' + fails.join(', '));
}







console.log(outputSql);
