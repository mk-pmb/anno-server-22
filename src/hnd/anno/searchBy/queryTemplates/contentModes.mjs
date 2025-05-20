// -*- coding: utf-8, tab-width: 2 -*-

function cte(cteName, sqlLines) {
  let sql = sqlLines;
  if (sql.join) { sql = sql.join('\n'); }
  sql = sql.trim();
  if (!sql.startsWith('WITH ')) { sql = 'WITH \v_in AS (\n#|\n) ' + sql; }
  sql = sql.replace(/#details/g, '\v_data.details');
  sql = sql.replace(/\v/g, cteName);
  return sql;
}

const mcm = function makeContentMode(cteName, extraColumns, joins) {
  return cte(cteName, [
    'SELECT \v_in.*, ' + extraColumns + ' FROM \v_in',
    ...[].concat(joins).map(j => j + ' USING (versid)'),
    'JOIN anno_data AS \v_data USING (versid)',
  ]);
};


mcm.annoTitle = ('COALESCE('
    + "#details->>'dc:title', "
    + "#details->>'title', "
    + 'NULL)');


const EX = {

  addAnnoTitle: mcm('anno_titles', mcm.annoTitle + ' AS title', []),

  addFullContent: mcm('full_content', 'st.stamps, #details',
    'LEFT JOIN anno_stamps_json AS st'),

  addSubjectTargetRelUrls: mcm('subjtgt_urls', 'st.*',
    'LEFT JOIN anno_subjtargets_json AS st'),


};


export default EX;
