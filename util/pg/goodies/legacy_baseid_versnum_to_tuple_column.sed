#!/bin/sed -nurf
# -*- coding: UTF-8, tab-width: 2 -*-

#/^INSERT INTO /!d
#/^INSERT INTO "public"\."anno_data" /!d
#/^INSERT INTO "public"\."anno_links" /!d
#/^INSERT INTO "public"\."anno_stamps" /!d

/^INSERT INTO /{
  s~ VALUES ~\n&~

  /^INSERT INTO "[^" ]+"\."anno_data" /{
    s~^(INSERT INTO \S+ \()"pg_row_id", ~\r\1~
  }

  /^\r/{
    s~(\n VALUES \()[0-9]+, ~\1~
    s~^\r~~
  }
  s~(\n VALUES \()([0-9]+, |)('[^']+', [0-9]+), ~\1\2(\3), ~
}

s~\n~~p
