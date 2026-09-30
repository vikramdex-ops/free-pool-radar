Two licences, because this repo ships two different kinds of thing.

- `LICENSE` - MIT. Covers the code (Next.js app, scripts, migrations).
- `DATA-LICENSE` - CC0 1.0 Universal, verbatim legal code. Covers the dataset
  (observations, offers, providers, sweeps) released from Supabase.
- `NOTICE.md` - trademark / non-endorsement notice. Neither licence grants
  trademark rights, and nothing here implies any provider sponsors or is
  affiliated with this project.
- `package.json` - `license: MIT` so tooling and package registries report it.

Why split: the code is worth protecting, the data is worth not protecting.
The value of this project is that someone else can take the measurements and
build something without asking. Keeping the data under a copyleft licence would
defeat that, and shipping MIT-only would imply the dataset carries the same
warranty-free-but-attribution-bound terms as the code, which is not what we
want.

Merging order: this merges **before** the README rewrite (PR #9), because the
README references `LICENSE` and `DATA-LICENSE` and those files have to exist.
