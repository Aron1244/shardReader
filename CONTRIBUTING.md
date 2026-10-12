# Contributing to shardReader

Thanks for your interest in contributing. This document explains how to set up a development environment, propose changes, and submit issues.

## Code of conduct

Be respectful. Disagree on technical grounds, not personal ones. Assume good faith.

## License

By contributing, you agree that your contributions will be licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0), the same license that covers the project. See `LICENSE` for the full text.

If you add new source files, include the standard AGPL-3.0 header at the top:

```
// Copyright (C) <year> <your name>
//
// This file is part of shardReader.
//
// shardReader is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
```

## Development setup

### Requirements

- **Node.js** 22+ (tested with 24)
- **pnpm** 11+
- **Rust** stable (1.77+) with the Tauri 2 prerequisites for your platform:
  - **Windows**: Visual Studio C++ Build Tools, WebView2 runtime
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `webkit2gtk-4.1`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`

### First run

```bash
git clone <your-fork>
cd shardReader
pnpm install
pnpm tauri:dev
```

The first `pnpm tauri:dev` builds the Rust dependencies, which can take several minutes. Subsequent runs are fast.

## Project structure

```
shardReader/
├── src/                    Frontend (React + TypeScript)
│   ├── app/                Routing and providers
│   ├── components/         UI primitives (shadcn/ui)
│   ├── features/           Domain features (library, reader, settings)
│   ├── i18n/               Translations
│   └── lib/                Shared utilities
├── src-tauri/              Rust shell (commands, plugins)
├── tests/                  Vitest unit tests
├── docs/                   Additional documentation
└── STATUS.md               Internal development log
```

See `STATUS.md` for the current state of the project and what's being worked on.

## Available scripts

| Command | Description |
|---|---|
| `pnpm dev` | Vite dev server (renderer only) |
| `pnpm build` | Type-check and produce a production bundle |
| `pnpm preview` | Preview the production bundle |
| `pnpm tauri:dev` | Run the desktop app with hot reload |
| `pnpm tauri:build` | Build platform-specific installers |
| `pnpm test` | Run the test suite once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | TypeScript check, no emit |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint with autofix |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check |

## Coding conventions

### TypeScript / React

- **Components**: functional, with hooks. Prefer small, focused components.
- **State**: Zustand stores for shared state. `useState` for local component state.
- **Styling**: Tailwind CSS 4 utility classes. Use the design tokens from `src/index.css`.
- **i18n**: All user-facing strings go through `react-i18next`. Add keys to both `en.json` and `es.json`.
- **Naming**: PascalCase for components, camelCase for variables and functions.
- **Files**: Match the default export name, e.g. `BookCard.tsx` exports `BookCard`.

### Rust

- **Edition**: 2021.
- **Error handling**: return `Result<T, String>`. Use descriptive error messages.
- **Tauri commands**: each `#[tauri::command]` must be added to `generate_handler!` in `src-tauri/src/lib.rs`.
- **Permissions**: capabilities are declared in `src-tauri/capabilities/default.json`. Plugin commands need their `allow-X` permissions.

### Formatting

- **TypeScript / JSON / Markdown**: Prettier with the project config. Run `pnpm format` before committing.
- **Rust**: `cargo fmt` is recommended. The CI should run this on PRs.

## Adding a new EPUB feature

If you're working on the library or reader:

1. Frontend logic goes under `src/features/<feature>/`.
2. Rust commands that the frontend calls go in `src-tauri/src/lib.rs`.
3. Add a custom command in `src-tauri/src/lib.rs` and register it in `generate_handler!`.
4. Custom commands are accessible from the frontend by default. Plugin commands need their `allow-X` permission in `src-tauri/capabilities/default.json`.
5. Persist data via the JSON index in `<appDataDir>/library/index.json` (current) or SQLite (planned).

## Adding a new UI component

1. Use `pnpm dlx shadcn@latest add <name>` to pull from shadcn/ui.
2. If the component doesn't exist in shadcn, write it in `src/components/ui/`.
3. Compose the new component into features, don't put feature logic in `src/components/`.

## Translations

- English is the source of truth (`src/i18n/locales/en.json`).
- Add the same keys to `es.json`. Both files must have the same shape; typecheck will catch divergences.
- Use `useTranslation()` to read strings; never hardcode user-facing text.
- For long strings with interpolation, use named placeholders: `"{{count}} pages left"`.

## Tests

- Unit tests live in `tests/` (and `*.test.ts(x)` co-located with source where appropriate).
- Use **Vitest** with **Testing Library** for React component tests.
- Test user-facing behavior, not implementation details.
- A new feature should ship with at least one test covering the happy path.

## Commit messages

Use a short imperative subject line. Add a body explaining the **why**, not the what.

```
feat(library): extract book covers during import

Store cover image in <appDataDir>/library/covers/<id>.<ext> and
expose a `get_book_cover` command so the UI can render it lazily
without re-reading the EPUB.
```

Prefixes we use:
- `feat:` — new user-facing feature
- `fix:` — bug fix
- `chore:` — internal change with no user impact
- `docs:` — documentation only
- `refactor:` — code change with no behavior change
- `test:` — adding or fixing tests

## Pull requests

1. Create a branch from `main` with a descriptive name (`feat/cover-extraction`, `fix/db-hang`, etc.).
2. Make focused commits. One PR per concern.
3. Before opening the PR, run:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```
4. In the PR description, explain:
   - What the change does
   - Why it's needed
   - How you tested it (screenshots for UI changes)
5. If your PR changes user-facing behavior, mention it in the description and ideally add a screenshot.

## Reporting bugs

Open a GitHub issue with:
- shardReader version
- Operating system and version
- Steps to reproduce
- Expected vs actual behavior
- If applicable: sample EPUB file (or a description of its size/format) and the relevant log output

## Security

If you find a security issue, **do not open a public issue**. Email the maintainers directly (link in the GitHub profile or repo description) with details.

## Questions?

Open a GitHub Discussion or reach out via the project's communication channels.
