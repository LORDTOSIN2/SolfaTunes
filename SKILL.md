---
name: create-abc-notation-from-image-solfa
description: Use when asked to convert a Curwen Tonic Sol-fa hymn score image (photo, scan, screenshot) into real, standard ABC notation for the SolfaTunes app. Triggers on "solfa to ABC", "convert this tonic sol-fa", "transcribe this hymn for SolfaTunes", or any image of d r m f s l t notation, with or without a descant. The output must be genuine ABC (note letters A-G, not sol-fa syllables) and must pass a rigorous pitch/rhythm round-trip check (converting ABC back to sol-fa to compare with the original) before it is returned.
---

# SKILL: Convert Curwen Tonic Sol-fa Image to ABC for SolfaTunes

Convert an image of a Curwen Tonic Sol-fa hymn into ABC notation that the SolfaTunes app (https://github.com/PYTHAGON2/SolfaTunes/) can parse, display and play. SolfaTunes has its **own** ABC parser and tonic sol-fa reconstruction engine (no abcjs), so it reads only the subset of ABC described in this file. The rules below reflect the exact parser and timing engine source.

---

## 0. The One Rule That Matters Most

**Sol-fa is the INPUT. ABC is the OUTPUT. They must never be mixed.**

The most common failure is copying sol-fa tokens (`s,`, `fe`, `:-.r`, `:`) into the ABC code block. That is not ABC, and SolfaTunes cannot read it.

Inside an ABC music line (everything after `[V:n]`), only these characters are legal:

| Allowed | Meaning |
|---|---|
| `A B C D E F G` / `a b c d e f g` | note letters (uppercase = octave starting at middle C, lowercase = the octave above) |
| `,` `'` | one octave down / up (`C,` is below `C`; `c'` is above `c`) |
| `^` `_` `=` | sharp / flat / natural, placed before the note letter |
| `z` | rest |
| digits and `/` | duration multiplier (`2`, `3`, `3/2`, `/2`, `/4`, `3/4`) |
| `\|` `\|\|` `\|]` | barlines |
| space | separator |

**Forbidden in ABC music lines:**
- the sol-fa letters `r s l t m` used as notes, and syllables such as `fe` `de` `ta`;
- subscript or superscript digits;
- the colon `:` (outside `[V:n]`) and the period `.` (in ABC it means staccato);
- a lone `-` used as "hold the note";
- ties, chords `[...]`, tuplets and grace notes (merge held notes into one longer note instead, for example `d4` or `B3/2`).

**Quick lint:** after the `[V:n]` prefix, any lowercase letter outside `a`-`g` and `z`, and any `:` or `.`, means sol-fa leaked in.

---

## 1. Visual Anatomy of a Tonic Sol-fa Score

Sol-fa writes pitch as a syllable relative to the key (movable-do), marks octaves with subscripts or superscripts, and marks rhythm with punctuation. Voices are stacked in a braced grid, one row per voice, aligned pulse by pulse. A **Descant**, when present, is a separate extra row at the **top** of the system, often labelled "DESCANT".

Real excerpt (key F, first two bars of Hursley, descant on top):

```text
KEY F   Hursley
DESCANT |d¹ :t.l :s.f |m :r :d |
Soprano |d  :d   :d   |d :t₁:d |
Alto    |s₁ :s₁  :s₁  |s₁:-  :s₁|
Tenor   |m  :m   :m   |m :r  :m |
Bass    |d  :d   :d   |d :-  :d |
```

### A. Key and tonic

- Read the printed `KEY [Letter]` and use it: `KEY Bb` becomes `K:Bb`, `KEY F` becomes `K:F`, `KEY G` becomes `K:G`. `d` is that note.
- Do not infer the key from the melody when a `KEY` is printed.

### B. Syllables

- Natural degrees: `d r m f s l t`.
- Raised syllables end in `e` or `i`: `de re fe se le` (older spelling) or `di ri fi si li`.
- Lowered syllables end in `a`: `ma ra la ta`.

### C. Octave marks

- No mark: central octave.
- Subscript `₁`: one octave below central; `₂`: two below.
- Superscript `¹` (also printed as a prime `'`, as in `d'`): one octave above central.
- The mark belongs to the syllable it follows (`fe₁` is a raised f in the lower octave).
- Read marks one by one with the image zoomed in. A missed subscript is the most common octave error: a leap of a 7th between neighbouring notes is usually a misread subscript.

### D. Rhythm punctuation (a pulse grid, not note values)

| Symbol | Meaning |
|---|---|
| `\|` | barline |
| `\|\|` | end of a phrase or line (a thicker double bar ends the piece) |
| `:` | separates **pulses** (beats) inside a bar |
| `-` | the previous note continues through this pulse (or half-pulse) |
| `.` | splits a pulse into **two halves** |
| `,` | splits a half-pulse into **two quarter-pulses** (sixteenth notes) |
| empty pulse | silence, so a rest `z` |

**Pulse arithmetic (under `L:1/4`, one pulse = 1 beat):**

| Printed Sol-fa | Duration Meaning | ABC (`L:1/4`) | SolfaTunes Output Display |
|---|---|---|---|
| `d` | 1 pulse | `C` | `d` |
| `d :-` | 2 pulses | `C2` | `d : -` |
| `d :- :-` | 3 pulses | `C3` | `d : - : -` |
| `t.l` | Two half-pulses (1/2 + 1/2) | `B/2 A/2` | `t.l` |
| `d :-.r` | 1 + 1/2 pulses, then 1/2 pulse | `B3/2 c/2` | `d : -.r` |
| `d,r.m` | Two 1/4-pulses, then 1/2 pulse | `C/4 D/4 E/2` | `d,r.m` |
| `d.r,m` | 1/2-pulse, then two 1/4-pulses | `C/2 D/4 E/4` | `d.r,m` |
| `d,r,m,f` | Four 1/4-pulses (sixteenths) | `C/4 D/4 E/4 F/4` | `d,r,m,f` |
| `d :-` in 6/8 | 2 compound beats (dotted half) | `C3` | `d : -` |
| `d : r` in 6/8 | 2 compound beats (each dotted quarter) | `C3/2 D3/2` | `d : r` |

### E. Phrase-end bar split across `||` & Anacrusis (Pickups)

1. **Phrase-end split across `||`:**
   Some scores print the last bar of a line short, with the missing pulse printed as a one-pulse "pickup" right after the `||`:
   ```text
    |d :-  ||m |r :- :r |
   ```
   `d :-` (2 pulses) plus the lone `m` (1 pulse) make one full 3-pulse bar. Transcribe exactly what is printed: `B2 || d |` (in K:Bb, soprano). Do **not** pad the pickup into a full bar, do **not** invent a rest, and do not add a pickup at the start of the tune unless the first bar is printed short. When checking bar lengths, add the two halves together.

2. **Anacrusis / Pickup Bar at Tune Start:**
   If the hymn begins on an upbeat (for example a single pulse before the first barline), write only the note(s) in that opening bar: e.g. `[V:1] D |`.
   - **Do NOT** pad the opening bar with rests.
   - **Do NOT** change the `M:` meter header to accommodate the pickup. SolfaTunes natively handles anacrusis bars.

---

## 2. Pitch and Rhythm Mapping Rules

### A. Pitch: ABC pitches are SOUNDING pitches

SolfaTunes plays ABC notes exactly as written (no clef transposition). Its own example tunes put the Tenor an octave below the Soprano's literal register and the Bass lower still. Use these rules:

1. Use `K:` from the printed key. The key signature is applied automatically, so write plain letters and never add an accidental the key already supplies.
2. **Soprano, Alto and Descant:** literal. `d` is the tonic letter in uppercase (the octave starting at middle C), then the letters climb: after `B` they continue in lowercase (`c d e ...`).
3. **Tenor and Bass:** one octave **lower** than the same printed sol-fa in the S/A table (sol-fa prints the T and B parts an octave above where they sound). To lower one octave: a lowercase letter becomes uppercase, an uppercase letter gains one comma, a letter with `'` loses one `'`. Equivalently, read the Tenor/Bass note from the S/A table **one column to the left** (T/B central = S/A `₁` column).
4. Each subscript lowers by one more octave (add `,`). Each superscript raises by one (add `'`).

**Sanity check on ranges** (the voices must never cross): Descant above Soprano; roughly Soprano C4 to A5, Alto G3 to D5, Tenor C3 to G4, Bass E2 to D4. If the Tenor sits above the Alto anywhere, the Tenor/Bass octave shift was forgotten.

---

### B. Complete Hymn Key Pitch Reference Tables (Soprano / Alto / Descant)

Below are the complete lookup tables for every major key commonly found in Curwen Tonic Sol-fa hymnody. For **Tenor** and **Bass**, read one column to the left (e.g. Tenor central octave = the `₁` column).

#### Key of C (`K:C`, tonic C)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `C,,` | `C,` | `C` | `c` |
| r | `D,,` | `D,` | `D` | `d` |
| m | `E,,` | `E,` | `E` | `e` |
| f | `F,,` | `F,` | `F` | `f` |
| s | `G,,` | `G,` | `G` | `g` |
| l | `A,,` | `A,` | `A` | `a` |
| t | `B,,` | `B,` | `B` | `b` |

#### Key of G (`K:G`, tonic G, 1 sharp F#)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `G,,` | `G,` | `G` | `g` |
| r | `A,,` | `A,` | `A` | `a` |
| m | `B,,` | `B,` | `B` | `b` |
| f | `C,` | `C` | `c` | `c'` |
| s | `D,` | `D` | `d` | `d'` |
| l | `E,` | `E` | `e` | `e'` |
| t | `F,` | `F` | `f` | `f'` |

#### Key of D (`K:D`, tonic D, 2 sharps F# C#)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `D,,` | `D,` | `D` | `d` |
| r | `E,,` | `E,` | `E` | `e` |
| m | `F,,` | `F,` | `F` | `f` |
| f | `G,,` | `G,` | `G` | `g` |
| s | `A,,` | `A,` | `A` | `a` |
| l | `B,,` | `B,` | `B` | `b` |
| t | `C,` | `C` | `c` | `c'` |

#### Key of A (`K:A`, tonic A, 3 sharps F# C# G#)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `A,,` | `A,` | `A` | `a` |
| r | `B,,` | `B,` | `B` | `b` |
| m | `C,` | `C` | `c` | `c'` |
| f | `D,` | `D` | `d` | `d'` |
| s | `E,` | `E` | `e` | `e'` |
| l | `F,` | `F` | `f` | `f'` |
| t | `G,` | `G` | `g` | `g'` |

#### Key of E (`K:E`, tonic E, 4 sharps F# C# G# D#)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `E,,` | `E,` | `E` | `e` |
| r | `F,,` | `F,` | `F` | `f` |
| m | `G,,` | `G,` | `G` | `g` |
| f | `A,,` | `A,` | `A` | `a` |
| s | `B,,` | `B,` | `B` | `b` |
| l | `C,` | `C` | `c` | `c'` |
| t | `D,` | `D` | `d` | `d'` |

#### Key of F (`K:F`, tonic F, 1 flat Bb)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `F,,` | `F,` | `F` | `f` |
| r | `G,,` | `G,` | `G` | `g` |
| m | `A,,` | `A,` | `A` | `a` |
| f | `B,,` | `B,` | `B` | `b` |
| s | `C,` | `C` | `c` | `c'` |
| l | `D,` | `D` | `d` | `d'` |
| t | `E,` | `E` | `e` | `e'` |

#### Key of Bb (`K:Bb`, tonic Bb, 2 flats Bb Eb)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `B,,` | `B,` | `B` | `b` |
| r | `C,` | `C` | `c` | `c'` |
| m | `D,` | `D` | `d` | `d'` |
| f | `E,` | `E` | `e` | `e'` |
| s | `F,` | `F` | `f` | `f'` |
| l | `G,` | `G` | `g` | `g'` |
| t | `A,` | `A` | `a` | `a'` |

#### Key of Eb (`K:Eb`, tonic Eb, 3 flats Bb Eb Ab)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `E,,` | `E,` | `E` | `e` |
| r | `F,,` | `F,` | `F` | `f` |
| m | `G,,` | `G,` | `G` | `g` |
| f | `A,,` | `A,` | `A` | `a` |
| s | `B,,` | `B,` | `B` | `b` |
| l | `C,` | `C` | `c` | `c'` |
| t | `D,` | `D` | `d` | `d'` |

#### Key of Ab (`K:Ab`, tonic Ab, 4 flats Bb Eb Ab Db)
| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `A,,` | `A,` | `A` | `a` |
| r | `B,,` | `B,` | `B` | `b` |
| m | `C,` | `C` | `c` | `c'` |
| f | `D,` | `D` | `d` | `d'` |
| s | `E,` | `E` | `e` | `e'` |
| l | `F,` | `F` | `f` | `f'` |
| t | `G,` | `G` | `g` | `g'` |

#### Key of Db (`K:Db`, tonic Db, 5 flats Bb Eb Ab Db Gb)
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

### C. Time Signature and Note Length

- Always declare `L:1/4` in the ABC header.
- **Simple meters (`2/4`, `3/4`, `4/4`):** One sol-fa pulse = one quarter note (`1`). Half-pulse = `/2`. Quarter-pulse = `/4`.
- **Compound meters (`6/8`, `9/8`, `12/8`):** One sol-fa pulse is a dotted quarter note. Under `L:1/4`, a full compound pulse is written as `3/2` (e.g. `C3/2 D3/2` gives two pulses `d : r`), and a 2-pulse held note is `3` (e.g. `E3` gives `m : -`).
- If no meter is printed, infer it from the pulses per bar: 2 pulses = `M:2/4`, 3 pulses = `M:3/4`, 4 pulses = `M:4/4`.

### D. Chromatic Syllables

Find the diatonic pitch of the plain degree, move it one semitone (raised `e`/`i` endings up with `^` or `=`, lowered `a` endings down with `_` or `=`), and write an explicit accidental.

- `K:Bb`, central S/A: `di`/`de` = `=B`, `ri`/`re` = `^c`, `fi`/`fe` = `=e`, `si`/`se` = `^f`, `li`/`le` = `^g`, `ma` = `_d`, `la` = `_g`, `ta` = `_a`.
- `K:F`, central S/A: `de` = `^F`, `re` = `^G`, `fe` = `=B`, `se` = `^c`, `le` = `^d`, `ma` = `_A`, `la` = `_d`, `ta` = `_e`.
- `K:G`, central S/A: `fe` = `=c` (or `^c`), `se` = `^d`, `ta` = `=f` (or `_f`).
- An accidental lasts until the barline for that letter and octave. If the plain note returns later in the same bar, restate it explicitly. Apply the Tenor/Bass octave shift to chromatic notes too (e.g. Tenor `de` in K:F is `^F,`).

### E. What the SolfaTunes Renderer Supports

SolfaTunes calculates rhythm using **sixteenth-note resolution** (`durationTicks = mult * L_val * 16`):
- Simple meters (`2/4`, `3/4`, `4/4`) have 4 sixteenth ticks per pulse.
- Half-pulses are split by periods `.` (e.g. `t.l`).
- Sub-pulses within a half-pulse are split by commas `,` (e.g. `d,r.m` or `d,r,m,f`).
- Notes sustained into a pulse followed by a late starter are rendered as `-` then `.` then the note (e.g. `d :-.r`).
- Compound meters (`6/8`, `9/8`, `12/8`) have 6 sixteenth ticks per pulse.
- **Home Register Octaves:** SolfaTunes computes sol-fa octaves relative to the tonic pitch class (`solfaOctave = Math.floor((midiPitch - tonic) / 12)`). Notes within the home register `d r m f s l t` display without octave dots.

---

## 3. What the SolfaTunes Parser Accepts (Format Rules)

Header order: `X`, `T`, `C`, `M`, `L`, `K`, metadata comments, `%%staves`, voice declarations, then music, then lyrics.

```abc
X:1
T:[Tune Name]
C:[Composer / Source as printed]
M:[3/4]
L:1/4
K:[Key]
% tune_name=[Tune Name]
% hymn_name=[Hymn name, only if printed]
% hymn_meter=[only if printed]
% verses=[only if known]
% has_descant=[true/false]
%%staves [(1 2) (3 4)]
V:1 name="Soprano" clef=treble
V:2 name="Alto" clef=treble
V:3 name="Tenor" clef=treble
V:4 name="Bass" clef=bass

% --- System 1 ---
[V:1] ... |
[V:2] ... |
[V:3] ... |
[V:4] ... |

W: [verse line 1]
W: [verse line 2]
```

### Parser Behaviour Rules:
- **Voice ids:** use `V:1` to `V:4` (Soprano, Alto, Tenor, Bass) and `V:5` for a Descant. Each music line starts with `[V:n] `.
- **Music lines:** one line per voice per visual system. All voices in a system have the same bars and the same barlines in the same places.
- **System comments:** the line `% --- System N ---` starts a new visual system. The parser treats **any comment line containing the word "System"** as a break, so never use that word in any other comment.
- **Barlines:** `|`, `||`, `|]` (final bar) are all accepted. Do not write a leading barline before the first bar.
- **Lyrics:** one `W:` line per poetic line, blank `W:` between stanzas. Never use lowercase `w:` (it would be read as music).
- **Metadata:** `% tune_name=`, `% hymn_name=`, `% hymn_meter=`, `% verses=`, `% has_descant=` are read in `key=value` form. Include only what is visible on the page; omit otherwise.
- **`%%staves`:** groups in parentheses make braced staves. SATB: `%%staves [(1 2) (3 4)]`. SA only: `%%staves [(1 2)]`. TB only: `%%staves [(3 4)]`. **With a descant:** `%%staves [(5) (1 2) (3 4)]`, declare `V:5 name="Descant" clef=treble` first, set `% has_descant=true`, and write the Descant line first in every system.

---

## 4. Mandatory 5-Step Workflow with Round-Trip Validation

To ensure 100% accuracy, execute steps 1 to 4 internally before outputting the ABC.

### Step 1: Raw Extraction (Internal Ground Truth)
Zoom into every system. For each voice (Descant first when present), write the exact printed tokens bar by bar: syllables, octave marks, `:` `.` `,` `-`, barlines, `||` positions. Mark uncertain subscripts and re-inspect them.

### Step 2: Pulse & Rhythm Expansion (Internal)
Turn each bar into `(note, duration)` pairs:
- Simple meters: 1 pulse = 1, half = `1/2`, quarter = `1/4`.
- Compound meters: 1 pulse = `3/2`, half = `3/4`.
- Confirm that every bar has the same pulse count across all voices.

### Step 3: ABC Compilation (Internal)
Convert each pitch using the key tables in Section 2.B:
- Soprano, Alto, Descant: literal column from table.
- Tenor, Bass: shift one column to the left (1 octave lower).
- Add durations (`2`, `3`, `3/2`, `/2`, `/4`). **Only ABC characters (Section 0) may appear.**

### Step 4: Mandatory Round-Trip Test & Verification (CRITICAL)
**Convert your generated ABC back into Sol-fa notes internally and compare token-by-token against Step 1:**
1. **Pitch syllable verification:** Does each ABC pitch map to the exact printed sol-fa syllable? (e.g. In K:Bb, `B` -> `d`, `c` -> `r`, `d` -> `m`, `A` -> `t`).
2. **Octave register verification:**
   - Soprano/Alto/Descant central syllables must match the table central octave (no extraneous commas or apostrophes).
   - Tenor/Bass must sound one octave below Soprano (check that Tenor never sits above Alto).
3. **Rhythm & Hold verification:**
   - `B3/2 c/2` converts back to `d :-.r`.
   - `C/4 D/4 E/2` converts back to `d,r.m`.
   - Held notes (`-`) must match extended durations, not ABC ties or chords.
4. **Measure summation check:**
   - In 3/4 time, every full bar must add up to 3 beats (12 sixteenth ticks).
   - In 4/4 time, every full bar must add up to 4 beats (16 sixteenth ticks).
   - In 6/8 time, every full bar must add up to 2 compound beats (12 sixteenth ticks).
   - Split bars around `||` must sum together to exactly one full bar.
   - Any discrepancy must be corrected in the ABC before continuing!

### Step 5: Final Output
Return **ONLY** the clean, verified ABC code block.

---

## 5. Validation Checklist

Before presenting the output, verify every item:
- [ ] **No sol-fa characters in music lines:** only A-G, a-g, `,`, `'`, `^`, `_`, `=`, `z`, digits, `/`, `|`, and spaces.
- [ ] **Header order:** `X`, `T`, `C`, `M`, `L`, `K`, metadata comments, `%%staves`, `V:` lines.
- [ ] **`K:` matches the printed key:** correct tonic from the printed score.
- [ ] **`L:1/4` is present:** all note multipliers calculated relative to quarter notes.
- [ ] **Pitch tables respected:** S/A/D from central table; T/B shifted one column left.
- [ ] **Voice ranges do not cross:** Descant > Soprano > Alto > Tenor > Bass.
- [ ] **Explicit accidentals for chromatic notes:** e.g. `fe` in B♭ is `=e`/`=E`; `de` in F is `^F`.
- [ ] **Every bar adds up to the meter:** pickup bars not padded; split bars sum across `||`.
- [ ] **Descant correctly placed:** `V:5` top of staves, `% has_descant=true`, `%%staves [(5) (1 2) (3 4)]`.
- [ ] **System lines strictly formatted:** `% --- System N ---` only; word "System" appears nowhere else.
- [ ] **Lyrics placed in `W:` lines:** exact words, no invented text or lower-case `w:`.
- [ ] **Round-trip test passed:** ABC converted back to sol-fa perfectly equals the printed score.

---

## 6. Prompt Template for Gemini

```markdown
You are an expert musicologist and ABC notation transcription engine specializing in Curwen Tonic Sol-fa hymnody for the SolfaTunes app (https://github.com/PYTHAGON2/SolfaTunes/).

Convert the provided Sol-fa score image into standard ABC notation following the exact rules from the create-abc-notation-from-image-solfa skill.

Execution Steps:
1. RAW EXTRACTION: Read the exact printed sol-fa tokens bar by bar, voice by voice (Descant is the top row when present).
2. PULSE EXPANSION: Convert pulses and punctuation to durations (L:1/4; simple pulses = 1, compound 6/8 pulses = 3/2, half-pulses = /2, quarter-pulses = /4).
3. ABC COMPILATION: Translate syllables to sounding pitches using the key reference table (Soprano/Alto/Descant literal; Tenor/Bass shifted one octave lower). Never put sol-fa syllables, colons, periods, ties, or chords in the ABC music lines.
4. ROUND-TRIP VALIDATION: Convert your ABC back to sol-fa notes internally and verify token-by-token against the original score: confirm pitch degrees, octave marks, durations, and that every bar sums exactly to the meter. Fix any discrepancy.
5. FINAL OUTPUT: Return ONLY the final ABC code block.
```

---

## 7. Worked Example 1: Warrington (Key Bb, 3/4 Time, SATB)

### Step 1 (Internal Raw Extraction, System 1):
```text
S: s₁ :s₁ :f₁ | m₁ :s₁ :d | d :-.r :t₁ | d :- || m | r :- :r | m :- :r.d |
A: m₁ :m₁ :r₁ | m₁ :r₁ :m₁ | f₁ :- :r₁ | m₁ :- || s₁ | s₁ :- :s₁ | s₁ :fe₁ :s₁.l₁ |
T: d :d :t₁ | d :r :d | l₁ :- :s₁ | s₁ :- || d | d :t₁ :t₁ | d :- :r.m |
B: d₁ :m₁ :s₁ | d :t₁ :l₁ | f₁ :r₁ :s₁ | d₁ :- || d₁ | s₁ :- :s₁ | d₁ :l₂ :t₂.d₁ |
```

### Steps 2 to 4 (Internal Round-Trip Checks):
- `d :-.r` (Soprano) = d held 3/2, then r for 1/2 -> `B3/2 c/2`. Round-trip: `B3/2 c/2` -> `d :-.r` (Pass).
- `fe₁` (Alto) = raised f one octave down; in K:Bb, f = E♭, so `fe₁` = E♮ = `=E`. Round-trip: `=E` -> `fe₁` (Pass).
- Tenor `d` is B♭3 = `B,`; Bass `d₁` is B♭2 = `B,,` (one octave below S/A table). (Pass).
- Soprano `d :-` plus the pickup `m` across `||` = 2 + 1 = 3 pulses -> `B2 || d |`. (Pass).

### Step 5: Final ABC Output
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

W: O GOD of truth, O Lord of might,
W: Who orderest time and change aright,
W: Arraying morn with joyful gleams,
W: And kindling noonday's fiery beams;
```

---

## 8. Worked Example 2: Hursley (Key F, 3/4 Time, SATB + Descant)

### Step 1 (Internal Raw Extraction, System 1 & Chromatic Bar):
```text
D: d¹ :t.l :s.f | m :r :d | s :- :f |      ...   | t :l.t :de¹ |
S: d :d :d      | d :t₁ :d | r :m :r |      ...   | r :r :m |
A: s₁ :s₁ :s₁   | s₁ :- :s₁ | t₁ :- :t₁ |  ...   | t₁ :r :de |
T: m :m :m      | m :r :m  | f :s :f |      ...   | s :l :s |
B: d :d :d      | d :- :d  | s₁ :- :s₁ |    ...   | s :f :m |
```

### Steps 2 to 4 (Internal Round-Trip Checks):
- `d¹` (Descant) is F5 = `f`; `t.l` = `e/2 d/2`; `s.f` = `c/2 B/2`.
- Alto `s₁` is C4 = `C`. Tenor `m` is A3 = `A,`. Bass `d` is F3 = `F,`; Bass `s₁` is C3 = `C,`.
- `de¹` (Descant) = raised d, an octave up = F♯5 = `^f`. Alto `de` = F♯4 = `^F`.
- In K:F, `F G A B c d e` all fall in the central solfa register, so they display without dots on-screen.

### Step 5: Final ABC Output
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

---

## 9. Final Output Rule

Return **ONLY** the verified ABC code block. Do not include raw extraction logs, round-trip notes, validation commentary or markdown conversation text. The SolfaTunes parser is strict about header order and voice declarations; any extra text outside the code block or any sol-fa character inside a music line will break transcription and rendering.
