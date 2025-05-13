// -*- coding: utf-8, tab-width: 2 -*-

import qrystr from 'qrystr';


const EX = {

  parseStr(orig) {
    let flags = String(orig || '').trim();
    if (!flags) { return false; }
    flags = flags.split(/\s*\n\s*/).map(function eachLine(ln) {
      if (ln.startsWith('#')) { return ''; }
      return ln.replace(/\s+/g, '&');
    }).join('&');
    flags = qrystr(flags);
    delete flags[''];
    return Boolean(Object.keys(flags).length) && flags;
  },

};


export default EX;
