"use client";

import React, { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";

type SharedFile = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default function SharedFilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = React.use(params);
  const [file, setFile] = useState<SharedFile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // No credentials here on purpose: this page must work for a fully
    // logged-out visitor with no cookie at all.
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/shares/${token}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setFile(data);
      })
      .catch(() => setNotFound(true));
  }, [token]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/shares/${token}/download-url`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const { url } = await res.json();

      // Not window.open: this runs after an await, past the user-gesture
      // window popup blockers key off. The signed URL sets
      // Content-Disposition: attachment, so a plain navigation downloads
      // the file without leaving the page.
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        {notFound ? (
          <p className="text-gray-600">This link is invalid or has been revoked.</p>
        ) : !file ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <FileText size={28} />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 break-all">{file.filename}</h2>
            <p className="text-sm text-gray-400 mb-6">{formatBytes(file.size)}</p>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Download size={18} />
              {downloading ? "Preparing..." : "Download"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
