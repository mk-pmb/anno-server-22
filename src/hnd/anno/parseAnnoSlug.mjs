// -*- coding: utf-8, tab-width: 2 -*-

import httpErrors from '../../httpErrors.mjs';

const errNoId = httpErrors.noSuchAnno.explain('No anno ID given');
const errBadId = httpErrors.noSuchAnno.explain('Unsupported anno ID format');


const slugRgx = /^([A-Za-z0-9_\-]{10,36})(?:\.(\d+)|)(?:\~(\d+)|)$/;

const EX = function parseAnnoSlug(slug) {
  if (!slug) { throw errNoId.throwable(); }
  const m = slugRgx.exec(slug);
  if (!m) { throw errBadId.throwable(); }
  const parts = {
    id: m[1],
    legacyMongoId: m[1],
    legacyReplyNum: (+m[2] || 0),
    reviNum: (+m[3] || 0),
  };
  if (parts.legacyReplyNum) { parts.id += '.' + parts.legacyReplyNum; }
  return parts;
};


export default EX;
