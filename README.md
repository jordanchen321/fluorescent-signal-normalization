# Fluorescent signal normalization

Transpose and normalize .xlsx files for fluorescent signal data. Step 1 transposes the data; Step 2 normalizes by time zero using `(value − t₀) / t₀`.

## Prerequisites

- **Node.js** (v18 or later)
- **Python** (3.9 or later)
- **npm** (comes with Node.js)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/jordanchen321/fluorescent-signal-normalization.git
cd fluorescent-signal-normalization
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs `pandas` and `openpyxl` for Excel processing.

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

## Usage

1. **Upload** an `.xlsx` file via the drop zone.
2. **Step 1 – Transpose:** Run transpose to rearrange the data. Output: `filename_transposed.xlsx`.
3. **Step 2 – Normalize:** Run normalize on the transposed data. Output: `filename_normalized.xlsx`.
4. Or use **Run all** to transpose and normalize in one step. Output: `filename_normalized.xlsx`.

## Expected data format

- **Transpose:** Data starts at a configurable cell (default: B9). The first column becomes the first row.
- **Normalize:** Expects:
  - Row 1: No. row (untouched)
  - Row 2: Comment row (removed)
  - Row 3: Type row (untouched, time in milliseconds)
  - Row 4+: Data rows; first data row is time zero

## Command-line usage

When running Program:

```bash
cd web 
npm run dev 
```
