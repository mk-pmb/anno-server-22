// -*- coding: utf-8, tab-width: 2 -*-

import getOwn from 'getown';
import objPop from 'objpop';
import pMap from 'p-map';

import categorizeTargets from '../categorizeTargets.mjs';
import detectUserIdentity from '../../../acl/detectUserIdentity.mjs';
import fmtAnnosAsRssFeed from '../fmtAnnosAsRssFeed.mjs';
import genericAnnoMeta from '../redundantGenericAnnoMeta.mjs';
import httpErrors from '../../../httpErrors.mjs';
import miscMetaFieldInfos from '../miscMetaFieldInfos.mjs';
import parseStampRows from '../parseStampRows.mjs';
import stampUtil from '../util/stampUtil.mjs';
import stopwatchUtil from '../../util/stopwatchUtil.mjs';

import buildSearchQuery from './buildSearchQuery.mjs';
import qryTpl from './queryTemplates/index.mjs';

const {
  fubar,
  noSuchResource,
} = httpErrors.throwable;



function uts2iso(u) { return (new Date((+u || 0) * 1e3)).toISOString(); }

function ores(x) { return x || ''; }

function numOr0(x) { return (+x || 0); }
function posOr0(n) { return (n > 0 ? n : 0); }
function nonNegNum(x) { return posOr0(numOr0(x)); }


const EX = async function multiSearch(ctx) {
  const stopwatch = { ZERO: Date.now() };
  const { srv, req } = ctx;
  const {
    latestVersionOnly,
    overrideSearchTmpl,
    reviverOpts: customReviverOpts,
    searchAllWithStamp,
    searchBaseId,
    skipAcl,
    subjTgtSpec,
    untrustedOpt,
  } = ctx;

  const popUntrustedOpt = objPop(untrustedOpt, {
    leftoversErrCls: noSuchResource,
    leftoversMsg: 'Unsupported criterion qualifier',
  });

  await (skipAcl || srv.acl.requirePerm(req, {
    privilegeName: 'discover',
    targetUrl: subjTgtSpec,
  }));

  const debugHints = req.userFacingErrorDebugHints;
  debugHints.stopWatch = stopwatchUtil.durations.bind(null, stopwatch);
  stopwatch.earlyAcl = Date.now();

  const [outFmtMain, ...outFmtSub] = ores(ctx.outFmt
    || popUntrustedOpt('fmt')).split(/:/);
  const meta = {
    outFmtMain,
    outFmtSub,
    subjTgtSpec: ores(subjTgtSpec),
    aclAdditionalTargetUrls: [],
  };

  EX.miscUntrustedMetaOptNames.forEach(function maybeCopy(k) {
    const v = popUntrustedOpt(k);
    if (v !== undefined) { meta[k] = v; }
  });

  const search = buildSearchQuery.prepare('#defaultSearchCore');
  if (searchBaseId) { search.data({ searchBaseId }); }

  (function parseOptions() {
    const optCtx = { ctx, search, meta, popUntrustedOpt };
    EX.processLimitAndRssOptionsInplace(optCtx);
  }());

  if (searchAllWithStamp) {
    const st = stampUtil.splitStampNameNS(searchAllWithStamp, noSuchResource);
    await (skipAcl || srv.acl.requirePerm(req, {
      privilegeName: 'search_hasStamp_' + st.aclStampName,
      targetUrl: subjTgtSpec,
    }));
    stopwatch.stampAcl = Date.now();
    search.tmpl('inquiryType', '#inquiryAllWithStamp');
    search.data('searchStampName', st.stType);
  }

  const delayedPrivilegeChecks = new Set();

  if (subjTgtSpec) {
    const byPrefix = subjTgtSpec.endsWith('/*') && subjTgtSpec.slice(0, -1);
    const cmp = (byPrefix ? 'Prefix' : 'Exact');
    search.tmpl('inquiryType', qryTpl.inquiryLink('subject', cmp));
    search.data('byLinkUrl', byPrefix || subjTgtSpec);
  }

  function addRequiredPrivilege(privilegeName) {
    if (skipAcl) { return; }
    if (!subjTgtSpec) { return delayedPrivilegeChecks.add(privilegeName); }
    return srv.acl.requirePerm(req, { privilegeName, targetUrl: subjTgtSpec });
  }

  const annoReviverOpts = { ...customReviverOpts };

  const { asRoleName } = req;
  let validRole = !asRoleName;

  if (asRoleName === 'approver') {
    validRole = true;
    await addRequiredPrivilege('stamp_any_add_dc_dateAccepted');
    search.tmpl('visibilityWhere', '#visibilityAny');
  }

  let userId = null;
  if (asRoleName === 'author') {
    validRole = true;
    userId = ores((await detectUserIdentity.andDetails(req)).userId);
    search.tmpl('visibilityWhere', '#visibilityAuthorMode');
    search.data('rqUserId', userId);
    annoReviverOpts.lowlineStamps = {};
  }

  if (!validRole) { throw noSuchResource('Unsupported role name'); }

  if (latestVersionOnly) { search.wrapSeed('latestVersionOnly'); }
  search.wrapSeed('orderedSearch');
  search.tmplIf(ctx.rowsLimit, 'orderedSearchLimit');

  search.tmpl('orderByTimeDirection', (function decide() {
    if (popUntrustedOpt('oldestFirst')) { return 'ASC'; }
    if (ctx.rowsLimit) { return 'DESC'; }
    return 'ASC';
  }()));

  const contentMode = EX.decideContentMode({ ctx, meta, popUntrustedOpt });
  if (contentMode.priv) {
    // Always delay:
    //  * To validate read (or similar) on all targets,
    //  * For ACL preview.
    delayedPrivilegeChecks.add(contentMode.priv);
    meta.aclAdditionalTargetUrls.push(subjTgtSpec);
    if (asRoleName) {
      // ^-- i.e., client can be expected to tolerate our custom fields.
      delayedPrivilegeChecks.aclPreviewPriv = contentMode.priv;
      const apre = {}; // ACL preview container
      apre[''] = { userId };
      meta.extraTopFields = { [miscMetaFieldInfos.subjTgtAclField]: apre };
      delayedPrivilegeChecks.aclPreviewBySubjectTargetUrl = apre;
    }
  }
  if (contentMode.wrap) { search.wrapSeed(contentMode.wrap); }
  if (!contentMode.hasSubjs) { search.wrapSeed('addSubjectTargetRelUrls'); }

  search.tmpl(overrideSearchTmpl);

  popUntrustedOpt.expectEmpty();

  stopwatch.prep = Date.now();
  const found = await search.selectAll(srv);
  stopwatch.db = Date.now();
  debugHints.nResults = found.length;
  // console.debug('subjectTarget: found =', found, '</</ subjTgt found');

  Object.assign(found, {

    meta,

    toFullAnnos() {
      const a = found.map(r => EX.resultToFullAnno(srv, annoReviverOpts, r));
      a.meta = found.meta;
      return a;
    },

  });

  await (skipAcl || EX.checkSubjTgtAcl(srv, req,
    delayedPrivilegeChecks, found));
  stopwatch.lateAcl = Date.now();

  stopwatch.packaged = Date.now();
  meta.stopwatchDurations = debugHints.stopWatch();
  meta.stopwatchDurations += ', nResults=' + found.length;
  return found;
};



Object.assign(EX, {

  contentModeDetails: {
    full:         { priv: 'read', wrap: 'addFullContent', hasSubjs: true },
    justTitles:   { priv: 'read', wrap: 'addAnnoTitle' },
  },


  defaultContentMode: 'full',


  decideContentMode(how) {
    const { ctx, meta } = how; // , popUntrustedOpt
    // console.debug('decideContentMode:', { ctx_rC: ctx.readContent });
    let cm = ctx.readContent || EX.defaultContentMode;
    if (cm === 'full') {
      const { just } = meta;
      if (just === 'title') { cm = 'justTitles'; }
      // console.debug('decideContentMode:', { just, cm });
    }
    // console.debug('getOwn?', { cm });
    cm = getOwn(EX.contentModeDetails, cm);
    // console.debug('gotOwn!', { cm });
    if (!cm) { throw noSuchResource('Unsupported content mode option'); }
    return cm;
  },


  async checkSubjTgtAcl(srv, req, privNamesSet, found) {
    const privNames = Array.from(privNamesSet);
    if (!privNames.length) { return; }

    const {
      aclAdditionalTargetUrls,
    } = found.meta;
    const foundSubjTgtUrls = found.map(function findSubjectTargets(rec) {
      const subj = rec.subject_target_rel_urls;
      if (subj) { return subj; }
      if (!rec.details) {
        const [baseId, versNum] = rec.versid;
        const msg = `No details for annotation with ID ${baseId} v${
          versNum} while checking privileges {${privNames.join(', ')}}`;
        throw new Error(msg);
      }
      return categorizeTargets(srv, rec.details,
        { errInvalidAnno: fubar }).subjTgtUrls;
    }).flat();
    const allSubjTgtUrls = [
      ...foundSubjTgtUrls,
      ...aclAdditionalTargetUrls,
    ].filter(Boolean);
    if (!allSubjTgtUrls.length) { return; }

    const { aclPreviewPriv, aclPreviewBySubjectTargetUrl } = privNamesSet;
    await pMap(privNames, async function check(privilegeName) {
      const aclMetaSpy = ((privilegeName === aclPreviewPriv)
        && { aclPreviewBySubjectTargetUrl });
      await srv.acl.requirePermForAllTargetUrls(req,
        allSubjTgtUrls, // <-- No need to de-dupe, it will be done internally.
        { privilegeName, aclMetaSpy });
    });
  },


  resultToFullAnno(srv, opts, rec) {
    const idParts = { baseId: rec.base_id, versNum: rec.version_num }; /*
      Unfortunately, rec.versid is a plain string with a format like
      '(unquoted-base-id,1)', so we'd need to actually parse it to use that.
      Fortunately, we've already extracted its parts into separate columns. */

    const { lowlineStamps } = opts;
    const stamps = parseStampRows(rec.stamps, { lowlineStamps });
    // console.debug('rec:', rec, 'stamps:', stampInfos);
    let fullAnno = {
      'dc:title': rec.title,
      created: rec.time_created.toISOString(),
      ...rec.details,
    };
    if (!opts.omitGenericMeta) {
      fullAnno = genericAnnoMeta.add(srv, idParts, fullAnno);
    }
    Object.assign(fullAnno, {
      ...stamps,
      ...lowlineStamps,
      // xDisclosed: rec.disclosed,
      // xSunny: rec.sunny,
    });
    delete fullAnno[miscMetaFieldInfos.unapprovedStampName];
    if (!rec.disclosed) { fullAnno['dc:dateAccepted'] = false; }
    if (!rec.sunny) { fullAnno['as:deleted'] = uts2iso(rec.sunset_uts); }
    return fullAnno;
  },


  processLimitAndRssOptionsInplace(how) {
    const { ctx, meta, popUntrustedOpt } = how;
    const { outFmtMain, outFmtSub } = meta;
    const giveRss = (outFmtMain === 'rss');

    let max = Infinity;
    if (giveRss) {
      max = (+ctx.rssMaxItems || -1);
      if (max === -1) { max = fmtAnnosAsRssFeed.defaultMaxItems; }
    }

    const userLimit = nonNegNum(popUntrustedOpt('limit'));
    if ((userLimit >= 1) && (userLimit < max)) { max = userLimit; }
    const origRowsLimit = (+ctx.rowsLimit || 0);
    if ((origRowsLimit >= 1) && (origRowsLimit < max)) { max = origRowsLimit; }
    if (max !== Infinity) { ctx.rowsLimit = max; }

    if (!giveRss) { return; }

    ctx.readContent = 'justTitles';
    // ^- It would be nice if we could also populate the RSS <author> and
    //    <description> fields, but generating them is too much effort.

    const [fmtSub1] = outFmtSub;
    if (fmtSub1 === 'vh') { meta.rssMode = 'version-history'; }
  },


});


EX.miscUntrustedMetaOptNames = [
  'debugSql', // <- Report will be empty without the proper server debug flags.
  'just',
  'scaleTargetHeight',
  'scaleTargetWidth',
];











export default EX;
