"""
First Peak and AUC summary from normalized xlsx.

Expects normalized file (from normalize.py):
- Row 0: Average first N row
- Row 1: No., A1, A2, D1, D2, ... (headers)
- Row 2+: time, data1, data2, ... (normalized values)

Output:
- Row 0: empty, col1, col2, col3, ...
- Row 1: First Peak, max(col1), max(col2), ...
- Row 2: AUC, sum(col1), sum(col2), ...
"""

import sys
from pathlib import Path

import pandas as pd


def fp_auc_xlsx(input_path: str | Path, output_path: str | Path | None = None) -> Path:
    """Compute First Peak (max) and AUC (sum) per column from normalized file."""
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if output_path is None:
        stem = input_path.stem.replace("_normalized", "")
        output_path = input_path.parent / f"{stem}_FP_AUC{input_path.suffix}"
    else:
        output_path = Path(output_path)

    df = pd.read_excel(input_path, header=None, engine="openpyxl")

    # Row 0 = average row, Row 1 = headers (No., A1, A2, ...), Row 2+ = data
    headers = df.iloc[1]
    data = df.iloc[2:]

    # Data columns: exclude col 0 (time)
    col_headers = [str(headers.iloc[i]).strip() for i in range(1, len(headers))]
    data_cols = list(range(1, data.shape[1]))

    first_peak = data[data_cols].max(axis=0)
    auc = data[data_cols].sum(axis=0)

    out_df = pd.DataFrame(
        [
            [""] + col_headers,
            ["First Peak"] + [float(first_peak.iloc[i]) for i in range(len(data_cols))],
            ["AUC"] + [float(auc.iloc[i]) for i in range(len(data_cols))],
        ]
    )
    out_df.to_excel(output_path, index=False, header=False, engine="openpyxl")
    return output_path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python fp_auc.py <normalized.xlsx> [output.xlsx]")
        print("  Outputs First Peak (max) and AUC (sum) per column. Filename ends with _FP_AUC.xlsx")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        out = fp_auc_xlsx(input_file, output_file)
        print(f"Done. FP_AUC file saved to: {out}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
