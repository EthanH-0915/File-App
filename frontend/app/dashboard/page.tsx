"use client"
import Image from "next/image";
import Link from 'next/link'
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback } from "react";
import { Menu, X, Search, FileText, Download, Trash2, Share2, Copy } from 'lucide-react';
import { useRef } from "react";
import { FileInput } from "../components/FileInput";

type FileItem = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

type ShareGrant = {
  id: string;
  email: string;
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

export default function Home() {
  const [filter, setFilter] = React.useState<"mine" | "shared">("mine");
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sharedFiles, setSharedFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareModalFile, setShareModalFile] = useState<FileItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
   const router = useRouter();

    // A dead session must not look like an empty drive, so a 401 sends the
    // user back to login rather than rendering the "no files yet" state.
    const fetchFiles = useCallback(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files`, {
          credentials: "include",
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          throw new Error("Could not load your files");
        }

        setFiles(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your files");
      }
    }, [router]);

    const fetchSharedFiles = useCallback(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files/shared-with-me`, {
          credentials: "include",
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          throw new Error("Could not load files shared with you");
        }

        setSharedFiles(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load files shared with you");
      }
    }, [router]);

    useEffect(() => {
      fetchFiles();
      fetchSharedFiles();
    }, [fetchFiles, fetchSharedFiles]);

    const handleFileSelect = async (file: File) => {
      setError(null);

      const maxSize = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_SIZE);
      if (maxSize && file.size > maxSize) {
        setError(`File is too large. Max size is ${formatBytes(maxSize)}.`);
        return;
      }

      setUploading(true);
      try {
        const urlRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          }),
        });

        if (!urlRes.ok) {
          throw new Error("Could not start upload");
        }

        const { fileId, url, fields } = await urlRes.json();

        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
          formData.append(key, value as string);
        });
        formData.append("file", file);

        const uploadRes = await fetch(url, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Upload to storage failed");
        }

        // The file stays invisible until the backend has verified the object
        // actually landed in S3 and recorded its real size.
        const completeRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/files/${fileId}/complete`,
          { method: "POST", credentials: "include" },
        );

        if (!completeRes.ok) {
          throw new Error("Could not finish upload");
        }

        // The completion response is the stored record, with the real size
        // S3 reported, so there's nothing to re-fetch. Listings are newest
        // first, so it goes on the front.
        const created: FileItem = await completeRes.json();
        setFiles((prev) => [created, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    };

    const handleDownload = async (id: string) => {
      setError(null);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files/${id}/download-url`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Could not download this file");
        }

        const { url } = await res.json();

        // Not window.open: this runs after an await, so the user-gesture
        // window has closed and popup blockers eat it. The signed URL comes
        // back with Content-Disposition: attachment, so a plain navigation
        // downloads the file without leaving the page.
        const link = document.createElement("a");
        link.href = url;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not download this file");
      }
    };

    const handleDelete = async (id: string) => {
      if (!confirm("Delete this file?")) return;

      setError(null);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Could not delete this file");
        }

        setFiles((prev) => prev.filter((file) => file.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete this file");
      }
    };


    const visibleFiles = filter === "shared" ? sharedFiles : files;
    const canManage = filter === "mine";

    const handleLogout = async (e: React.FormEvent) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // IMPORTANT — send/receive cookies
    });
    if (res.ok) {
      console.log("Logged out");
      router.push("/login");
    } else {
      console.error("Logout failed");
    };
  }
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-16 bg-white flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
          <h2 className="text-xl font-bold text-blue-600">Welcome</h2>
        </div>

        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400 size-5" />
            <input
              type="text"
              placeholder="Search files..."
              className="w-full h-10 rounded-xl bg-gray-50 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="w-10 h-10 bg-gray-200 rounded-full hidden sm:block"></div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className={`
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 fixed md:relative top-16 md:top-0 bottom-0 md:bottom-auto left-0 z-10 w-64 bg-white overflow-y-auto
          transition-transform duration-300 ease-in-out
        `}>
          <nav className="p-4 space-y-5">
              <FileInput onFileSelect={file => handleFileSelect(file)}
                buttonText={uploading ? "Uploading..." : "Upload File"}
                disabled={uploading}
                containerClassName="w-full"
                buttonClassName="w-full text-left px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
              />
            <button
              onClick={() => setFilter("mine")}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${
                filter === "mine" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              My Files
            </button>
            <button
              onClick={() => setFilter("shared")}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${
                filter === "shared" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              Shared with me
            </button>
            {['Recent', 'Favorites', 'Trash'].map((item) => (
              <button key={item} className="w-full text-left px-4 py-3 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 font-medium transition-colors">
                {item}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="w-full mt-10 text-left px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 font-medium transition-colors"
            >
              Logout
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                {filter === "shared" ? "Shared with me" : "Your Files"}
              </h2>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}

            {visibleFiles.length === 0 ? (
              <p className="text-gray-500">
                {filter === "shared" ? "No files have been shared with you yet." : "No files yet. Upload one to get started."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleFiles.map((file) => (
                  <div key={file.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      <FileText />
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center break-all">{file.filename}</span>
                    <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(file.id)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        aria-label={`Download ${file.filename}`}
                      >
                        <Download size={18} />
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => setShareModalFile(file)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            aria-label={`Share ${file.filename}`}
                          >
                            <Share2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(file.id)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            aria-label={`Delete ${file.filename}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {shareModalFile && (
          <ShareModal file={shareModalFile} onClose={() => setShareModalFile(null)} />
        )}

        {isMenuOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-0 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );

}

function ShareModal({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const [shares, setShares] = useState<ShareGrant[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const refresh = useCallback(async () => {
    const [sharesRes, linkRes] = await Promise.all([
      fetch(`${apiUrl}/files/${file.id}/shares`, { credentials: "include" }),
      fetch(`${apiUrl}/files/${file.id}/share-link`, { credentials: "include" }),
    ]);
    if (sharesRes.ok) setShares(await sharesRes.json());
    if (linkRes.ok) {
      const { token } = await linkRes.json();
      setLinkToken(token);
    }
  }, [apiUrl, file.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiUrl}/files/${file.id}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Could not share this file");
      }
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share this file");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    const res = await fetch(`${apiUrl}/files/${file.id}/shares/${shareId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    }
  };

  const handleToggleLink = async () => {
    setBusy(true);
    try {
      if (linkToken) {
        await fetch(`${apiUrl}/files/${file.id}/share-link`, {
          method: "DELETE",
          credentials: "include",
        });
        setLinkToken(null);
      } else {
        const res = await fetch(`${apiUrl}/files/${file.id}/share-link`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const { token } = await res.json();
          setLinkToken(token);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = () => {
    if (!linkToken) return;
    const url = `${window.location.origin}/shared/${linkToken}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Share &ldquo;{file.filename}&rdquo;</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleShare} className="flex gap-2">
          <input
            type="email"
            required
            placeholder="Share with an email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 h-10 rounded-lg border border-gray-300 px-3 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 h-10 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Share
          </button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {shares.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase">People with access</p>
            {shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{share.email}</span>
                <button
                  onClick={() => handleRevoke(share.id)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label={`Remove access for ${share.email}`}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Anyone with the link</p>
            <p className="text-xs text-gray-400">{linkToken ? "Link sharing is on" : "Link sharing is off"}</p>
          </div>
          <div className="flex items-center gap-2">
            {linkToken && (
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                aria-label="Copy link"
              >
                <Copy size={16} />
              </button>
            )}
            <button
              onClick={handleToggleLink}
              disabled={busy}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                linkToken ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {linkToken ? "Turn off" : "Get link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
