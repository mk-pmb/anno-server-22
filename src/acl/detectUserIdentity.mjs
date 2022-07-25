// -*- coding: utf-8, tab-width: 2 -*-

const EX = function detectUserIdentity(srv, req) {
  let found = false;
  srv.acl.identityDetectors.forEach(function maybe(detector) {
    if (found) { return; }
    console.debug('detectUserIdentity: trying detector:', detector.name);
    const info = detector(req);
    console.debug('detectUserIdentity: detector result:', detector.name, info);
    if (info) { found = info; }
  });
  return found;
};


export default EX;
