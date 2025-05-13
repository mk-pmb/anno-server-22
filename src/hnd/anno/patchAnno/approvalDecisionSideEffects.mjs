// -*- coding: utf-8, tab-width: 2 -*-

import makeStampDeleter from '../util/makeStampDeleter.mjs';
import miscMetaFieldInfos from '../miscMetaFieldInfos.mjs';


const unapStamp = miscMetaFieldInfos.unapprovedStampName;


const sunsetUEV = async function sunsetUndecidedEarlierVersions(ctx) {
  const st = ctx.mainStampRec;
  const { sqlTpl } = sunsetUEV;
  const [, stBaseId, stVersNum] = st.versid;
  const args = [stBaseId, stVersNum, st.st_at, st.st_by];
  await ctx.srv.db.postgresQueryRows(sqlTpl, args);
};

sunsetUEV.sqlTpl = `
  INSERT INTO anno_stamps (versid, st_at, st_by, st_type)
  SELECT da.versid, $3 AS st_at, $4 AS st_by, 'as:deleted' AS st_type
  FROM anno_data AS da LEFT JOIN anno_stamps AS st USING (versid)
  WHERE st.st_type = '${unapStamp}'
    AND (da.versid).baseid = $1 AND (da.versid).vernum < $2
  ON CONFLICT (versid, st_type) DO NOTHING;
  `;


const delUnap = makeStampDeleter.fromCtxProp({ st_type: unapStamp });




const EX = {
  sunsetUndecidedEarlierVersions: sunsetUEV,
  deleteStampUbhdUnapproved: delUnap,

  prepareAdd: sunsetUEV,
  cleanupAfterAdd: delUnap,
};


export default EX;
