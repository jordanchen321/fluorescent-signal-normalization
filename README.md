# Fluorescent Signal Normalization

A web application for transposing, normalizing, and summarizing fluorescent signal data from Excel (`.xlsx`) files, designed for Prism import and analysis.

## Features

- **Step 1: Transpose** — Reorganizes data so the first column becomes the first row. Removes Comment and Type rows.
- **Step 2: Normalize** — Converts time to seconds, adds an average-of-first-N baseline row, and normalizes values as `(value − avg) / avg`.
- **Step 3: First Peak & AUC** — Produces a summary file with First Peak (max per column) and AUC (sum per column).
- **Run all** — Runs transpose, normalize, and FP_AUC in one go, returning both normalized and FP_AUC files.
- **Column filter** — Optionally restrict Step 2 and Run all to specific columns (e.g., letters A, B, C with range 1–12).
- **Save location** — Choose a folder to save files into, or use the browser’s default Downloads folder.

---

## Prerequisites

- **Node.js** (v18 or later)
- **Python** (3.9 or later) with `pip`
- **npm** (included with Node.js)

---

## Installation

### 1. Clone or download the project

```bash
git clone https://github.com/jordanchen321/fluorescent-signal-normalization.git
cd fluorescent-signal-normalization
```

### 2. Install Python dependencies

```bash
pip install pandas openpyxl
```

These packages are used by the transpose, normalize, and FP_AUC scripts.

### 3. Install Node dependencies

```bash
cd web
npm install
```

### 4. Run the application

From the `web` directory:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How to Use

### 1. Upload a file

Drop an `.xlsx` file onto the drop zone or click to browse. Only `.xlsx` files are accepted.

### 2. Step 1: Transpose

- **Start cell** — Cell where your data begins (default: `B8`). The first column at that cell becomes the first row of the output.
- Click **Run Step 1**.
- Output: `filename_transposed.xlsx`.

### 3. Step 2: Normalize

- **First N reads** — Number of rows used for the baseline average (default: 30).
- **Columns to run**
  - **Run all** — Process all columns.
  - **Select columns** — Limit to specific columns:
    - **Range** — Two numbers (e.g., 1 and 12) defining the column index range.
    - **Letters** — Letters for column labels, e.g. `A, B, C`.
- Click **Run Step 2**.
- Output: `filename_normalized.xlsx`.

### 4. Step 3: First Peak & AUC

- Runs after Step 2.
- Click **Run Step 3**.
- Output: `filename_FP_AUC.xlsx` with First Peak (max per column) and AUC (sum per column).

### 5. Run all

- Performs transpose → normalize → FP_AUC.
- Uses the same options as Step 1 and Step 2 (start cell, first N reads, columns filter).
- Downloads two files: `filename_normalized.xlsx` and `filename_FP_AUC.xlsx`.

### 6. Save location

- **Choose folder** — Pick a folder to save all output files.
- **Clear** — Use the browser’s default Downloads folder again.
- If no folder is chosen, files are saved to the Downloads folder.

---

## Expected Data Format

### Input (for Transpose)

- Data starts at the **Start cell** (default `B8`).
- The first column contains labels such as No., A1, A2, etc.
- **Comment** and **Type** rows are removed during transpose.

### Normalize input (transposed file)

- Row 1: No. row (headers: No., A1, A2, D1, …).
- Row 2+: Time (ms) in the first column, then data values in the rest.

### Normalize output

- Row 0: Average of first N reads.
- Row 1: Headers.
- Row 2+: Time in seconds and normalized values.

### FP_AUC output

- Row 0: Column headers.
- Row 1: First Peak (max per column).
- Row 2: AUC (sum per column).

---

## Command-Line Usage

You can also run the Python scripts directly.

### Transpose

```bash
python transpose_excel.py input.xlsx [output.xlsx] [--start-cell B8]
```

### Normalize

```bash
python normalize.py input.xlsx [output.xlsx] [--first-n-reads 30] [--filter-letters "A, B, C"] [--filter-range "1 to 12"]
```

### FP_AUC

```bash
python fp_auc.py normalized.xlsx [output.xlsx]
```

---

## Project Structure

```
normalization/
├── transpose_excel.py   # Step 1: transpose script
├── normalize.py         # Step 2: normalize script
├── fp_auc.py            # Step 3: First Peak & AUC script
└── web/
    ├── app/
    │   ├── page.js      # Main UI
    │   ├── globals.css  # Styles
    │   └── api/         # API routes (transpose, normalize, fp-auc, run-all)
    └── package.json
```

---

## Browser Support

- **Save to folder** uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), supported in Chrome and Edge.
- In Firefox and Safari, files are saved to the default Downloads folder.
