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
  const [step2Done, setStep2Done] = useState(false);
  const [normalizedBlob, setNormalizedBlob] = useState(null);
  const [normalizedName, setNormalizedName] = useState(null);
  const [step3Loading, setStep3Loading] = useState(false);
  const [runAllLoading, setRunAllLoading] = useState(false);
  const [startCell, setStartCell] = useState("B8");
  const [firstNReads, setFirstNReads] = useState("30");
  const [step2FilterAll, setStep2FilterAll] = useState(true);
  const [filterRangeStart, setFilterRangeStart] = useState("1");
  const [filterRangeEnd, setFilterRangeEnd] = useState("12");
  const [filterLetters, setFilterLetters] = useState("A, B, C");
  const [saveFolderHandle, setSaveFolderHandle] = useState(null);
  const [saveFolderName, setSaveFolderName] = useState(null);

  const saveFile = useCallback(async (blob, filename) => {
    if (saveFolderHandle) {
      try {
        const fileHandle = await saveFolderHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (err) {
        throw new Error(`Could not save to folder: ${err.message}`);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [saveFolderHandle]);

  const handleChooseFolder = useCallback(async () => {
    if (!("showDirectoryPicker" in window)) {
      setStatus({ type: "error", message: "Folder picker not supported in this browser. Files will save to Downloads." });
      return;
    }
    try {
      const handle = await window.showDirectoryPicker();
      if (handle.requestPermission) {
        const perm = await handle.requestPermission({ mode: "readwrite" });
        if (perm !== "granted") {
          setStatus({ type: "error", message: "Write permission denied for folder." });
          return;
        }
      }
      setSaveFolderHandle(handle);
      setSaveFolderName(handle.name);
      setStatus({ type: "success", message: `Saving to: ${handle.name}` });
    } catch (err) {
      if (err.name !== "AbortError") {
        setStatus({ type: "error", message: err.message || "Could not pick folder." });
      }
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && isXlsx(f)) {
      setFile(f);
      setStatus(null);
      setStep1Done(false);
      setStep2Done(false);
      setTransposedBlob(null);
      setTransposedName(null);
      setNormalizedBlob(null);
      setNormalizedName(null);
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
      setStep2Done(false);
      setTransposedBlob(null);
      setTransposedName(null);
      setNormalizedBlob(null);
      setNormalizedName(null);
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
      form.append("startCell", startCell.trim() || "B8");
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
      await saveFile(blob, name);
      setTransposedBlob(blob);
      setTransposedName(name);
      setStep1Done(true);
      setStatus({ type: "success", message: "Transposed. Step 2 unlocked." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Transpose failed." });
    } finally {
      setStep1Loading(false);
    }
  }, [file, startCell, saveFile]);

  const handleStep2 = useCallback(async () => {
    if (!transposedBlob || !step1Done) return;
    setStep2Loading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", transposedBlob, transposedName || "transposed.xlsx");
      if (firstNReads.trim() !== "") form.append("firstNReads", firstNReads.trim());
      if (!step2FilterAll) {
        form.append("filterLetters", filterLetters.trim());
        form.append("filterRange", `${filterRangeStart} to ${filterRangeEnd}`);
      }
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
      await saveFile(blob, name);
      setNormalizedBlob(blob);
      setNormalizedName(name);
      setStep2Done(true);
      setStatus({ type: "success", message: "Normalized. Step 3 unlocked." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Normalization failed." });
    } finally {
      setStep2Loading(false);
    }
  }, [transposedBlob, transposedName, step1Done, firstNReads, step2FilterAll, filterLetters, filterRangeStart, filterRangeEnd, saveFile]);

  const handleStep3 = useCallback(async () => {
    if (!normalizedBlob || !step2Done) return;
    setStep3Loading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", normalizedBlob, normalizedName || "normalized.xlsx");
      const res = await fetch("/api/fp-auc", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || "FP_AUC.xlsx";
      await saveFile(blob, name);
      setStatus({ type: "success", message: "FP_AUC file saved." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "FP_AUC failed." });
    } finally {
      setStep3Loading(false);
    }
  }, [normalizedBlob, normalizedName, step2Done, saveFile]);

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
      form.append("startCell", startCell.trim() || "B8");
      if (firstNReads.trim() !== "") form.append("firstNReads", firstNReads.trim());
      if (!step2FilterAll) {
        form.append("filterLetters", filterLetters.trim());
        form.append("filterRange", `${filterRangeStart} to ${filterRangeEnd}`);
      }
      const res = await fetch("/api/run-all", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      const b64ToBlob = (b64) => {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      };
      await saveFile(b64ToBlob(data.normalized.base64), data.normalized.filename);
      await saveFile(b64ToBlob(data.fpAuc.base64), data.fpAuc.filename);
      setStatus({ type: "success", message: "Normalized and FP_AUC files saved." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Run all failed." });
    } finally {
      setRunAllLoading(false);
    }
  }, [file, startCell, firstNReads, step2FilterAll, filterLetters, filterRangeStart, filterRangeEnd, saveFile]);

  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <h1>Fluorescent signal normalization</h1>
          <p className="subtitle">
            Step 1: Transpose. Step 2: Normalize. Step 3: First Peak &amp; AUC.
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

        <div className="option save-location">
          <span className="option__label">Save location</span>
          <div className="save-location__controls">
            <span className="save-location__path">{saveFolderName || "Downloads (default)"}</span>
            <button type="button" className="button button--small" onClick={handleChooseFolder}>
              Choose folder
            </button>
            {saveFolderName && (
              <button
                type="button"
                className="button button--small button--secondary"
                onClick={() => { setSaveFolderHandle(null); setSaveFolderName(null); setStatus(null); }}
              >
                Clear
              </button>
            )}
          </div>
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
            <p className="step__desc">Column at start cell becomes first row. Removes Comment and Type rows. Output: <em>filename_transposed.xlsx</em></p>
            <label className="option">
              <span className="option__label">Start cell</span>
              <input
                type="text"
                value={startCell}
                onChange={(e) => setStartCell(e.target.value)}
                placeholder="B8"
                className="option__input option__input--cell"
              />
            </label>
            <button
              type="button"
              className="button button--step button--step-fixed"
              onClick={handleStep1}
              disabled={!file || step1Loading}
            >
              {step1Loading ? "Transposing…" : "Run Step 1"}
            </button>
          </div>

          <div className={`step step--2 ${!step1Done ? "step--locked" : ""}`}>
            <h2 className="step__title">Step 2: Normalize</h2>
            <p className="step__desc">Time → seconds. Adds avg-of-first-N row. Normalizes: (value − avg) / avg. Output: <em>filename_normalized.xlsx</em></p>
            <label className="option">
              <span className="option__label">First N reads (for baseline avg)</span>
              <input
                type="number"
                min="1"
                value={firstNReads}
                onChange={(e) => setFirstNReads(e.target.value)}
                placeholder="30"
                className="option__input option__input--cell option__input--number"
              />
            </label>
            <div className="option">
              <span className="option__label">Columns to run</span>
              <div className="toggle-buttons">
                <button
                  type="button"
                  className={`button button--toggle ${step2FilterAll ? "button--toggle-active" : ""}`}
                  onClick={() => setStep2FilterAll(true)}
                >
                  Run all
                </button>
                <button
                  type="button"
                  className={`button button--toggle ${!step2FilterAll ? "button--toggle-active" : ""}`}
                  onClick={() => setStep2FilterAll(false)}
                >
                  Select columns
                </button>
              </div>
            </div>
            {!step2FilterAll && (
              <>
                <div className="option">
                  <span className="option__label">Range</span>
                  <div className="range-inputs">
                    <input
                      type="number"
                      min="1"
                      value={filterRangeStart}
                      onChange={(e) => setFilterRangeStart(e.target.value)}
                      className="option__input option__input--number"
                    />
                    <span className="range-inputs__to">to</span>
                    <input
                      type="number"
                      min="1"
                      value={filterRangeEnd}
                      onChange={(e) => setFilterRangeEnd(e.target.value)}
                      className="option__input option__input--number"
                    />
                  </div>
                </div>
                <label className="option">
                  <span className="option__label">Letters (e.g. A, B, C)</span>
                  <input
                    type="text"
                    value={filterLetters}
                    onChange={(e) => setFilterLetters(e.target.value)}
                    placeholder="A, B, C"
                    className="option__input option__input--wide"
                  />
                </label>
              </>
            )}
            <button
              type="button"
              className="button button--step button--step-fixed"
              onClick={handleStep2}
              disabled={!step1Done || step2Loading}
            >
              {step2Loading ? "Normalizing…" : "Run Step 2"}
            </button>
          </div>

          <div className={`step step--3 ${!step2Done ? "step--locked" : ""}`}>
            <h2 className="step__title">Step 3: First Peak &amp; AUC</h2>
            <p className="step__desc">First Peak = max per column. AUC = sum per column. Output: <em>filename_FP_AUC.xlsx</em></p>
            <button
              type="button"
              className="button button--step button--step-fixed"
              onClick={handleStep3}
              disabled={!step2Done || step3Loading}
            >
              {step3Loading ? "Computing…" : "Run Step 3"}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={handleRunAll}
          disabled={!file || runAllLoading}
        >
          {runAllLoading ? "Running…" : "Run all (transpose + normalize + FP_AUC)"}
        </button>
      </div>
    </main>
  );
}

function isXlsx(f) {
  const n = (f.name || "").toLowerCase();
  return n.endsWith(".xlsx") || (f.type || "").includes("spreadsheet");
}
