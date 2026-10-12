# shardReader

A local-first EPUB reader for desktop, with a personal library, reading progress, and per-book settings. Built as a calm, free alternative for people who want to read their own files without giving up control of them.

> **Status:** early development. Currently working on Phase 1 (library import).

---

## Features

### Implemented

- Cross-platform desktop app shell (Tauri 2): Windows, macOS, Linux
- React 19 + TypeScript + Vite frontend
- Tailwind CSS 4 + shadcn/ui component primitives (code copied into the repo)
- Dark / light / system theme, persistent
- Interface in English and Spanish
- Sidebar navigation (Library / Reader / Settings)
- SQLite-backed storage via `@tauri-apps/plugin-sql`
- Key-value preferences via `@tauri-apps/plugin-store`
- Native file picker via `@tauri-apps/plugin-dialog`
- Renderer integration via `foliate-js` (EPUB 2/3 reflowable, fixed-layout, multi-format-ready)

### Planned

See [`lector_epub_multiplataforma.md`](./lector_epub_multiplataforma.md) for the full roadmap. Phases at a glance:

1. **Library** — import EPUBs, list/search, persist paths
2. **Reading experience** — render, TOC, font/size/margin/theme controls, auto-resume progress
3. **Bookmarks, highlights, notes, in-book search, reading stats, backup**

### Out of scope (v1)

PDF, DRM, OPDS, audiobooks.

---

## Stack

| Layer         | Choice                                                                                 |
| ------------- | -------------------------------------------------------------------------------------- |
| Shell         | Tauri 2 (Rust)                                                                         |
| UI runtime    | React 19 + TypeScript                                                                  |
| Build         | Vite 8                                                                                 |
| Styles        | Tailwind CSS 4 + shadcn/ui (Radix)                                                     |
| State         | Zustand                                                                                |
| Icons         | lucide-react                                                                           |
| i18n          | i18next + react-i18next                                                                |
| EPUB engine   | [foliate-js](https://github.com/johnfactotum/foliate-js) + `@zip.js/zip.js` + `fflate` |
| Persistence   | SQLite (`@tauri-apps/plugin-sql`) for data, `@tauri-apps/plugin-store` for prefs       |
| Routing       | React Router v7                                                                        |
| Tests         | Vitest + Testing Library                                                               |
| Lint / format | ESLint flat config + Prettier (with `prettier-plugin-tailwindcss`)                     |

Mobile platforms are intentionally deferred — see the spec for the staging notes.

---

## Requirements

- **Node.js** 22+ (tested with 24)
- **Rust** stable (1.77+), via [rustup](https://rustup.rs)
- **pnpm** 11+
- Platform deps for Tauri — see the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

  - **Windows:** Microsoft Visual Studio C++ Build Tools, WebView2 runtime
  - **macOS:** Xcode Command Line Tools
  - **Linux:** `webkit2gtk-4.1`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`

---

## Quick start

```bash
pnpm install
pnpm tauri:dev          # launches the desktop window
```

The first build pulls and compiles all Rust dependencies; subsequent runs are fast.

### Headless (frontend only)

If you just want to iterate on UI without launching the native window:

```bash
pnpm dev                # plain Vite dev server at http://localhost:1420
```

---

## Scripts

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | Vite dev server (renderer only)            |
| `pnpm build`        | Type-check and produce a production bundle |
| `pnpm preview`      | Preview the built bundle                   |
| `pnpm tauri:dev`    | Run the desktop app with hot reload        |
| `pnpm tauri:build`  | Build platform-specific installers         |
| `pnpm test`         | Run unit and component tests once          |
| `pnpm test:watch`   | Vitest watch mode                          |
| `pnpm typecheck`    | TypeScript check, no emit                  |
| `pnpm lint`         | ESLint                                     |
| `pnpm lint:fix`     | ESLint with autofix                        |
| `pnpm format`       | Prettier write                             |
| `pnpm format:check` | Prettier check (CI-friendly)               |

---

## Project structure

```
src/
  app/                Routing root
  components/
    layout/           App shell, theme provider, providers
    ui/               shadcn/ui primitives (added per-component)
  features/
    library/          Import and library UI
    reader/           EPUB rendering + reading controls
    settings/         App preferences
  i18n/               i18next init + locale JSON files
  lib/                Cross-feature helpers (cn, etc.)
  App.tsx             Providers + router
  main.tsx            Entry point
  index.css           Tailwind import + shadcn tokens

src-tauri/            Rust shell + plugin registrations + capabilities
tests/                Vitest suites with shared setup
```

The `features/` folder follows a vertical-slice pattern: each feature owns its own `components/`, `hooks/`, `services/`, and `pages/`. Cross-feature code goes through `components/` and `lib/`.

---

## Internationalization

Locales live in `src/i18n/locales/{en,es}.json`. The active language is detected from `localStorage`, falling back to the browser preference (`es-*` → Spanish, anything else → English). Add a new language by:

1. Adding `<code>.json` under `locales/`
2. Adding the tag to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`

Component copy should use `useTranslation()` — never hardcode user-facing strings.

---

## Security

EPUB files are untrusted containers (HTML/CSS/images, and scripts in EPUB 3 scripted content). `foliate-js` renders them inside sandboxed iframes; the project never enables EPUB scripts and runs under the Tauri capability system with least-privilege permissions. When integrating the renderer in earnest, set a Content-Security-Policy in `src-tauri/tauri.conf.json` that blocks inline scripts.

---

## IDE setup

Recommended:

- [VS Code](https://code.visualstudio.com)
- [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

---

## Acknowledgments

The EPUB rendering stack draws on work by:

- [johnfactotum / foliate-js](https://github.com/johnfactotum/foliate-js) and [Foliate](https://github.com/johnfactotum/foliate)
- [readest/readest](https://github.com/readest/readest) — Tauri 2 reference for cross-platform ebook apps
- [koodo-reader/koodo-reader](https://github.com/koodo-reader/koodo-reader) — feature surface reference
- All the maintainers of Tauri 2 and its plugin ecosystem

---

## License

TBD. Intended for an open-source license compatible with the AGPL ecosystem used by similar projects; final decision pending.
