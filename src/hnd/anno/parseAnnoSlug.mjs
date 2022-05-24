// -*- coding: utf-8, tab-width: 2 -*-

import httpErrors from '../../httpErrors.mjs';

const errNoId = httpErrors.noSuchAnno.explain('No anno ID given');
const errBadId = httpErrors.noSuchAnno.explain('Unsupported anno ID format');


const slugRgx = /^([A-Za-z0-9_\-]{10,36})((?:\.[\d\.]+)*)(?:\~(\d+)|)$/;

const EX = function parseAnnoSlug(slug) {
  if (!slug) { throw errNoId.throwable(); }
  const m = slugRgx.exec(slug);
  if (!m) { throw errBadId.throwable(); }
  const parts = {
    slug,
    mongoId: m[1],
    replySuf: (m[2] || ''),
    reviNum: (+m[3] || 0),
  };
  parts.annoId = parts.mongoId + parts.replySuf;
  parts.replyNums = parts.replySuf.split('.').slice(1).map(n => +n);
  return parts;
};


export default EX;
