#!/bin/bash
# -*- coding: utf-8, tab-width: 2 -*-


function dinst_main () {
  exec </dev/null
  local SELFFILE="$(readlink -m -- "$BASH_SOURCE")"
  local SELFPATH="$(dirname -- "$SELFFILE")"
  source -- "$SELFPATH"/lib/kisi.sh --lib || return $?

  local REPOPATH="$(dirname -- "$SELFPATH")"
  dinst_validate_docker_volume_path 'repo path' "$REPOPATH" || return $?

  local NPM_AUDIT_LOG="$REPOPATH"/tmp.npm-audit.log
  # local NPM_AUDIT_LOG="$REPOPATH"/node_modules/.logs/npm-audit.log
  mkdir --parents -- "$(dirname -- "$NPM_AUDIT_LOG")" || true

  local TASK="${1:-dockerize}"; shift
  "${FUNCNAME%_*}_$TASK" "$@" || return $?$(
    echo "E: Task '$TASK' failed with error code $? after $SECONDS sec." >&2)
}


function dinst_dockerize () {
  cd -- "$REPOPATH" || return $?
  local DKSELF="/app${SELFFILE:${#REPOPATH}}"

  [ -n "$DK_TASK" ] || local DK_TASK='install'

  local DK_VARS=()
  readarray -t DK_VARS < <( env | cut -d = -sf 1 | sed -nrf <(echo '
    s~^DK_ENV_~\n~
    s~^(APP|DK)_~\n&~
    s!^\n!--env&!p
    ') )

  local DK_CMD=(
    docker
    run
    --interactive     # Some tasks need stdio even in batch mode.
    --rm              # Remove temporary container after use
    )

  if tty --silent; then
    echo "Gonna $DK_TASK with dockerized node.js/npm:"
    echo
    DK_CMD+=( --tty )
  fi

  if [ -n "$EXTRAS_DIR" ]; then
    dinst_validate_docker_volume_path EXTRAS_DIR "$EXTRAS_DIR" || return $?
    DK_CMD+=( --volume "$EXTRAS_DIR:/extras:rw" )
  fi

  DK_CMD+=(
    --volume "$REPOPATH:/app:rw"
    "${DK_VARS[@]}"
    --workdir /app
    node:24
    "$DKSELF"
    inside_docker_"$DK_TASK"
    )
  "${DK_CMD[@]}";
  local DK_RV=$?
  [ "$DK_RV" == 0 ] || echo W: >&2 \
    "Docker failed (rv=$DK_RV), gonna clean up anyway."
  chapterize '' dinst_fix_npm_file_perms . extras
  [ "$DK_RV" == 0 ] || return "$DK_RV"$(
    echo E: "Docker action failed, rv=$DK_RV" >&2)

  chapterize "All done. Installation took $SECONDS seconds. $(
    )Local time now: $(printf '%(%F %T)T' -1)"
  case "$DK_TASK" in
    install ) dinst_summarize_audit_log;;
  esac
}


function dinst_summarize_audit_log () {
  local VAL="$(grep -hnPie '\b\d+ vulnerab' -- "$NPM_AUDIT_LOG" |
    uniq --skip-fields=2)"
  [ -n "$VAL" ] || return 0
  echo
  echo "Security audit summary, from: $NPM_AUDIT_LOG"
  local SED='
    s!\a!!g
    s!^!      !
    s!^ *([ 0-9]{5}:)!\r\1!
    s!^ *\r?( *[0-9]+:)!  ㏑\1 !
    '
  VAL="$(echo "$VAL" | sed -rf <(echo "$SED") )"
  echo "$VAL" >>"$NPM_AUDIT_LOG"
  SED='
    s!\b[0-9]+ vulnerab!\a&!g
    s!\a(0 \S+)!\x1B[92m\1\x1B[0m!g
    '
  VAL="$(echo "$VAL" | sed -rf <(echo "$SED") )"
  echo "$VAL" | sed -re 's!\a([0-9]+ \S+)!\x1B[91m\1\x1B[0m!g'
  case "$VAL" in
    *$'\a'* )
      echo H: 'Try if some vulnerabilities can be solved by' \
        'repeating this install step.' \
        '(It usually settles within 4 attempts.)' \
      ;;
  esac
}


function dinst_fix_npm_file_perms () {
  local ITEM=
  while [ "$#" -ge 1 ]; do
    ITEM="$1"; shift
    for ITEM in "$ITEM"/{node_modules,tmp.*.log}; do
      [ -L "$ITEM" ] || [ -d "$ITEM" ] || [ -f "$ITEM" ] || continue
      sudo chown --reference "$ITEM" --recursive -- "$ITEM" || return $?
    done
  done
}


function dinst_validate_docker_volume_path () {
  local DESCR="$1" VPATH="$2"
  case "$VPATH" in
    *:* | *' '* )
      echo E: "$DESCR contains unsupported characters: $VPATH" >&2
      return 8;;
  esac
  [ -d "$VPATH" ] || return 4$(
    echo E: "$DESCR seems to not be a directory: $VPATH" >&2)
}


function dinst_inside_docker_install () {
  local RUNMJS='nodejs'
  mkdir --parents -- "$(dirname -- "$NPM_AUDIT_LOG")" || true
  >"$NPM_AUDIT_LOG" || return $?$(
    echo "E: Failed to clear the npm audit log: $NPM_AUDIT_LOG" >&2)

  chapterize dinst_configure_npm || return $?
  dinst_maybe_install_extras || return $?

  cd -- "$REPOPATH/$APP_SUBPATH" || return $?
  chapterize --cwd '' dinst_install_npm_module || return $?
  chapterize --cwd 'Generate database initialization file' \
    dinst_dbinit_gen || return $?
}


function dinst_inside_docker_eval () {
  cd -- "$REPOPATH/$APP_SUBPATH" || return $?
  eval "$DK_EVAL" || return $?
}


function dinst_inside_docker_run_script () {
  cd -- "$REPOPATH/$APP_SUBPATH" || return $?
  $RUNMJS $DK_EVAL || return $?
}


function dinst_configure_npm () {
  sed -nre '/\S/s~^\s+~~p' <<<'
    omit            = dev
    package-lock    = false
    progress        = false
    update-notifier = false
    ' >"$HOME"/.npmrc || return $?
}


function dinst_maybe_install_extras () {
  local PKGDIR= DESCR=
  for PKGDIR in {plugins,/extras}/*/package.json; do
    [ -f "$PKGDIR" ] || continue
    PKGDIR="${PKGDIR%/*}"
    DESCR="$(basename -- "$PKGDIR")"
    cd -- "$PKGDIR" || return $?$(echo E: "Failed to chdir to $PKGDIR!" >&2)
    chapterize --cwd '' dinst_install_npm_module || return $?
  done
  cd -- "$REPOPATH" || return $?
}


function dinst_install_npm_module () {
  # We temporarily activate the package lock in order to be able to audit:
  local ENABLE_PKGLOCK='--package-lock=true'

  npm install $ENABLE_PKGLOCK . &> >(
    grep --line-buffered -vPe '^\s*run `npm \S+`? for details\b' |
    sed -ure '/ audited [0-9]+ packages /{N;s~\n$~~}' |
    sed -ure '/ packages are looking for /{N;s~\n$~~}' |
    grep -vFe ' packages are looking for ' |
    stdbuf -i0 -o0 tee -- > >(sed -rune '/vulnerab|audit/s|^|installed @ '$(
      )"$PWD: |p" >>"$NPM_AUDIT_LOG")
    ) || return $?$(echo E: "Failed to install npm package in $PWD" >&2)

  local AUDIT=(
    npm audit fix
    $ENABLE_PKGLOCK
    --dry-run   # Do not modify package.json
    --force     # Allow upgrades even beyond the semver range that
      # a dependency's package.json declares as compatible.
    )
  ( chapterize --cwd '' cat -- package.json
    mkdir --parents -- node_modules/.logs
    chapterize --cwd '' npm ls --all |&
      tee -- node_modules/.logs/npm-ls-all.log
    chapterize --cwd '' sha1sum --binary -- package-lock.json
    chapterize --cwd '' "${AUDIT[@]}" |  sed -re \
      '/vulnerab|audit/s|^|audit sim @ '$(
      )"$PWD: |" | tee --append "$NPM_AUDIT_LOG"

    rm -- package-lock.json 2>/dev/null || true
  ) &>>"$NPM_AUDIT_LOG" || return $?$(
    echo E: "Failed to audit npm package in $PWD" >&2)
}


function dinst_dbinit_gen () {
  cd -- "$REPOPATH" || return $?
  local DEST='util/pg/dbinit_structure.sql'
  $RUNMJS "${DEST%.*}".gen.mjs >"$DEST" || return $?
  # wc --lines -- "$DEST" || return $?
  grep --with-filename -Fe '$date$' -- "$DEST" || return $?
}








dinst_main "$@"; exit $?
