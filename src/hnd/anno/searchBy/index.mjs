// -*- coding: utf-8, tab-width: 2 -*-

import getOwn from 'getown';
import objPop from 'objpop';
import qrystr from 'qrystr';
import splitStringOnce from 'split-string-or-buffer-once-pmb';

import fmtAnnoCollection from '../fmtAnnosAsSinglePageCollection.mjs';
import fmtAnnosAsIiif3 from '../fmtAnnosAsIiif3.mjs';
import fmtAnnosAsRssFeed from '../fmtAnnosAsRssFeed.mjs';
import httpErrors from '../../../httpErrors.mjs';
import sendFinalTextResponse from '../../../finalTextResponse.mjs';

import multiSearch from './multiSearch.mjs';


const unsupportedCriterion = httpErrors.notImpl.explain(
  'Search criterion not implemented.').throwable;
const missingCriterionParam = httpErrors.noSuchResource.explain(
  'Search criterion requires a parameter.').throwable;
const outFmtUnsupported = httpErrors.notImpl.explain(
  'Requested output format is not currently supported.').throwable;


function orf(x) { return x || false; }


function apacheSlashes(sub) {
  let url = sub.join('/');

  // Some reverse proxies like our Apache normalize double slashes,
  // mangling the URL. We could document how to configure them properly,
  // … or we can just cheat-fix it:
  url = url.replace(/^(\w+:\/)(?!\/)/, '$1/');

  return url;
}


const EX = async function searchBy(pathParts, req, srv) {
  const [critSpec, ...subPathParts] = pathParts;
  const [criterion, query] = (splitStringOnce(';', critSpec) || [critSpec]);
  const searchHnd = getOwn(EX.searchHandlers, criterion);
  if (!searchHnd) { throw unsupportedCriterion(); }
  const untrustedOpt = (Boolean(query)
    && qrystr.parse(query.replace(/;/g, '&')));
  return searchHnd({ req, srv, untrustedOpt }, subPathParts);
};


async function fmtColl(ctx, rawSearchResults) {
  if (EX.maybeDebugSqlInstead(ctx, rawSearchResults)) { return; }
  const { meta } = rawSearchResults;
  const popMeta = objPop.d(meta);
  const extraTopFields = popMeta('extraTopFields') || {};

  let note = (extraTopFields['skos:note'] || '');
  if (note) { note += '\n'; }
  note += String(popMeta('stopwatchDurations'));
  extraTopFields['skos:note'] = note;

  const fmtHnd = getOwn(EX.outFmtHandlers, meta.outFmtMain || '');
  if (!fmtHnd) { throw outFmtUnsupported(); }
  const annos = rawSearchResults.toFullAnnos();
  annos.getRawSearchResults = Object.bind(null, rawSearchResults);
  return fmtHnd({ ...ctx, annos, extraTopFields });
}


function makeSubPathUrlSearch(pathKey, customOpt) {
  const opt = {
    latestVersionOnly: true,
    readContent: 'full',
    rssMaxItems: -1,
    ...customOpt,
  };
  const f = async function subPathUrlSearch(ctx, subPathParts) {
    const sub = apacheSlashes(subPathParts);
    if (!sub) { throw missingCriterionParam(); }
    const found = await multiSearch({ ...ctx, ...opt, [pathKey]: sub });
    return fmtColl(ctx, found);
  };
  Object.assign(f, { pathKey });
  return f;
}


Object.assign(EX, {


  searchHandlers: {
    has_stamp: makeSubPathUrlSearch('searchAllWithStamp'),
    subject_target: makeSubPathUrlSearch('subjTgtSpec'),
  },


  outFmtHandlers: {
    '': fmtAnnoCollection.replyToRequest,
    count: fmtAnnoCollection.replyToRequest,
    iiif3: fmtAnnosAsIiif3.replyToRequest,
    rss(how) { return fmtAnnosAsRssFeed({ ...EX.defaultRssOpt, ...how }); },
  },


  defaultRssOpt: { feedTitle: 'Search' },


  maybeDebugSqlInstead(ctx, rawSearchResults) {
    const { debugSql } = rawSearchResults.meta;
    if (!debugSql) { return false; }
    const info = orf(rawSearchResults.sqlDebugInfo); /*
      ^-- This will be empty unless the proper server debug flags are set. */
    let args = JSON.stringify(orf(info.args), null, 2);
    args = args.replace(/\n\s*/g, ' ');
    const report = (String(info.query || '') + ' -- args: ' + args + '\n');
    sendFinalTextResponse(ctx.req, { text: report, type: 'plain' });
    return true;
  },



});


export default EX;
