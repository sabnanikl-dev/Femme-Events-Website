# Local Development Notes

## Sanity CORS origins

The Femme Events site fetches public content from Sanity in local development and local build previews. The Sanity project CORS allowlist should include the local origins used by Vite:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:4173`
- `http://127.0.0.1:4173`

These should be added without credentials unless a future authenticated Studio/API workflow requires otherwise.

Useful commands from the `studio/` directory:

```bash
npx sanity cors list
npx sanity cors add http://127.0.0.1:4173 --no-credentials
```

Avoid wildcard CORS origins for this project.
