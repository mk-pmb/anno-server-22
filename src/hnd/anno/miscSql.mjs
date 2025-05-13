// -*- coding: utf-8, tab-width: 2 -*-

const EX = {

  annoExactVerCond: (a, b) => `${a}.versid = ${b}.versid`,


  joinStampEffUts0(joinAs, stType) {
    const col = `COALESCE(${joinAs}.st_effuts, 0) AS ${joinAs}Ts`;
    const join = (`LEFT JOIN anno_stamps_effuts AS ${joinAs}`
      + ' ON ' + EX.annoExactVerCond(joinAs, 'da')
      + ` AND ${joinAs}.st_type = '${stType}'`);
    return {
      col,
      colLn: '\n    ' + col + ',',
      join,
    };
  },


};


export default EX;
