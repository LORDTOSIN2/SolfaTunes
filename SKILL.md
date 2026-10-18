---
name: create-abc-notation-from-image-solfa
description: Use when asked to convert a Curwen Tonic Sol-fa hymn score image (photo, scan, screenshot) into real, standard ABC notation for the SolfaTunes app. Triggers on "solfa to ABC", "convert this tonic sol-fa", "transcribe this hymn for SolfaTunes", or any image of d r m f s l t notation, with or without a descant. The output must be genuine ABC (note letters A-G, not sol-fa syllables) and must pass a pitch/rhythm round-trip check before it is returned.
---

# SKILL: Convert Curwen Tonic Sol-fa Image to ABC for SolfaTunes

Convert an image of a Curwen Tonic Sol-fa hymn into ABC notation that the SolfaTunes app (https://github.com/PYTHAGON2/SolfaTunes/) can parse, display and play. SolfaTunes has its **own** ABC parser (no abcjs), so it reads only the subset of ABC described in this file. The rules below were checked against that parser's source.

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
| digits and `/` | duration multiplier (`2`, `3`, `3/2`, `/2`) |
| `\|` `\|\|` `\|]` | barlines |
| space | separator |

**Forbidden in ABC music lines:**
- the sol-fa letters `r s l t m` used as notes, and syllables such as `fe` `de` `ta`;
- subscript or superscript digits;
- the colon `:` (outside `[V:n]`) and the period `.` (in ABC it means staccato);
- a lone `-` used as "hold the note";
- ties, chords `[...]`, tuplets and grace notes (SolfaTunes ignores or mangles them; merge held notes into one longer note instead, for example `d4`).

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

- Read the printed `KEY [Letter]` and use it: `KEY Bb` becomes `K:Bb`, `KEY F` becomes `K:F`. `d` is that note.
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
| `,` | splits a half-pulse into two quarters (see 2.E: not representable) |
| empty pulse | silence, so a rest `z` |

Pulse arithmetic (one pulse = 1 beat):

| Printed | Durations |
|---|---|
| `d` | d = 1 |
| `d :-` | d = 2 |
| `d :- :-` | d = 3 |
| `t.l` | t = 1/2, l = 1/2 |
| `d :-.r` | d = 1 + 1/2 = 3/2, r = 1/2 |

### E. Phrase-end bar split across `||`

Some scores print the last bar of a line short, with the missing pulse printed as a one-pulse "pickup" right after the `||`:

```text
 |d :-  ||m |r :- :r |
```

`d :-` (2 pulses) plus the lone `m` (1 pulse) make one full 3-pulse bar. Transcribe exactly what is printed: `B2 || d |` (in K:Bb, soprano). Do **not** pad the pickup into a full bar, do **not** invent a rest, and do not add a pickup at the start of the tune unless the first bar is printed short. When checking bar lengths, add the two halves together. Many scores (for example Hursley) have no such split: every bar is full.

---

## 2. Pitch and Rhythm Mapping Rules

### A. Pitch: ABC pitches are SOUNDING pitches

SolfaTunes plays ABC notes exactly as written (no clef transposition). Its own example tunes put the Tenor an octave below the Soprano's literal register and the Bass lower still. Use these rules:

1. Use `K:` from the printed key. The key signature is applied automatically, so write plain letters and never add an accidental the key already supplies.
2. **Soprano, Alto and Descant:** literal. `d` is the tonic letter in uppercase (the octave starting at middle C), then the letters climb: after `B` they continue in lowercase (`c d e ...`).
3. **Tenor and Bass:** one octave **lower** than the same printed sol-fa in the S/A table (sol-fa prints the T and B parts an octave above where they sound). To lower one octave: a lowercase letter becomes uppercase, an uppercase letter gains one comma, a letter with `'` loses one `'`. Equivalently, read the Tenor/Bass note from the S/A table **one column to the left** (T/B central = S/A `₁` column).
4. Each subscript lowers by one more octave (add `,`). Each superscript raises by one (add `'`).

**Soprano / Alto / Descant table for `K:Bb`** (`d` = B♭):

| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `B,,` | `B,` | `B` | `b` |
| r | `C,` | `C` | `c` | `c'` |
| m | `D,` | `D` | `d` | `d'` |
| f | `E,` | `E` | `e` | `e'` |
| s | `F,` | `F` | `f` | `f'` |
| l | `G,` | `G` | `g` | `g'` |
| t | `A,` | `A` | `a` | `a'` |

**Soprano / Alto / Descant table for `K:F`** (`d` = F):

| Sol-fa | `₂` | `₁` | central | `¹` |
|---|---|---|---|---|
| d | `F,,` | `F,` | `F` | `f` |
| r | `G,,` | `G,` | `G` | `g` |
| m | `A,,` | `A,` | `A` | `a` |
| f | `B,,` | `B,` | `B` | `b` |
| s | `C,` | `C` | `c` | `c'` |
| l | `D,` | `D` | `d` | `d'` |
| t | `E,` | `E` | `e` | `e'` |

For another key, build the same table: the tonic letter in uppercase for `d`, then climb through the letter names (`K:G`: `d r m f s l t` = `G A B c d e f`, the key adds F♯).

**Sanity check on ranges** (the voices must never cross): Descant above Soprano; roughly Soprano C4 to A5, Alto G3 to D5, Tenor C3 to G4, Bass E2 to D4. If the Tenor sits above the Alto anywhere, the Tenor/Bass octave shift was forgotten.

### B. Time signature and note length

- Use `L:1/4`. One sol-fa pulse = one quarter note.
- If `M:` is printed, use it. If no time signature is printed, infer it from the pulses per full bar: 2 becomes `2/4`, 3 becomes `3/4`, 4 becomes `4/4`. Warrington and Hursley print none and have 3 pulses per bar, so `M:3/4`.

### C. Chromatic syllables

Find the diatonic pitch of the plain degree, move it one semitone (raised `e`/`i` endings up, lowered `a` endings down), and write an explicit accidental that gives that pitch.

`K:Bb`, central octave S/A: `di`/`de` = `=B`, `ri`/`re` = `^c`, `fi`/`fe` = `=e`, `si`/`se` = `^f`, `li`/`le` = `^g`, `ma` = `_d`, `la` = `_g`, `ta` = `_a`.
`K:F`, central octave S/A: `de` = `^F`, `re` = `^G`, `fe` = `=B`, `se` = `^c`, `le` = `^d`, `ma` = `_A`, `la` = `_d`, `ta` = `_e`.

An accidental lasts until the barline for that letter and octave. If the plain note of the same letter and octave returns later in the same bar, restate it (for example `=E ... _E`). Apply the octave rules of 2.A to chromatic notes too (Tenor `de` in K:F is `^F,`).

### D. Holds

A sol-fa `-` extends duration. Encode it as a longer note (`d2`, `d3`, `d3/2`). Never use an ABC tie.

### E. What the renderer can and cannot represent

SolfaTunes measures time in eighth notes. Pulses and half-pulses are fine. Quarter-pulse subdivisions (`d.r,m`) and compound-meter pulses (`6/8`, pulse = `3/2`) cannot be shown faithfully. Transcribe such passages exactly as printed anyway and do not simplify them silently.

---

## 3. What the SolfaTunes Parser Accepts (format rules)

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

### A. Parser behaviour you must respect

- **Voice ids:** use `V:1` to `V:4` (Soprano, Alto, Tenor, Bass) and `V:5` for a Descant. Each music line starts with `[V:n] `.
- **Music lines:** one line per voice per visual system. All voices in a system have the same bars and the same barlines in the same places. A voice id that repeats inside one system silently starts a new system.
- **System comments:** the line `% --- System N ---` starts a new system. The parser treats **any comment line containing the word "System"** as a break, so never use that word in any other comment.
- **Barlines:** `|`, `||`, `|]` (final bar) are all accepted. Do not write a leading barline before the first bar.
- **Lyrics:** one `W:` line per poetic line, blank `W:` between stanzas. Never use lowercase `w:` (it would be read as music).
- **Metadata:** `% tune_name=`, `% hymn_name=`, `% hymn_meter=`, `% verses=`, `% has_descant=` are read exactly in that `key=value` form. Include one only if the information is visible on the page; omit the whole line otherwise. Never guess a meter, verse count or hymn name. Ignore headings such as "SECOND TUNE" and notes such as "(Sext)".
- **`%%staves`:** groups in parentheses make braced staves. SATB: `%%staves [(1 2) (3 4)]`. SA only: `%%staves [(1 2)]`. TB only: `%%staves [(3 4)]`. **With a descant:** `%%staves [(5) (1 2) (3 4)]`, declare `V:5 name="Descant" clef=treble` first, set `% has_descant=true`, and write the Descant line first in every system.
- **Never drop a printed voice and never add an absent one.** Keep `clef=treble` for Tenor (clef is only a label here; pitch comes from the letters).

### B. Lyrics

Copy the printed words exactly. Drop printing marks that are not words (for example the small tick `'` printed before some words). Do not invent verses.

---

## 4. Mandatory 5-Step Workflow

Run steps 1 to 4 internally. Output only step 5.

1. **Raw extraction.** Zoom into every system. For each voice (Descant first when present), write the exact printed tokens bar by bar: syllables, octave marks, `:` `.` `-`, barlines, `||` positions. Mark uncertain subscripts and re-inspect them. This is the ground truth.
2. **Pulse expansion.** Turn each bar into `(note, duration)` pairs using 1.D. Confirm that every bar has the same pulse count (split bars in 1.E must sum to it).
3. **ABC compilation.** Convert each pair using the tables in 2.A to 2.C, applying the Tenor/Bass octave shift. **Only ABC characters (section 0) may appear.**
4. **Round-trip check.** Convert your ABC back into sol-fa for every bar and compare it with step 1. Check:
   - pitch drift, octave slips, missing accidentals, and the range check in 2.A;
   - note lengths (`d3/2 r/2` must come back as `d :-.r`);
   - bar sums, with halves around `||` combined;
   - identical bar and barline layout across all voices;
   - the section 0 lint (no sol-fa leakage).
   Fix errors and repeat until the round-trip equals the extraction.
5. **Final output.** Return only the final ABC code block.

Note for debugging: SolfaTunes draws octave dots relative to each voice's most common octave, so its on-screen dots are not a reliable check of absolute octaves. Judge octaves with the tables and range check above.

---

## 5. Validation Checklist

- [ ] No sol-fa characters in music lines (lint passes); no ties, chords or tuplets.
- [ ] Header order is `X T C M L K`, metadata comments, `%%staves`, `V:` lines.
- [ ] `K:` equals the printed `KEY`; `M:` is printed or correctly inferred.
- [ ] Soprano, Alto and Descant follow the 2.A table; Tenor and Bass are one octave lower; ranges do not cross.
- [ ] Chromatic syllables carry explicit accidentals (`fe` in B♭ is `=e`/`=E`; `de` in F is `^F`).
- [ ] Every bar adds up to `M:` (halves around `||` combined); no padded or invented pickups.
- [ ] Holds are note lengths, not ties.
- [ ] Descant (if printed) is `V:5`, first in each system, with `has_descant=true` and `%%staves [(5) (1 2) (3 4)]`.
- [ ] The word "System" appears only in `% --- System N ---` lines.
- [ ] Lyrics copied exactly into `W:` lines; no invented metadata.

---

## 6. Prompt Template for Gemini

```markdown
You are an expert musicologist and ABC notation transcription engine specializing in Curwen Tonic Sol-fa hymnody.

Convert the provided Sol-fa score image into standard ABC notation for the SolfaTunes app (https://github.com/PYTHAGON2/SolfaTunes/).

Work internally in five steps: (1) read the exact printed sol-fa tokens bar by bar, voice by voice (a descant is the extra top row), (2) expand pulses into note durations, (3) compile to ABC, (4) convert your ABC back to sol-fa and compare with step 1, fixing any difference, (5) output.

The ABC body must use real note letters (A-G, a-g) with octave marks, accidentals and durations. Soprano, alto and descant use the literal octave table from the skill; tenor and bass are written one octave lower. Never put sol-fa syllables, colons, subscripts, periods, ties or chords in the music lines. Use the exact header order and voice layout from the skill. Copy lyrics into W: lines. Omit metadata that is not visible on the page.

Return ONLY the final ABC code block.
```

---

## 7. Worked Example 1: Warrington (key Bb, 3 pulses per bar, SATB)

### Step 1 (internal, for illustration only): raw extraction, system 1

```text
S: s₁ :s₁ :f₁ | m₁ :s₁ :d | d :-.r :t₁ | d :- || m | r :- :r | m :- :r.d |
A: m₁ :m₁ :r₁ | m₁ :r₁ :m₁ | f₁ :- :r₁ | m₁ :- || s₁ | s₁ :- :s₁ | s₁ :fe₁ :s₁.l₁ |
T: d :d :t₁ | d :r :d | l₁ :- :s₁ | s₁ :- || d | d :t₁ :t₁ | d :- :r.m |
B: d₁ :m₁ :s₁ | d :t₁ :l₁ | f₁ :r₁ :s₁ | d₁ :- || d₁ | s₁ :- :s₁ | d₁ :l₂ :t₂.d₁ |
```

### Steps 2 to 4 (internal): spot checks

- `d :-.r` (Soprano) = d held 3/2, then r for 1/2, so `B3/2 c/2`.
- `fe₁` (Alto) is a raised f one octave down; in K:Bb, f = E♭, so `fe₁` = E♮ = `=E`.
- Tenor `d` is B♭3 = `B,`; Bass `d₁` is B♭2 = `B,,`. Both are one octave below the S/A table.
- Bass `d₁ :l₂ :t₂.d₁` = `B,, G,, A,,/2 B,,/2` (G2, A2, B♭2, rising stepwise).
- Soprano `d :-` plus the pickup `m` = 3 pulses, so `B2 || d`.

### Step 5: final output

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

## 8. Worked Example 2: Hursley (key F, 3 pulses per bar, SATB + Descant)

### Step 1 (internal): raw extraction, system 1, first three bars, and a chromatic bar from system 2

```text
D: d¹ :t.l :s.f | m :r :d | s :- :f |      ...   | t :l.t :de¹ |
S: d :d :d      | d :t₁ :d | r :m :r |      ...   | r :r :m |
A: s₁ :s₁ :s₁   | s₁ :- :s₁ | t₁ :- :t₁ |  ...   | t₁ :r :de |
T: m :m :m      | m :r :m  | f :s :f |      ...   | s :l :s |
B: d :d :d      | d :- :d  | s₁ :- :s₁ |    ...   | s :f :m |
```

### Spot checks

- `d¹` (Descant) is F5 = `f`; `t.l` = `e/2 d/2`; `s.f` = `c/2 B/2`.
- Alto `s₁` is C4 = `C`. Tenor `m` is A3 = `A,`. Bass `d` is F3 = `F,`; Bass `s₁` is C3 = `C,`.
- `de¹` (Descant) = raised d, an octave up = F♯5 = `^f`. Alto `de` = F♯4 = `^F`.
- Every bar has 3 pulses and there is no split bar before any `||`.
- No hymn name, meter or verses are printed, so those metadata lines are omitted. No lyrics are printed, so there are no `W:` lines.

### Final output

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

Return **only** the verified ABC code block. Do not include the raw extraction, round-trip notes, validation commentary or explanations. The SolfaTunes parser is strict about header order and voice declarations; any deviation, and any sol-fa character in a music line, will break rendering.
