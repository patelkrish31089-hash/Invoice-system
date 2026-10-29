import { useEffect, useState } from "react";
import { authenticatedBlob } from "../../api/client";
import { Icon } from "../Icons";
import { Empty, Spinner } from "../UI";
import { bytes } from "../../utils/format";
import type { DocumentBrief } from "../../api/types";

export function DocumentViewer({ document, height = 620 }: { document: DocumentBrief | null; height?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!document) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setError(null);
    authenticatedBlob(`/documents/${document.uid}/file`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document?.uid]);

  if (!document) return <Empty title="No source document" message="This invoice has no linked document." icon="file" />;
  if (error) return <Empty title="Document unavailable" message={error} icon="alert" />;
  if (!url) return <div className="loading-block"><Spinner large /></div>;

  return (
    <div>
      <div className="viewer-toolbar">
        <Icon name="file" size={13} />
        <span className="truncate" style={{ maxWidth: 260 }}>{document.filename}</span>
        <span className="dot-sep">·</span>
        <span>{bytes(document.size_bytes)}</span>
        <span className="dot-sep">·</span>
        <span>{document.page_count} page{document.page_count === 1 ? "" : "s"}</span>
        <span className="dot-sep">·</span>
        <span className="mono">{document.sha256.slice(0, 12)}…</span>
        <a className="btn sm" style={{ marginLeft: "auto" }} href={url} target="_blank" rel="noreferrer" download={document.filename}>
          <Icon name="download" /> Open
        </a>
      </div>
      {document.content_type === "application/pdf" ? (
        <>
          <iframe className="doc-frame" style={{ height }} src={url} title={`Document ${document.filename}`} />
          <p className="tiny muted" style={{ padding: "8px 2px 0" }}>
            Some browsers (and headless capture tools) do not render PDFs inside an iframe — use
            <strong> Open </strong> to view or download the original file.
          </p>
        </>
      ) : (
        <div className="doc-image-wrap" style={{ maxHeight: height }}>
          <img className="doc-image" src={url} alt={`Scanned invoice ${document.filename}`} />
        </div>
      )}
    </div>
  );
}
