// -*- coding: utf-8, tab-width: 2 -*-

import libDoi from 'doi-utils-pmb';
import getOwn from 'getown';

import decideAuthorIdentity from '../postNewAnno/decideAuthorIdentity.mjs';
import httpErrors from '../../../httpErrors.mjs';
import lookupExactVersion from '../idGet/lookupExactVersion.mjs';
import miscMetaFieldInfos from '../miscMetaFieldInfos.mjs';
import parseDatePropOrFubar from '../../util/parseDatePropOrFubar.mjs';
import stampUtil from '../util/stampUtil.mjs';

import approvalDecisionSideEffects from './approvalDecisionSideEffects.mjs';
import deleteDoiRequestStamp from './deleteDoiRequestStamp.mjs';


const {
  notImpl,
  stateConflict,
} = httpErrors.throwable;


const doNothing = Boolean;

function orf(x) { return x || false; }

function popEffTs(pop) {
  let eff = pop('str | undef', 'when');
  eff = (eff && parseDatePropOrFubar(eff).jsDate);
  return (eff && { st_effts: eff });
}


const EX = async function addStamp(ctx) {
  const stRec = {
    base_id: ctx.idParts.baseId,
    version_num: ctx.idParts.versNum,
    st_effts: null,
    st_detail: null,
  };
  const stParsed = await ctx.catchBadInput(function parse(mustPopInput) {
    const stType = mustPopInput('nonEmpty str', 'type');
    stRec.st_type = stType;
    const splat = stampUtil.splitStampNameNS(stType, notImpl);
    const popMore = getOwn(EX.addStampParseDetails, splat.aclStampName);
    if (popMore) { Object.assign(stRec, popMore(mustPopInput)); }
    let det;

    if (stType === miscMetaFieldInfos.doiStampName) {
      const doi = libDoi.expectBareDoi(mustPopInput('nonEmpty str', 'doi'));
      det = libDoi.toUri(doi);
    }

    if (det !== undefined) { stRec.st_detail = JSON.stringify(det); }
    mustPopInput.expectEmpty();
    return splat;
  });
  const { aclStampName, stType } = stParsed;

  const guessRole = getOwn(EX.roleByStamp, stType);
  if (guessRole) { ctx.req.asRoleName = guessRole; }
  Object.assign(ctx, await lookupExactVersion(ctx));
  const author = decideAuthorIdentity.fromAnnoCreator(ctx.annoDetails,
    ctx.who);

  const privName = ('stamp_' + (author.authorized ? 'own' : 'any')
    + '_add_' + aclStampName);
  await ctx.requireAdditionalReadPrivilege(privName);
  stRec.st_by = (ctx.who.userId || '');
  stRec.st_at = (new Date()).toISOString();
  ctx.mainStampRec = stRec;

  const stampFx = orf(getOwn(EX.stampFx, stType));
  // console.debug('addStamp: prepare:', ctx.mainStampRec);
  await (stampFx.prepareAdd || doNothing)(ctx);

  // console.debug('addStamp: main:', ctx.mainStampRec);
  ctx.hadDupeError = false;
  await ctx.srv.db.postgresInsertOneRecord('anno_stamps', stRec, {
    customDupeError(err) {
      ctx.hadDupeError = err;
      return 'ignore';
    },
  });

  // console.debug('addStamp: cleanup:', ctx.mainStampRec);
  await (stampFx.cleanupAfterAdd || doNothing)(ctx);
  // console.debug('addStamp: done:', ctx.mainStampRec);

  if (ctx.hadDupeError) { EX.dupeStamp(); }
  return { st_at: stRec.st_at };
};


Object.assign(EX, {

  dupeStamp() { throw stateConflict('A stamp of this type already exists'); },

  roleByStamp: {
    'as:deleted':         'approver',
    'dc:dateApproved':    'approver',
  },


  addStampParseDetails: {
    as_deleted: popEffTs,
  },


  stampFx: {
    [miscMetaFieldInfos.doiStampName]: deleteDoiRequestStamp,
    'dc:dateAccepted': approvalDecisionSideEffects,
  },


});



export default EX;
