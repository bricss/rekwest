# Contributing Guidelines

## Development Workflow

1. Create a branch: `git checkout -b feat/my-feature` or `fix/bug-fix-name`
2. Code, add tests, verify:
   ```bash
   npm test                          # run the full suite
   npm run lint                      # ensure zero errors/warnings
   npm run build                     # compile source if applicable
   ```
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) format (see below).
4. Push and open a pull request.

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) spec:

```
<type>(<scope>): <subject>   # subject ≤ 80 chars
                             # blank line
<body>                       # wrap at 80 chars
```

### Allowed Types

| Type       | Description                              |
|------------|------------------------------------------|
| `build`    | Build system or dependency changes       |
| `ci`       | CI pipeline modifications                |
| `chore`    | Housekeeping (tooling, config)           |
| `docs`     | Documentation-only changes               |
| `feat`     | A new feature                            |
| `fix`      | A bug fix                                |
| `perf`     | Performance improvement                  |
| `refactor` | Code change, neither fix nor feature     |
| `style`    | Formatting, whitespace — no logic change |
| `test`     | Adding or correcting tests               |

### Examples

```
feat(api): add new endpoint for user auth
fix(parser): handle malformed input gracefully
docs(readme): update installation instructions
```

## Pull Requests

- Ensure all checks pass locally (`npm test`, `npm run lint`).
- Include tests covering new or changed behavior.
- Describe the motivation behind the change, not just what was done.

## Coding Standards

- **ESLint** (or your linter) enforces style rules — configure it in your IDE for auto-fix on save.
- **EditorConfig**: matches the project's indentation, encoding, and line-ending conventions.
- Follow the existing code style — match patterns already present in the codebase.
- Use descriptive names; avoid one-letter variables except in short loops.

## Reporting Issues

1. Search existing issues to avoid duplicates.
2. Confirm you're on a supported version of the dependency (e.g., Node.js).
3. Include a minimal reproducible snippet, expected vs. actual behavior, and environment details.

---

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/). Be respectful and constructive.
