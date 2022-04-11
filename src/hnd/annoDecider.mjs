// -*- coding: utf-8, tab-width: 2 -*-

import equal from 'equal-pmb';

import httpErrors from '../httpErrors.mjs';
import sendFinalTextResponse from '../finalTextResponse.mjs';

import hndUtil from './hndUtil.mjs';


const namedEqual = equal.named.deepStrictEqual;

const annoIdRgx = /^[A-Za-z0-9_\-]{10,36}$/;

function noSuchAnno(req, why) {
  const text = 'Annotation not found: ' + why;
  sendFinalTextResponse(req, { code: 404, text });
}

const searchNotImpl = httpErrors.notImpl.explain(
  'Unsupported combination of search criteria.');


const EX = async function makeAnnoDecider(srv) {

  async function annoHnd(req) {
    const urlSubDirs = hndUtil.getFirstAsteriskDirs(req);
    const { method } = req;
    if (method !== 'GET') { return httpErrors.badVerb(req); }

    // console.debug('annoHnd: urlSubDirs =', urlSubDirs);
    if (urlSubDirs.length !== 1) {
      return noSuchAnno(req, 'Subresource not implemented');
    }
    const [annoId] = urlSubDirs;
    if (!annoId) {
      const queryKeys = Object.keys(req.query);
      if (queryKeys.length) {
        return searchNotImpl(req);
      }
      return noSuchAnno(req, 'No ID given');
    }

    const idMatch = (annoIdRgx.exec(annoId) || false);
    if (idMatch[0] !== annoId) {
      return noSuchAnno(req, 'Unsupported ID format');
    }

    const reply = await srv.db.postgresSelect('"details" FROM "anno_data"'
      + ' WHERE "anno_id" = $1 LIMIT 2;', [annoId]);
    const { rows } = reply;
    const nRows = rows.length;
    if (!nRows) { return noSuchAnno(req, 'ID not in database'); }
    namedEqual('Number of rows found for anno ID ' + annoId, nRows, 1);
    return sendFinalTextResponse.json(req, rows[0].details);
  }

  return annoHnd;
};


export default EX;
