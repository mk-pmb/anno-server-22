// -*- coding: utf-8, tab-width: 2 -*-

import equal from 'equal-pmb';

import httpErrors from '../../httpErrors.mjs';
import sendFinalTextResponse from '../../finalTextResponse.mjs';

import parseVersId from './parseVersionIdentifier.mjs';
import ubhdAnnoIdFmt from './ubhdAnnoIdFmt.mjs';

const namedEqual = equal.named.deepStrictEqual;

const errNotInDb = httpErrors.noSuchAnno.explain('ID not in database');

const versionSep = ubhdAnnoIdFmt.versionNumberSeparator;


async function getExactVersion(srv, req, idParts) {
  const { versId, baseId, versNum } = idParts;
  const queryTpl = ('"details"'
    + ' FROM "anno_data" WHERE "base_id" = $1'
    + ' AND "version_num" = $2 LIMIT 2'
  );
  const reply = await srv.db.postgresSelect(queryTpl, [baseId, versNum]);
  const { rows } = reply;
  const nRows = rows.length;
  if (!nRows) { throw errNotInDb.throwable(); }
  namedEqual('Number of rows found for anno version ID ' + versId, nRows, 1);
  return sendFinalTextResponse.json(req, rows[0].details, { type: 'annoLD' });
}


async function redirToLatestVersion(srv, req, idParts) {
  const { baseId } = idParts;
  const queryTpl = ('MAX("version_num") AS "latest"'
    + ' FROM "anno_data" WHERE "base_id" = $1'
  );
  const reply = await srv.db.postgresSelect(queryTpl, [baseId]);
  const { latest } = reply.rows[0];
  if (!latest) { throw errNotInDb.throwable(); }
  return req.res.redirect(baseId + versionSep + latest);
}


function idGet(srv, req, versId) {
  const idParts = parseVersId(versId);
  if (idParts.versNum) { return getExactVersion(srv, req, idParts); }
  return redirToLatestVersion(srv, req, idParts);
}


export default idGet;
