// -*- coding: utf-8, tab-width: 2 -*-

import equal from 'equal-pmb';
import guessAndParseSubjectTargetUrl
  from 'webanno-guess-subject-target-url-pmb/extra/parse.mjs';

import acl from '../../acl/index.mjs';
import httpErrors from '../../httpErrors.mjs';
import parseAnnoSlug from './parseAnnoSlug.mjs';
import sendFinalTextResponse from '../../finalTextResponse.mjs';

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
  const { details } = rows[0];

  const subjTgt = guessAndParseSubjectTargetUrl(details);
  // ^-- Using parse because it includes safety checks.
  (await acl(srv, req, { targetUrl: subjTgt.url })).requirePerm('read');
  return sendFinalTextResponse.json(req, details, { type: 'annoLD' });
}


async function redirToLatestRevision(srv, req, idParts) {
  const { annoId } = idParts;
  // :ATTN:ACL: Currently no ACL checks for this lookup.
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
