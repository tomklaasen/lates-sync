# Lates Sync — Automatic calendar blocks from ICS shift data

This Google Apps Script monitors an external ICS calendar feed for specific shift events and automatically creates time blocks in your Google Calendar. Useful for blocking personal time (e.g. cooking) on days when a family member works a particular shift.

## What it does

- Fetches a shift calendar from an ICS feed URL
- Finds events matching a configurable shift name
- Creates a blocking event (default: "Koken", 17:30–20:00) on each of those days in your default Google Calendar
- Removes the blocking event if the corresponding shift disappears
- Looks one month ahead
- Runs once a day on a timer

## Setup

### 1. Create a new Google Apps Script project

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Give it a name, e.g. "Lates Sync"

### 2. Add the script

1. Select all the default code in the editor and delete it
2. Copy the entire contents of `CookingBlockSync.gs` from this repository and paste it in
3. Click the save icon (or Ctrl+S / Cmd+S)

### 3. Configure your sensitive properties

The ICS feed URL and shift name are stored as **Script Properties** so they stay out of the code.

1. In the left sidebar, click the **gear icon** (Project Settings)
2. Scroll down to **Script Properties**
3. Click **Add script property** and add these two entries:

| Property | Value |
|---|---|
| `ICS_URL` | The full URL of your ICS calendar feed |
| `SHIFT_NAME` | The exact event name(s) to match. Separate multiple names with `\|` (e.g. `L7,6 13:30 N17\|L7,6 14:00 N17`) |

4. Click **Save script properties**

### 4. Run it manually (first time)

1. In the toolbar, make sure `syncCookingBlocks` is selected in the function dropdown
2. Click **Run**
3. Google will ask you to authorize the script — click **Review Permissions**, choose your Google account, and allow access
4. Check the execution log (View > Execution log) to see which shifts were found
5. Verify that blocking events appeared in your Google Calendar

### 5. Set up the daily trigger

1. In the left sidebar, click the **clock icon** (Triggers)
2. Click **+ Add Trigger**
3. Configure:
   - **Function to run:** `syncCookingBlocks`
   - **Event source:** Time-driven
   - **Type of time-based trigger:** Day timer
   - **Select time of day:** 6:00 to 7:00 (or whenever you prefer)
4. Click **Save**

The script will now run automatically every day.

## Configuration

### Script Properties (sensitive — not in code)

Set these in Project Settings > Script Properties:

| Property | Description |
|---|---|
| `ICS_URL` | URL of the ICS calendar feed to monitor |
| `SHIFT_NAME` | Exact event name(s) that identify the target shift. Separate multiple with `\|` |

### Constants (in `CookingBlockSync.gs`)

| Variable | Default | Description |
|---|---|---|
| `COOKING_TITLE` | `Koken` | Name of the auto-created calendar events |
| `COOKING_START_HOUR` | `17` | Start hour of the blocking event |
| `COOKING_START_MINUTE` | `30` | Start minute of the blocking event |
| `COOKING_END_HOUR` | `20` | End hour of the blocking event |
| `COOKING_END_MINUTE` | `0` | End minute of the blocking event |
| `LOOK_AHEAD_DAYS` | `31` | How many days ahead to scan |
| `AUTO_MARKER` | `[auto-cooking-block]` | Description text used to identify auto-created events. Do not change after first run. |

## How it tracks its own events

The script identifies events it created by checking for both:
- Title equals `COOKING_TITLE`
- Description equals `AUTO_MARKER`

This means:
- **Don't change `AUTO_MARKER`** after the first run, or the script will lose track of old events and create duplicates.
- If you manually edit a blocking event's description, the script will no longer manage it.
- Manually-created events with different descriptions are left untouched.

## Troubleshooting

### "Missing script property" error
- You haven't set `ICS_URL` and/or `SHIFT_NAME` yet. See step 3 above.

### No shifts found
- Check the execution log for errors
- The ICS feed URL may have changed — verify it's still accessible by opening it in a browser
- The shift name may have changed — check the ICS feed content for the current SUMMARY values

### Duplicate events
- This can happen if `AUTO_MARKER` was changed. Delete the orphaned events manually and keep `AUTO_MARKER` consistent going forward.

### Permission errors
- Re-run the script manually and re-authorize when prompted
