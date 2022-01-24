Coding Rules
---

Make sure your `IDE` uses [ESLint](https://eslint.org/) rules and applies [EditorConfig](https://editorconfig.org/)
coding styles.

## Commit Guidelines

We have very precise rules over how our git commit messages can be formatted. This leads to **more readable messages**
that are easy to follow when looking through the **project history**.

### Commit Message Format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special format that includes
a **type**, a **scope**, and a **subject**:

```
<type>(<scope>): <subject>
<blank>
<body>
<blank>
<footer>
```

The subject line of the commit message cannot be longer 80 characters. The second line is always blank and other lines
should be wrapped at 80 characters. This allows the message to be easier to read.

The **type** and **scope** *(can be avoided)* should always be lowercase as shown above.

### Type

Please use one of the following:

* **bump**: Manual increment of the application version.
* **chore**: Update to task runner or build scripts, etc.
* **feat**: New feature for the user, not a new feature for build scripts.
* **fix**: Bugs fix for the user, not a fix to a build scripts.
* **doc**: Change to the documentation.
* **perf**: Change that improves code performance.
* **refactor**: Change that neither fixes a bug nor adds a feature.
* **style**: Change that do not affect the meaning of the code (formatting, missing semicolons, white-spaces, etc.).
* **test**: Add new or missing tests, or tests refactoring.

### Scope

The scope could be anything specifying the location of the commit change. For example `view` or `logger`.

### Subject

The subject contains a succinct description of the change:

* Use the imperative, present tense: "change" not "changed" nor "changes".
* Don't capitalize the first letter.
* Do not add a dot (.) at the end.

### Body

The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about breaking changes and is also the place to reference issues that this
commit closes.
