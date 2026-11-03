# Share this Todo application

This package combines the complete frontend and backend source. It excludes real environment files, node_modules, build output, credentials, and Git history. The .env.example files contain only shareable defaults/placeholders. The recipient must configure their own MongoDB URI, Google Web client ID, and randomly generated JWT secret.

## Run after extracting

Use Node.js 22.12+ and a running MongoDB service. From the extracted todo-app directory:

```sh
cd backend
npm ci
cp .env.example .env
# Edit .env with your own configuration and JWT secret.
cd ../frontend
npm ci
cp .env.example .env
# Edit .env with your own Google client ID; match the backend ID.
```

Start npm run dev in backend and frontend in separate terminals. Open http://localhost:5174/login. Documentation: http://localhost:5174/code-documentation. See README.md for Google Console and database setup.

## Gmail

Gmail blocks .js attachments, including .js files inside ZIP archives. A small ZIP may therefore still be rejected. Use a Google Drive link or a Git repository link instead; do not rely on renaming the ZIP to bypass attachment rules.

Official policy: https://support.google.com/mail/answer/6590

## Git alternative

Extract this ZIP into a new folder and work from that clean extracted copy. Do not copy existing .env files into the repository. The included .gitignore excludes local environments, dependencies, builds, private keys, and credential JSON names.

Create an EMPTY repository on GitHub (without generated README/license files), then run from the extracted todo-app folder:

```sh
git init
git add .
git status --short
# Review the staged file list; real .env files and node_modules must not appear.
git commit -m "Initial Todo application source"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace the repository URL. Authenticate using your configured Git credential manager or SSH; never embed an access token in the URL. For a public repository, share its URL with the recipient. No repository was created or uploaded automatically.
