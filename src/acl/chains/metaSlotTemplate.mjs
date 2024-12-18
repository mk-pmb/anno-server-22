// -*- coding: utf-8, tab-width: 2 -*-

import mustBe from 'typechecks-pmb/must-be';


const allSlotsRgx = /<\$([A-Za-z][\w\-\.]*)>/g;

allSlotsRgx.reset = function reset() {
  // Unless we manually reset, the next .test() might report a false negative.
  // -> https://stackoverflow.com/a/2141974
  allSlotsRgx.lastIndex = 0;
  return allSlotsRgx;
};

const EX = {

  hasSlots(spec) {
    const has = allSlotsRgx.reset().test(spec);
    return has;
  },

  compile(spec) {
    // Minimize effort for literal specs (no lookup slots):
    const hs = EX.hasSlots(spec);
    const f = (hs ? EX.render : String).bind(null, spec);
    f.hasSlots = hs;
    f.origSpec = spec;
    return f;
  },

  render(spec, ctx) {
    const r = spec.replace(allSlotsRgx.reset(),
      (m, k) => (ctx.allMeta[m && k] || ''));
    return r;
  },

  bulkCompile(opt, specsList) {
    const renderers = [];
    const verbatims = new Set();
    (opt.specsList || specsList).forEach(function compile(spec, idx) {
      if ((spec === '') && opt.allowEmptySpec) { return verbatims.add(spec); }
      mustBe.nest(opt.specsItemDescr + ' #' + (idx + 1), spec);
      const r = EX.compile(spec);
      if (r.hasSlots) { return renderers.push(r); }
      verbatims.add(spec);
    });
    const nTotal = renderers.length + verbatims.size;
    const report = { renderers, verbatims, nTotal };
    if (opt.debugHint) { console.debug(opt.debugHint, report); }
    return report;
  },















};


export default EX;
