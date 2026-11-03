import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SourceCode from '../components/SourceCode.jsx';
import { getDocumentationCatalog, getModuleSource, getAllSource, bundleFiles, copyText, downloadBundle } from '../services/documentationService.js';
import './CodeDocumentation.css';

export default function CodeDocumentation() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('module') || 'login';
  const [modules, setModules] = useState([]);
  const [moduleData, setModuleData] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingModule, setLoadingModule] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [moduleError, setModuleError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [moduleAttempt, setModuleAttempt] = useState(0);
  const [notification, setNotification] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoadingCatalog(true);
    setCatalogError('');
    getDocumentationCatalog(controller.signal).then((items) => { if (active) setModules(items); })
      .catch((error) => { if (active) setCatalogError(error.response?.data?.message || 'Could not load documentation. Check that the backend is running.'); })
      .finally(() => { if (active) setLoadingCatalog(false); });
    return () => { active = false; controller.abort(); };
  }, [catalogAttempt]);

  useEffect(() => {
    if (!modules.length) return;
    const controller = new AbortController();
    let active = true;
    setLoadingModule(true);
    setModuleData(null);
    setModuleError('');
    getModuleSource(selectedId, controller.signal).then((data) => { if (active) setModuleData(data); })
      .catch((error) => { if (active) setModuleError(error.response?.data?.message || 'Could not read this module. Please retry.'); })
      .finally(() => { if (active) setLoadingModule(false); });
    return () => { active = false; controller.abort(); };
  }, [modules, selectedId, moduleAttempt]);

  const selectedModule = modules.find((module) => module.id === selectedId);
  const current = moduleData?.id === selectedId ? moduleData : null;
  const moduleFiles = current ? [...current.frontend, ...current.backend] : [];

  function chooseModule(id) {
    setModuleData(null);
    setLoadingModule(true);
    setNotification(null);
    setParams({ module: id });
    window.scrollTo({ top: 0, behavior: 'auto' });
    // Also allow reloading the currently selected module.
    if (id === selectedId) setModuleAttempt((value) => value + 1);
  }

  async function copy(text, label) {
    try { await copyText(text); setNotification({ type: 'success', message: `${label} copied to clipboard.` }); }
    catch (error) { setNotification({ type: 'error', message: error.message }); }
  }

  async function copyAll() {
    setExporting(true);
    try { await copy(bundleFiles(await getAllSource(), 'Todo application — all source files'), 'All project files'); }
    catch { setNotification({ type: 'error', message: 'Could not export the source files. Please retry.' }); }
    finally { setExporting(false); }
  }

  function downloadModule() {
    downloadBundle(bundleFiles(moduleFiles, `${selectedModule.title} — frontend and backend`), `${selectedId}-source.txt`);
    setNotification({ type: 'success', message: `${selectedModule.title} code downloaded.` });
  }

  return (
    <main className="docs-page docs-simple">
      <header className="docs-topbar">
        <Link className="docs-brand" to="/code-documentation"><span aria-hidden="true">{'</>'}</span><div>Code Documentation</div></Link>
        <div className="docs-top-actions"><Link to="/dashboard">Back to app</Link><button className="docs-button" disabled={exporting || !modules.length} onClick={copyAll}>{exporting ? 'Preparing…' : 'Copy entire project'}</button></div>
      </header>
      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label="Choose a module">
          <div className="docs-sidebar-heading">CHOOSE A PAGE OR MODULE</div>
          {loadingCatalog ? <p className="docs-sidebar-message" role="status">Loading modules…</p>
            : catalogError ? <div className="docs-sidebar-message"><p role="alert">{catalogError}</p><button className="docs-button" onClick={() => setCatalogAttempt((value) => value + 1)}>Retry</button></div>
            : <nav>{modules.map((module) => <button key={module.id} className={`docs-module-button ${selectedId === module.id ? 'is-active' : ''}`}
              aria-current={selectedId === module.id ? 'page' : undefined} onClick={() => chooseModule(module.id)}>{module.title}</button>)}</nav>}
        </aside>
        <section className="docs-workspace" aria-labelledby="docs-title">
          <div className="docs-module-heading"><div><h1 id="docs-title">{selectedModule ? `${selectedModule.title} Code` : 'Code Documentation'}</h1><p>All frontend and backend files together. Select a module and copy its code.</p></div>
            <div className="docs-module-actions"><button className="docs-button docs-button-primary" disabled={!current || loadingModule} onClick={() => copy(bundleFiles(moduleFiles, `${selectedModule.title} — frontend and backend`), `${selectedModule.title} frontend and backend code`)}>Copy {selectedModule?.title || 'module'} Code (FE + BE)</button><button className="docs-button" disabled={!current || loadingModule} onClick={downloadModule}>Download code</button></div>
          </div>
          {notification && <div className={`docs-notification docs-notification-${notification.type}`} role={notification.type === 'error' ? 'alert' : 'status'}><span>{notification.message}</span><button onClick={() => setNotification(null)} aria-label="Dismiss notification">×</button></div>}
          {selectedModule?.notes && <p className="docs-module-note">{selectedModule.notes}</p>}
          <div className="docs-section-links"><a href="#frontend-code">Frontend code ↓</a><a href="#backend-code">Backend code ↓</a><button className="docs-button docs-button-small" disabled={loadingModule} onClick={() => setModuleAttempt((value) => value + 1)}>Reload source</button></div>
          {loadingModule ? <div className="docs-editor-loading" role="status">Loading frontend and backend code…</div>
            : moduleError ? <div className="docs-empty"><p role="alert">{moduleError}</p><button className="docs-button" onClick={() => setModuleAttempt((value) => value + 1)}>Retry</button></div>
            : current && ['frontend', 'backend'].map((side) => (
              <section key={side} id={`${side}-code`} className="docs-source-section" aria-labelledby={`${side}-heading`}>
                <div className="docs-section-heading"><h2 id={`${side}-heading`}>{side === 'frontend' ? 'Frontend — React' : 'Backend — Node.js / Express'}</h2><button className="docs-button" disabled={!current[side].length} onClick={() => copy(bundleFiles(current[side], `${selectedModule.title} — ${side}`), `${side === 'frontend' ? 'Frontend' : 'Backend'} files`)}>Copy {side === 'frontend' ? 'Frontend' : 'Backend'} Code</button></div>
                {!current[side].length && <p className="docs-empty">No {side} files are used by this module.</p>}
                {current[side].map((file) => (
                  <article className="docs-editor docs-file-card" key={file.path} aria-label={file.path}>
                    <div className="docs-editor-heading"><div><strong>{file.name}</strong><span>{file.path}</span></div><div className="docs-editor-actions"><button onClick={() => copy(file.path, 'File path')}>Copy File Path</button><button className="docs-copy-code" disabled={file.status !== 'available'} onClick={() => copy(file.code, file.name)}>Copy Code</button></div></div>
                    {file.redacted && <p className="docs-redacted">Sensitive values were redacted.</p>}
                    <SourceCode file={file} wrap={false} />
                    <div className="docs-editor-footer"><span>{file.language}</span><span>{file.status === 'available' ? `${file.code.split('\n').length} lines · complete file` : file.status}</span></div>
                  </article>
                ))}
              </section>
            ))}
        </section>
      </div>
    </main>
  );
}
