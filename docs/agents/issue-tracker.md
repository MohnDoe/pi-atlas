# Issue tracker: Linear

Issues and PRDs for this repo live as **Linear** issues on the `pi-atlas` team (key: `PI`). Use the `linear` CLI (`@schpet/linear-cli`) for all operations.

## Setup

1. **Auth**: `npx @schpet/linear-cli auth login` — create an API key at [linear.app/settings/account/security](https://linear.app/settings/account/security).
2. **Config** (one-time, from repo root): `npx @schpet/linear-cli config` — writes `.linear.toml`.

Alternatively, set env vars:
- `LINEAR_API_KEY` — personal API token
- `LINEAR_TEAM_ID` — `"PI"`

## Conventions

Run commands via `npx @schpet/linear-cli` (or `linear` if installed globally).

### Create an issue

```bash
npx @schpet/linear-cli issue create \
  -t "Title" \
  -d "Description" \
  --label "Feature" \
  --state "Backlog" \
  --no-interactive
```

- Use `--description-file <path>` instead of `-d` for long markdown content (e.g. PRD text).
- `-l/--label` is repeatable: `--label "Feature" --label "PRD"`.
- Without `--no-interactive`, the CLI prompts for each field.
- `--start` to start the issue after creation, `-a self` to assign to yourself.

### Update an issue

```bash
npx @schpet/linear-cli issue update PI-5 \
  -t "New title" \
  -d "New description" \
  --description-file /path/to/file.md
```

Note: `issue update` does **not** support `--no-interactive` — it only runs non-interactively when flags are provided. Omitting all flags opens the interactive editor.

### View an issue

```bash
npx @schpet/linear-cli issue view PI-5                # human-readable
npx @schpet/linear-cli issue view PI-5 --json          # JSON (preferred for agents)
npx @schpet/linear-cli issue view PI-5 --web           # open in browser
npx @schpet/linear-cli issue view PI-5 --no-comments   # exclude comments
```

### List/search issues

```bash
npx @schpet/linear-cli issue list                      # your assigned issues
npx @schpet/linear-cli issue query --search "skill" --json  # full-text search
npx @schpet/linear-cli issue query --state triage --json     # filter by state
npx @schpet/linear-cli issue query --label "Feature" --json  # filter by label
npx @schpet/linear-cli issue query --all-teams --json --limit 0   # all issues
npx @schpet/linear-cli issue query --team PI --limit 0 --json     # all PI team issues
```

State filter values (for `--state`): `"triage"`, `"backlog"`, `"unstarted"`, `"started"`, `"completed"`, `"canceled"`. Can be repeated: `--state triage --state backlog`.

Other query filters: `--assignee`, `--sort` (`"manual"` | `"priority"`), `--project`, `--cycle`, `--milestone`, `--created-after`, `--updated-after`, `--include-archived`.

### Add a comment

```bash
npx @schpet/linear-cli issue comment add PI-5 -b "Comment text"
npx @schpet/linear-cli issue comment add PI-5 --body-file /path/to/comment.md
npx @schpet/linear-cli issue comment list PI-5
```

### Manage labels

```bash
# Create a workspace label (no --team flag)
npx @schpet/linear-cli label create -n "ready-for-agent" -c "#4EA7FC"

# Create a team-specific label
npx @schpet/linear-cli label create -n "PRD" -c "#5e6ad2" -t PI

# List labels
npx @schpet/linear-cli label list                     # team labels only
npx @schpet/linear-cli label list --workspace          # workspace labels only
npx @schpet/linear-cli label list --all                # all labels
npx @schpet/linear-cli label list --all --json         # JSON output

# Delete a label
npx @schpet/linear-cli label delete "ready-for-agent" --force
npx @schpet/linear-cli label delete "ready-for-agent" -t PI  # disambiguate team label
```

### Delete an issue

```bash
npx @schpet/linear-cli issue delete PI-5 -y           # skip confirmation
npx @schpet/linear-cli issue delete --bulk PI-5 PI-6   # bulk delete
npx @schpet/linear-cli issue delete --bulk-file ids.txt
```

### Other

```bash
npx @schpet/linear-cli issue id                       # read from git branch name
npx @schpet/linear-cli issue url                      # print issue URL for current branch
npx @schpet/linear-cli team list                      # list teams
```

## Triage workflow

Issues are triaged by applying Linear labels. The following labels are used; create them via `label create` if they don't exist yet:

| Label | Scope | Meaning |
|-------|-------|---------|
| `considering` | workspace | Initial state for new issues and PRDs |
| `needs-triage` | workspace | Maintainer needs to evaluate |
| `needs-info` | workspace | Waiting on reporter for more information |
| `ready-for-agent` | workspace | Fully specified, ready for an AFK agent |
| `ready-for-human` | workspace | Requires human implementation |
| `wontfix` | workspace | Will not be actioned |

Create all six as workspace labels (omit `--team`):

```bash
for label in considering needs-triage needs-info ready-for-agent ready-for-human wontfix; do
  npx @schpet/linear-cli label create -n "$label" -c "#bec2c8"
done
```

## When a skill says "publish to the issue tracker"

1. Create the Linear issue with a clear title and the full PRD/description via `--description-file`.
2. Apply `ready-for-agent` label via `--label`.
3. If labels don't exist yet, create them first with `label create`.

## When a skill says "fetch the relevant ticket"

```bash
npx @schpet/linear-cli issue view <id> --json | jq .
```
