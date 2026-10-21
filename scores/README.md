# Score library

Add `.abc` or `.txt` ABC-notation score files to this folder. The app discovers these files at build time and lists them in the score library.

Use standard ABC headers such as `T:` for the tune title and `C:` for the composer. To show the hymn title first in the library, add a metadata comment:

```text
% hymn_name=The hymn title
% tune_name=The tune name
```

The library defaults to hymn titles and falls back to the score's `T:` title when no `hymn_name` is present. Users can switch the list to tune names at any time.
