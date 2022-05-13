// -*- coding: utf-8, tab-width: 2 -*-

import getOwn from 'getown';
import conciseValuePreview from 'concise-value-preview-pmb';

import emptyIdGet from './emptyIdGet.mjs';
import hndUtil from '../hndUtil.mjs';
import httpErrors from '../../httpErrors.mjs';
import idGet from './idGet.mjs';
import sendFinalTextResponse from '../../finalTextResponse.mjs';


const EX = async function makeAnnoRoute(srv) {
  function rt(req) { return EX.annoRoute(req, srv); }
  return rt;
};


Object.assign(EX, {

  async annoRoute(req, srv) {
    srv.confirmCors(req);
    if (req.method === 'OPTIONS') { return; }
    const urlSubDirs = hndUtil.getFirstAsteriskDirs(req);
    // console.debug('annoHnd: urlSubDirs =', urlSubDirs);
    if (urlSubDirs.length !== 1) {
      return httpErrors.notImpl.explain('Anno subresource not implemented'
        + urlSubDirs[0])(req);
    }
    const [annoId] = urlSubDirs;
    // req.logCkp('annoRoute', { method, annoId });
    if (annoId) { return EX.annoIdRoute(srv, req, annoId); }
    return EX.emptyIdRoute(srv, req);
  },


  async emptyIdRoute(srv, req) {
    const { method } = req;
    if (method === 'GET') { return emptyIdGet(srv, req); }

    return httpErrors.badVerb(req);
  },


  async annoIdRoute(srv, req, annoId) {
    const { method } = req;
    const fx = (getOwn(EX, method.toLowerCase() + '_' + annoId)
      || getOwn(EX, 'other_' + annoId));
    req.logCkp('annoIdRoute fx:', conciseValuePreview(fx));
    if (fx) { return fx(srv, req, annoId); }
    if (method === 'GET') { return idGet(srv, req, annoId); }
    return httpErrors.badVerb(req);
  },


  async post_acl(srv, req) {
    return sendFinalTextResponse.json(req, { stub: true });
  },


});


export default EX;
