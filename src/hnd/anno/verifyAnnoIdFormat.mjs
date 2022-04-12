// -*- coding: utf-8, tab-width: 2 -*-

import httpErrors from '../../httpErrors.mjs';


const annoIdRgx = /^[A-Za-z0-9_\-]{10,36}$/;

const EX = function verifyAnnoIdFormat(annoId) {
  if (annoId) {
    const idMatch = (annoIdRgx.exec(annoId) || false);
    if (idMatch[0] === annoId) { return annoId; }
  }
  const msg = ('Annotation not found: '
    + (annoId ? 'Unsupported ID format' : 'No ID given'));
  throw httpErrors.throwable(404, msg);
};


export default EX;
