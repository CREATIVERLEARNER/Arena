# Bookroom 📚

A cozy 2D home for your comics — put bookcases on a wall, drop in your `.cbz` files, and arrange
everything exactly how you like it: by hand, by series, by favourite, whatever.

Inspired by games like [Boxroom](https://store.steampowered.com/app/1168980/Boxroom/), but flat and
fast on purpose. Built as a companion to [Komga](https://komga.org): keep reading there, shelve here.

## What it does

- **The room** — a long wall where you place wooden bookcases. Drag them around, resize them from
  the edges, change the wood, rename them, stack as many as you like. Pan and zoom freely.
- **Click a bookcase to open it** and see its books as **spines** — thin ones for short books, thick
  ones for long ones, generated colours per series (or a colour pulled from the cover). No spine
  image? The spine just says the name, like a real library. Flip to **Covers** view to browse
  face-out.
- **Arrange however you want** — drag spines around by hand (across rows, with a live insertion
  caret), or sort by *series & volume*, *author/artist*, *favourites first*, *read status*,
  *recently added*, or *title*. Dragging on a sorted shelf switches it to custom order.
- **CBZ import** — drop `.cbz`/`.zip` files (or whole folders) anywhere. Bookroom reads the cover,
  page count and metadata straight out of the archive — **ComicInfo.xml** when present
  (series, number, writer…), otherwise it parses the filename (`Berserk v05.cbz`,
  `Vinland Saga Chapter 12.cbz`, `Yotsuba&! v03 [Group].cbz` …). Duplicates are skipped on re-import,
  and an accidental import can be undone.
- **Loose books** — imports made from the room land in a to-shelve inbox (the import panel offers a
  one-click "move all to…"); drop files while a shelf is open and they shelve directly onto it.
  Tick books and move them in bulk any time.
- **Read tracking** — unread/reading/read status, 5-star ratings, tags and notes. Unread books get a
  little dot on the spine, 4★+ books get a gold pip.
- **Backup** — everything lives in your browser (IndexedDB); export/import a JSON backup to move it.
  Comic files are never stored — only small covers and metadata, so even huge libraries stay light.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

First launch shows an empty room — add a bookcase, drop some `.cbz` files, or press
**Load a sample library** to see it populated.

### Production

```bash
npm run build      # static site in dist/
npm run preview    # serve the build locally
```

`dist/` is a fully static site — serve it with anything (`python -m http.server`, nginx, Caddy…).
Or with Docker:

```bash
docker build -t bookroom .
docker run -p 8080:80 bookroom
```

## Controls

| Action | How |
| --- | --- |
| Pan / zoom the room | drag empty space · scroll (or pinch) · `−`/`+` · `0` fit |
| Move a bookcase | drag it (edges snap to neighbours) |
| Resize a bookcase | drag its left/right edge · or *Bookcase options* |
| Open a bookcase | click it |
| Bookcase options | right-click · the `⋯` button · or `Esc`-out of options |
| Rearrange books | drag spines (spines view) |
| Book quick actions | right-click a spine (mark read, move, delete…) |
| Search | `/` — matches shelf names and the books inside |
| New bookcase | `n` |
| Help | `?` |
| Back to room | `Esc` |

## Notes & limits

- **Browsers**: needs a modern browser for `DecompressionStream` (Chrome/Edge 80+, Firefox 113+,
  Safari 16.4+).
- **CBR (RAR) isn't supported** — convert to CBZ first (most tools, including Komga itself, can).
  ZIP64 archives are also rejected (re-save them).
- Data is **per browser profile**. Moving machines or browsers? `Settings → Export backup`.
- Import reads files locally in your browser; nothing is uploaded anywhere.

## Tests

```bash
npm test    # zip reader, domain logic (layout/capacity/sorting), render smoke tests
```

## Tech

React + Vite, zero runtime dependencies beyond React. The CBZ reader is a ~100-line custom ZIP
parser that uses the platform's `DecompressionStream` for deflate — no zip library. Fonts
(Fraunces) are bundled locally, so the built app works offline.

### Possible next steps

- Built-in page reader (it already has the ZIP plumbing)
- RAR/CBR support via libarchive.wasm
- Direct Komga server import
- Wall decorations, more rooms/floors
