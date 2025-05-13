// -*- coding: utf-8, tab-width: 2 -*-

const EX = {
  annoDetails: ('details, author_local_userid'
    + ' FROM anno_data WHERE (versid).baseid = $1'
    + ' AND (versid).vernum = $2 LIMIT 2'
  ),
  annoStamps: ('*'
    + ' FROM anno_stamps WHERE (versid).baseid = $1'
    + ' AND (versid).vernum = $2 LIMIT 2'
  ),
  latestVersion: (
    'MAX((versid).vernum) AS latest'
    + ' FROM anno_data WHERE (versid).baseid = $1'
  ),
  allVersions: ('(versid).vernum, time_created'
    + ' FROM anno_data WHERE (versid).baseid = $1'
  ),
};


export default EX;
