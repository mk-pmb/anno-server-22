// -*- coding: utf-8, tab-width: 2 -*-

import equal from 'equal-pmb';

import httpErrors from '../../httpErrors.mjs';
import sendFinalTextResponse from '../../finalTextResponse.mjs';
import parseAnnoSlug from './parseAnnoSlug.mjs';

const namedEqual = equal.named.deepStrictEqual;

const errNotInDb = httpErrors.noSuchAnno.explain('ID not in database');


async function getExactRevision(srv, req, idParts) {
  const { slug, annoId, reviNum } = idParts;
  const queryTpl = ('"details"'
    + ' FROM "anno_data" WHERE "anno_id" = $1'
    + ' AND "revision_id" = $2 LIMIT 2'
  );
  const reply = await srv.db.postgresSelect(queryTpl, [annoId, reviNum]);
  const { rows } = reply;
  const nRows = rows.length;
  if (!nRows) { throw errNotInDb.throwable(); }
  namedEqual('Number of rows found for anno slug ' + slug, nRows, 1);
  return sendFinalTextResponse.json(req, rows[0].details, { type: 'annoLD' });
}


async function redirToLatestRevision(srv, req, idParts) {
  const { annoId } = idParts;
  const queryTpl = ('MAX("revision_id") AS "latest"'
    + ' FROM "anno_data" WHERE "anno_id" = $1'
  );
  const reply = await srv.db.postgresSelect(queryTpl, [annoId]);
  const { latest } = reply.rows[0];
  if (!latest) { throw errNotInDb.throwable(); }
  return req.res.redirect(annoId + '~' + latest);
}


function idGet(srv, req, slug) {
  const idParts = parseAnnoSlug(slug);
  if (idParts.reviNum) { return getExactRevision(srv, req, idParts); }
  return redirToLatestRevision(srv, req, idParts);
}


export default idGet;
