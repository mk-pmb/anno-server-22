// -*- coding: utf-8, tab-width: 2 -*-

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
      return httpErrors.notImpl.explain(req,
        'Anno subresource not implemented');
    }
    const [annoId] = urlSubDirs;
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
    if (method === 'GET') { return idGet(srv, req, annoId); }

    return httpErrors.badVerb(req);
  },


});


export default EX;
