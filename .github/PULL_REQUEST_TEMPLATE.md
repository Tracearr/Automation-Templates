## What it does

Paste the sentence Tracearr shows for this automation. Anything else a reviewer
should know goes under it.

## Checklist

- [ ] Exported from Tracearr, not hand-edited. CI recomputes the fingerprint over
      `inputs` and `definition`, so an edit fails the build.
- [ ] The file is `templates/<slug>.json` and the `slug` inside matches the filename.
- [ ] The description says what the automation actually does.
- [ ] Nothing from your install is in the JSON. Export lifts server ids, destination
      ids and condition values into inputs, but read the file over anyway.
- [ ] CI is green.

The [contributing section](https://github.com/Tracearr/automation-templates#contributing-a-template)
of the README has the rest.
