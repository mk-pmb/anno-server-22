// -*- coding: utf-8, tab-width: 2 -*-

import httpErrors from '../../httpErrors.mjs';
import requestDebugHandler from '../debugRequest.mjs';
// import sendFinalTextResponse from '../../finalTextResponse.mjs';

import hndUtil from '../hndUtil.mjs';


const EX = async function makeSessionRoute() {

  const redirectToWhoami = hndUtil.makeRedirector('whoami');

  function sessionHnd(req) {
    const subUrl = hndUtil.getFirstAsteriskUrlPart(req);
    if (subUrl === 'login') {
      // This route is meant to be protected by a mandatory login
      // requirement in a reverse proxy.
      return redirectToWhoami(req);
    }
    if (subUrl === 'whoami') {
      return requestDebugHandler(req);
    }
    return httpErrors.noSuchResource(req);
  }

  return sessionHnd;
};


export default EX;
