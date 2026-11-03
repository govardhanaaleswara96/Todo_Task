// Explicit source allowlist. No filesystem path is accepted from the browser.
const frontendAuth = [
  'frontend/src/components/AuthForm.jsx', 'frontend/src/components/GoogleSignIn.jsx',
  'frontend/src/services/authService.js', 'frontend/src/services/api.js',
  'frontend/src/App.jsx', 'frontend/src/App.css',
];
const backendAuth = [
  'backend/controllers/authController.js', 'backend/routes/authRoutes.js',
  'backend/services/googleService.js', 'backend/models/User.js',
  'backend/config/auth.js', 'backend/middleware/authMiddleware.js',
  'backend/app.js', 'backend/server.js', 'backend/config/db.js',
];
const frontendTodos = [
  'frontend/src/pages/Dashboard.jsx', 'frontend/src/components/TodoTable.jsx',
  'frontend/src/components/TodoModal.jsx', 'frontend/src/components/TaskStats.jsx',
  'frontend/src/services/todoService.js', 'frontend/src/services/authService.js', 'frontend/src/services/api.js', 'frontend/src/App.css',
];
const backendTodos = [
  'backend/controllers/todoController.js', 'backend/routes/todoRoutes.js',
  'backend/models/Todo.js', 'backend/middleware/todoValidation.js',
  'backend/middleware/authMiddleware.js', 'backend/config/auth.js', 'backend/models/User.js', 'backend/config/db.js', 'backend/server.js', 'backend/app.js',
];

export const documentationModules = [
  { id: 'project-setup', title: 'Project Setup', description: 'Dependencies, entry points, styling, health checks, tests, and the documentation feature itself.',
    frontend: ['frontend/package.json', 'frontend/package-lock.json', 'frontend/vite.config.js', 'frontend/index.html', 'frontend/src/main.jsx', 'frontend/src/App.jsx', 'frontend/src/App.css', 'frontend/src/pages/Home.jsx', 'frontend/src/components/ConnectionStatus.jsx', 'frontend/src/components/FormField.jsx', 'frontend/src/services/authValidation.js', 'frontend/src/pages/CodeDocumentation.jsx', 'frontend/src/pages/CodeDocumentation.css', 'frontend/src/components/SourceCode.jsx', 'frontend/src/services/documentationService.js'],
    backend: ['backend/package.json', 'backend/package-lock.json', 'backend/server.js', 'backend/app.js', 'backend/config/db.js', 'backend/controllers/healthController.js', 'backend/routes/healthRoutes.js', 'backend/tests/auth.test.js', 'backend/tests/todos.test.js', 'backend/config/documentation.js', 'backend/services/documentationService.js', 'backend/controllers/documentationController.js', 'backend/routes/documentationRoutes.js', 'backend/tests/documentation.test.js', 'README.md', '.gitignore'],
    notes: 'FormField and authValidation are retained files from the earlier UI phase; the active authentication flow is Google-only.' },
  { id: 'signup', title: 'Signup', description: 'The existing Google-backed signup flow, including shared components and configuration.',
    frontend: ['frontend/src/pages/Signup.jsx', ...frontendAuth], backend: backendAuth,
    notes: 'Signup and Login share AuthForm and GoogleSignIn. Styles live in App.css; there is no separate Signup.css or password registration API.' },
  { id: 'login', title: 'Login', description: 'Google sign-in, session creation, and frontend routing.',
    frontend: ['frontend/src/pages/Login.jsx', ...frontendAuth], backend: backendAuth,
    notes: 'This application uses Google-only login. Styles are shared in App.css; email/password authentication is not implemented.' },
  { id: 'google-oauth', title: 'Google OAuth', description: 'Google Identity Services, official backend token verification, and the application session cookie.',
    frontend: ['frontend/src/pages/Login.jsx', 'frontend/src/pages/Signup.jsx', ...frontendAuth, 'frontend/.env.example', 'frontend/vite.config.js'],
    backend: [...backendAuth, 'backend/.env.example'], notes: 'Only shareable .env.example files are included. Real .env files and credential values are never served.' },
  { id: 'authentication-middleware', title: 'Authentication Middleware', description: 'JWT verification, current-user lookup, and the frontend session check.',
    frontend: ['frontend/src/pages/Dashboard.jsx', 'frontend/src/services/authService.js', 'frontend/src/services/api.js', 'frontend/src/App.jsx'],
    backend: ['backend/middleware/authMiddleware.js', 'backend/config/auth.js', 'backend/models/User.js', 'backend/routes/authRoutes.js', 'backend/controllers/authController.js'],
    notes: 'The profile check is inside Dashboard.jsx. There is no separate ProtectedRoute component.' },
  { id: 'dashboard', title: 'Dashboard', description: 'Protected workspace, statistics, notifications, and persistent task operations.', frontend: frontendTodos,
    backend: [...backendTodos, 'backend/routes/authRoutes.js', 'backend/controllers/authController.js'],
    notes: 'The actual services are todoService.js and authService.js. Dashboard styling is shared in App.css.',
    extraFrontend: ['frontend/src/services/authService.js'] },
  { id: 'todo-list', title: 'Todo List', description: 'User-owned task retrieval, table rendering, loading, and empty states.', frontend: frontendTodos, backend: backendTodos },
  { id: 'add-todo', title: 'Add Todo', description: 'The existing modal, validation, Axios request, and MongoDB creation.', frontend: frontendTodos, backend: backendTodos },
  { id: 'edit-todo', title: 'Edit Todo', description: 'Editing details and Pending/Completed status using the existing update endpoint.', frontend: frontendTodos, backend: backendTodos },
  { id: 'delete-todo', title: 'Delete Todo', description: 'Confirmation, Axios deletion, and atomic owner-scoped removal.', frontend: frontendTodos, backend: backendTodos },
  { id: 'mongodb-models', title: 'MongoDB Models', description: 'Actual User and Todo schemas, ownership, timestamps, and indexes.',
    frontend: [], backend: ['backend/models/User.js', 'backend/models/Todo.js', 'backend/config/db.js'], notes: 'Mongoose schemas run on the backend. There are no frontend model files.' },
  { id: 'api-routes', title: 'API Routes', description: 'Express route definitions and the Axios clients that call them.',
    frontend: ['frontend/src/services/api.js', 'frontend/src/services/authService.js', 'frontend/src/services/todoService.js', 'frontend/src/services/documentationService.js'],
    backend: ['backend/app.js', 'backend/server.js', 'backend/routes/authRoutes.js', 'backend/routes/todoRoutes.js', 'backend/routes/healthRoutes.js', 'backend/routes/documentationRoutes.js', 'backend/controllers/authController.js', 'backend/controllers/todoController.js', 'backend/controllers/healthController.js', 'backend/controllers/documentationController.js', 'backend/middleware/authMiddleware.js', 'backend/middleware/todoValidation.js'] },
  { id: 'environment-configuration', title: 'Environment Configuration', description: 'Shareable environment templates and the code that reads configuration.',
    frontend: ['frontend/.env.example', 'frontend/vite.config.js', 'frontend/src/services/api.js', 'frontend/src/components/GoogleSignIn.jsx'],
    backend: ['backend/.env.example', 'backend/config/db.js', 'backend/config/auth.js', 'backend/services/googleService.js', 'backend/server.js'],
    notes: 'Local .env files are intentionally excluded. Use your own values in the template placeholders.' },
].map(({ extraFrontend = [], ...module }) => ({
  ...module, frontend: [...new Set([...module.frontend, ...extraFrontend])], backend: [...new Set(module.backend)],
}));

export const allowedSourcePaths = new Set(documentationModules.flatMap((module) => [...module.frontend, ...module.backend]));
