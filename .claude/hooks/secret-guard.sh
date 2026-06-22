#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit): block edits to secret-bearing files.
# Reads the hook payload on stdin and denies if the target path is a Firebase
# service-account key or a local env file.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  *serviceAccountKey.json | *-firebase-adminsdk-*.json | *.env.local | *.env.*.local)
    jq -n --arg f "$f" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("Blocked: " + $f + " holds secrets (Firebase service-account key or .env.local) and must not be edited by the agent.")
      }
    }'
    ;;
esac
exit 0
