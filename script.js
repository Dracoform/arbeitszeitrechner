"use strict";

/**

 * =============================================================

 *  German Work-Time Calculator (ArbZG § 3, § 4, § 5)

 * -------------------------------------------------------------

 *  LEGAL MODEL (§ 4 ArbZG) — CORRECTED:

 *

 *  There is NO independent "mandatory 2nd break" rule. There are

 *  two SEPARATE constraints that together determine break needs:

 *

 *    (A) CONTINUITY: no single work segment may exceed 6 hours

 *        without ANY break.

 *    (B) TOTAL MINUTES: cumulative break time across the day must

 *        reach 30 min (if total net work >6h–9h) or 45 min (if

 *        total net work >9h). Each break chunk must be ≥15 min.

 *

 *  Consequently: a single 45-minute break (taken at/before the 6h

 *  mark) can fully satisfy BOTH constraints for a 10-hour day,

 *  making a second break entirely optional. A second break only

 *  becomes MANDATORY if:

 *    - the segment after break 1 would otherwise exceed 6h, OR

 *    - break 1's duration alone doesn't cover the total-minutes

 *      requirement for the planned total work time.

 *

 *  This file evaluates both conditions live and only shows/forces

 *  a second break when actually legally necessary.

 * =============================================================

 */

// ---- Legal constants (in minutes) --------------------------

const MINUTES_PER_HOUR = 60;

const MAX_CONTINUOUS_WORK_MIN = 6 * MINUTES_PER_HOUR;   // 360 — hard continuity limit

const MIN_BREAK_CHUNK_MIN = 15;                          // minimum size of any break chunk

const STANDARD_WORKDAY_NET_MIN = 8 * MINUTES_PER_HOUR;   // 480

const MAX_WORKDAY_NET_MIN = 10 * MINUTES_PER_HOUR;       // 600 — assumed planning target

const MANDATORY_REST_MIN = 11 * MINUTES_PER_HOUR;        // § 5 ArbZG

const NIGHT_FLAG_HOUR = 20; // 20:00 — threshold for "Beantragung für Bezahlung"

/**

 * Total break minutes legally required, based on total net work.

 * (§ 4 ArbZG Satz 1)

 */

function getRequiredTotalBreakMinutes(totalNetWorkMin) {

  if (totalNetWorkMin > 9 * MINUTES_PER_HOUR) return 45;

  if (totalNetWorkMin > 6 * MINUTES_PER_HOUR) return 30;

  return 0;

}

// ---- DOM references -----------------------------------------

const form = document.getElementById("time-form");

const startTimeInput = document.getElementById("start-time");

const errorMsg = document.getElementById("error-msg");

const resultsSection = document.getElementById("results-section");

const complianceBox = document.getElementById("compliance-warnings");

const displayStart = document.getElementById("display-start");

const display8h = document.getElementById("display-8h");

const display10h = document.getElementById("display-10h");

const displayRest = document.getElementById("display-rest");

const break1StartInput = document.getElementById("break1-start-input");

const break1EndInput = document.getElementById("break1-end-input");

const break1StartOffset = document.getElementById("break1-start-offset");

const break1EndOffset = document.getElementById("break1-end-offset");

const break1Warning = document.getElementById("break1-warning");

const break1ResetBtn = document.getElementById("break1-reset");

const break1RequirementNote = document.getElementById("break1-requirement-note");

const break2StartInput = document.getElementById("break2-start-input");

const break2EndInput = document.getElementById("break2-end-input");

const break2StartOffset = document.getElementById("break2-start-offset");

const break2EndOffset = document.getElementById("break2-end-offset");

const break2Warning = document.getElementById("break2-warning");

const break2ResetBtn = document.getElementById("break2-reset");

const break2RequirementNote = document.getElementById("break2-requirement-note");

const break2Tag = document.getElementById("break2-tag");

const break2EnabledCheckbox = document.getElementById("break2-enabled-checkbox");

const break2InputsWrapper = document.getElementById("break2-inputs-wrapper");

const badge10hEl = document.getElementById("badge-10h");

const item10hEl = document.getElementById("item-10h");

// =============================================================

//  Application state (mutable, single source of truth)

// =============================================================

const state = {

  start: null,

  break1Start: null,

  break1End: null,

  break1Touched: false,

  break2Start: null,

  break2End: null,

  break2Touched: false,

  break2Enabled: false,

  break2Requirement: null, // cached result of evaluateBreak2Requirement()

};

// =============================================================

//  Date/Time helper utilities

// =============================================================

function addMinutes(date, minutes) {

  return new Date(date.getTime() + minutes * 60000);

}

function parseStartTime(timeStr) {

  const match = /^(\d{2}):(\d{2})$/.exec(timeStr);

  if (!match) return null;

  const hours = Number(match[1]);

  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

}

/**

 * Combines a base date's Y/M/D with a "HH:MM" string, rolling

 * forward in 24h increments until strictly after `mustBeAfter`.

 * Enables cross-midnight editing without asking for a date.

 */

function combineTimeAfter(baseDate, timeStr, mustBeAfter) {

  const [h, m] = timeStr.split(":").map(Number);

  let candidate = new Date(

    baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h, m, 0, 0

  );

  while (candidate.getTime() <= mustBeAfter.getTime()) {

    candidate = addMinutes(candidate, 24 * 60);

  }

  return candidate;

}

function calendarDayDiff(reference, target) {

  const refMid = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

  const tgtMid = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  return Math.round((tgtMid.getTime() - refMid.getTime()) / 86400000);

}

function formatTime(date) {

  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false });

}

function toTimeInputValue(date) {

  const hh = String(date.getHours()).padStart(2, "0");

  const mm = String(date.getMinutes()).padStart(2, "0");

  return `${hh}:${mm}`;

}

function formatDurationMin(totalMinutes) {

  const h = Math.floor(totalMinutes / 60);

  const m = Math.round(totalMinutes % 60);

  if (h <= 0) return `${m} Min.`;

  return `${h} Std. ${m} Min.`;

}

function isPastEveningThreshold(date, startDate) {

  const evening = new Date(

    startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), NIGHT_FLAG_HOUR, 0, 0, 0

  );

  return date.getTime() >= evening.getTime();

}

function dayBadgeHTML(start, target) {

  const diff = calendarDayDiff(start, target);

  return diff > 0 ? ` <span class="day-offset">+${diff}T</span>` : "";

}

function setOffsetBadge(el, start, target) {

  const diff = calendarDayDiff(start, target);

  if (diff > 0) {

    el.textContent = `+${diff}T`;

    el.hidden = false;

  } else {

    el.hidden = true;

  }

}

// =============================================================

//  Core simulation engine — walks work/break intervals to find

//  the clock time at which cumulative NET WORK reaches a target.

//  Zero-length break segments (break2 disabled) are automatically

//  skipped, so no special-casing is needed elsewhere.

// =============================================================

function buildIntervals(start, b1s, b1e, b2s, b2e) {

  return [

    { start: start, end: b1s, isWork: true },

    { start: b1s, end: b1e, isWork: false },

    { start: b1e, end: b2s, isWork: true },

    { start: b2s, end: b2e, isWork: false },

    { start: b2e, end: addMinutes(b2e, 48 * 60), isWork: true }, // open-ended buffer

  ];

}

function findTimeAtNetWork(targetMinutes, intervals) {

  let cumulative = 0;

  for (const iv of intervals) {

    const durMin = (iv.end.getTime() - iv.start.getTime()) / 60000;

    if (durMin <= 0) continue; // skips zero-length / disabled break2 automatically

    if (iv.isWork) {

      if (cumulative + durMin >= targetMinutes) {

        return addMinutes(iv.start, targetMinutes - cumulative);

      }

      cumulative += durMin;

    }

  }

  return null;

}

// =============================================================

//  Break 1 default suggestion

// =============================================================

function getDefaultBreak1(start) {

  const s = addMinutes(start, MAX_CONTINUOUS_WORK_MIN); // latest legal start = 6h mark

  const e = addMinutes(s, 30); // 30 min is a sensible default duration (not a legal fixed value)

  return { start: s, end: e };

}

// =============================================================

//  Break 2 requirement evaluation — THE CORE FIX

// =============================================================

/**

 * Determines whether a second break is legally required, given

 * where break 1 was actually placed, and assuming the planning

 * target is the full 10h legal maximum (this app's worst-case

 * planning horizon).

 */

function evaluateBreak2Requirement(start, break1Start, break1End) {

  const netBeforeBreak1Min = (break1Start - start) / 60000;

  const break1DurationMin = (break1End - break1Start) / 60000;

  const requiredTotalMin = getRequiredTotalBreakMinutes(MAX_WORKDAY_NET_MIN); // 45, for a 10h day

  // Continuity check: if NO second break is taken, would the work

  // segment after break 1 (running all the way to 10h total net

  // work) exceed the 6h continuity limit?

  const remainingContinuousWorkIfNoBreak2 = MAX_WORKDAY_NET_MIN - netBeforeBreak1Min;

  const continuityViolated = remainingContinuousWorkIfNoBreak2 > MAX_CONTINUOUS_WORK_MIN;

  // Total-minutes check: does break 1 alone already cover the

  // required total break time for a 10h day?

  const minutesShortfall = Math.max(0, requiredTotalMin - break1DurationMin);

  const minutesInsufficient = minutesShortfall > 0;

  const required = continuityViolated || minutesInsufficient;

  // Hard legal deadline for break 2 IF required by continuity:

  // it must begin before 6 continuous hours elapse after break 1.

  const continuityDeadline = addMinutes(break1End, MAX_CONTINUOUS_WORK_MIN);

  const suggestedDurationMin = required

    ? Math.max(MIN_BREAK_CHUNK_MIN, minutesShortfall)

    : 0;

  return {

    required,

    continuityViolated,

    minutesInsufficient,

    minutesShortfall,

    requiredTotalMin,

    break1DurationMin,

    continuityDeadline,

    suggestedDurationMin,

  };

}

/**

 * Computes a sensible DEFAULT POSITION for break 2 when required.

 * Mirrors the original spec's example (9h-net-work heuristic) for

 * the common case, but is automatically capped by the hard

 * continuity deadline whenever break 1 was taken early enough that

 * continuity — not total minutes — is the binding constraint.

 */

function getDefaultBreak2Suggestion(start, break1Start, break1End, requirement) {

  const netBeforeBreak1Min = (break1Start - start) / 60000;

  const remainingToNineHours = Math.max(0, 9 * MINUTES_PER_HOUR - netBeforeBreak1Min);

  const heuristicPosition = addMinutes(break1End, remainingToNineHours);

  const cappedPosition =

    heuristicPosition.getTime() < requirement.continuityDeadline.getTime()

      ? heuristicPosition

      : requirement.continuityDeadline;

  const duration = requirement.suggestedDurationMin;

  return { start: cappedPosition, end: addMinutes(cappedPosition, duration) };

}

// =============================================================

//  Sync logic — keeps break 2 in step with break 1 unless the

//  user has manually taken control of break 2.

// =============================================================

function autoSyncBreak2() {

  const requirement = evaluateBreak2Requirement(state.start, state.break1Start, state.break1End);

  state.break2Requirement = requirement;

  if (state.break2Touched) return; // user has manual control — leave alone

  state.break2Enabled = requirement.required;

  if (requirement.required) {

    const def2 = getDefaultBreak2Suggestion(state.start, state.break1Start, state.break1End, requirement);

    state.break2Start = def2.start;

    state.break2End = def2.end;

  } else {

    // Not required — park at the continuity deadline with zero

    // duration, so if the user manually enables it later there's

    // a sensible starting point to edit from.

    state.break2Start = requirement.continuityDeadline;

    state.break2End = requirement.continuityDeadline;

  }

}

// =============================================================

//  Compliance validation

// =============================================================

function getComplianceWarnings() {

  const warnings = [];

  const netBeforeBreak1Min = (state.break1Start - state.start) / 60000;

  const break1DurationMin = (state.break1End - state.break1Start) / 60000;

  // --- Segment 1 continuity (start -> break1) ---

  if (netBeforeBreak1Min > MAX_CONTINUOUS_WORK_MIN) {

    warnings.push(

      `1. Pause beginnt zu spät: ${formatDurationMin(netBeforeBreak1Min)} ohne Pause gearbeitet (max. 6 Std. erlaubt).`

    );

  }

  // --- Break 1 minimum chunk size ---

  if (break1DurationMin > 0 && break1DurationMin < MIN_BREAK_CHUNK_MIN) {

    warnings.push(`1. Pause ist kürzer als die gesetzliche Mindestdauer von 15 Minuten.`);

  }

  if (state.break2Enabled) {

    const netBetweenBreaksMin = (state.break2Start - state.break1End) / 60000;

    const break2DurationMin = (state.break2End - state.break2Start) / 60000;

    if (netBetweenBreaksMin < 0) {

      warnings.push(`2. Pause beginnt vor Ende der 1. Pause – bitte Zeiten prüfen.`);

    } else if (netBetweenBreaksMin > MAX_CONTINUOUS_WORK_MIN) {

      warnings.push(

        `Zwischen den Pausen wird ${formatDurationMin(netBetweenBreaksMin)} durchgehend gearbeitet (max. 6 Std. erlaubt).`

      );

    }

    if (break2DurationMin > 0 && break2DurationMin < MIN_BREAK_CHUNK_MIN) {

      warnings.push(`2. Pause ist kürzer als die gesetzliche Mindestdauer von 15 Minuten.`);

    }

    const totalBreakMin = break1DurationMin + break2DurationMin;

    const requiredTotalMin = getRequiredTotalBreakMinutes(MAX_WORKDAY_NET_MIN);

    if (totalBreakMin < requiredTotalMin) {

      warnings.push(

        `Gesamte Pausenzeit unzureichend: ${Math.round(totalBreakMin)} von ${requiredTotalMin} Minuten (bei bis zu 10 Std. Arbeit).`

      );

    }

  } else {

    // Break 2 disabled — verify that's actually legally fine.

    const requirement = evaluateBreak2Requirement(state.start, state.break1Start, state.break1End);

    if (requirement.required) {

      warnings.push(`Zweite Pause wurde deaktiviert, ist aber laut Berechnung gesetzlich erforderlich.`);

    }

  }

  return warnings;

}

function renderComplianceBanner(warnings) {

  if (warnings.length === 0) {

    complianceBox.className = "compliance-warnings ok";

    complianceBox.innerHTML = "✓ Alle Pausenzeiten entsprechen den gesetzlichen Vorgaben.";

    complianceBox.hidden = false;

    return;

  }

  complianceBox.className = "compliance-warnings";

  complianceBox.innerHTML =

    "<strong>⚠ Gesetzliche Vorgaben verletzt:</strong><ul>" +

    warnings.map((w) => `<li>${w}</li>`).join("") +

    "</ul>";

  complianceBox.hidden = false;

}

// =============================================================

//  Rendering — Requirement notes

// =============================================================

function renderBreak1Note() {

  const deadline = addMinutes(state.start, MAX_CONTINUOUS_WORK_MIN);

  const requiredTotalMin = getRequiredTotalBreakMinutes(MAX_WORKDAY_NET_MIN);

  break1RequirementNote.innerHTML =

    `Spätester Beginn: <strong>${formatTime(deadline)}${dayBadgeHTML(state.start, deadline)}</strong> ` +

    `(6 Std. ohne Pause max., § 4 ArbZG). Mindestdauer je Abschnitt: 15 Min. ` +

    `Gesamter Pausenanspruch bei bis zu 10 Std. Arbeit: <strong>${requiredTotalMin} Min.</strong>`;

}

function renderBreak2Note(requirement) {

  if (requirement.required) {

    break2Tag.textContent = "gesetzlich erforderlich";

    break2Tag.className = "tag tag--required";

    const reasons = [];

    if (requirement.continuityViolated) {

      reasons.push(

        `ohne weitere Pause wären ab ${formatTime(state.break1End)} mehr als 6 Std. durchgehend gearbeitet worden`

      );

    }

    if (requirement.minutesInsufficient) {

      reasons.push(

        `die 1. Pause allein (${Math.round(requirement.break1DurationMin)} Min.) erreicht nicht die insgesamt erforderlichen ${requirement.requiredTotalMin} Min.`

      );

    }

    break2RequirementNote.innerHTML =

      `⚠ Erforderlich, da ${reasons.join(" und ")}. ` +

      `Spätester Beginn: <strong>${formatTime(requirement.continuityDeadline)}${dayBadgeHTML(state.start, requirement.continuityDeadline)}</strong> ` +

      `(6 Std. nach Ende der 1. Pause) — Mindestdauer: <strong>${Math.round(requirement.suggestedDurationMin)} Min.</strong>`;

  } else {

    break2Tag.textContent = "optional";

    break2Tag.className = "tag tag--optional";

    break2RequirementNote.innerHTML =

      `✓ Nicht gesetzlich erforderlich: Die 1. Pause (${Math.round(requirement.break1DurationMin)} Min.) ` +

      `deckt bereits den gesetzlichen Gesamtanspruch von ${requirement.requiredTotalMin} Min. ab, ` +

      `und kein Arbeitsabschnitt überschreitet 6 Std. Sie können optional trotzdem eine weitere Pause einplanen.`;

  }

}

// =============================================================

//  Main render / recalculation routine

// =============================================================

function recalcAndRender() {

  const { start, break1Start, break1End, break2Start, break2End, break2Enabled } = state;

  const fullIntervals = buildIntervals(start, break1Start, break1End, break2Start, break2End);

  const standardWorkdayEnd = findTimeAtNetWork(STANDARD_WORKDAY_NET_MIN, fullIntervals);

  const legalMaximum = findTimeAtNetWork(MAX_WORKDAY_NET_MIN, fullIntervals);

  const earliestNextStart = legalMaximum ? addMinutes(legalMaximum, MANDATORY_REST_MIN) : null;

  // ---- Read-only displays ----

  displayStart.innerHTML = formatTime(start);

  if (standardWorkdayEnd) {

    display8h.innerHTML = formatTime(standardWorkdayEnd) + dayBadgeHTML(start, standardWorkdayEnd);

  }

  if (legalMaximum) {

    display10h.innerHTML = formatTime(legalMaximum) + dayBadgeHTML(start, legalMaximum);

  }

  if (earliestNextStart) {

    displayRest.innerHTML = formatTime(earliestNextStart) + dayBadgeHTML(start, earliestNextStart);

  }

  // ---- Break 1 inputs ----

  break1StartInput.value = toTimeInputValue(break1Start);

  break1EndInput.value = toTimeInputValue(break1End);

  setOffsetBadge(break1StartOffset, start, break1Start);

  setOffsetBadge(break1EndOffset, start, break1End);

  renderBreak1Note();

  // ---- Break 2 inputs & requirement note ----

  const requirement = state.break2Requirement || evaluateBreak2Requirement(start, break1Start, break1End);

  renderBreak2Note(requirement);

  break2EnabledCheckbox.checked = break2Enabled;

  break2StartInput.disabled = !break2Enabled;

  break2EndInput.disabled = !break2Enabled;

  break2StartInput.value = toTimeInputValue(break2Start);

  break2EndInput.value = toTimeInputValue(break2End);

  setOffsetBadge(break2StartOffset, start, break2Start);

  setOffsetBadge(break2EndOffset, start, break2End);

  // ---- The ONLY place the "Beantragung für Bezahlung" badge is

  // ever shown: the final work milestone of the day (10h max),

  // and only if it genuinely falls at/after 20:00 or into the

  // next calendar day. ----

  if (legalMaximum && item10hEl && badge10hEl) {

    const requiresPaymentClaim = isPastEveningThreshold(legalMaximum, start);

    item10hEl.classList.toggle("flagged", requiresPaymentClaim);

    badge10hEl.hidden = !requiresPaymentClaim;

  }

  // ---- Compliance banner ----

  const warnings = getComplianceWarnings();

  renderComplianceBanner(warnings);

  break1Warning.hidden = true;

  break2Warning.hidden = true;

  warnings.forEach((w) => {

    if (w.startsWith("1. Pause")) {

      break1Warning.textContent = w;

      break1Warning.hidden = false;

    }

    if (w.startsWith("2. Pause") || w.startsWith("Zwischen") || w.startsWith("Gesamte") || w.startsWith("Zweite Pause")) {

      break2Warning.textContent = w;

      break2Warning.hidden = false;

    }

  });

  resultsSection.hidden = false;

}

// =============================================================

//  Event handlers — Break 1

// =============================================================

break1StartInput.addEventListener("change", () => {

  const oldStart = state.break1Start;

  const newStart = combineTimeAfter(state.start, break1StartInput.value, state.start);

  const delta = newStart.getTime() - oldStart.getTime();

  state.break1Start = newStart;

  state.break1End = new Date(state.break1End.getTime() + delta); // preserve duration

  state.break1Touched = true;

  afterBreak1Changed();

});

break1EndInput.addEventListener("change", () => {

  state.break1End = combineTimeAfter(state.break1Start, break1EndInput.value, state.break1Start);

  state.break1Touched = true;

  afterBreak1Changed();

});

break1ResetBtn.addEventListener("click", () => {

  const def1 = getDefaultBreak1(state.start);

  state.break1Start = def1.start;

  state.break1End = def1.end;

  state.break1Touched = false;

  afterBreak1Changed();

});

function afterBreak1Changed() {

  if (!state.break2Touched) {

    autoSyncBreak2();

  } else {

    // Even if break 2 is user-controlled, refresh the requirement

    // evaluation so the note/warnings stay accurate.

    state.break2Requirement = evaluateBreak2Requirement(state.start, state.break1Start, state.break1End);

  }

  recalcAndRender();

}

// =============================================================

//  Event handlers — Break 2

// =============================================================

break2EnabledCheckbox.addEventListener("change", () => {

  state.break2Touched = true;

  state.break2Enabled = break2EnabledCheckbox.checked;

  if (state.break2Enabled) {

    const currentDurationMin = (state.break2End - state.break2Start) / 60000;

    if (currentDurationMin <= 0) {

      // Give it a sensible non-zero default if turning on from a

      // previously "parked" (zero-duration) state.

      const requirement = state.break2Requirement ||

        evaluateBreak2Requirement(state.start, state.break1Start, state.break1End);

      const dur = Math.max(MIN_BREAK_CHUNK_MIN, requirement.minutesShortfall);

      state.break2End = addMinutes(state.break2Start, dur);

    }

  }

  recalcAndRender();

});

break2StartInput.addEventListener("change", () => {

  const oldStart = state.break2Start;

  const newStart = combineTimeAfter(state.break1End, break2StartInput.value, state.break1End);

  const delta = newStart.getTime() - oldStart.getTime();

  state.break2Start = newStart;

  state.break2End = new Date(state.break2End.getTime() + delta);

  state.break2Touched = true;

  state.break2Enabled = true;

  recalcAndRender();

});

break2EndInput.addEventListener("change", () => {

  state.break2End = combineTimeAfter(state.break2Start, break2EndInput.value, state.break2Start);

  state.break2Touched = true;
  state.break2Enabled = true;

  recalcAndRender();

});

break2ResetBtn.addEventListener("click", () => {

  state.break2Touched = false;

  autoSyncBreak2();

  recalcAndRender();

});

// =============================================================

//  Form handling — Start time

// =============================================================

function showError(message) {

  errorMsg.textContent = message;

  errorMsg.hidden = false;

  resultsSection.hidden = true;

}

function clearError() {

  errorMsg.hidden = true;

  errorMsg.textContent = "";

}

form.addEventListener("submit", (event) => {

  event.preventDefault();

  clearError();

  const rawValue = startTimeInput.value;

  if (!rawValue) {

    showError("Bitte eine gültige Startzeit im Format HH:MM eingeben.");

    return;

  }

  const startDate = parseStartTime(rawValue);

  if (!startDate) {

    showError("Ungültiges Zeitformat. Bitte HH:MM verwenden (z. B. 08:00).");

    return;

  }

  // Reset entire state — a new start time means fresh suggestions.

  state.start = startDate;

  const def1 = getDefaultBreak1(startDate);

  state.break1Start = def1.start;

  state.break1End = def1.end;

  state.break1Touched = false;

  state.break2Touched = false;

  autoSyncBreak2();

  recalcAndRender();

});

// Auto-calculate on load using the default input value.

window.addEventListener("DOMContentLoaded", () => {

  form.dispatchEvent(new Event("submit"));

});