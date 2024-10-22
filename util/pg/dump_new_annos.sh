#!/bin/bash
# -*- coding: utf-8, tab-width: 2 -*-


function daily_dumper () {
  export LANG{,UAGE}=en_US.UTF-8  # make error messages search engine-friendly
  local DUMPS_DIR="${ANNO_DUMPS_DIR:-/pgdumps/new_annos}"
  mkdir --parents -- "$DUMPS_DIR" || true
  cd -- "$DUMPS_DIR" || return $?$(
    echo E: 'Failed to chdir to dumps directory!' >&2)

  local LATEST_DIR=
  latest_dir_scan_double_digit_subdir || return $? # year
  latest_dir_scan_double_digit_subdir || return $? # month
  latest_dir_scan_double_digit_subdir || return $? # day
  echo "Potentially latest date subdirectory: $LATEST_DIR"

  # exec > >(LANG=C sed -re 's~\t~\t»»\t~g; s~\r~\n««~g; s~$~¶~g'
  local ANNOS_AFTER='2000-01-01T00:00:00+00:00'

  local SQL_CMD="
    SELECT json_build_object(
      'time_created', time_created,
      'base_id', base_id,
      'version_num', version_num,
      'details', details,
      'stamps', stamps) AS anno
    FROM anno_data NATURAL JOIN anno_disclosed NATURAL JOIN anno_stamps_json
    WHERE time_created > (TIMESTAMP '$ANNOS_AFTER')
    ORDER BY time_created ASC, base_id ASC, version_num ASC
    LIMIT 1
    "
  local PSQL_OPT=(
    --no-align
    --echo-errors
    --quiet
    --field-separator=':'
    # \n is default anyways # --record-separator=$'\n'
    --tuples-only
    --expanded
    --user=postgres
    --no-password
    --dbname=postgres
    )
  local SAVE_SUB="$(printf -- '%(%y/%m/%d)T' -2)"
  mkdir --parents -- "$SAVE_SUB" || true
  local SAVE_TS="$(printf -- '%(%y%m%d-%H%M%S)T' -2)-$$"
  local TMPF="tmp.dumper.$SAVE_TS.sql"
  psql "${PSQL_OPT[@]}" --command="$SQL_CMD" >"$TMPF" || return 4$(
    echo E: 'Failed to dump!' >&2)
  LANG=C sed -nre 's!^anno:!!p' -i -- "$TMPF" || return 4$(
    echo E: 'Failed to strip labels from the temporary file!' >&2)
  tail -- "$TMPF"

  # BusyBox chown doesn't support `--reference .`, so we `stat` instead:
  chown "$(stat -c %u:%g .)" -R . || true
}


function latest_dir_scan_double_digit_subdir () {
  local CUR= MAX=00
  for CUR in "$LATEST_DIR"[0-9][0-9]/; do
    [ -d "$CUR" ] || continue
    CUR="${CUR%/}"
    CUR="${CUR##*/}"
    # The '1' in front prevents bash from interpreting leading zero as octal.
    [ "1$CUR" -gt "1$MAX" ] && MAX="$CUR"
  done
  LATEST_DIR+="$MAX/"
}










daily_dumper "$@"; exit $?
