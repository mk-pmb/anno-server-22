#!/bin/sed -urf
# -*- coding: UTF-8, tab-width: 2 -*-
s~^((INSERT|REPLACE) INTO "\S{1,30}" \()("pg_row_id", |)"base_id", "version_num",~\1"versid",~
s~^(\s+)\(([0-9]+, |)('[^', ]{1,64}', [0-9]+),~\1((\3),~
/^SELECT pg_catalog\.setval\('"public"\."anno_\S+_pg_row_id_seq"', /d
