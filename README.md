# Tracearr automation templates

Automations people have written for [Tracearr](https://github.com/connorgallopo/Tracearr), as
exported share codes. The gallery at <https://docs.tracearr.com/templates> is built from this
repository's `index.json`.

Nothing in a Tracearr install ever contacts this repository. Adding a template to your own
Tracearr means copying its share code and pasting it into Automations → Import. There is no URL
import and no catalog fetch, on purpose: a self-hosted install should not phone anywhere to find
out what it can do.

## What is in here

| Path | What |
|---|---|
| `templates/<slug>.json` | One exported envelope per template. CI rejects any other file here. |
| `index.json` | Built by CI on `main`. The docs gallery reads this and nothing else. |
| `builtins.json` | Slug to fingerprint for the templates Tracearr already ships. |
| `verified.json` | Slugs a maintainer has read. |
| `scripts/` | Validation, the index build, and the discussion sync. |

## Contributing a template

1. Build the automation in Tracearr and check it does what you want.
2. Open it and choose **Export**. The dialog shows the share code with a **Copy the share code**
   button, and the JSON sits under the disclosure titled **Put this in the community gallery**,
   alongside links to the gallery and to this repository.
3. Open that disclosure and set **Author** and **Section** before copying anything, because both
   are written into the JSON. **Author** is optional free text, and Tracearr never fills it from
   the account; once it has a value the dialog says "The code includes the author name."
   **Section** is the part of the gallery the template is listed under (Notifications, Server
   health, Limits and rules, Housekeeping) and becomes the envelope's `group`.
4. Press **Copy the JSON**, save it as `templates/<slug>.json` where `<slug>` matches the `slug`
   in the file, and open a pull request. Pull requests are the only way in.

Do not hand-edit the JSON. The envelope carries a `fingerprint` over its own `inputs` and
`definition`, CI recomputes it, and a mismatch fails the build. Change the automation in Tracearr
and export it again instead.

A good template asks for as little as possible and explains itself in its `description`. Scope
ids, destination ids and condition values that name a server, an account or an IP range are
lifted into inputs at export, so whoever imports it fills in their own. That is also why an
export carries no destination configuration, no tokens, and no names from your install.

### What CI checks

`validate.yml` runs on every pull request and fails on any of:

- a file in `templates/` that is not `.json`
- an envelope that `templateEnvelopeSchema` rejects, including unknown keys and unknown trigger,
  action or input kinds
- a fingerprint that does not match the recomputed hash over `canonicalJson({ inputs, definition })`
- a filename that does not match its own slug, or a slug already used by another file
- an envelope the index build cannot render

`discussions.yml` runs on `main`: it rebuilds `index.json`, opens or edits one Discussion per
template in the **Templates** category, writes each discussion number back into `index.json`, and
commits the result. That last push uses the `INDEX_DEPLOY_KEY` deploy key, since `main` requires the validate check and the workflow's own token cannot get past it. The docs page for a template embeds that thread through giscus, so reactions
and replies live on GitHub.

### What gets rejected

- Anything but an envelope in `templates/`. The gallery renders the envelope's own fields
  (name, description, sentence, inputs) and never contributor-supplied HTML or MDX.
- Templates whose actions do something the description does not admit to. The page derives a
  "What this does" block from the definition, so a template that stops streams says so whatever
  its author wrote, but a misleading description is still a reason to close a pull request.
- Near-duplicates of an existing template. Improve the existing one.
- Templates that need a Tracearr newer than the released one.

## Verified and Built-in

**Verified** means a maintainer read the template and its definition. That is a human review.
Nothing about a share code is signed and nothing is checked cryptographically. A slug listed in
`verified.json` gets the badge; the review happens when the pull request is merged, and it happens
again whenever the envelope changes, because changing it changes the fingerprint.

**Built-in** means the slug and fingerprint both match a template Tracearr already ships, so
importing it gives you exactly the ready-made automation already in your New automation gallery.

Neither badge travels with a share code. A code pasted from Discord, a forum or anywhere else
carries no claim at all, which is why Tracearr's import review shows what the automation does and
adds it paused.

## Running the scripts locally

```bash
npm install
node scripts/validate.mjs      # every envelope, one line per problem
node scripts/build-index.mjs   # writes index.json
```

`@tracearr/shared` is pinned in `package.json` to the release the template schema belongs to.
While 2.2 is in beta it points at the `next` tag, which is where betas publish; at the 2.2.0
release it becomes `2.2.0`. Bump it deliberately, together with whatever `minServerVersion` the
envelopes then carry.

## License

AGPL-3.0, the same as Tracearr itself. The full text is in `LICENSE`.
