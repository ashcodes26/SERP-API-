# Local project size cleanup

The workspace measured 961.6 MiB before cleanup and 656.5 MiB afterward. Removed 431 disposable cache/build directories, freeing approximately 305.1 MiB (31.7%). Git-tracked project files total approximately 3.0 MiB; installed dependencies account for most local disk usage and are already excluded from Git.

Removed:

- Isolated browser-test profiles: `mobile/.market-browser` and `mobile/.preview-chrome` (approximately 230 MiB combined).
- Generated web build: `mobile/dist`.
- Private QA screenshots, synthetic downloads and exports: `docs/.workspace-downloads`.
- Pytest caches.
- Generated `__pycache__` folders throughout backend code and its virtual environment, including approximately 69.7 MiB of installed-package bytecode. Python regenerates bytecode as needed; package source and compiled extensions remain intact.

Preserved application source, tests, documentation, checked-in assets/screenshots, Git history, credentials in ignored `.env` files, SQLite data, dependency manifests/lockfile and installed frontend/backend packages. Active Expo metadata was retained. No dependencies or feature code were removed. No setup changes are required. Cache regeneration during development can increase local size again.

Verification: 95 backend tests passed with `APP_ENV=test` before cache removal. After removal, fresh imports of FastAPI, SQLAlchemy, pandas, openpyxl and the backend application passed, and the running backend health endpoint returned HTTP 200. The frontend development server was restarted after a slow cache rebuild; the website returned HTTP 200 afterward. No tracked project file was removed; this report is the only source-tree addition.

Remaining size is chiefly `mobile/node_modules` (532.4 MiB) and `backend/.venv` (113.9 MiB after bytecode cleanup). A source-only copy can omit those directories and require installation from `mobile/package-lock.json` and `backend/requirements.txt` before running. Recommend using GitHub or a source-only archive when sharing the project, rather than copying the installed dependency folders.
