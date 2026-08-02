// -*- coding: utf-8, tab-width: 2 -*-

import arrayOfTruths from 'array-of-truths';
import loMapValues from 'lodash.mapvalues';
import mergeOpt from 'merge-options';

import learnTopicDict from
  '@ubhd-as22/http-server-base/src/cfg/learnTopicDict.mjs';

import lazyMergeTruthyPropInplace from './util/lazyMergeTruthyPropInplace.mjs';
import servicesApi from './servicesApi.mjs';

const OrderedMap = Map; // to clarify where we do care.
const isNum = Number.isFinite;

function orf(x) { return x || false; }

const essentialMandatoryBool = 'bool'; /*
  This alias is just to clarify that these options are so important that
  we force users to make an explicit choice, so that we are able to detect
  when their config decision got lost by accident. */

const optionalDictObjRule = 'dictObj | undef'; /*
  Unfortunately we cannot allow `null`, because that would hide the dict
  that we may have wanted to inherit via the `INHERITS` directive.
  The loss would occurr before `learnOneService()` is even invoked, so any
  workaround there would have to partially repeat the entire `INHERITS`.
  Which is impractical, so unfortunately, you'll have to live with either
  a dummy entry in your dictionary, or useless diff noise because you'll
  have to also comment-out the name of the dictionary whenever it would
  otherwise become `null`. */


const EX = {

  async make(srv) {
    const svcs = new Map();
    Object.assign(svcs, servicesApi, {
      idByPrefix: new OrderedMap(),
      prefixReverseHostnameAliases: false,
    });
    const ctx = { srv, svcs, learnMeta: EX.learnServicesMeta };
    await learnTopicDict(ctx, 'services', EX.learnOneService);
    return svcs;
  },


  learnServicesMeta(ctx, mustPopCfgMeta) {
    const sd = EX.learnOneService(ctx, '', mustPopCfgMeta);
    ctx.topicDefaults = sd; // eslint-disable-line no-param-reassign
    mustPopCfgMeta.expectEmpty('Services defaults config key');
  },


  learnOneService(ctx, svcId, mustPopDetail) {
    const { svcs } = ctx;
    const det = {};
    if (svcId) {
      det.id = svcId;
      svcs.set(svcId, det);
    }

    function copy(prop, rules, dflt) {
      const v = mustPopDetail(rules, prop, dflt);
      if (v !== undefined) { det[prop] = v; }
      return v;
    }

    const tum = orf(copy('targetUrlMetadata',
      'dictObj' + (svcId ? '' : ' | undef | nul')));
    if (tum.forbiddenStrings) {
      const msg = ('The `forbiddenStrings` section was probably meant to be '
        + 'part of the `scopeSubUrlRules` section.');
      throw new Error(msg);
    }
    const { prefixes } = tum;
    if (svcId) {
      arrayOfTruths(prefixes).forEach(pfx => svcs.idByPrefix.set(pfx, svcId));
    } else if (prefixes !== undefined) {
      const msg = 'Services defaults must not include URL prefixes.';
      throw new Error(msg);
    }

    lazyMergeTruthyPropInplace(svcs, 'prefixReverseHostnameAliases', tum);

    EX.learnRssFeeds(ctx, svcId, prefixes,
      copy('rssFeeds', optionalDictObjRule));
    copy('annoBrowserRedirect', 'str | nul | undef');
    copy('approvalRequired', 'bool | nul | undef');
    copy('autoRequestNextVersionDoi', essentialMandatoryBool);
    copy('multiSubjAnnoBrowserRedirect', 'str | nul | undef');
    copy('staticAclMeta', optionalDictObjRule);

    mustPopDetail.expectEmpty('Unsupported leftover service config keys');
    return det;
  },


  learnRssFeeds(ctx, svcId, urlPrefixes, feedsSpec) {
    // console.debug('learnRssFeeds', { svcId }, feedsSpec);
    if (!feedsSpec) { return; }
    if (!svcId) { return; }
    const feedDefaults = ctx.mergeInheritedFragments(feedsSpec['']);
    loMapValues(feedsSpec, function learnOneRssFeed(origFeedCfg, origFeedId) {
      if (!origFeedId) { return; }
      // ^-- Empty feed ID is used for defaults.
      const feedId = origFeedId.replace(/\^/g, svcId);
      // console.debug('learnOneRssFeed:', feedId, merged);
      const merged = mergeOpt({
        staticMeta: {
          serviceId: svcId,
        },
      }, feedDefaults, ctx.mergeInheritedFragments(origFeedCfg));
      const fc = ctx.srv.rssFeeds.register(feedId, merged);
      if (!fc.prefix) { fc.prefix = 1; }
      if (isNum(fc.prefix)) { fc.prefix = urlPrefixes[fc.prefix - 1]; }
      if (!fc.prefix) {
        throw new Error('Empty URL prefix for RSS feed ' + feedId);
      }
    });
  },


};


export default EX;
