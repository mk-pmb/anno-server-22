// -*- coding: utf-8, tab-width: 2 -*-

import getOwn from 'getown';
import loMapValues from 'lodash.mapvalues';
import mustBe from 'typechecks-pmb/must-be';
import objPop from 'objpop';
import vTry from 'vtry';


const msecPerMinute = 6e4;


const EX = function learnIdentityDetectors(acl, idSrcCfgDict) {
  if (!idSrcCfgDict) { return; }
  const idSrcOrder = Object.keys(idSrcCfgDict).sort();
  idSrcOrder.forEach(function dareLearn(idSrcName) {
    const details = getOwn(idSrcCfgDict, idSrcName);
    const popDetail = objPop(details, { mustBe }).mustBe;
    const ctx = { acl, idSrcName, popDetail };
    const detector = vTry(EX.learnOneIdSrc,
      'Configure identity soource ' + idSrcName)(ctx);
    acl.identityDetectors.push(detector);
  });
};


Object.assign(EX, {

  learnOneIdSrc(ctx) {
    const { popDetail } = ctx;
    const mtd = popDetail('nonEmpty str', 'method');
    const fac = getOwn(EX.idSrcFactories, mtd);
    if (!fac) { throw new Error('Unsupported method: ' + mtd); }
    const detector = fac(ctx);
    popDetail.done('Unsupported config option(s)');
    return detector;
  },


  firstNonEmptyHeader(req, list) {
    return (req === list);
  },


  idSrcFactories: {

    cookie(ctx) {
      const prefix = ctx.popDetail('nonEmpty str', 'cookie_name') + '=';
      return function detectIdentityCookie(req) {
        let report = false;
        const cookies = (req.header('cookie') || '').split(/;\s*/);
        cookies.forEach(function maybe(ck) {
          if (report) { return; }
          if (!ck.startsWith(prefix)) { return; }
          const un = decodeURIComponent(ck.slice(prefix.length));
          if (!un) { return; }
          if (un === '-') {
            report = { userId: '' };
            return;
          }
          report = { userId: un };
        });
        const soon = Date.now() + (10 * msecPerMinute);
        return (report && {
          ...report,
          renewalAvailableBefore: soon,
          sessionExpiryHardLimit: soon,
        });
      };
    },


    headers(ctx) {
      const headerNamesLists = {};

      function popHeaderNamesList(key, convert) {
        const orig = ctx.popDetail('nonEmpty str | nonEmpty ary', key);
        const list = [].concat(orig || []);
        list.convert = convert;
        headerNamesLists[key] = list;
      }

      popHeaderNamesList('userId', String);
      popHeaderNamesList('renewalAvailableBefore', Number);
      popHeaderNamesList('sessionExpiryHardLimit', Number);

      return function detectIdentityHeaders(req) {
        const report = loMapValues(headerNamesLists, function one(list) {
          let found = false;
          list.forEach(function maybe(headerName) {
            if (found) { return; }
            const raw = req.header(headerName);
            if (!raw) { return; }
            const val = list.convert(raw);
            if (!val) { return; }
            found = val;
          });
          return found;
        });
        if (!report.userId) { return false; }
        return report;
      };
    },

  },



});


export default EX;
