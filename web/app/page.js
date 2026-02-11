"use client";

import { useCallback, useState } from "react";

const ACCEPT = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function Home() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [step1Done, setStep1Done] = useState(false);
  const [transposedBlob, setTransposedBlob] = useState(null);
  const [transposedName, setTransposedName] = useState(null);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);
  const [runAllLoading, setRunAllLoading] = useState(false);
  const [startCell, setStartCell] = useState("B9");
  const [maxSeconds, setMaxSeconds] = useState("30");

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && isXlsx(f)) {
      setFile(f);
      setStatus(null);
      setStep1Done(false);
      setTransposedBlob(null);
      setTransposedName(null);
    } else {
      setFile(null);
      setStatus({ type: "error", message: "Please drop a single .xlsx file." });
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleInputChange = useCallback((e) => {
    const f = e.target?.files?.[0];
    if (f && isXlsx(f)) {
      setFile(f);
      setStatus(null);
      setStep1Done(false);
      setTransposedBlob(null);
      setTransposedName(null);
    } else {
      setFile(null);
      setStatus(f ? { type: "error", message: "Please select a .xlsx file." } : null);
    }
  }, []);

  const handleStep1 = useCallback(async () => {
    if (!file) {
      setStatus({ type: "error", message: "Upload an .xlsx file first." });
      return;
    }
    setStep1Loading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("startCell", startCell.trim() || "B9");
      const res = await fetch("/api/transpose", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || "transposed.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setTransposedBlob(blob);
      setTransposedName(name);
      setStep1Done(true);
      setStatus({ type: "success", message: "Transposed. Step 2 unlocked." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Transpose failed." });
    } finally {
      setStep1Loading(false);
    }
  }, [file, startCell]);

  const handleStep2 = useCallback(async () => {
    if (!transposedBlob || !step1Done) return;
    setStep2Loading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", transposedBlob, transposedName || "transposed.xlsx");
      if (maxSeconds.trim() !== "") form.append("maxSeconds", maxSeconds.trim());
      const res = await fetch("/api/normalize", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || "normalized.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: "success", message: "Normalized file downloaded." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Normalization failed." });
    } finally {
      setStep2Loading(false);
    }
  }, [transposedBlob, transposedName, step1Done, maxSeconds]);

  const handleRunAll = useCallback(async () => {
    if (!file) {
      setStatus({ type: "error", message: "Upload an .xlsx file first." });
      return;
    }
    setRunAllLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("startCell", startCell.trim() || "B9");
      if (maxSeconds.trim() !== "") form.append("maxSeconds", maxSeconds.trim());
      const res = await fetch("/api/run-all", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || "normalized.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: "success", message: "Transpose + normalize complete." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Run all failed." });
    } finally {
      setRunAllLoading(false);
    }
  }, [file, startCell, maxSeconds]);

  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <h1>Fluorescent signal normalization</h1>
          <p className="subtitle">
            Step 1: Transpose. Step 2: Normalize. Or run both at once.
          </p>
        </header>

        <div
          className={`dropzone dropzone--main ${dragging ? "dropzone--active" : ""} ${file ? "dropzone--has-file" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept={ACCEPT}
            onChange={handleInputChange}
            className="dropzone__input"
            id="file-input"
          />
          <label htmlFor="file-input" className="dropzone__label">
            {file ? (
              <span className="dropzone__filename">{file.name}</span>
            ) : (
              <>
                <span className="dropzone__icon">📄</span>
                <span>Drop your .xlsx here or click to browse</span>
              </>
            )}
          </label>
        </div>

        {status && (
          <p className={`status status--${status.type}`}>
            {status.type === "success" ? "✓ " : "✗ "}
            {status.message}
          </p>
        )}

        <div className="steps">
          <div className="step">
            <h2 className="step__title">Step 1: Transpose</h2>
            <p className="step__desc">Column at start cell becomes first row. Output: <em>filename_transposed.xlsx</em></p>
            <label className="option">
              <span className="option__label">Start cell</span>
              <input
                type="text"
                value={startCell}
                onChange={(e) => setStartCell(e.target.value)}
                placeholder="B9"
                className="option__input option__input--cell"
              />
            </label>
            <button
              type="button"
              className="button button--step"
              onClick={handleStep1}
              disabled={!file || step1Loading}
            >
              {step1Loading ? "Transposing…" : "Run Step 1"}
            </button>
          </div>

          <div className={`step step--2 ${!step1Done ? "step--locked" : ""}`}>
            <h2 className="step__title">Step 2: Normalize</h2>
            <p className="step__desc">(value − t₀) / t₀. Skips columns where t₀ = 0. Output: <em>filename_normalized.xlsx</em></p>
            <label className="option">
              <span className="option__label">Max seconds (optional)</span>
              <input
                type="number"
                min="0"
                step="any"
                value={maxSeconds}
                onChange={(e) => setMaxSeconds(e.target.value)}
                placeholder="All"
                className="option__input option__input--cell option__input--number"
              />
            </label>
            <button
              type="button"
              className="button button--step"
              onClick={handleStep2}
              disabled={!step1Done || step2Loading}
            >
              {step2Loading ? "Normalizing…" : "Run Step 2"}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={handleRunAll}
          disabled={!file || runAllLoading}
        >
          {runAllLoading ? "Running…" : "Run all (transpose + normalize)"}
        </button>
      </div>
    </main>
  );
}

function isXlsx(f) {
  const n = (f.name || "").toLowerCase();
  return n.endsWith(".xlsx") || (f.type || "").includes("spreadsheet");
}
