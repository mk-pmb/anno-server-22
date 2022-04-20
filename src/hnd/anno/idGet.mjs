// -*- coding: utf-8, tab-width: 2 -*-

import equal from 'equal-pmb';

import httpErrors from '../../httpErrors.mjs';
import sendFinalTextResponse from '../../finalTextResponse.mjs';
import verifyAnnoIdFormat from './verifyAnnoIdFormat.mjs';

const namedEqual = equal.named.deepStrictEqual;

const queryTpl = `
  "details" FROM "anno_data"
  WHERE "anno_id" = $1 LIMIT 2;
`.trim();


async function idGet(srv, req, annoId) {
  verifyAnnoIdFormat(annoId);
  const reply = await srv.db.postgresSelect(queryTpl, [annoId]);
  const { rows } = reply;
  const nRows = rows.length;
  if (!nRows) { return httpErrors.noSuchAnno(req, 'ID not in database'); }
  namedEqual('Number of rows found for anno ID ' + annoId, nRows, 1);
  return sendFinalTextResponse.json(req, rows[0].details);
}


export default idGet;
