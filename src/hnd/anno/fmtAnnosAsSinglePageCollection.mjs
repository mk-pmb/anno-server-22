// -*- coding: utf-8, tab-width: 2 -*-

import mustBe from 'typechecks-pmb/must-be';

import sendFinalTextResponse from '../../finalTextResponse.mjs';
import plumb from '../util/miscPlumbing.mjs';


function orf(x) { return x || false; }


const EX = function fmtAnnosAsSinglePageCollection(how) {
  const {
    annos,
    canonicalUrl,
    extraTopFields,
    ...unexpected
  } = how;
  delete unexpected.untrustedOpt;
  mustBe.keyless('Unexpected options', unexpected);
  mustBe.ary('Annotations list', annos);
  mustBe.nest('canonicalUrl', canonicalUrl);

  const nTotal = annos.length;
  const coll = {
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    type: [
      'BasicContainer',
      'AnnotationCollection',
    ],
    id: canonicalUrl,
    total: nTotal,
    first: {
      id: canonicalUrl,
      startIndex: 0,
      items: annos,
    },
    last: { id: canonicalUrl },
    ...extraTopFields,
  };
  return coll;
};


function replyToRequest(origHow) {
  const { srv, req, ...how } = origHow;
  if (!how.canonicalUrl) {
    how.canonicalUrl = plumb.guessOrigReqUrl(srv, req);
  }
  return sendFinalTextResponse.json(req, EX(how), EX.jsonReplyOpt);
}


Object.assign(EX, {
  replyToRequest,

  jsonReplyOpt: {
    sorted: false,
  },

});


export default EX;
