// -*- coding: utf-8, tab-width: 2 -*-

import univeil from 'univeil';
import sortedJson from 'safe-sortedjson';


const EX = function prettyJson(data) {
  return EX.adjustExistingJson(univeil.jsonify(data, null, 2));
};


Object.assign(EX, {

  adjustExistingJson(origJson) {
    let j = origJson;
    j = j.replace(/(\n +\{)\n +/g, '$1 ');
    return j;
  },

  sorted(data) {
    return EX.adjustExistingJson(sortedJson(data, null, 2));
  },


});



export default EX;
