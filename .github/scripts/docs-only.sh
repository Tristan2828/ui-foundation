#!/usr/bin/env bash
# Does this run change only files no check reads? The first step of every
# required job (verify.yml, package.yml) runs this and skips the job's
# later steps when it says so, so the job still reports success under its
# own name. A workflow-level paths-ignore would leave the required checks
# pending forever, and a separate job other jobs depend on fails open (a
# job skipped because its dependency failed still reports success).
#
# Docs only means every changed path is one of:
#   docs/**   .claude/** (the root's, not the template's)   a root *.md
# Nothing in CI, scripts/, the package or the template reads them, and
# release.yml doesn't count them as released. Markdown elsewhere is shipped
# or synced (conventions, template/docs, template/AGENTS.md) or is a script's
# input (scripts/fixtures/entity-plans/*.md), so it runs everything.
#
# Anything else runs everything: another path, an empty list, a list that
# may be incomplete, an event this doesn't know, FULL=true (release.yml
# sets it for a release). If the list can't be read the step fails, and
# with it the job: it never falls through to "docs only".
#
#   docs-only.sh              decide for this run; writes run=true|false
#                             to $GITHUB_OUTPUT
#   docs-only.sh --classify   read paths, one per line, on stdin; print
#                             docs-only or run (the self-test's entry point)
#
# Reads GITHUB_EVENT_NAME, GITHUB_EVENT_PATH, GITHUB_REPOSITORY, GITHUB_SHA
# (set by Actions; in a reusable workflow they are the caller's event), FULL,
# and GH_TOKEN for the pulls API (pull-requests: read).
set -euo pipefail
# A failure inside $(decide) must fail the script too.
shopt -s inherit_errexit

classify() {
  local path any=0
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    any=1
    case "$path" in
      docs/* | .claude/*) ;;
      */*) echo run; return ;;
      *.md) ;;
      *) echo run; return ;;
    esac
  done
  if [ "$any" = 1 ]; then echo docs-only; else echo run; fi
}

if [ "${1:-}" = "--classify" ]; then
  classify
  exit 0
fi

decide() {
  if [ "${FULL:-false}" = "true" ]; then
    echo "A full run was asked for (a release); running everything." >&2
    echo run
    return
  fi
  local list
  list=$(mktemp)
  case "${GITHUB_EVENT_NAME:-}" in
    pull_request)
      local pr expected listed
      pr=$(jq -er '.pull_request.number' "$GITHUB_EVENT_PATH")
      # Each file's name and, for a rename, the name it had: a file renamed
      # out of docs/ counts on both. The API lists at most 3,000 files, so
      # a count that differs from the PR's own means the list may be short.
      gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$pr/files?per_page=100" \
        --jq '.[] | [.filename, (.previous_filename // "")] | @tsv' > "$list.tsv"
      expected=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$pr" --jq '.changed_files')
      listed=$(wc -l < "$list.tsv" | tr -d ' ')
      tr '\t' '\n' < "$list.tsv" > "$list"
      echo "PR #$pr changes $listed files (the PR says $expected):" >&2
      cut -f1 "$list.tsv" | sed 's/^/  /' >&2
      if [ "$listed" != "$expected" ]; then
        echo "The file list may be incomplete; running everything." >&2
        echo run
        return
      fi
      ;;
    push)
      local before
      before=$(jq -r '.before // ""' "$GITHUB_EVENT_PATH")
      if [ -z "$before" ] || [ -z "${before//0/}" ]; then
        echo "No earlier commit to compare with (before: '${before}'); running everything." >&2
        echo run
        return
      fi
      git fetch --no-tags --quiet --depth=1 origin "$before"
      git diff --no-renames --name-only "$before" "$GITHUB_SHA" > "$list"
      echo "$before..$GITHUB_SHA changes:" >&2
      sed 's/^/  /' "$list" >&2
      ;;
    *)
      echo "Event '${GITHUB_EVENT_NAME:-}' always runs everything." >&2
      echo run
      return
      ;;
  esac
  classify < "$list"
}

# decide prints its answer on stdout and everything else on stderr.
answer=$(decide)
case "$answer" in
  docs-only) run=false; echo "Docs only: this job's later steps are skipped." ;;
  run) run=true ;;
  *) echo "::error::docs-only.sh decided '$answer'"; exit 1 ;;
esac
echo "run=$run" >> "${GITHUB_OUTPUT:?}"
