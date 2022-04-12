// -*- coding: utf-8, tab-width: 2 -*-

import hndUtil from '../hndUtil.mjs';
import httpErrors from '../../httpErrors.mjs';
import idGet from './idGet.mjs';
import verifyAnnoIdFormat from './verifyAnnoIdFormat.mjs';


const searchNotImpl = httpErrors.notImpl.explain(
  'Unsupported combination of search criteria.');


const EX = async function makeAnnoRoute(srv) {
  function rt(req) { return EX.annoRoute(req, srv); }
  return rt;
};

Object.assign(EX, {

  async annoRoute(req, srv) {
    const urlSubDirs = hndUtil.getFirstAsteriskDirs(req);
    const { method } = req;
    if (method !== 'GET') { return httpErrors.badVerb(req); }

    // console.debug('annoHnd: urlSubDirs =', urlSubDirs);
    if (urlSubDirs.length !== 1) {
      return httpErrors.notImpl.explain(req,
        'Anno subresource not implemented');
    }
    const [annoId] = urlSubDirs;
    if (!annoId) {
      const queryKeys = Object.keys(req.query);
      if (queryKeys.length) {
        return searchNotImpl(req);
      }
      return verifyAnnoIdFormat(annoId);
    }

    return idGet(annoId, req, srv);
  },

});


export default EX;
