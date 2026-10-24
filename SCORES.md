# Score files

The app automatically bundles `.abc`, `.txt`, `.xml`, and `.musicxml` files in
this folder into the score library at build time. ABC files open in the ABC
editor; XML and MusicXML files open through the MusicXML importer, including
its existing confirmation for unsupported or lossy content.

Reference ABC files used by the test suite are stored in
`test/fixtures/scores/` and are not part of the app's bundled score list.

Use standard ABC headers such as `T:` for the tune title and `C:` for the composer. To show the hymn title first in the library, add a metadata comment:

```text
% hymn_name=The hymn title
% tune_name=The tune name
```

The score library defaults to hymn titles and falls back to the score's `T:` title when no `hymn_name` is present. Users can switch the list to tune names at any time.

## Project files

The app opens MusicXML project files and ABC text files locally in the browser. **Save project** downloads a MusicXML file; it does not overwrite a file on disk or synchronize projects to a server. ABC download remains available for compatibility with existing scores.

MusicXML content that the editable score cannot represent, including ties and note-aligned lyrics, is reported as lossy. The original MusicXML is retained as recovery data in saved MusicXML projects when available. This recovery copy is not an editable representation of those constructs. Replacing a lossy or unverified MusicXML project requires confirmation; cancelling keeps the current score and its recovery source.
