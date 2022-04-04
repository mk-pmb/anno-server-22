// -*- coding: utf-8, tab-width: 2 -*-

import equal from 'equal-pmb';

import httpErrors from '../httpErrors.mjs';
import sendFinalTextResponse from '../finalTextResponse.mjs';

import hndUtil from './hndUtil.mjs';


const namedEqual = equal.named.deepStrictEqual;

const annoIdRgx = /^[A-Za-z0-9_\-]{10,36}$/;


const EX = async function makeAnnoDecider(srv) {

  function annoHnd(req) {
    const urlSubDirs = hndUtil.getFirstAsteriskDirs(req);
    const { method } = req;
    if (method !== 'GET') { return httpErrors.badMethod(req); }

    console.debug('annoHnd:', urlSubDirs);
    if (urlSubDirs.length !== 1) { return httpErrors.noSuchResource(req); }
    const [annoId] = urlSubDirs;
    const idMatch = (annoIdRgx.exec(annoId) || false);
    if (idMatch[0] !== annoId) { return httpErrors.noSuchResource(req); }

    console.debug('annoHnd: srv.db:', srv.db);
    const reply = srv.db.postgresSelect('"details" FROM "anno_data"'
      + ' WHERE "anno_id" = $1 LIMIT 2;', [annoId]);
    const { rows } = reply;
    const nRows = rows.length;
    if (!nRows) { return httpErrors.noSuchResource(req); }
    namedEqual('Number of rows found for anno ID ' + annoId, nRows, 1);
    return sendFinalTextResponse.json(req, rows[0].details);
  }

  return annoHnd;
};


export default EX;
