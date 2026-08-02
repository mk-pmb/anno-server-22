// -*- coding: utf-8, tab-width: 2 -*-

import getOwn from 'getown';

import detectUserIdentity from '../../../acl/detectUserIdentity.mjs';
import httpErrors from '../../../httpErrors.mjs';
import sendFinalTextResponse from '../../../finalTextResponse.mjs';

import addStamp from './addStamp.mjs';

const {
  notImpl,
} = httpErrors.throwable;


const actionHandlers = {
  addStamp,
};


const EX = async function patchAnno(ctx) {
  const { req } = ctx;
  const fancyBody = await req.parseRequestBody({ fmt: 'json', fancy: true });
  Object.assign(ctx, fancyBody);
  await ctx.catchBadInput(function parse(mustPopInput) {
    ctx.action = mustPopInput('nonEmpty str', 'action');
  });
  const hnd = getOwn(actionHandlers, ctx.action);
  if (!hnd) { throw notImpl('Unknown PATCH action'); }
  ctx.who = await detectUserIdentity(req);
  const result = await hnd(ctx);
  if (result !== undefined) { sendFinalTextResponse.json(req, result); }
};


export default EX;
