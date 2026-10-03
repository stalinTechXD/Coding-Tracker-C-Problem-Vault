import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function CodeBlock({ code }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="code-block">
      <button className="copy-btn" onClick={copy} type="button">
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <SyntaxHighlighter
        language="cpp"
        style={oneDark}
        customStyle={{ margin: 0, borderRadius: 10, fontSize: 13.5 }}
        showLineNumbers
      >
        {code || '// no code yet'}
      </SyntaxHighlighter>
    </div>
  );
}
