#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): after a .ts/.tsx change, typecheck the
# project and lint the edited file, surfacing any errors back to the model.
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
case "$f" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" || exit 0
[ -x node_modules/.bin/tsc ] || exit 0

tsc_out=$(node_modules/.bin/tsc --noEmit 2>&1)
tsc_rc=$?
biome_out=$(node_modules/.bin/biome check "$f" 2>&1)
biome_rc=$?

if [ $tsc_rc -ne 0 ] || [ $biome_rc -ne 0 ]; then
  jq -n --arg t "$tsc_out" --arg b "$biome_out" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: ("Type/lint check failed after this edit — fix before continuing.\n--- tsc --noEmit ---\n" + $t + "\n--- biome check ---\n" + $b)
    }
  }'
fi
exit 0
