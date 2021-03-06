// -*- coding: utf-8, tab-width: 2 -*-

import express from 'express';

import eternal from './wrap/eternal.mjs';
import hndUtil from './hndUtil.mjs';
import httpErrors from '../httpErrors.mjs';
import logIncomingRequest from './logIncomingRequest.mjs';
import makeAnnoRoute from './anno/route.mjs';
import makeSessionRoute from './sess/route.mjs';
import simpleFilenameRedirector from './simpleFilenameRedirector.mjs';
import siteLocalReservedRoutes from './siteLocalReservedRoutes.mjs';


const EX = async function installRootRoutes(srv) {
  const rt = srv.getRootRouter();
  const { popCfg } = srv;

  rt.use(logIncomingRequest);

  const serveFile = express.static(popCfg('nonEmpty str', 'wwwpub_path'));
  rt.use('/static/favicon.ico', eternal());
  rt.use('/static', serveFile);
  rt.get('/', hndUtil.makeRedirector('/static/'));

  rt.use('/session/*', await makeSessionRoute(srv));
  rt.use('/anno/*', await makeAnnoRoute(srv));
  siteLocalReservedRoutes.installRoutes(rt);

  rt.get('/:filename', eternal(simpleFilenameRedirector('/static/:filename')));


  // If no previous route has matched, default to:
  rt.use(httpErrors.noSuchResource);
};


export default EX;
