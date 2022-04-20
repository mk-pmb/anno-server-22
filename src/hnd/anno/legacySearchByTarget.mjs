// -*- coding: utf-8, tab-width: 2 -*-

import fmtAnnoCollection from './fmtAnnosAsSinglePageCollection.mjs';
import ubhdAnnoIdFmt from './ubhdAnnoIdFmt.mjs';


const {
  legacyRevisionSeparator,
} = ubhdAnnoIdFmt;


const EX = async function legacySearchByTarget(srv, req, origTargetSpec) {
  const reply = await srv.db.postgresSelect(EX.queryTpl, [origTargetSpec]);
  const { rows } = reply;
  const annos = rows.map(EX.recombineAnno);
  fmtAnnoCollection.replyToRequest(srv, req, { annos });
};


const queryTpl = ([
  'anno_id',
  'revision_id',
  'details',
].map(f => 'data.' + f).join(', ') + `
  FROM anno_links AS links
  INNER JOIN anno_data AS data
    ON links.rel = 'subject'
    AND links.url = $1
    AND data.anno_id = links.anno_id
`).trim();


Object.assign(EX, {

  queryTpl,

  recombineAnno(rec) {
    const id = rec.anno_id + legacyRevisionSeparator + rec.revision_id;
    const anno = { id, ...rec.details };
    return anno;
  },

});


export default EX;
