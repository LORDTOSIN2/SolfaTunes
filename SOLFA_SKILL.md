---
name: extract-tonic-solfa-from-image
description: >-
  Use when asked to extract or transcribe Curwen Tonic Sol-fa hymn scores from
  images (scans, photos, sheet music, PDFs) into a Neat Plain Text Tonic Sol-fa
  code block for SolfaTunes. Triggers on "extract solfa", "convert image to solfa",
  "transcribe solfa", "tonic solfa from photo", "hymn to solfa", or any image
  containing d r m f s l t vocal notation. Strictly outputs a single, clean,
  pulse-aligned Plain Text Tonic Sol-fa code block ready for SolfaTunes, complete
  with enriched metadata and public-domain hymn lyrics.
---

# SKILL: Extract Curwen Tonic Sol-fa from Image to SolfaTunes Plain Text

Convert an image of a Curwen Tonic Sol-fa hymn score (photo, scan, screenshot, or PDF page) directly into a **Neat Plain Text Tonic Sol-fa code block** specifically engineered for the SolfaTunes application (https://github.com/PYTHAGON2/SolfaTunes/).

Unlike ABC conversion skills, the objective of this skill is to produce **pure, authentic, human-readable Tonic Sol-fa text** using Curwen sol-fa syllables (`d r m f s l t`), unicode octave subscripts/superscripts (`d₁`, `d¹`), timing punctuation (`|`, `||`, `|]`, `:`, `.`, `,`, `-`), vertical pulse alignment, enriched metadata comments, and full public-domain hymn lyrics.

---

## 0. Output Contract

1. **Single Primary Artifact:**
   Output exactly **one** primary markdown code block labelled ````text```` containing the complete, ready-to-paste Tonic Sol-fa score.
2. **Pure Sol-fa Syntax:**
   Never output ABC notation letters (`C D E F G A B`) in the music lines. Use exclusively Curwen syllables (`d r m f s l t`), chromatic alterations (`fe`, `ta`, `se`, etc.), octave marks (`₁`, `²`), and SolfaTunes rhythmic punctuation.
3. **No Mixed Encodings:**
   Do not mix ABC syntax into Sol-fa lines. Voice lines must begin with standard voice prefixes (`S:`, `A:`, `T:`, `B:`, or `D:`).
4. **Complete Song:**
   Transcribe all systems from opening measure to final double bar `|]`.

---

## 1. SolfaTunes Header & Metadata Specification

Every SolfaTunes score begins with standard headers and metadata comments. SolfaTunes' parser expects these exact keys:

### A. Primary Header Line
The very first line can be formatted as a single combined header or individual lines:
```text
KEY [Key]   [Tune Title]   [Composer / Dates]   M:[Meter]
```
*Example:*
```text
KEY G   Vienna   J. H. Knecht (1752–1817)   M:2/4
```
*Alternatively, separate lines are also fully supported:*
```text
KEY G
T: Vienna
C: J. H. Knecht (1752–1817)
M: 2/4
```

### B. Standard Keys
* Major keys: `KEY C`, `KEY G`, `KEY D`, `KEY A`, `KEY E`, `KEY F`, `KEY Bb`, `KEY Eb`, `KEY Ab`, `KEY Db`.
* Minor keys: `KEY Am`, `KEY Em`, `KEY Dm`, `KEY Gm`, etc.
* If the image has a cut-off or blurred key, determine the key by inspecting the final tonic chord (`d` in Soprano/Bass) or the printed signature.

### C. Standard Meters
* `M:4/4` or `M:C` (Common time — 4 pulses per measure)
* `M:2/4` (2 pulses per measure)
* `M:3/4` (3 pulses per measure)
* `M:6/8` (Compound duple — 2 dotted-quarter pulses per measure, each divided into 3 eighth notes)
* `M:C|` or `M:2/2` (Cut time / Alla breve — 2 half-note pulses per measure)

### D. Enriched Metadata Comments (`%`)
The LLM should **enrich and supply all important metadata** that SolfaTunes utilizes. If any item is not legible or not printed in the image, browse or deduce it from hymnological knowledge:

| Metadata Tag | Purpose / App Usage | Example |
|---|---|---|
| `% tune_name=` | Tune identifier used for score indexing and filtering | `% tune_name=Winchester New` |
| `% hymn_name=` | Hymn title or incipit shown as the primary library title | `% hymn_name=On Jordan's Bank the Baptist's Cry` |
| `% hymn_meter=` | Poetic meter of the hymn text | `% hymn_meter=L.M.` or `% hymn_meter=8.8.8.8` |
| `% has_descant=` | Flags optional descant voice line (`true` or `false`) | `% has_descant=false` |
| `% verses=` | Total count of verses included in the score | `% verses=4` |

*Common Poetic Meter Abbreviations:*
* `L.M.` (Long Meter = `8.8.8.8`)
* `C.M.` (Common Meter = `8.6.8.6`)
* `S.M.` (Short Meter = `6.6.8.6`)
* `D.` suffix denotes Doubled (e.g., `C.M.D.` = `8.6.8.6.8.6.8.6`)
* Specific meters: `7.6.7.6.D.`, `8.7.8.7.`, `8.7.8.7.8.7.`, `6.5.6.5.D.`, `10.10.10.10.`

---

## 2. Voice Lines & System Architecture

SolfaTunes arranges vocal parts into systems separated by system comments:
```text
% --- System 1 ---
S: | d : r | m : f | s : - |
A: | s₁ : t₁ | d : r | m : - |
T: | m : s | s : l | t : - |
B: | d : s₁ | d : f₁ | s₁ : - |

% --- System 2 ---
...
```

### Voice Prefixes
* `D:` — Descant (optional top voice, treble register)
* `S:` — Soprano (melody, treble register)
* `A:` — Alto (harmony, treble register)
* `T:` — Tenor (tenor harmony; written in sol-fa with treble syllables, sounds an octave lower)
* `B:` — Bass (foundation harmony, bass register)

---

## 3. Curwen Syllables & Octave Standards

### A. Sol-fa Syllables
* **Diatonic scale degrees:** `d` (do), `r` (re), `m` (mi), `f` (fa), `s` (sol), `l` (la), `t` (ti).
* **Sharpened (raised) degrees:** `fe` (sharp 4), `se` (sharp 5), `de` (sharp 1), `re` (sharp 2), `le` (sharp 6). *Aliases ending in `i` (`fi`, `si`, `di`, `ri`, `li`) are also accepted by the parser.*
* **Flattened (lowered) degrees:** `ta` (flat 7), `la` (flat 6), `ma` (flat 3), `ra` (flat 2).

### B. Curwen Octave Subscripts and Superscripts
Curwen Tonic Sol-fa uses small subscript numbers for lower octaves and superscript numbers (or primes) for upper octaves:

| Octave Level | Notation | Meaning | Examples |
|---|---|---|---|
| **Upper Octave 2** | `²` | 2 octaves above central | `d²`, `m²` |
| **Upper Octave 1** | `¹` | 1 octave above central | `d¹`, `r¹`, `m¹`, `f¹`, `s¹` |
| **Central Octave** | *(no mark)* | Base voice register | `d`, `r`, `m`, `f`, `s`, `l`, `t` |
| **Lower Octave 1** | `₁` | 1 octave below central | `s₁`, `l₁`, `t₁`, `f₁`, `m₁`, `d₁` |
| **Lower Octave 2** | `₂` | 2 octaves below central | `d₂`, `t₂`, `s₂`, `f₂` |
| **Lower Octave 3** | `₃` | 3 octaves below central | `d₃` (rare deep bass pedal) |

### C. Voice Register Context (Crucial for Tenor & Bass)
In standard Curwen hymn books:
* **Soprano, Alto, and Descant:** Central octave corresponds to vocal octave 4–5. `d` is middle C (or key tonic). An octave lower is marked `s₁`, `l₁`, `t₁`. An octave higher is marked `d¹`, `r¹`, `m¹`.
* **Tenor and Bass:** Printed in the hymn book with syllables relative to the male register. Tenor middle C is written `d¹`, while central `d` sounds an octave lower (C3). Bass tonic is usually `d₁` (C3) or `d₂` (C2).
* **Subscript Verification Rule:** When transcribing from a scan, carefully inspect lower notes for tiny subscript `₁` marks. If an apparent melody or harmony leaps by a 7th instead of stepping by a 2nd (e.g. `d` to `t` instead of `d` to `t₁`), a subscript `₁` was almost certainly printed on the lower note.

---

## 4. Timing, Rhythm & Punctuation Grid

SolfaTunes parses rhythmic time using standard Curwen punctuation. Every pulse and sub-division must be transcribed with mathematical accuracy:

| Symbol | Syntax | Musical Meaning & Value | SolfaTunes Example |
|---|---|---|---|
| **Barline** | `\|` | Standard measure boundary | `\| d : r : m : f \|` |
| **Double Barline** | `\|\|` | Section, phrase, or line break | `\| d : - \|\| m \| r : d \|` |
| **Final Barline** | `\|]` | End of hymn score | `\| d : - : - : - \|]` |
| **Pulse Divider** | `:` | Separates primary beat pulses | `d : r : m` (3 quarter notes in 3/4) |
| **Continuation Dash** | `-` | Previous note held across pulse | `d : -` (half note in 2/4 or 4/4) |
| **Half-Pulse Divider** | `.` | Splits pulse into two eighth notes | `d.r : m.f` (two 8ths then two 8ths) |
| **Quarter-Pulse Divider** | `,` | Splits half-pulse into 16th notes | `d,r.m,f : s` (four 16ths then quarter) |
| **Sustained + Late Starter** | `-.` | Held for 1.5 pulses, then eighth note | `d : -.r : m : f` (dotted quarter + 8th) |
| **Rest (Silence)** | `·` | Rest of 1 pulse (or blank `: :`) | `d : · : m : ·` (notes with rests) |
| **Repeat Barlines** | `:\|`, `\|:`, `::` | Repeat start / end / double repeat | `\|: d : r : m : f :\|` |

### Special Timing Situations

#### 1. Pickup Measures (Anacrusis / Upbeat)
If a hymn starts on an upbeat (e.g. beat 4 in 4/4 time, or beat 3 in 3/4 time), write **only the upbeat pulse** in the opening measure:
```text
S: | s₁ | d : r : m : f | s : - : m : - |
```
*Never pad the opening pickup measure with artificial rests!* SolfaTunes' timing engine automatically recognizes pickup measures.

#### 2. Split Phrase Measures Across `||`
Hymns frequently place a double barline `||` at the end of a poetic line in the middle of a measure:
```text
S: | d : - || m | r : d : t₁ : r |
```
In this 3/4 example, the 2 pulses `d : -` before `||` and the 1 pulse `m` after `||` together equal one complete 3-pulse measure. Preserve the exact printed placement of `||`.

#### 3. Compound Meters (6/8, 9/8, 12/8)
In compound meters, each main beat pulse is a dotted quarter note, divided into three eighth notes with periods:
```text
M:6/8
S: | d.r.m : f.m.r | d : - |
```

---

## 5. Vertical Pulse Alignment Standards

To ensure neatness, scanability, and instant human review, align barlines `|` and pulse colons `:` vertically across all voices within each system:

```text
% --- System 1 ---
S: | s₁ | d  : -  : m  : -  | s  : -  : m  : d  | r  : -  : -  : -  |
A: | m₁ | s₁ : -  : d  : -  | d  : -  : d  : s₁ | t₁ : -  : -  : -  |
T: | d  | m  : -  : s  : -  | m  : -  : s  : m  | s  : -  : -  : -  |
B: | d₁ | d  : -  : d  : -  | d  : -  : d  : d₁ | s₁ : -  : -  : -  |
```

*Rules for Clean Alignment:*
1. Align the voice prefixes `S:`, `A:`, `T:`, `B:` at column 0.
2. Space out syllables and dashes so that colons `:` line up in vertical columns.
3. Align measure boundaries `|`, `||`, and `|]` vertically across all active staves.

---

## 6. Public Domain Lyrics Integration Protocol

Hymn texts from historic hymnals (e.g. *Hymns Ancient & Modern*, *The English Hymnal*, *Methodist Hymn Book*, *Sacred Songs and Solos*, etc.) are in the **public domain**.

### A. Completing Missing Stanzas
Printed Curwen scores often print only Verse 1 between the sol-fa staves, with verses 2, 3, 4 printed as text at the bottom (or omitted for space).
* **Mandatory Rule:** When transcribing, include **all standard verses** of the hymn.
* If verses 2, 3, 4... are legible in the scan, transcribe them faithfully.
* If only verse 1 is present in the image, browse or draw from established public-domain hymn sources (such as Hymnary.org, CyberHymnal, or standard denominational hymnals) to provide the complete hymn text.

### B. Formatting Lyrics Lines
* Prefix every line of lyrics with `W:`.
* Number each stanza clearly (e.g. `W: 1.`, `W: 2.`, `W: 3.`, `W: 4.`).
* Indent continuation lines of a stanza with 3 spaces so stanza numbers stand out.
* Separate stanzas with a blank `W:` line.

*Example:*
```text
W: 1. ON Jordan's bank the Baptist's cry
W:    Announces that the Lord is nigh;
W:    Awake, and hearken, for he brings
W:    Glad tidings of the King of kings.
W:
W: 2. Then cleansed be every breast from sin;
W:    Make straight the way for God within;
W:    Prepare we in our hearts a home,
W:    Where such a mighty Guest may come.
W:
W: 3. For Thou art our Salvation, Lord,
W:    Our Refuge, and our great Reward;
W:    Without Thy grace we waste away,
W:    Like flowers that wither and decay.
W:
W: 4. To heal the sick stretch forth Thine hand,
W:    And bid the fallen sinner stand;
W:    Shine forth, and let Thy light restore
W:    Earth's own true loveliness once more.
W:
W: 5. All praise, eternal Son, to Thee
W:    Whose advent doth Thy people free,
W:    Whom with the Father we adore
W:    And Holy Ghost for evermore. Amen.
```

---

## 7. Concrete Reference Examples

### Example 1: Winchester New (2/4 Meter with Upbeat)
```text
KEY C   Winchester New   Musikalisch Handbuch (Hamburg, 1690)   M:2/4
% tune_name=Winchester New
% hymn_name=On Jordan's bank the Baptist's cry
% hymn_meter=L.M.
% has_descant=false
% verses=5

% --- System 1 ---
S: | s  | d¹ : s  | l  : l  | s  : f        | m  || m  | f  : m  | r  : s  | s  : fe | s  : - ||
A: | m  | s  : m  | f  : d  | d  : t₁.d : - | d  || d  | d  : d  | t₁ : t₁ | m  : r  | r  : - ||
T: | d¹ | d¹ : d¹ | d¹ : f  | s  : s        | s  || s  | f  : s  | s  : s  | d¹ : l  | t  : - ||
B: | d  | m  : d  | f  : f  | m  : s        | d  || d  | l₁ : d  | s₁ : m  | d  : r  | s₁ : - ||

% --- System 2 ---
S: | s  | d¹ : r¹    | m¹ : d¹ | f¹    : m¹    | r¹ || m¹ | d¹ : l  | s  : d¹ | d¹ : t  | d¹ : - |]
A: | s  | s  : f     | m  : s  | f     : s     | s  || s  | f  : f  | m  : m  | l  : s  | m  : - |]
T: | s  | s  : t₁.d¹ | d¹ : d¹ | t₁.d¹ : d¹    | t  || d¹ | d¹ : d¹ | d¹ : d¹ | r¹ : r¹ | d¹ : - |]
B: | s₁ | m  : r     | d  : m  | r     : m.f   | s  || d  | m  : f  | m  : l  | f  : s  | d  : - |]

W: 1. ON Jordan's bank the Baptist's cry
W:    Announces that the Lord is nigh;
W:    Awake, and hearken, for he brings
W:    Glad tidings of the King of kings.
W:
W: 2. Then cleansed be every breast from sin;
W:    Make straight the way for God within;
W:    Prepare we in our hearts a home,
W:    Where such a mighty Guest may come.
W:
W: 3. For Thou art our Salvation, Lord,
W:    Our Refuge, and our great Reward;
W:    Without Thy grace we waste away,
W:    Like flowers that wither and decay.
W:
W: 4. To heal the sick stretch forth Thine hand,
W:    And bid the fallen sinner stand;
W:    Shine forth, and let Thy light restore
W:    Earth's own true loveliness once more.
W:
W: 5. All praise, eternal Son, to Thee
W:    Whose advent doth Thy people free,
W:    Whom with the Father we adore
W:    And Holy Ghost for evermore. Amen.
```

### Example 2: Vienna (2/4 Meter with Half-Pulses and Accidentals)
```text
KEY G   Vienna   J. H. Knecht (1752–1817)   M:2/4
% tune_name=Vienna
% hymn_name=Lucis Creator optime
% hymn_meter=7.7.7.7
% has_descant=false
% verses=2

% --- System 1 ---
S: | m : r   | d  : m  | s    : f     | m  : - || l₁ : t₁ | d  : r   | t₁ : l₁  | s₁ : - ||
A: | d : t₁  | l₁ : d  | d.s₁ : l₁.t₁ | d  : - || f₁ : f₁ | m₁ : l₁  | s₁ : fi₁ | s₁ : - ||
T: | s : -.f | m  : m  | d    : f     | s  : - || d  : r  | m  : r   | r  : -.d | t₁ : - ||
B: | d : s₁  | l₁ : l₁ | m₁   : r₁    | d₁ : - || f₁ : r₁ | l₁ : fi₁ | s₁ : r₁  | s₁ : - ||

% --- System 2 ---
S: | d  : t₁ | l₁ : d  | f     : m     | r  : - || s  : f  | m : r  | d  : t₁ | d  : - |]
A: | m₁ : s₁ | f₁ : s₁ | l₁.t₁ : d     | t₁ : - || d  : r  | d : l₁ | s₁ : s₁ | s₁ : - |]
T: | d  : m  | d  : m  | f     : s     | s  : - || s  : s  | s : f  | m  : r  | m  : - |]
B: | l₁ : m₁ | f₁ : m₁ | r₁    : m₁.f₁ | s₁ : - || m₁ : t₁ | d : f₁ | s₁ : s₁ | d₁ : - |]

W: 1. BLEST Creator of the light,
W:    Making day with radiance bright,
W:    Thou didst o'er the forming earth
W:    Give the golden light its birth.
W:
W: 2. May we ne'er by guilt depressed
W:    Lose the way to endless rest;
W:    Nor with idle thoughts and vain
W:    Bind our souls to earth again.
```

### Example 3: Franconia (2/4 Meter with S.M. Meter & Caesuras)
```text
KEY Eb   Franconia   Harmonischer Liederschatz, 1738   M:2/4
% tune_name=Franconia
% hymn_name=The advent of our King
% hymn_meter=S.M.
% has_descant=false
% verses=5

% --- System 1 ---
S: | d  | r  : m | f  : s  | m : - || s | l : d¹ | f  : m | r  : - ||
A: | s₁ | t₁ : d | d  : t₁ | d : - || d | d : d  | t₁ : d | t₁ : - ||
T: | m  | s  : s | f  : r  | m : - || m | f : s  | f  : s | s  : - ||
B: | d  | s₁ : d | l₁ : s₁ | d : - || d | f : m  | r  : d | s₁ : - ||

% --- System 2 ---
S: | s  | d¹ : t  | l  : s  | l : l  | s  || s  | d  : m  | r  : r  | d : - |]
A: | r  | d  : r  | m  : t₁ | r : r  | t₁ || t₁ | d  : d  | d  : t₁ | d : - |]
T: | t  | s  : s  | d¹ : s  | s : fe | s  || s  | m  : s  | l₁ : s  | m : - |]
B: | s₁ | m  : s₁ | d  : m  | r : r  | s₁ || s₁ | l₁ : m₁ | f₁ : s₁ | d : - |]

W: 1. The advent of our King
W:    Our prayers must now employ,
W:    And we must hymns of welcome sing
W:    In strains of holy joy.
W:
W: 2. The everlasting Son
W:    Incarnate deigns to be;
W:    Himself a servant's form puts on,
W:    To set His servants free.
W:
W: 3. Daughter of Zion, rise
W:    To meet thy lowly King;
W:    Nor let thy faithless heart despise
W:    The peace He comes to bring.
W:
W: 4. As Judge, on clouds of light,
W:    He soon will come again,
W:    And His true members all unite
W:    With Him in heaven to reign.
W:
W: 5. All glory to the Son,
W:    Who comes to set us free,
W:    With Father, Spirit, Three in One,
W:    Through all eternity. Amen.
```

### Example 4: Hymn with Descant (D, S, A, T, B)
```text
KEY G   St. Anne   William Croft (1678–1727)   M:4/4
% tune_name=St. Anne
% hymn_name=O God, our help in ages past
% hymn_meter=C.M.
% has_descant=true
% verses=6

% --- System 1 ---
D: | -  | -  : -  : -  : -  | -  : -  : -  : d¹ | d¹ : t  : d¹ : s  | l  : -  : -  ||
S: | d  | m  : d  : s  : f  | m  : -  : r  : d  | f  : m  : r  : d  | r  : -  : -  ||
A: | d  | d  : d  : d  : d  | d  : -  : t₁ : d  | d  : d  : t₁ : d  | t₁ : -  : -  ||
T: | m  | s  : m  : s  : l  | s  : -  : s  : m  | l  : s  : s  : m  | s  : -  : -  ||
B: | d  | d  : l₁ : m₁ : f₁ | s₁ : -  : s₁ : d  | f₁ : d  : s₁ : l₁ | s₁ : -  : -  ||

...
```

---

## 8. Verification & Quality Checklist

Before presenting the final Plain Text Tonic Sol-fa code block to the user, verify each item:

- [ ] **Header Format:** Line 1 includes `KEY [Key]`, tune name, composer, and `M:[Meter]`.
- [ ] **Metadata Comments:** Contains `% tune_name=`, `% hymn_name=`, `% hymn_meter=`, `% has_descant=`, and `% verses=`.
- [ ] **Voice Completeness:** SATB parts (plus Descant if present) are transcribed in every system.
- [ ] **Bar Consistency:** Pulse counts inside each measure strictly match the meter (e.g. exactly 4 pulses between `|` in 4/4, 3 pulses in 3/4, 2 pulses in 2/4).
- [ ] **Continuation & Held Notes:** Notes sustained across beats use `-`.
- [ ] **Subscript Fidelity:** Checked all lower vocal lines (especially Tenor and Bass) for missing `₁` or `₂` marks.
- [ ] **Pickup Bar:** If the hymn opens on an upbeat, the first bar contains only the upbeat pulses.
- [ ] **Vertical Column Alignment:** Barlines and colons align neatly in monospace font across voices.
- [ ] **Lyrics:** Complete stanzas included under `W:`, formatted with stanza numbers and stanza breaks.
- [ ] **Single Clean Output:** The code block is pure, pristine Plain Text Tonic Sol-fa, ready to paste directly into SolfaTunes!
