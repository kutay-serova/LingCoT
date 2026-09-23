# dev/tests/vendor

Third-party code used by the guards only. Nothing here ships with the app.

| file | package | version | licence |
|---|---|---|---|
| `acorn.js` | acorn (`dist/acorn.js`) | 8.18.0 | MIT, `LICENSE-acorn` |
| `walk.js` | acorn-walk (`dist/walk.js`) | 8.3.5 | MIT, `LICENSE-acorn-walk` |

Used by `i18n_literal_test.js` to parse the inline script and the modules.
Copied unmodified from npm so the suite runs without `npm install`.
