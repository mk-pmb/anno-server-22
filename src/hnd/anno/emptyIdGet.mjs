// -*- coding: utf-8, tab-width: 2 -*-

import httpErrors from '../../httpErrors.mjs';

import verifyAnnoIdFormat from './verifyAnnoIdFormat.mjs';

const searchNotImpl = httpErrors.notImpl.explain(
  'Unsupported combination of search criteria.');


const EX = async function emptyIdGet(req) {
  const queryKeys = Object.keys(req.query);
  if (queryKeys.length) {
    return searchNotImpl(req);
  }
  return verifyAnnoIdFormat();
};


export default EX;
