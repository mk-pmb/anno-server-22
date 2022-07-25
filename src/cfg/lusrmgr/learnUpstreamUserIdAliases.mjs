// -*- coding: utf-8, tab-width: 2 -*-

import mustBe from 'typechecks-pmb/must-be.js';
import objPop from 'objpop';


const EX = function learnUpstreamUserIdAliases(mgr, userName, aliases) {
  if (!aliases) { return; }
  const known = mgr.upstreamUserIdAliases;
  aliases.forEach(function learnAlias(origAliasSpec) {
    const popSpec = objPop(origAliasSpec, { mustBe }).mustBe;
    let id = popSpec('str', 'id');
    popSpec.done('Unsupported identity alias option(s)');

    id = id.replace(/\s+/g, '');
    if (!id) {
      const msg = 'Empty or whitespace-only alias for user ' + userName;
      const err = new Error(msg);
      throw err;
    }

    if (!known.has(id)) { return known.set(id, userName); }

    const winner = known.get(id);
    const msg = ('Duplicate upstream user alias: ' + id
      + ', to be added for user ' + userName
      + ', but already used for user ' + winner);
    const err = new Error(msg);
    err.name = 'DuplicateUserAliasError';
    err.alias = id;
    err.loser = userName;
    err.winner = winner;
    throw err;
  });
};


export default EX;
