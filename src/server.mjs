// -*- coding: utf-8, tab-width: 2 -*-

import configFilesAdapter from
  '@ubhd-as22/http-server-base/src/cfg/configFilesAdapter/ad.mjs';
import installGlobalRequestExtras from
  '@ubhd-as22/http-server-base/src/hnd/globalRequestExtras.mjs';
import makeRequestBodyParser from
  '@ubhd-as22/http-server-base/src/hnd/util/parseRequestBody.mjs';
import pluginsLib from '@ubhd-as22/http-server-base/src/plugins.mjs';
import timeoutFallbackResponse from
  '@ubhd-as22/http-server-base/src/hnd/timeoutFallbackResponse.mjs';

import absDir from 'absdir';
import envcfgMergeConfigs from 'envcfg-merge-configs-pmb';
import express from 'express';
import makeHookRunner from 'hookrunner25a-pmb';
import mustBe from 'typechecks-pmb/must-be.js';
import nodeHttp from 'http';
import objPop from 'objpop';
import PrRouter from 'express-promise-router';

import dbAdapter from './dbAdapter/pg/index.mjs';
import fallbackErrorHandler from './hnd/fallbackErrorHandler.mjs';
import installListenAddrPlumbing from './listenAddrPlumbing.mjs';
import installRootRoutes from './hnd/rootRoutes.mjs';
import libDebugFlags from './cfg/debugFlags.mjs';
import loggingUtil from './hnd/util/logging.mjs';
import lusrmgr from './cfg/lusrmgr/index.mjs';
import makeGenericCorsHandler from './hnd/util/genericCorsHandler.mjs';
import prepareAcl from './acl/prepareAcl.mjs';
import prepareRssFeedsConfig from './hnd/rss/prepareConfig.mjs';
import servicesAdapter from './cfg/servicesAdapter.mjs';


const pathInRepo = absDir(import.meta, '..');

const guessDockerized = (process.getuid() === 0);

const defaultConfig = {

  envcfg_prefix: 'anno_',
  db: dbAdapter.getConfigDefaults(),
  cfgfiles: configFilesAdapter.getConfigDefaults(),
  debug_flags: '',

  listen_addr: (guessDockerized ? '0.0.0.0' : '127.0.0.1') + ':33321',
  notify_server_listening: '',
  public_baseurl: '',
  wwwpub_path: pathInRepo('wwwpub'),
  upload_size_limit: '', // default is defined in parseRequestBody

  response_timeout_sec: 5,

  ...fallbackErrorHandler.configDefaults,

};


const EX = async function createServer(customConfig) {
  const entireConfig = envcfgMergeConfigs({ ifPrefixProp: 'envcfg_prefix' },
    defaultConfig, customConfig);
  const popCfg = objPop.d(entireConfig, { mustBe }).mustBe;
  const serverDebugFlags = libDebugFlags.parseStr(popCfg('str | undef',
    'debug_flags'));
  console.debug('Server config:', entireConfig);
  if (serverDebugFlags) {
    console.warn('W: SERVER DEBUG FLAGS ENABLED!', serverDebugFlags);
  }
  popCfg('str | eeq:false', 'envcfg_prefix');
  const srv = {
    pathInRepo,
    popCfg,

    initialConfigDone() {
      popCfg.expectEmpty('Unsupported server config option(s)');
      srv.popCfg = EX.denyLateConfigRead;
    },

    configFiles: await configFilesAdapter.make({ popCfg }),
    serverDebugFlags,
    runHook: makeHookRunner(),

    ...loggingUtil.basics,
  };
  await pluginsLib.install(srv);

  const webSrv = nodeHttp.createServer();
  const app = express();
  app.set('x-powered-by', false);
  app.set('case sensitive routing', true);
  app.set('etag', false);
  app.set('strict routing', true);

  app.once('close', function cleanup(...args) {
    console.debug('cleanup:', args);
  });

  installGlobalRequestExtras(srv, app);
  app.use(timeoutFallbackResponse({
    timeoutMsec: popCfg('str | num | undef', 'response_timeout_sec') * 1e3,
  }));

  const rootRouter = PrRouter({
    strict: true,
    /* ^- Discern /session from /session/, because the trailing slash
          is relevant for relative paths.
      Beware: Doesn't fully protect sub-routes:
          https://github.com/expressjs/express/issues/2281
    */
  });
  app.use(rootRouter);
  app.use(fallbackErrorHandler.decide(popCfg, webSrv));

  Object.assign(srv, {
    getLowLevelWebServer() { return webSrv; },
    getRootRouter() { return rootRouter; },
  });
  await installListenAddrPlumbing(srv);

  srv.rssFeeds = await prepareRssFeedsConfig(srv);
  srv.services = await servicesAdapter.make(srv);
  srv.lusrmgr = await lusrmgr.make(srv);
  srv.acl = await prepareAcl(srv);
  srv.db = await dbAdapter.init({ popCfg });
  await installRootRoutes(srv);

  const confirmCorsImpl = makeGenericCorsHandler();
  srv.globalRequestExtras({
    confirmCors() { return confirmCorsImpl(this); },
    getDb() { return srv.db; },
    getSrv() { return srv; },
    serverDebugFlags,
    ...loggingUtil.requestExtras,
    ...makeRequestBodyParser.util.requestExtras(popCfg),
  });

  srv.runHook('server/installRequestHandler/before', { app, srv });
  webSrv.on('request', app);
  return srv;
};


Object.assign(EX, {

  denyLateConfigRead(expectedType, slot) {
    const err = new Error('Late attempt to read server config');
    Object.assign(err, { expectedType, slot });
    throw err;
  },


});


export default EX;
