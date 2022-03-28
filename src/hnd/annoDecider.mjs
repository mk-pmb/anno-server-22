// -*- coding: utf-8, tab-width: 2 -*-

import httpErrors from '../httpErrors.mjs';
import sendFinalTextResponse from '../finalTextResponse.mjs';

import hndUtil from './hndUtil.mjs';


const annoIdRgx = /^[A-Za-z0-9_\-]{10,36}$/;


const EX = async function makeAnnoDecider() {

  function annoHnd(req) {
    const urlSubDirs = hndUtil.getFirstAsteriskDirs(req);
    const { method } = req;
    if (method !== 'GET') { return httpErrors.badMethod(req); }

    console.debug('annoHnd:', urlSubDirs);
    if (urlSubDirs.length !== 1) { return httpErrors.noSuchResource(req); }
    const [annoId] = urlSubDirs;
    const idMatch = (annoIdRgx.exec(annoId) || false);
    if (idMatch[0] !== annoId) { return httpErrors.noSuchResource(req); }

    const anno = { annoId };
    sendFinalTextResponse.json(req, anno);
  }

  return annoHnd;
};


export default EX;
