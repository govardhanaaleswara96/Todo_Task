import { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import ini from 'highlight.js/lib/languages/ini';
import markdown from 'highlight.js/lib/languages/markdown';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('markdown', markdown);

export default function SourceCode({ file, wrap }) {
  const highlighted = useMemo(() => {
    if (!file || file.status !== 'available') return '';
    // highlight.js escapes the raw source before producing its markup.
    return hljs.getLanguage(file.language) ? hljs.highlight(file.code, { language: file.language }).value : null;
  }, [file]);

  if (!file) return <div className="docs-empty">No source file is available.</div>;
  if (file.status !== 'available') return (
    <div className="docs-empty"><span className="docs-missing-label">{file.status}</span><h3>{file.name}</h3><p>{file.message}</p></div>
  );
  return (
    <div className={`docs-code-scroll ${wrap ? 'docs-code-wrap' : ''}`} tabIndex={0} role="region" aria-label={`Source code for ${file.path}`}>
      <pre className="docs-line-numbers" aria-hidden="true">{file.code.split('\n').map((line, index) => index + 1).join('\n')}</pre>
      <pre className="docs-code"><code className="hljs">{highlighted === null
        ? file.code
        : <span dangerouslySetInnerHTML={{ __html: highlighted }} />}</code></pre>
    </div>
  );
}
