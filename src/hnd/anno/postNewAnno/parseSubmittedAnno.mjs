// -*- coding: utf-8, tab-width: 2 -*-

import arrayOfTruths from 'array-of-truths';
import loMapValues from 'lodash.mapvalues';
import mustBe from 'typechecks-pmb/must-be';

import redundantGenericAnnoMeta from '../redundantGenericAnnoMeta.mjs';

import fixLocalUrlFieldsInplace from './fixLocalUrlFieldsInplace.mjs';


const verbatimCopyKeysMandatedByProtocol = [
  'canonical',
];

const alwaysDiscardFields = [
  'iana:version-history',
];

const potentialSingleElementArraysToUnpack = [
  'rights',
  'type',
];


function maybeWrapId(rec) {
  if (typeof rec === 'string') { return { id: rec }; }
  return rec;
}


function orf(x) { return x || false; }


const baseUtil = {
  bindAllTo(o, ...a) { return loMapValues(o, v => v.bind(...a)); },
  loMapValues,
  maybeWrapId,
  orf,
};


const EX = async function parseSubmittedAnno(mustPopInput, cfg, psaCtx) {
  const anno = {};
  const util = baseUtil.bindAllTo(EX.util, null, { anno, mustPopInput });
  const { req } = psaCtx;
  const srv = req.getSrv();
  const hookCtx = { anno, cfg, ...baseUtil, ...util, srv, req, tmp: {} };
  await srv.runHook('submitAnno/parse/before', hookCtx);

  redundantGenericAnnoMeta.mustPopAllStatic(mustPopInput);
  await srv.runHook('submitAnno/parse/extraFields/early', hookCtx);
  alwaysDiscardFields.forEach(k => mustPopInput('any', k));

  verbatimCopyKeysMandatedByProtocol.forEach(k => util.copy(k, 'str | undef'));
  util.copy('id', 'nonEmpty str | undef');

  if (cfg.extraCopyFields) {
    loMapValues(cfg.extraCopyFields, (rule, key) => util.copy(key, rule));
  }

  util.copy('as:audience', 'obj | ary | nonEmpty str | undef');
  util.copy('as:context', 'obj | ary | nonEmpty str | undef');
  util.copy('creator', 'obj | ary | nonEmpty str | undef');
  util.copy('dc:isVersionOf', 'nonEmpty str | undef');
  util.copy('dc:language', 'nonEmpty str | undef');
  util.copy('dc:replaces', 'nonEmpty str | undef');
  util.copy('dc:title', 'nonEmpty str');
  util.copy('rights', 'nonEmpty str | undef');

  util.parseResource('target');
  util.parseResource('body');
  anno.target.forEach(EX.sanityCheckTarget);

  const typeDecl = util.neStrList('type');
  if (!typeDecl.includes('Annotation')) {
    throw new Error('Field "type" must include "Annotation".');
  }

  const motivations = util.neStrList('motivation');
  const inReplyTo = util.neStrList('as:inReplyTo');

  const motiReply = motivations.includes('replying');
  if (motiReply && (!inReplyTo.length)) {
    const msg = ('For annotation with motivation "replying"'
      + ' we expect to also see "as:inReplyTo".');
    throw new Error(msg);
  }
  if (inReplyTo.length && (!motiReply)) {
    const msg = ('For annotation with "as:inReplyTo"'
      + ' we expect to also see motivation "replying".');
    throw new Error(msg);
  }

  potentialSingleElementArraysToUnpack.forEach(util.unpackSingleElementArray);

  await srv.runHook('submitAnno/parse/extraFields/late', hookCtx);
  mustPopInput.expectEmpty('Unsupported annotation field');

  fixLocalUrlFieldsInplace(cfg, anno);
  await srv.runHook('submitAnno/parse/after', hookCtx);
  return anno;
};


EX.util = {

  copy(utilCtx, key, rule) {
    const { anno, mustPopInput } = utilCtx;
    const val = mustPopInput(rule, key);
    if (val !== undefined) { anno[key] = val; }
  },

  neStrList(utilCtx, key) {
    const { anno, mustPopInput } = utilCtx;
    const list = arrayOfTruths.ifAny(
      mustPopInput('ary | nonEmpty str | undef', key));
    if (!list) { return ''; }
    // ^-- using empty string b/c it's false-y but still supports .includes().
    list.forEach((x, i) => mustBe.nest(key + '[' + i + ']', x));
    anno[key] = list;
    return list;
  },

  parseResource(utilCtx, key) {
    const { anno, mustPopInput } = utilCtx;
    const spec = mustPopInput('obj | ary | nonEmpty str | undef', key);
    const list = arrayOfTruths(spec).map(maybeWrapId);
    if (!list.length) {
      throw new RangeError('Annotation needs at least one ' + key);
    }
    anno[key] = list;
  },

  unpackSingleElementArray(utilCtx, k) {
    const { anno } = utilCtx;
    const v = anno[k];
    if (Array.isArray(v) && (v.length === 1)) { [anno[k]] = v; }
  },

};


Object.assign(EX, {

  sanityCheckTarget(tgt) {
    const sel = orf(tgt.selector);
    if (sel.type === 'SvgSelector') {
      if (!/\d/.test(sel.value)) {
        throw new Error('Refusing SvgSelector that contains no numbers.');
      }
    }
  },

});


export default EX;
