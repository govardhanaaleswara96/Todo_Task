# Todo application — Google authentication

This continues the existing React/Vite and Express/Mongoose project. Google is the only sign-in method. Login and Signup both use Google Identity Services and the same account-creation/sign-in endpoint. There are no email/password endpoints. The dashboard now uses protected backend Todo CRUD APIs with persistent MongoDB data.

## Requirements and installation

Use Node.js 22.12+ with npm and a running MongoDB Community or Atlas database. The development machine currently has Node 18, which produces engine warnings; upgrade for supported use.

From `todo-app`:

```sh
cd backend
npm install
cd ../frontend
npm install
```

The project already exists; do not scaffold it again. Both lockfiles are provided, so `npm ci` can be used for repeat installs.

## Environment configuration

Local `.env` files already exist and are ignored by Git. A random JWT secret was generated in `backend/.env`; do not replace it with a public example. The Google client ID you supplied is configured in both local `.env` files. The shareable templates leave it blank.

Backend `.env`:

```dotenv
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/todo_app
FRONTEND_URL=http://localhost:5174
JWT_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Frontend `.env`:

```dotenv
VITE_API_URL=http://localhost:5001/api
VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Use the **same client ID** in both files. It is a public identifier. A client secret is not needed for the GIS ID-token callback flow and must never go into the frontend. To generate a new application JWT secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy its output into JWT_SECRET privately. Restart both servers after changing `.env`. Changing JWT_SECRET invalidates existing sessions.

The `.env.example` files are shareable templates. If local `.env` files are missing, copy the templates and fill them in; do not overwrite an existing configured `.env`.

Port 5001 avoids macOS Control Center on port 5000. Port 5174 avoids another project already using 5173 on this machine.

## Google Cloud Console setup

1. Open https://console.cloud.google.com/ and create or select a project.
2. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen** in the older interface).
3. Configure Branding, including the app name, support email, and developer contact.
4. Configure Audience: choose the appropriate audience. If External and in Testing, add your Google account under Test users. Internal is limited to your Workspace organization.
5. Open **Clients → Create client** (or **Credentials → Create credentials → OAuth client ID**).
6. Choose **Web application**.
7. Add these Authorized JavaScript origins, without a trailing path:
   - `http://localhost`
   - `http://localhost:5174`
8. Create the client and copy the client ID into both `.env` files shown above.
9. Restart both development servers, open `http://localhost:5174/login`, and click the official Google button.

This implementation uses the Google Identity Services popup/JavaScript credential callback, so no backend redirect URI is required. The application redirect to `/dashboard` happens in React after its own backend completes sign-in. No Google Drive, Calendar, or other API scopes are requested.

Use `localhost` for both frontend and backend. Do not mix it with `127.0.0.1`: browser cookie sites and Google authorized origins differ. To intentionally use an IP or another hostname, change both app URLs, FRONTEND_URL, and the Google authorized origin consistently.

Official references:

- [Google client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Google server-side ID-token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Google Identity Services JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)

## MongoDB

For local MongoDB, start your existing MongoDB service and use the default URI. If no service is running but `mongod` is installed, run this in a separate terminal:

```sh
mkdir -p /tmp/todo-mongodb
mongod --dbpath /tmp/todo-mongodb --bind_ip 127.0.0.1 --port 27017
```

Do not run a second instance if port 27017 is already in use by MongoDB. The local instance on this machine was already running during implementation.

For Atlas, create a cluster, database user, and current-IP network access rule. Set MONGODB_URI to the Atlas Drivers connection string with database name `todo_app`, for example:

```dotenv
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/todo_app?retryWrites=true&w=majority
```

Keep credentials private and URL-encode special characters in the database password.

## Run

Terminal 1, from `todo-app`:

```sh
cd backend
npm run dev
```

Expect `MongoDB connected` and `Backend running at http://localhost:5001`. `npm start` runs without file watching. The server requires a valid JWT_SECRET and database connection. With a blank GOOGLE_CLIENT_ID, it starts but Google sign-in returns a configuration error until the ID is set.

Terminal 2:

```sh
cd frontend
npm run dev
```

Open http://localhost:5174/signup or http://localhost:5174/login. If the earlier frontend is already running on 5174, use that terminal rather than starting a second server; stop it with Ctrl+C and restart it after updating environment variables.

Routes:

| Page | Purpose |
| --- | --- |
| `/login` | Google sign-in |
| `/signup` | Google signup, using the same sign-in flow |
| `/dashboard` | Loads your verified profile, statistics, and your saved Todo table; redirects to Login for an invalid session |
| `/health` | Original React/Express/MongoDB connectivity check |

## API and session behavior

| Endpoint | Request | Result |
| --- | --- | --- |
| POST `/api/auth/google` | JSON `{ "credential": "GOOGLE_ID_TOKEN" }` | Verifies Google ID token, finds/creates a user, sets JWT cookie, returns public user |
| GET `/api/auth/profile` | App session cookie | Returns current public user; 401 if missing/invalid/expired |
| POST `/api/auth/logout` | JSON `{}` and session cookie | Clears session cookie |
| GET `/api/health` | None | Backend/database connectivity |

The backend uses Google's official `google-auth-library` `verifyIdToken` with the configured client ID as audience. It validates the signature, issuer, and expiration. The controller also requires a subject and verified email. Browser-supplied names, email addresses, Google IDs, or roles are never accepted as identity.

The stable Google subject (`sub`) identifies repeat sign-ins. If no subject match exists, the backend checks verified email. A legacy account can be linked automatically only when Google is authoritative for that email (Gmail or Google Workspace). A conflicting Google ID or an existing third-party email is rejected rather than silently merging accounts. A new third-party-email Google user can still be created and subsequently found by their Google subject. Unique indexes prevent duplicate email or Google ID records.

The User model contains name, email, optional password, optional googleId, and createdAt. Existing password values are neither changed nor returned. No password authentication is implemented. Responses explicitly select public fields: id, name, email, and createdAt.

The application's HS256 JWT lasts one hour. It is stored only in an **HttpOnly cookie**, scoped to `/api`, with SameSite=Lax and Secure in production. Axios uses `withCredentials: true`. Tokens are never returned in response JSON or put in localStorage/sessionStorage. Auth responses use Cache-Control: no-store. Browser mutations require JSON and reject unapproved Origin headers; credentialed CORS allows only configured frontend origins.

Use HTTPS in production with NODE_ENV=production and same-site frontend/backend domains. This cookie configuration deliberately targets same-site hosting; unrelated frontend/backend domains need a separate cross-site cookie/CSRF deployment design. Keep the JWT secret private. Logout removes the browser cookie; an already copied JWT remains valid until expiry (there is no revocation database).

For future Todo authorization, reuse `requireAuth` and filter records by `req.user._id`. Authentication does not grant every user access to everyone else's data. Google API authorization (such as Drive access) is a separate future flow; this app stores no Google access/refresh tokens.

## Validation and tests

```sh
cd frontend
npm run build
cd ../backend
npm test
```

Backend integration tests need local MongoDB (or TEST_MONGODB_URI). Each run creates and removes only its own uniquely named test database. Tests use mocked Google verifier responses and real MongoDB; they do not pretend to perform live Google sign-in. Covered cases include first/repeat sign-in, verified-email linking, conflicts, unverified/invalid credentials, cookie flags, protected profiles, expired/tampered/wrong-audience JWTs, logout, JSON errors, and rejected origins. Live Google consent requires your configured client ID and a real browser account.

Manual checks after configuration:

1. Open `/dashboard` in a private browser window: expect a redirect to `/login`.
2. Sign in with a test Google account: expect `/dashboard`, your name, and verified email.
3. Refresh `/dashboard`: the session cookie restores your profile.
4. Log out: expect `/login`; revisit `/dashboard` to confirm access is denied.
5. Use Signup with the same Google account: expect the same MongoDB user record.
6. In browser DevTools → Network, verify `/api/auth/google` sets an HttpOnly cookie; its JSON response contains no JWT or password. Application storage should have no app token in localStorage/sessionStorage.
7. Submit an invalid credential via the API: expect an error, never a signed-in session.

## File guide

| File | Purpose |
| --- | --- |
| `backend/server.js` | Loads environment, validates auth configuration, connects DB, creates indexes, starts API |
| `backend/app.js` | CORS, JSON/Origin checks, cookie parsing, routes, error handling |
| `backend/config/db.js` | Mongoose connection |
| `backend/config/auth.js` | Cookie, expiry, and JWT configuration |
| `backend/models/User.js` | User schema and unique indexes; suppresses private fields |
| `backend/services/googleService.js` | Official Google ID-token verification |
| `backend/controllers/authController.js` | Account matching/creation, app JWT cookie, profile and logout |
| `backend/middleware/authMiddleware.js` | JWT verification and current-user lookup |
| `backend/routes/authRoutes.js` | Authentication endpoint routing |
| `backend/controllers/healthController.js` | Existing connectivity response |
| `backend/routes/healthRoutes.js` | Existing health route |
| `backend/tests/auth.test.js` | Real MongoDB integration tests with mocked Google verification |
| `frontend/src/components/GoogleSignIn.jsx` | Loads GIS and renders the official Google button |
| `frontend/src/components/AuthForm.jsx` | Google-only login/signup layout, loading and error handling |
| `frontend/src/pages/Login.jsx`, `Signup.jsx` | Select the Google login/signup presentation |
| `frontend/src/pages/Dashboard.jsx` | Fetches protected profile and supports logout |
| `frontend/src/pages/Home.jsx` | Original health page |
| `frontend/src/components/ConnectionStatus.jsx` | Original health display |
| `frontend/src/services/api.js` | Shared Axios instance with credentialed requests |
| `frontend/src/services/authService.js` | Google sign-in, profile and logout requests |
| `frontend/src/App.jsx` | React Router routes |
| `frontend/src/main.jsx` | React entry point |
| `frontend/src/App.css` | Shared responsive styles |
| `frontend/vite.config.js` | Frontend port and Google popup-compatible headers |
| `frontend/index.html` | HTML entry point and page metadata |
| Each `.env.example` | Shareable environment template |
| Each `package.json` / `package-lock.json` | Dependencies, commands, and exact installed versions |

`FormField.jsx` and `authValidation.js` from the previous UI phase are retained but are unused by Google-only login. They do not expose email/password login. Complete new and modified application source is collected in [GOOGLE_AUTH_CODE.md](GOOGLE_AUTH_CODE.md).

## Troubleshooting

- **Google button missing/configuration notice:** Fill both client IDs and restart both servers. The app does not use a fake Google button or invented credentials.
- **origin_mismatch / client not found:** Use a Web application client with the exact frontend scheme/hostname/port in Authorized JavaScript origins. Match the two configured client IDs.
- **Access blocked:** Check the Google app audience/test-user settings and allow popups. Browser extensions or network filters may block the Google script.
- **Google succeeds then returns to Login:** Use `localhost` consistently for both servers, check Axios API URL and FRONTEND_URL, and verify the cookie was accepted. Production Secure cookies require HTTPS.
- **Cannot reach backend:** Port 5001 must be running; port 5000 belongs to another system service here.
- **Blank/wrong app on 5173:** Another project owns that port. Use this app on 5174.
- **MongoDB/index startup error:** Verify the URI and database access. Pre-existing duplicate emails or googleIds must be reviewed before unique indexes can be created; startup does not silently delete accounts.
- **Node engine warnings:** Upgrade to Node.js 22.12+.


## Dashboard connected to MongoDB

Sign in at http://localhost:5174/login, then open `/dashboard`. Google authentication and the existing HttpOnly session cookie are unchanged. The dashboard loads the verified profile and fetches the signed-in user's Todos using the shared credentialed Axios client.

- Total, Completed, and Pending cards derive from the loaded records.
- **Add Todo** posts title, description, and status to `/api/todos`. The new server record appears after a successful response.
- **Edit** puts changes to `/api/todos/:id` and uses the updated server record in the table.
- The row **Status** dropdown puts Pending/Completed changes to the same endpoint.
- **Delete** asks for confirmation, then calls DELETE and removes the row only after the server succeeds.
- **Refresh** fetches the current list. Saved changes also survive a full browser reload.
- Loading indicators cover profile/list loading, saving, deleting, and status updates. Duplicate submissions and overlapping mutations are disabled.
- Success and error notifications can be dismissed. A failed save keeps the modal and entered values open. Failed status/delete requests keep the existing record and counts.
- A list failure shows a retry action rather than pretending the list is empty. A successful empty list shows the first-Todo prompt. Initial counts show a dash while data is loading/unavailable.
- An API 401 redirects to Google Login. Logout still calls the existing backend.
- The layout remains responsive with a horizontally scrollable table and a viewport-sized modal.

There are no sample tasks, sample reset controls, localStorage records, or frontend-generated IDs. New accounts start empty. MongoDB provides each task's _id and timestamps. Statistics update from the list after confirmed API responses.

No new dependencies or environment variables are required. Run `npm run dev` in `backend` and `frontend` using the existing configuration. Use localhost consistently (frontend 5174, backend 5001) so the session cookie works.

Frontend additions/changes: `src/services/todoService.js`, `src/pages/Dashboard.jsx`, `src/components/TodoTable.jsx`, `src/components/TodoModal.jsx`, `src/components/TaskStats.jsx`, and `src/App.css`. Removed `src/data/sampleTodos.js`. Authentication and backend runtime code were not modified for this integration.

Manual verification:

1. Sign in with Google and open Dashboard. New accounts should have zero statistics and an empty list.
2. Add a Pending Todo. Expect its MongoDB ID/date in the table and Total/Pending counts to increase.
3. Edit its title and description, then change Status to Completed. Expect updated values and Completed/Pending counts.
4. Refresh the browser and verify persistence.
5. Cancel a deletion to keep the row, then confirm deletion and verify counts/empty state.
6. Stop the backend and try Refresh: expect an error with Retry. Restart it and retry.
7. Stop the backend while a modal is open and submit: expect an error with entered values preserved.
8. Sign out and verify Dashboard redirects to Login. Another account must only see its own records.

Build: `npm run build` in `frontend`. Backend regression checks: `npm test` in `backend` (local MongoDB required). Browser integration QA used a uniquely named temporary database, real Express/Mongoose APIs, real session JWTs, and isolated Chrome. It did not access real users' data or automate Google consent.

Complete current frontend source is in [TODO_FRONTEND_CODE.md](TODO_FRONTEND_CODE.md).

## Backend Todo CRUD

No new dependencies or environment variables are required. The existing Google sign-in sets the HttpOnly `todo_session` JWT cookie, and every Todo route reuses the unchanged `requireAuth` middleware.

| Method | Endpoint | Success |
| --- | --- | --- |
| POST | `/api/todos` | 201 `{ success: true, todo }` plus Location header |
| GET | `/api/todos` | 200 `{ success: true, todos: [...] }`, newest first |
| GET | `/api/todos/:id` | 200 `{ success: true, todo }` |
| PUT | `/api/todos/:id` | 200 `{ success: true, todo }` |
| DELETE | `/api/todos/:id` | 204, no response body |

Create request:

```json
{ "title": "Plan the week", "description": "Pick three priorities", "status": "Pending" }
```

Update request (one or more fields; omitted fields remain unchanged):

```json
{ "status": "Completed" }
```

Validation:

- Title is required on creation and cannot be cleared on update. It must be a nonblank string of at most 120 characters after trimming.
- Description is optional, defaults to an empty string, and must be a string of at most 1000 characters after trimming. Send an empty string to clear it.
- Status is exactly `Pending` or `Completed`; creation defaults to `Pending`.
- Only title, description, and status are accepted. userId, _id, timestamps, unknown fields, and MongoDB operators are rejected.
- PUT accepts at least one field. Empty updates, nulls, arrays, and invalid field types return 400.
- IDs must be 24-character hexadecimal ObjectIds. Malformed IDs return 400.
- A missing or invalid JWT returns 401. A missing Todo or another user's Todo returns the same 404 response.
- Invalid JSON returns 400; oversized requests return 413; POST/PUT require application/json (415 otherwise); unapproved browser origins return 403; unexpected database failures return a generic 500 without internals.

Mongoose manages createdAt and updatedAt automatically. Responses include _id, userId, title, description, status, createdAt, and updatedAt. The userId is always taken from the authenticated database user, never from request data. Read, update, and delete operations filter by both Todo ID and userId, including atomic updates/deletions.

After signing in through the browser, you can manually exercise the existing credentialed Axios client from frontend code:

```javascript
import api from './services/api.js';

const created = await api.post('/todos', { title: 'My first task' });
const id = created.data.todo._id;
const list = await api.get('/todos');
const item = await api.get(`/todos/${id}`);
await api.put(`/todos/${id}`, { status: 'Completed' });
await api.delete(`/todos/${id}`); // No body needed; HTTP 204 has no JSON result.
```

The shared app middleware now permits bodyless DELETE requests only under `/api/todos/`. Origin checks still apply, and DELETE is a non-simple browser method subject to CORS preflight. Authentication endpoints retain their existing JSON behavior.

Run the existing backend with `npm run dev` and tests with `npm test` from `backend`. The test command runs both the unchanged Google-auth integration suite and the new Todo suite against uniquely named temporary databases, never the app database. Todo tests use real MongoDB, real signed JWTs, and two users to exercise ownership isolation. The dashboard now calls these endpoints through the shared Axios client.

New files: `backend/models/Todo.js`, `backend/middleware/todoValidation.js`, `backend/controllers/todoController.js`, `backend/routes/todoRoutes.js`, and `backend/tests/todos.test.js`. The only existing runtime file modified is `backend/app.js` to mount the router and permit bodyless Todo DELETE. Authentication models, controllers, routes, and JWT middleware are unchanged.

Full source for every new or modified backend file is in [TODO_BACKEND_CODE.md](TODO_BACKEND_CODE.md).


## Code Documentation and source bundle generator

Open **http://localhost:5174/code-documentation**. This additional page is public, with no login or developer/admin allowlist, as requested. Existing Google Login, Signup, Dashboard, and Todo CRUD implementations are unchanged.

The explorer contains all 13 requested modules: Project Setup, Signup, Login, Google OAuth, Authentication Middleware, Dashboard, Todo List, Add Todo, Edit Todo, Delete Todo, MongoDB Models, API Routes, and Environment Configuration.

Choose Login, Signup, Dashboard, or any module. All of its complete Frontend and Backend files appear together on one page, with no tabs or file-selection step. Login is selected by default. Every file has syntax highlighting, its path, and a copy button. Module links are shareable, for example `/code-documentation?module=login`. On mobile, module buttons form a horizontally scrollable list.

Copy and generate controls:

- **Copy Code:** exact displayed file content, without line numbers or editor markup.
- **Copy File Path:** the project-relative path.
- **Copy Frontend Code / Copy Backend Code:** all files in that section.
- **Copy Login Code (FE + BE)** (or the selected module name): the complete frontend and backend code together.
- **Copy entire project:** every allowlisted project source file, deduplicated across modules.
- **Download code:** downloads the selected module as a `.txt` file containing paths and complete code. It packages actual source; it does not invent a new implementation.

Shared files are intentionally referenced by several modules. A full-project copy includes each path once. Module bundles are reference/share bundles, not separate alternative applications. Use Copy All Files when another developer needs the complete project dependency structure.

Code is read from the running backend's project checkout, not from static Markdown snapshots or duplicate snippets. A new file must be registered in `backend/config/documentation.js` to appear in the catalog. Reload source or reselect the module after editing. Node dependencies remain external npm dependencies; the setup module includes package manifests and lockfiles.

Only explicit file paths in the catalog can be served. Real `.env`, `.env.local`, private keys, node_modules, database contents, and arbitrary filesystem paths are not exposed. The Environment Configuration module serves actual `.env.example` templates only. Known configured secret strings and MongoDB credential URLs are redacted before display/copy, and authentication/source responses are not cached. A missing file is labeled missing; unreadable or blocked files have no substitute code. Copying a multi-file bundle keeps an explicit marker for such files.

The active app uses shared `AuthForm.jsx`, `GoogleSignIn.jsx`, and `App.css`. There are no invented Signup.css, Login.css, Dashboard.css, dashboardService.js, or ProtectedRoute.jsx files; module notes explain the actual shared structure. Backend models correctly have no frontend counterparts.

Documentation APIs (no authentication required):

| Endpoint | Purpose |
| --- | --- |
| GET `/api/docs` | Module/file metadata |
| GET `/api/docs/modules/:moduleId` | Complete allowed source for a known module |
| GET `/api/docs/export` | All allowed source files, deduplicated |

Unknown module IDs return 404. No API accepts an arbitrary file path. Source file reads reject symlinks and out-of-project locations and are limited to 1 MB per file.

Frontend dependency: `highlight.js`, installed in the existing frontend package. No backend dependencies or environment settings were added. For a fresh checkout, run the existing `npm install` commands in both folders, then `npm run dev` for both. The backend must have the repository's frontend and backend source folders available at their existing relative paths; a frontend-only static host cannot supply backend code.

New implementation files:

- `frontend/src/pages/CodeDocumentation.jsx` and `CodeDocumentation.css`: documentation explorer and scoped UI styling.
- `frontend/src/components/SourceCode.jsx`: syntax-highlighted, escaped code view.
- `frontend/src/services/documentationService.js`: Axios requests, clipboard fallback, source bundling, and download.
- `backend/config/documentation.js`: actual module-to-file catalog and source allowlist.
- `backend/services/documentationService.js`: safe source reading, redaction, and export.
- `backend/controllers/documentationController.js` and `routes/documentationRoutes.js`: source API endpoints.
- `backend/tests/documentation.test.js`: source integrity, file coverage, missing paths, redaction, and traversal/symlink tests.

Existing files changed: frontend `src/App.jsx` for the additional route, frontend package manifest/lockfile for syntax highlighting, and backend `app.js` for the documentation router. Existing application page/components and authentication/CRUD services were not modified.

Validation: `npm run build` in frontend and `npm test` in backend. Documentation tests run without accessing user data. The existing authentication/Todo tests continue using their own temporary databases.
