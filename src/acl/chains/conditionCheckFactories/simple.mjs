// -*- coding: utf-8, tab-width: 2 -*-

import loGet from 'lodash.get';
import mustBe from 'typechecks-pmb/must-be';

import common from './common.mjs';


function alwaysFalse() { return false; }
function orf(x) { return x || false; }


const EX = {

  never() { return alwaysFalse; },

  isLoggedIn(how) {
    common.expectNoCondArgs(how);
    return function check(aclCtx) {
      return Boolean(common.findUserId(aclCtx));
    };
  },

  isConfiguredUser(how) {
    common.expectNoCondArgs(how);
    return function check(aclCtx) {
      return Boolean(common.findUserDetails(aclCtx));
    };
  },

  isGenericUnknownUser(how) {
    // IDP provided a userId but we don't know them.
    common.expectNoCondArgs(how);
    return function check(aclCtx) {
      const userId = common.findUserId(aclCtx);
      const details = common.findUserDetails(aclCtx);
      return Boolean(userId && (!details));
    };
  },

  memberOfAnyAclGroup(how) {
    common.expectNoCondArgs(how);
    return function check(aclCtx) {
      return (common.findUserAclGroups(aclCtx).size >= 1);
    };
  },

  memberOfAclGroup(how) {
    const groupName = mustBe.nest('group name', how.args);
    const ckf = function check(aclCtx) {
      const groups = common.findUserAclGroups(aclCtx);
      const result = orf(groups && groups.has(groupName));
      // console.debug('D: memberOfAclGroup?', { groupName, groups, result });
      return result;
    };
    return ckf;
  },

  paramInList(how) {
    const path = how.popRuleProp('nonEmpty str | nonEmpty ary', 'param');
    const list = mustBe('nonEmpty ary', 'list of accepted values')(how.args);
    const ckf = function check(aclCtx) {
      const val = loGet(aclCtx.allMeta, path);
      const found = list.includes(val);
      // console.debug('D: paramInList?', { path, val, list, found });
      return found;
    };
    return ckf;
  },

};


export default EX;
