// === Configuration ===
// Sensitive values (ICS_URL, SHIFT_NAME) are stored in Script Properties.
// Run setupProperties() once to configure them, or set them manually via
// Project Settings > Script Properties.

const COOKING_TITLE = 'Koken';
const COOKING_START_HOUR = 17;
const COOKING_START_MINUTE = 30;
const COOKING_END_HOUR = 20;
const COOKING_END_MINUTE = 0;
const LOOK_AHEAD_DAYS = 90;

// Marker in the event description to identify auto-created blocks.
// Do not change this after first run, or orphan events will remain.
const AUTO_MARKER = '[auto-cooking-block]';

// === First-time setup ===

/**
 * Run this function once to store your sensitive configuration.
 * Afterwards, you can also edit them via Project Settings > Script Properties.
 */
function setupProperties() {
  var ui = SpreadsheetApp.getUi || null;
  var props = PropertiesService.getScriptProperties();

  var icsUrl = promptUser('Enter the ICS calendar feed URL:');
  if (!icsUrl) return;

  var shiftName = promptUser('Enter the exact shift event name to match (e.g. L7,6 13:30 N17):');
  if (!shiftName) return;

  props.setProperties({
    'ICS_URL': icsUrl,
    'SHIFT_NAME': shiftName
  });

  Logger.log('Properties saved successfully.');
  Logger.log('ICS_URL = ' + icsUrl);
  Logger.log('SHIFT_NAME = ' + shiftName);
}

function promptUser(message) {
  var html = HtmlService.createHtmlOutput(
    '<p>' + message + '</p>' +
    '<input id="val" type="text" style="width:100%" /><br><br>' +
    '<button onclick="google.script.run.withSuccessHandler(google.script.host.close).receiveInput(document.getElementById(\'val\').value)">OK</button>'
  ).setWidth(400).setHeight(150);

  // Fallback: since standalone scripts can't show UI dialogs,
  // just log instructions for manual setup.
  Logger.log('=== MANUAL SETUP REQUIRED ===');
  Logger.log('Go to Project Settings (gear icon) > Script Properties and add:');
  Logger.log('  ICS_URL    = <your ICS calendar feed URL>');
  Logger.log('  SHIFT_NAME = <the exact shift event name to match>');
  return null;
}

function getRequiredProperty(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error(
      'Missing script property: ' + key + '. ' +
      'Go to Project Settings (gear icon) > Script Properties and add it.'
    );
  }
  return value;
}

// === Main entry point ===

function syncCookingBlocks() {
  var icsUrl = getRequiredProperty('ICS_URL');
  var shiftName = getRequiredProperty('SHIFT_NAME');

  const lateShiftDates = fetchLateShiftDates(icsUrl, shiftName);
  Logger.log('Late shifts found: ' + [...lateShiftDates].join(', '));

  const calendar = CalendarApp.getDefaultCalendar();
  const now = new Date();
  const today = stripTime(now);
  const horizon = new Date(today.getTime() + LOOK_AHEAD_DAYS * 86400000);

  // Collect existing auto-created cooking blocks within the window
  const existingBlocks = calendar.getEvents(today, horizon).filter(function(e) {
    return e.getTitle() === COOKING_TITLE && e.getDescription() === AUTO_MARKER;
  });

  // Build a map of date -> event for existing blocks
  var blocksByDate = {};
  existingBlocks.forEach(function(e) {
    blocksByDate[toDateKey(e.getStartTime())] = e;
  });

  // Delete blocks whose late shift has disappeared
  Object.keys(blocksByDate).forEach(function(dateKey) {
    if (!lateShiftDates.has(dateKey)) {
      Logger.log('Deleting cooking block for ' + dateKey);
      blocksByDate[dateKey].deleteEvent();
      delete blocksByDate[dateKey];
    }
  });

  // Create blocks for new late shifts
  lateShiftDates.forEach(function(dateKey) {
    if (blocksByDate[dateKey]) {
      return; // already exists
    }

    var parts = dateKey.split('-');
    var start = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      COOKING_START_HOUR,
      COOKING_START_MINUTE
    );
    var end = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      COOKING_END_HOUR,
      COOKING_END_MINUTE
    );

    if (start < now) {
      return; // don't create events in the past
    }

    var day = start.getDay();
    if (day === 0 || day === 6) {
      return; // skip weekends
    }

    Logger.log('Creating cooking block for ' + dateKey);
    var event = calendar.createEvent(COOKING_TITLE, start, end);
    event.setDescription(AUTO_MARKER);
  });
}

// === ICS fetching & parsing ===

function fetchLateShiftDates(icsUrl, shiftName) {
  var response = UrlFetchApp.fetch(icsUrl);
  var icsText = response.getContentText();

  var now = new Date();
  var today = stripTime(now);
  var horizon = new Date(today.getTime() + LOOK_AHEAD_DAYS * 86400000);

  var dates = new Set();
  var blocks = icsText.split('BEGIN:VEVENT');

  for (var i = 1; i < blocks.length; i++) {
    var block = blocks[i];

    // Extract SUMMARY (handle \r\n line endings and ICS escaping)
    var summaryMatch = block.match(/SUMMARY:([^\r\n]+)/);
    if (!summaryMatch) {
      continue;
    }
    // ICS escapes commas as \, and semicolons as \; — unescape before comparing
    var summary = summaryMatch[1].trim().replace(/\\,/g, ',').replace(/\\;/g, ';');
    if (summary !== shiftName) {
      continue;
    }

    // Extract date from DTSTART (works for all-day and datetime formats)
    var dtMatch = block.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/);
    if (!dtMatch) {
      continue;
    }

    var eventDate = new Date(
      parseInt(dtMatch[1], 10),
      parseInt(dtMatch[2], 10) - 1,
      parseInt(dtMatch[3], 10)
    );

    if (eventDate >= today && eventDate <= horizon) {
      dates.add(toDateKey(eventDate));
    }
  }

  return dates;
}

// === Helpers ===

function toDateKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
