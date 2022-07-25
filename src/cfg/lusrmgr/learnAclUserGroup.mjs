// -*- coding: utf-8, tab-width: 2 -*-

const EX = function learnGroup(mgr, grpName, mustPopDetail) {
  const members = mustPopDetail('undef | ary', 'usernames');
  (members || []).forEach(function learn(userName) {
    const u = mgr.users.get(userName);
    if (!u) {
      console.warn('Group config adds unknown user. Ignored.',
        { grpName, userName });
      return;
    }
    u.aclUserGroups.add(grpName);
  });
  mustPopDetail.done('Unsupported user group option(s)');
};


export default EX;
