// -*- coding: utf-8, tab-width: 2 -*-

import loMapValues from 'lodash.mapvalues';
import regexpFlagsUpfront from 'regexp-flags-upfront';
import splitStringOnce from 'split-string-or-buffer-once-pmb';


const EX = function validateScopeUrl(srv, svcId, potentialScopeUrl) {
  const bad = EX.whyBad(srv, svcId, potentialScopeUrl);
  return (bad ? { bad } : { ok: potentialScopeUrl });
};


Object.assign(EX, {

  whyBad(srv, svcId, potentialScopeUrl) {
    let parsedUrl;
    try {
      parsedUrl = new URL(potentialScopeUrl);
    } catch (errParse) {
      return 'Failed to parse URL for validation.';
    }
    const { href, hash } = parsedUrl;
    if (hash) { return 'Hash currently is not allowed'; }
    if (href !== potentialScopeUrl) { return 'Not fully normalized'; }
    const svcInfo = srv.services.get(svcId);
    if (!svcInfo) { return 'Unknown service ID'; }
    const {
      prefixes,
      scopeSubUrlRules,
    } = svcInfo.targetUrlMetadata;
    if (!prefixes) { return 'No prefixes configured for this service'; }
    const firstPrefixIdx = prefixes.findIndex(p => href.startsWith(p));
    const firstPrefixUrl = ((firstPrefixIdx >= 0) && prefixes[firstPrefixIdx]);
    if (!firstPrefixUrl) { return 'Unexpected prefix'; }

    const subUrl = href.slice(firstPrefixUrl.length);
    if (!subUrl) { return ''; }
    if (!scopeSubUrlRules) { return 'Service allows no sub URLs'; }

    function checkMaxLen(part, orig) {
      const max = (+scopeSubUrlRules['max' + part + 'Length'] || 0);
      if (orig.length <= max) { return; }
      return 'Sub URL ' + part.toLowerCase() + ' length limit exceeded';
    }
    const [subPath, query] = splitStringOnce('?', subUrl) || [subUrl, ''];
    const tooLong = (checkMaxLen('Total', subUrl)
      || checkMaxLen('Path', subPath) || checkMaxLen('Query', query));
    if (tooLong) { return tooLong; }

    function checkBadChars(part, orig) {
      const rxSpec = scopeSubUrlRules['ok' + part + 'CharsRegExp'];
      const rxObj = regexpFlagsUpfront(rxSpec, 'g');
      const bad = orig.replace(rxObj, '');
      // console.debug('checkBadChars:', { bad, rxObj });
      if (!bad) { return; }
      return 'Unexpected character(s) in sub URL ' + part.toLowerCase();
    }
    const badChars = (checkBadChars('Path', subPath)
      || checkBadChars('Query', query));
    if (badChars) { return badChars; }

    const delimsubPath = '<' + subUrl + '>'; // RFC 3986 Appendix C
    const badSubStrs = [];
    loMapValues(scopeSubUrlRules.forbiddenStrings, function check(v, k) {
      if (delimsubPath.includes(v)) { badSubStrs.push(k); }
    });
    if (badSubStrs.length) {
      return 'Sub URL contains forbidden token(s): ' + badSubStrs.join(', ');
    }
    return '';
  },

});



export default EX;