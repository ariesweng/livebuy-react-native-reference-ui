// VTTSubtitleParser — WebVTT parsing pipeline (rb-react-native-subtitle-vtt-caption-display).
//
// Spec: `reference-ui-rendering/spec.md` §「渲染 RN CaptionOverlay VOD 字幕（CC）」.
//
// Core exposes only `SubtitleTrack.{available,enabled}` (booleans) — there is NO active-caption
// TEXT source. `channel.subtitle_url` points at a WebVTT file the turnkey container (`LivebuyPlayer`)
// fetches and parses itself (see `container/subtitlePipeline.ts`); this file is the pure,
// offline-testable parsing half of that pipeline. No React / React Native / I/O dependency, so it
// is trivial to unit test in plain node.
//
// Ported RULE-for-rule (not code-for-code) from iOS `VTTSubtitleParser.swift`
// (rb-ios-subtitle-vtt-caption-display) / Android `VTTSubtitleParser.kt`
// (rb-android-subtitle-vtt-caption-display) — same decode-tolerant philosophy as the repo's
// existing JSON-decoder-fallback discipline (CLAUDE.md "JSON decoder fallback"): a single
// malformed cue block is skipped without discarding the rest of the file.

/** A single parsed WebVTT cue: a `[start, end)` time window (seconds) and its display text. */
export interface VTTCue {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * Strict numeric parse: empty / whitespace-only / non-numeric -> `undefined`. Mirrors Swift's
 * `Double(_:)` (which returns `nil` for those inputs) — JS's own `Number('')` deceptively returns
 * `0`, which would silently misparse a malformed timestamp fragment as a valid zero instead of
 * rejecting the whole cue. Never used for anything but WebVTT timestamp components.
 */
function parseFloatStrict(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse a single VTT timestamp token — `HH:MM:SS.mmm` or the shorter `MM:SS.mmm` — into seconds.
 * Any other shape -> `undefined` (the caller skips the enclosing cue, not the whole file).
 */
function parseTimestamp(raw: string): number | undefined {
  const token = raw.trim();
  const secAndMs = token.split('.');
  if (secAndMs.length !== 1 && secAndMs.length !== 2) return undefined;

  const hms = secAndMs[0]!.split(':');
  let milliseconds = 0;
  if (secAndMs.length === 2) {
    // Pad/truncate to exactly 3 digits so "5" -> 500ms, "500" -> 500ms, "5000" invalid.
    const msString = secAndMs[1]!;
    if (msString.length > 3) return undefined;
    const msValue = parseFloatStrict(msString);
    if (msValue === undefined) return undefined;
    const scale = Math.pow(10, 3 - msString.length);
    milliseconds = (msValue * scale) / 1000;
  }

  if (hms.length === 3) {
    const h = parseFloatStrict(hms[0]!);
    const m = parseFloatStrict(hms[1]!);
    const s = parseFloatStrict(hms[2]!);
    if (h === undefined || m === undefined || s === undefined) return undefined;
    return h * 3600 + m * 60 + s + milliseconds;
  }
  if (hms.length === 2) {
    const m = parseFloatStrict(hms[0]!);
    const s = parseFloatStrict(hms[1]!);
    if (m === undefined || s === undefined) return undefined;
    return m * 60 + s + milliseconds;
  }
  return undefined;
}

/**
 * Parse a `"<start> --> <end> [cue settings...]"` line into `(start, end)` seconds. Cue settings
 * after the end timestamp (e.g. `align:middle line:90%`) are ignored — only the first
 * whitespace-separated token on the end side is consumed.
 */
function parseTimestampLine(line: string): { start: number; end: number } | undefined {
  const parts = line.split('-->');
  if (parts.length < 2) return undefined;
  const start = parseTimestamp(parts[0]!);
  if (start === undefined) return undefined;
  const endToken = parts[1]!.trim().split(/\s+/)[0] ?? '';
  const end = parseTimestamp(endToken);
  if (end === undefined) return undefined;
  return { start, end };
}

/**
 * Strip WebVTT inline cue-span tags (`<b>`, `</i>`, `<c.classname>`, `<00:00:01.000>`, ...) from a
 * cue text line. The result feeds a plain RN `Text` (`CaptionOverlayView`), which does not
 * interpret markup — leaving tags in would show literal `<i>...</i>` on screen. Simple tag-strip,
 * not full VTT cue-span style support.
 */
function stripInlineTags(line: string): string {
  if (!line.includes('<')) return line;
  let result = '';
  let insideTag = false;
  for (const ch of line) {
    if (ch === '<') {
      insideTag = true;
    } else if (ch === '>') {
      insideTag = false;
    } else if (!insideTag) {
      result += ch;
    }
  }
  return result;
}

/**
 * Parse ONE cue block (the lines between two blank-line separators). A block may open with a
 * `WEBVTT` header line, a `NOTE` comment, or a bare cue-identifier line — all skipped while
 * scanning forward for the first line containing `-->` (the timestamp line). Returns `undefined`
 * when no timestamp line is found, the timestamps fail to parse, or no non-empty text follows
 * (all treated as "not a real cue", not a fatal error for the rest of `parse`).
 */
function parseBlock(block: string): VTTCue | undefined {
  const lines = block.split('\n');
  const timestampIndex = lines.findIndex((l) => l.includes('-->'));
  if (timestampIndex < 0) return undefined;
  const range = parseTimestampLine(lines[timestampIndex]!);
  if (range === undefined) return undefined;

  const text = lines
    .slice(timestampIndex + 1)
    .map(stripInlineTags)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
  if (text.length === 0) return undefined;
  return { start: range.start, end: range.end, text };
}

/**
 * Parse raw WebVTT text into an ordered `VTTCue[]`. Decode-tolerant: a missing `WEBVTT` header,
 * cue-identifier lines, `NOTE` blocks, and cue settings trailing the timestamp line are all
 * tolerated; a single malformed cue block is skipped without discarding the rest of the file.
 * Empty / entirely unparsable input -> `[]`.
 */
function parse(raw: string): VTTCue[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split('\n\n');
  const cues: VTTCue[] = [];
  for (const block of blocks) {
    const cue = parseBlock(block);
    if (cue !== undefined) cues.push(cue);
  }
  return cues;
}

/**
 * Find the cue whose `[start, end)` window contains `time` (start inclusive, end exclusive).
 * `cues` need not be sorted. Multiple overlapping matches -> the first one found (overlapping cue
 * stacking is out of scope). No match -> `undefined`.
 */
function activeCue(cues: readonly VTTCue[], time: number): VTTCue | undefined {
  return cues.find((c) => c.start <= time && time < c.end);
}

export const VTTSubtitleParser = { parse, activeCue };
