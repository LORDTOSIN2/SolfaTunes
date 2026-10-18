/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExampleSong {
  id: string;
  title: string;
  composer: string;
  abcText: string;
}

export const EXAMPLES: ExampleSong[] = [
  {
    id: 'old_hundredth',
    title: 'Old Hundredth (Doxology)',
    composer: 'Louis Bourgeois, 1551',
    abcText: `% Praise God, from Whom All Blessings Flow (Old Hundredth)
% Beautiful SATB Multi-Voice Setting
X:1
T:Old Hundredth
C:Louis Bourgeois
M:4/4
L:1/4
K:G
%%staves [(S A) (T B)]
V:S name="Soprano" clef=treble
V:A name="Alto" clef=treble
V:T name="Tenor" clef=treble
V:B name="Bass" clef=bass

% --- System 1 ---
[V:S] G2 G2 | F2 E2 | D2 G2 | A2 B2 |
[V:A] D2 D2 | D2 C2 | B,2 D2 | D2 D2 |
[V:T] B,2 B,2 | A,2 G,2 | F,2 G,2 | F,2 G,2 |
[V:B] G,,2 G,,2 | D,,2 C,,2 | G,,2 B,,2 | D,2 G,,2 |

% --- System 2 ---
[V:S] B2 B2 | B2 A2 | G2 B2 | A2 G2 |
[V:A] D2 G2 | G2 F2 | D2 G2 | F2 D2 |
[V:T] G,2 D2 | D2 D2 | B,2 D2 | C2 B,2 |
[V:B] G,,2 G,,2 | G,,2 D,2 | G,2 G,,2 | D,2 G,,2 |

% --- System 3 ---
[V:S] A2 G2 | A2 B2 | d2 B2 | A2 G2 |
[V:A] D2 D2 | D2 D2 | F2 D2 | D2 B,2 |
[V:T] F,2 G,2 | F,2 G,2 | A,2 G,2 | F,2 G,2 |
[V:B] D,2 B,,2 | D,2 G,,2 | D,2 G,,2 | D,2 G,,2 |

% --- System 4 ---
[V:S] c2 B2 | A2 G2 | E2 F2 | G4 |]
[V:A] E2 D2 | D2 D2 | C2 C2 | B,4 |]
[V:T] G,2 G,2 | F,2 G,2 | G,2 A,2 | G,4 |]
[V:B] C,2 G,,2 | D,2 B,,2 | C,2 D,2 | G,,4 |]
`
  },
  {
    id: 'amazing_grace',
    title: 'Amazing Grace (Simple SATB)',
    composer: 'Traditional American Melody',
    abcText: `% Amazing Grace in G major, 3/4 time
X:2
T:Amazing Grace
C:Traditional
M:3/4
L:1/4
K:G
%%staves [(S A) (T B)]
V:S name="Soprano" clef=treble
V:A name="Alto" clef=treble
V:T name="Tenor" clef=treble
V:B name="Bass" clef=bass

% --- System 1 ---
[V:S] D | G2 (B/G/) | B2 A | G2 E | D2 D |
[V:A] B, | D2 D | D2 C | B,2 C | B,2 B, |
[V:T] G, | B,2 G, | G,2 F, | G,2 G, | G,2 G, |
[V:B] G,, | G,,2 G,, | D,,2 D,, | E,,2 C,, | G,,2 G,, |

% --- System 2 ---
[V:S] G2 (B/G/) | B2 (A/B/) | d2 | B2 d |
[V:A] D2 D | D2 D | D2 | D2 F |
[V:T] B,2 G, | G,2 G, | F,2 | G,2 B, |
[V:B] G,,2 G,, | E,,2 E,, | D,,2 | G,,2 B,, |

% --- System 3 ---
[V:S] (d/B/) G2 (B/G/) | B2 A | G2 E | D2 D |
[V:A] G2 D | D2 C | B,2 C | B,2 B, |
[V:T] B,2 B, | G,2 F, | G,2 G, | G,2 G, |
[V:B] G,,2 G,, | D,,2 D,, | E,,2 C,, | G,,2 G,, |

% --- System 4 ---
[V:S] G2 (B/G/) | B2 A | G3 | - |]
[V:A] D2 D | D2 C | B,3 | - |]
[V:T] B,2 G, | G,2 F, | G,3 | - |]
[V:B] G,,2 G,, | D,,2 D,, | G,,3 | - |]
`
  },
  {
    id: 'chromatic_scale',
    title: 'Chromatic Scale (Curwen Reference)',
    composer: 'SolfaTunes Theory Test',
    abcText: `% Demonstrate raised chromatic tones in Tonic Sol-fa
X:3
T:Chromatic Practice
C:Theory Dept
M:4/4
L:1/4
K:C
V:S name="Melody" clef=treble
C ^C D ^D | E F ^F G | ^G A ^A B | c4 |]
`
  },
  {
    id: 'bishopthorpe',
    title: 'Bishopthorpe (with Descant)',
    composer: 'J. Clarke (c.1659–1707)',
    abcText: `% Beautiful Bishopthorpe Hymn Setting
% Demonstrating has_descant, staves formatting, and lyrics
X:4
T:Bishopthorpe
C:J. Clarke (c.1659–1707)
M:3/4
L:1/4
K:G
% hymn_meter=8.6.8.6
% tune_name=Bishopthorpe
% hymn_name=Immortal Love, For Ever Full
% verses=7
% has_descant=true
%%staves [(5) (1 2) (3 4)]
V:5 name="Descant" clef=treble
V:1 name="Soprano" clef=treble
V:2 name="Alto" clef=treble
V:3 name="Tenor" clef=treble
V:4 name="Bass" clef=bass

% --- System 1 ---
[V:5] B2 c | d2 e | d2 c | B3 |
[V:1] G2 A | B2 c | B2 A | G3 |
[V:2] D2 D | D2 E | D2 C | B,3 |
[V:3] B,2 F, | G,2 G, | G,2 F, | G,3 |
[V:4] G,,2 D, | G,2 C, | G,,2 D, | G,,3 |

% --- System 2 ---
[V:5] d2 d | e2 d | c2 B | A3 |
[V:1] B2 B | c2 B | A2 G | F3 |
[V:2] D2 D | E2 D | C2 B, | A,3 |
[V:3] G,2 G, | G,2 G, | E,2 G, | D,3 |
[V:4] G,,2 B,, | C,2 G,, | A,,2 B,, | D,3 |

W: 1. Immortal Love for ever full,
W:    for ever flowing free,
W:    for ever shared, for ever whole,
W:    a never-ebbing sea.
W:
W: 2. Our outward lips confess the name,
W:    all other names above;
W:    love only knoweth whence it came,
W:    and comprehendeth love.
`
  },
  {
    id: 'hursley',
    title: 'Hursley (Katholisches Gesangbuch)',
    composer: 'c. 1775, SATB + Descant',
    abcText: `% Hursley Hymn Setting in F Major
X:5
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
`
  },
  {
    id: 'warrington',
    title: 'Warrington (Harrison)',
    composer: 'R. Harrison, 1748–1810',
    abcText: `% Warrington in Bb Major
X:6
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
`
  }
];
