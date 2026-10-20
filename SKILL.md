---
name: create-abc-notation-from-image-solfa
description: >-
  Use when asked to convert a Curwen Tonic Sol-fa hymn score image (photo, scan,
  screenshot) into real, standard ABC notation for the SolfaTunes app. Triggers
  on "solfa to ABC", "convert this tonic sol-fa", "transcribe this hymn for
  SolfaTunes", or any image of d r m f s l t notation, with or without a descant.
  Operates in two defined instructions: (1) extract tonic sol-fa from the image
  into neat plain text with all timing, rhythm, and punctuation intact, and (2)
  convert the plain text into SolfaTunes-compliant ABC notation. The final output
  presents both the neat plain text tonic sol-fa and the converted ABC notation.
---

# SKILL: Convert Curwen Tonic Sol-fa Image to ABC for SolfaTunes

Convert an image of a Curwen Tonic Sol-fa hymn score into standard ABC notation that the SolfaTunes app (https://github.com/PYTHAGON2/SolfaTunes/) can parse, render, and play back.

This skill is organized into **two definition instructions**:
1. **Definition Instruction 1 (Extraction):** Read the score image and extract the Tonic Sol-fa into neat, well-aligned plain text with all timing punctuation, octave marks, voice layouts, barlines, and lyrics intact.
2. **Definition Instruction 2 (Conversion):** Convert the neat plain-text Tonic Sol-fa into standard, sounding ABC notation matching the exact specifications of SolfaTunes' timing and parsing engine.
3. **Mandatory Round-Trip Verification:** Test results by converting the generated ABC notes back to sol-fa notes and verifying that they match the original plain-text sol-fa.

**Final Output Requirement:**
Every transcription response must provide **both** outputs in order:
1. **Neat Plain Text Tonic Sol-fa** code block.
2. **Converted ABC Notation** code block.

---

## 0. Fundamental Boundaries & Output Contract

1. **Two Distinct Stages:**
   - **Stage 1 (Plain Text):** Authentic Tonic Sol-fa text using syllables (`d r m f s l t`), punctuation (`|`, `||`, `|]`, `:`, `.`, `,`, `-`), and octave marks (`₁`, `₂`, `¹`).
   - **Stage 2 (ABC):** Pure ABC notation using sounding note letters (`A-G`, `a-g`), pitch modifiers (`,`, `'`, `^`, `_`, `=`), and durations (`2`, `3/2`, `/2`, `/4`).
2. **Never Mix Sol-fa and ABC:**
   - Sol-fa syllables (`r s l t m`), colons (`:`), and solitary dashes (`-`) must NEVER appear in ABC music lines.
   - ABC music lines contain only valid ABC tokens: note letters, octave marks `,`/`'`, accidentals, durations, and barlines.

---

## 1. Definition Instruction 1: Extract Tonic Sol-fa from Image to Plain Text

Extract the printed Curwen Tonic Sol-fa score from the image into clean, readable, pulse-aligned plain text. All rhythmic punctuation, octave markers, voice alignments, and lyrics must be preserved with 100% fidelity.

### A. Key, Meter, and Metadata Extraction
- **Key:** Read the printed `KEY [Letter]` (e.g. `KEY Bb`, `KEY F`, `KEY G`). Always record it at the top of the plain text.
- **Title & Tune Name:** Extract the tune name (e.g., `Warrington`, `Hursley`) and composer/dates (e.g., `R. Harrison, 1748–1810`).
- **Meter:** If printed, record it (e.g., `3/4`, `4/4`, `6/8`). If not explicitly printed, count the pulses between standard barlines `|`:
  - 2 pulses between barlines `|` -> `2/4`
  - 3 pulses between barlines `|` -> `3/4`
  - 4 pulses between barlines `|` -> `4/4`
  - 2 compound pulses (each subdivided into 3) -> `6/8`
- **Descant:** If a top row is labelled "DESCANT", record `has_descant=true`.
- **Hymn Name & Verses:** Extract hymn title or text meter if printed (e.g., `8.6.8.6`).

### B. Voice Stacking & System Alignment
Curwen scores stack vocal parts in rows per system, pulse-aligned vertically inside brackets `{` `}`:
- **Descant (`D:`):** Present in some hymn arrangements as an extra top row.
- **Soprano (`S:`):** Melody line (top row in standard SATB).
- **Alto (`A:`):** Second voice from top.
- **Tenor (`T:`):** Third voice (written in treble register, sounds an octave lower).
- **Bass (`B:`):** Bottom voice.

In the neat plain text output:
- Use explicit voice prefixes (`D:`, `S:`, `A:`, `T:`, `B:`).
- Align barlines `|` and colons `:` vertically across all voices in each system for visual clarity.

### C. Syllable & Chromatic Extraction
- **Diatonic Degrees:** `d` (do), `r` (re), `m` (mi), `f` (fa), `s` (sol), `l` (la), `t` (ti).
- **Raised Degrees (Sharpened):** Syllables ending in `e` or `i`: `de`, `re`, `fe`, `se`, `le` (or `di`, `ri`, `fi`, `si`, `li`).
- **Lowered Degrees (Flattened):** Syllables ending in `a`: `ta`, `la`, `ma`, `ra`.

### D. Octave Marks Extraction
- **Central Octave:** Plain syllable with no mark (e.g., `d`, `s`, `m`).
- **Lower Octaves:** Subscripts `₁` (one octave below central), `₂` (two octaves below central).
  *Note on Subscripts:* Subscript `₁` is small printed text. Always zoom in to verify. An apparent leap of a 7th between neighboring melody notes is almost always a missed subscript `₁`.
- **Upper Octaves:** Superscript `¹` or prime `'` (e.g., `d¹`, `s¹`).
- In plain text, write: `d₁`, `s₁`, `f₁`, `m₁`, `r₁`, `t₁`, `l₁`, `d₂`, `l₂`, `t₂`, `d¹`.

### E. Timing Punctuation Grid (Exact Tonic Sol-fa Syntax)
Every beat pulse and subdivision in Tonic Sol-fa has strict punctuation:

| Symbol | Name | Exact Timing Meaning |
|---|---|---|
| `\|` | Barline | Measure boundary |
| `\|\|` | Double barline | Phrase, section, or line break |
| `\|]` | Final barline | End of the hymn |
| `:` | Pulse divider | Separates main beat pulses inside a measure |
| `-` | Continuation | Previous note is sustained through this pulse (or half-pulse) |
| `.` | Half-pulse divider | Divides a pulse into two halves (e.g., `t.l` = two equal half-pulses) |
| `,` | Quarter-pulse divider | Divides a half-pulse into two quarter-pulses (sixteenth notes) |
| `:-.r` | Sustained + late starter | Note held for 1.5 pulses, then a half-pulse starts |
| `empty` | Rest / Silence | Space between colons (e.g., `: :` or explicit rest) |

### F. Phrase-End Bar Splits (`||`) and Pickup Bars (Anacrusis)
1. **Split Bars across `||`:**
   Many Curwen scores split a measure across phrase barlines `||`:
   ```text
   | d : - || m | r : - : r |
   ```
   The 2 pulses of `d : -` before `||` and the 1 pulse `m` after `||` together form one complete 3-pulse measure. Preserve this exact printed layout in the plain text.
2. **Opening Pickup Bars:**
   If the first bar is an upbeat (e.g., `| s₁ | d : - : m |`), write the exact partial bar. Do not insert extra rests or pad the bar.

### G. Lyrics Extraction
- Copy lyrics line-by-line under the relevant system, prefixed with `W:`.
- Preserve stanza numbering and punctuation.

---

## 2. Definition Instruction 2: Convert Plain Text Sol-fa to Standard ABC

Convert the extracted plain text Tonic Sol-fa into standard, sounding ABC notation suitable for the SolfaTunes app.

### A. Pitch Mapping Fundamentals
ABC pitches represent **sounding pitches**:
1. **Key Signature (`K:`):** Matches the printed key (e.g. `K:Bb`, `K:F`, `K:G`). SolfaTunes automatically handles key signature accidentals. Plain scale degrees use plain ABC letters without extra accidental prefixes.
2. **Soprano, Alto, and Descant:** Use the **literal central pitch tables** below. Uppercase letters (`C-B`) represent octave 4 (middle C to B4). Lowercase letters (`c-b`) represent octave 5.
3. **Tenor and Bass:** Sol-fa prints Tenor and Bass an octave higher than they sound. Therefore, **Tenor and Bass must be shifted one octave lower** than the Soprano/Alto table. Read Tenor/Bass **one column to the left** (Tenor/Bass central octave = the `₁` column).
4. **Range Sanity Check:** Descant > Soprano > Alto > Tenor > Bass. Soprano is roughly C4–A5; Alto G3–D5; Tenor C3–G4; Bass E2–D4.

---

### B. Complete Hymn Key Pitch Reference Tables

For **Soprano**, **Alto**, and **Descant**, use the literal columns below.
For **Tenor** and **Bass**, shift **one column to the left** (Tenor/Bass central octave = the `₁` column).

#### Key of C (`K:C`, tonic C, 0 sharps/flats)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `C,,` | `C,` | `C` | `c` |
| r | `D,,` | `D,` | `D` | `d` |
| m | `E,,` | `E,` | `E` | `e` |
| f | `F,,` | `F,` | `F` | `f` |
| s | `G,,` | `G,` | `G` | `g` |
| l | `A,,` | `A,` | `A` | `a` |
| t | `B,,` | `B,` | `B` | `b` |

#### Key of G (`K:G`, tonic G, 1 sharp: F#)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `G,,` | `G,` | `G` | `g` |
| r | `A,,` | `A,` | `A` | `a` |
| m | `B,,` | `B,` | `B` | `b` |
| f | `C,` | `C` | `c` | `c'` |
| s | `D,` | `D` | `d` | `d'` |
| l | `E,` | `E` | `e` | `e'` |
| t | `F,` | `F` | `f` | `f'` |

#### Key of D (`K:D`, tonic D, 2 sharps: F#, C#)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `D,,` | `D,` | `D` | `d` |
| r | `E,,` | `E,` | `E` | `e` |
| m | `F,,` | `F,` | `F` | `f` |
| f | `G,,` | `G,` | `G` | `g` |
| s | `A,,` | `A,` | `A` | `a` |
| l | `B,,` | `B,` | `B` | `b` |
| t | `C,` | `C` | `c` | `c'` |

#### Key of A (`K:A`, tonic A, 3 sharps: F#, C#, G#)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `A,,` | `A,` | `A` | `a` |
| r | `B,,` | `B,` | `B` | `b` |
| m | `C,` | `C` | `c` | `c'` |
| f | `D,` | `D` | `d` | `d'` |
| s | `E,` | `E` | `e` | `e'` |
| l | `F,` | `F` | `f` | `f'` |
| t | `G,` | `G` | `g` | `g'` |

#### Key of E (`K:E`, tonic E, 4 sharps: F#, C#, G#, D#)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `E,,` | `E,` | `E` | `e` |
| r | `F,,` | `F,` | `F` | `f` |
| m | `G,,` | `G,` | `G` | `g` |
| f | `A,,` | `A,` | `A` | `a` |
| s | `B,,` | `B,` | `B` | `b` |
| l | `C,` | `C` | `c` | `c'` |
| t | `D,` | `D` | `d` | `d'` |

#### Key of F (`K:F`, tonic F, 1 flat: Bb)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `F,,` | `F,` | `F` | `f` |
| r | `G,,` | `G,` | `G` | `g` |
| m | `A,,` | `A,` | `A` | `a` |
| f | `B,,` | `B,` | `B` | `b` |
| s | `C,` | `C` | `c` | `c'` |
| l | `D,` | `D` | `d` | `d'` |
| t | `E,` | `E` | `e` | `e'` |

#### Key of Bb (`K:Bb`, tonic Bb, 2 flats: Bb, Eb)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `B,,` | `B,` | `B` | `b` |
| r | `C,` | `C` | `c` | `c'` |
| m | `D,` | `D` | `d` | `d'` |
| f | `E,` | `E` | `e` | `e'` |
| s | `F,` | `F` | `f` | `f'` |
| l | `G,` | `G` | `g` | `g'` |
| t | `A,` | `A` | `a` | `a'` |

#### Key of Eb (`K:Eb`, tonic Eb, 3 flats: Bb, Eb, Ab)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `E,,` | `E,` | `E` | `e` |
| r | `F,,` | `F,` | `F` | `f` |
| m | `G,,` | `G,` | `G` | `g` |
| f | `A,,` | `A,` | `A` | `a` |
| s | `B,,` | `B,` | `B` | `b` |
| l | `C,` | `C` | `c` | `c'` |
| t | `D,` | `D` | `d` | `d'` |

#### Key of Ab (`K:Ab`, tonic Ab, 4 flats: Bb, Eb, Ab, Db)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `A,,` | `A,` | `A` | `a` |
| r | `B,,` | `B,` | `B` | `b` |
| m | `C,` | `C` | `c` | `c'` |
| f | `D,` | `D` | `d` | `d'` |
| s | `E,` | `E` | `e` | `e'` |
| l | `F,` | `F` | `f` | `f'` |
| t | `G,` | `G` | `g` | `g'` |

#### Key of Db (`K:Db`, tonic Db, 5 flats: Bb, Eb, Ab, Db, Gb)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `D,,` | `D,` | `D` | `d` |
| r | `E,,` | `E,` | `E` | `e` |
| m | `F,,` | `F,` | `F` | `f` |
| f | `G,,` | `G,` | `G` | `g` |
| s | `A,,` | `A,` | `A` | `a` |
| l | `B,,` | `B,` | `B` | `b` |
| t | `C,` | `C` | `c` | `c'` |

---

### C. Duration and Meter Mapping (Under `L:1/4`)
Always declare `L:1/4` in the ABC header. Durations scale relative to quarter notes:

| Tonic Sol-fa Pattern | Meaning | ABC Duration (`L:1/4`) | Example in K:Bb |
|---|---|---|---|
| `d` | 1 pulse | `1` (plain letter) | `B` |
| `d :-` | 2 pulses | `2` | `B2` |
| `d :- :-` | 3 pulses | `3` | `B3` |
| `d :- :- :-` | 4 pulses | `4` | `B4` |
| `r.d` | Two half-pulses | `/2` `/2` | `c/2 B/2` |
| `d :-.r` | 1.5 pulses + 0.5 pulse | `3/2` `/2` | `B3/2 c/2` |
| `d,r.m` | Two quarters + one half | `/4` `/4` `/2` | `B/4 c/4 d/2` |
| `d.r,m` | One half + two quarters | `/2` `/4` `/4` | `B/2 c/4 d/4` |
| `d,r,m,f` | Four quarter-pulses (sixteenths) | `/4` `/4` `/4` `/4` | `B/4 c/4 d/4 e/4` |
| `d : r` in 6/8 | Two compound pulses (dotted quarters) | `3/2` `3/2` | `B3/2 c3/2` |
| `d :-` in 6/8 | Held compound pulse (dotted half) | `3` | `B3` |
| empty pulse | Silence / Rest | `z` | `z` |

### D. Chromatic Syllables to ABC Accidentals
State explicit accidentals using `^` (sharp), `_` (flat), or `=` (natural):
- `K:Bb`, central S/A: `fe` / `fi` = `=e` (or `=E`), `se` = `^f`, `re` = `^c`, `ta` = `_a`.
  *In Warrington Alto: `fe₁` = `=E` (E natural 4).*
- `K:F`, central S/A: `fe` = `=B`, `de` = `^F`, `se` = `^c`, `ta` = `_e`.
- `K:G`, central S/A: `fe` = `=c`, `se` = `^d`, `ta` = `=f`.

---

### E. SolfaTunes ABC File Format Structure
```abc
X:1
T:[Tune Name]
C:[Composer / Source]
M:[3/4 or 4/4 or 6/8]
L:1/4
K:[Key]
% tune_name=[Tune Name]
% hymn_name=[Hymn name, if known]
% hymn_meter=[Meter, e.g. 8.6.8.6, if known]
% has_descant=[true/false]
%%staves [(5) (1 2) (3 4)]  <-- Include (5) only if descant is present
V:5 name="Descant" clef=treble  <-- Only if descant is present
V:1 name="Soprano" clef=treble
V:2 name="Alto" clef=treble
V:3 name="Tenor" clef=treble
V:4 name="Bass" clef=bass

% --- System 1 ---
[V:1] ... |
[V:2] ... |
[V:3] ... |
[V:4] ... |

W: [verse 1 line 1]
W: [verse 1 line 2]
```

---

## 3. Mandatory Round-Trip Verification Workflow

To guarantee zero errors in every conversion, the LLM must perform an internal validation step before returning the response:

1. **Step 1 (Extract Plain Text Sol-fa):**
   Follow **Definition Instruction 1** to produce the complete, pulse-aligned plain text representation.
2. **Step 2 (Translate to ABC):**
   Follow **Definition Instruction 2** and the pitch reference tables to convert the plain text into ABC notation.
3. **Step 3 (Mandatory Round-Trip Verification):**
   Convert each generated ABC note back to its sol-fa note and verify against the extracted plain text:
   - **Scale Degree Match:** Does `B` in `K:Bb` match `d`? Does `E` match `fe` (=E) or `f`?
   - **Octave Consistency:** Check octave registers across all voices. Soprano and Alto match the literal table; Tenor and Bass are shifted one octave lower. No accidental 7th or 9th leaps.
   - **Rhythm & Bar Sums:** Verify measure durations. Under `M:3/4 L:1/4`, every measure must sum to 3 quarter notes (12 sixteenth ticks). Split bars across `||` must sum to 3 pulses (e.g. 2 pulses before `||` and 1 pulse after `||`).
   - **Sustained Notes & Late Starters:** Verify that patterns like `B3/2 c/2` correspond to `d :-.r`.
4. **Step 4 (Produce Final Output):**
   Output **both**:
   - First: **`### Neat Plain Text Tonic Sol-fa`** text block.
   - Second: **`### Converted ABC Notation`** ````abc```` block.

---

## 4. Prompt Template for Gemini

```markdown
You are an expert musicologist and score transcription engine specializing in Curwen Tonic Sol-fa hymnody for the SolfaTunes app (https://github.com/PYTHAGON2/SolfaTunes/).

Convert the provided Sol-fa score image using the two definition instructions:

DEFINITION INSTRUCTION 1: EXTRACT TO PLAIN TEXT TONIC SOL-FA
1. Extract key, meter, tune name, composer, descant status, and lyrics.
2. Write a neat, column-aligned plain text representation of all voices (Descant D:, Soprano S:, Alto A:, Tenor T:, Bass B:) across each system.
3. Keep all timing punctuation intact: barlines |, double barlines ||, pulse colons :, continuation dashes -, half-pulse dots ., quarter-pulse commas ,, and octave subscripts/superscripts (₁, ₂, ¹).
4. Preserve split bars across || and pickup bars with exact pulse counts.

DEFINITION INSTRUCTION 2: CONVERT PLAIN TEXT TO ABC NOTATION
1. Translate syllables to sounding pitches using the appropriate Hymn Key Pitch Table (S/A/D literal, T/B shifted one octave lower).
2. Encode durations under L:1/4 (1 pulse = 1, 2 pulses = 2, half-pulse = /2, quarter-pulse = /4, compound 6/8 pulse = 3/2). Never put sol-fa letters, colons, or lone dashes in ABC music lines.
3. Validate round-trip: convert the ABC back to sol-fa internally to ensure 100% equivalence, correct bar sums, and proper split bar handling.

FINAL OUTPUT FORMAT:
Output the result in two distinct parts:
1. "### Neat Plain Text Tonic Sol-fa" followed by a code block containing the extracted sol-fa text.
2. "### Converted ABC Notation" followed by the final ```abc code block.
```

---

## 5. Worked Example 1: Warrington (Key Bb, 3/4 Time, SATB)

*Corresponds exactly to the Curwen Tonic Sol-fa printed score (`KEY Bb Warrington R. Harrison, 1748–1810`).*

### Neat Plain Text Tonic Sol-fa
```text
KEY Bb   Warrington   R. Harrison, 1748–1810   M:3/4
% tune_name=Warrington
% hymn_name=Rector potens, verax Deus
% has_descant=false

% --- System 1 ---
S: | s₁ : s₁ : f₁ | m₁ : s₁ : d | d :-.r : t₁ | d : - || m | r : - : r | m : - : r.d |
A: | m₁ : m₁ : r₁ | m₁ : r₁ : m₁ | f₁ : - : r₁ | m₁ : - || s₁ | s₁ : - : s₁ | s₁ : fe₁ : s₁.l₁ |
T: | d  : d  : t₁ | d  : r  : d  | l₁ : - : s₁ | s₁ : - || d  | d  : t₁ : t₁ | d  : -   : r.m  |
B: | d₁ : m₁ : s₁ | d  : t₁ : l₁ | f₁ : r₁ : s₁ | d₁ : - || d₁ | s₁ : - : s₁ | d₁ : l₂  : t₂.d₁ |

% --- System 2 ---
S: | t₁ : - : l₁  | s₁ : - : - || d  : d  : s₁ | l₁ : - : d  | f  :-.m : r.d |
A: | s₁ : - : fe₁ | s₁ : - : - || m₁ : s₁ : m₁ | f₁ : - : s₁ | f₁ :-.s₁: l₁  |
T: | r  : - : r.d | t₁ : - : - || d  : d  : d  | d  : - : d  | r  : l₁  : r   |
B: | r₁ : - : r₁  | s₁ : - : - || d₁ : m₁ : d₁ | f₁ : - : m₁ | r₁ :-.m₁: f₁  |

% --- System 3 ---
S: | d : t₁ || l₁    | s₁ : - : f₁ | m₁ : s₁ : d  | d :-.r : t₁ | d : - : - ||
A: | s₁: -  || f₁    | m₁ : - : r₁ | m₁ : -  : m₁.f₁| s₁ : l₁ : s₁ | s₁: - : - ||
T: | m : r  || d.r   | m  : d : t₁ | d  : -  : d.r  | m  : f  : r  | m : - : - ||
B: | s₁: -  || l₁.t₁ | d  : m₁: s₁ | d₁ : m₁ : l₁  | s₁ : f₁ : s₁ | d₁: - : - ||

W: 1. O GOD of truth, O Lord of might,
W:    Who orderest time and change aright,
W:    Arraying morn with joyful gleams,
W:    And kindling noonday's fiery beams;
```

### Converted ABC Notation
```abc
X:1
T:Warrington
C:R. Harrison, 1748-1810
M:3/4
L:1/4
K:Bb
% tune_name=Warrington
% hymn_name=Rector potens, verax Deus
% has_descant=false
%%staves [(1 2) (3 4)]
V:1 name="Soprano" clef=treble
V:2 name="Alto" clef=treble
V:3 name="Tenor" clef=treble
V:4 name="Bass" clef=bass

% --- System 1 ---
[V:1] F F E | D F B | B3/2 c/2 A | B2 || d | c2 c | d2 c/2 B/2 |
[V:2] D D C | D C D | E2 C | D2 || F | F2 F | F =E F/2 G/2 |
[V:3] B, B, A, | B, C B, | G,2 F, | F,2 || B, | B, A, A, | B,2 C/2 D/2 |
[V:4] B,, D, F, | B, A, G, | E, C, F, | B,,2 || B,, | F,2 F, | B,, G,, A,,/2 B,,/2 |

% --- System 2 ---
[V:1] A2 G | F3 || B B F | G2 B | e3/2 d/2 c/2 B/2 |
[V:2] F2 =E | F3 || D F D | E2 F | E3/2 F/2 G |
[V:3] C2 C/2 B,/2 | A,3 || B, B, B, | B,2 B, | C G, C |
[V:4] C,2 C, | F,3 || B,, D, B,, | E,2 D, | C,3/2 D,/2 E, |

% --- System 3 ---
[V:1] B A || G | F2 E | D F B | B3/2 c/2 A | B3 |]
[V:2] F2 || E | D2 C | D2 D/2 E/2 | F G F | F3 |]
[V:3] D C || B,/2 C/2 | D B, A, | B,2 B,/2 C/2 | D E C | D3 |]
[V:4] F,2 || G,/2 A,/2 | B, D, F, | B,, D, G, | F, E, F, | B,,3 |]

W: 1. O GOD of truth, O Lord of might,
W:    Who orderest time and change aright,
W:    Arraying morn with joyful gleams,
W:    And kindling noonday's fiery beams;
```

---

## 6. Worked Example 2: Hursley (Key F, 3/4 Time, SATB + Descant)

### Neat Plain Text Tonic Sol-fa
```text
KEY F   Hursley   M:3/4
% tune_name=Hursley
% has_descant=true

% --- System 1 ---
D: d¹ :t.l :s.f | m :r :d | s :- :f | m :- :- || s :l :t | d¹:- :s | d¹:t :l | t :- :- ||
S: d  :d   :d   | d :t₁:d | r :m :r | d :- :- || m :m :m | m :- :r | s :f :m | r :- :- ||
A: s₁ :s₁  :s₁  | s₁:- :s₁| t₁:- :t₁| d :- :- || d :d :d | d :t₁:d | d :t₁:d | t₁:- :- ||
T: m  :m   :m   | m :r :m | f :s :f | m :- :- || s :s :s | s :- :s | s :- :s | s :- :- ||
B: d  :d   :d   | d :- :d | s₁:- :s₁| d :- :- || d :d :d | d :- :d | m :r :d | s₁:- :- ||

% --- System 2 ---
D: t :l.t :de¹ | r¹:- :t | d¹:s :l | t :- :- | d¹:d¹:d¹|| d¹:t :d¹| r¹:d¹:t | d¹:- :- |]
S: r :r   :m   | f  :- :r | m :- :f | s :- :- | l :l :l || s :- :m | f :m :r | d  :- :- |]
A: t₁:r   :de  | r  :t₁:t₁| d :- :d | t₁:- :- | l₁:d :d || d :t₁:d | d :- :t₁| d  :- :- |]
T: s :l   :s   | f  :- :s | s :- :d | r :- :m | f :f :f || r :- :d | l :s :f | m  :- :- |]
B: s :f   :m   | r  :- :s₁| d :l₁:s₁| s₁:- :- | f₁:f₁:f₁|| s₁:- :l₁| f₁:s₁:s₁| d  :- :- |]
```

### Converted ABC Notation
```abc
X:1
T:Hursley
C:Katholisches Gesangbuch, c. 1775
M:3/4
L:1/4
K:F
% tune_name=Hursley
% has_descant=true
%%staves [(5) (1 2) (3 4)]
V:5 name="Descant" clef=treble
V:1 name="Soprano" clef=treble
V:2 name="Alto" clef=treble
V:3 name="Tenor" clef=treble
V:4 name="Bass" clef=bass

% --- System 1 ---
[V:5] f e/2 d/2 c/2 B/2 | A G F | c2 B | A3 || c d e | f2 c | f e d | e3 ||
[V:1] F F F | F E F | G A G | F3 || A A A | A G A | c B A | G3 ||
[V:2] C C C | C2 C | E2 E | F3 || F F F | F E F | F E F | E3 ||
[V:3] A, A, A, | A, G, A, | B, C B, | A,3 || C C C | C2 C | C2 C | C3 ||
[V:4] F, F, F, | F,2 F, | C,2 C, | F,3 || F, F, F, | F,2 F, | A, G, F, | C,3 ||

% --- System 2 ---
[V:5] e d/2 e/2 ^f | g2 e | f c d | e3 | f f f || f e f | g f e | f3 |]
[V:1] G G A | B2 G | A2 B | c3 | d d d || c2 A | B A G | F3 |]
[V:2] E G ^F | G D E | F2 F | E3 | D F F || F E F | F2 E | F3 |]
[V:3] C D C | B,2 C | C2 F, | G,2 A, | B, B, B, || G,2 F, | D C B, | A,3 |]
[V:4] C B, A, | G,2 C, | F,2 D, | C,3 | B,, B,, B,, || C,2 D, | B,, C, C, | F,3 |]
```
