// -*- coding: utf-8, tab-width: 2 -*-

import miscMetaFieldInfos from '../../miscMetaFieldInfos.mjs';
import miscSql from '../../miscSql.mjs';


const unapStamp = miscMetaFieldInfos.unapprovedStampName;


const EX = {

  visibilityStampJoins: `
      ${miscSql.joinStampEffUts0('unapproval', unapStamp).join}
      ${miscSql.joinStampEffUts0('retractions', 'as:deleted').join}
    `.trim(),

  visibilityStampCols: `
        (unapproval.st_type IS NULL) AS disclosed,
        COALESCE(retractions.st_effuts::int, 0) AS sunset_uts
    `.trim(),

  visibilityWhere: '#visibilityIsOrWasPublic',
  visibilityAny: 'True',
  visibilityAuthorMode: '#visibilityOwnAnnos OR ( #visibilityIsOrWasPublic )',

  visibilityOwnAnnos: ["( $rqUserId <> ''",
    // ^- This safety check also helps pg to potentially omit the next parts:
    'IS NOT NULL', '= $rqUserId )'].join(' AND da.author_local_userid '),

  visibilityIsOrWasPublic: 'da.disclosed',
  visibilityUndecided: 'da.sunny AND NOT da.disclosed',

};


export default EX;
