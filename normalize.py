"""
Normalize xlsx data by time zero.

Expects:
- Row 1: No. row (untouched)
- Row 2: Comment row (removed)
- Row 3: Type row (untouched)
- Row 4+: Data rows — first is time zero; Type column = ms

Formula: (value - time_zero_value) / time_zero_value
Skips columns where time_zero_value is 0.
If max_seconds is set, only the first n seconds are normalized; full dataset returned.
"""

import sys
from pathlib import Path

import pandas as pd


def normalize_xlsx(
    input_path: str | Path,
    output_path: str | Path | None = None,
    max_seconds: float | None = None,
) -> Path:
    """
    Normalize data using (value - time_zero) / time_zero per column.
    Keeps No. row and Type row untouched. Removes Comment row.
    Time zero = first data row (row after Type).
    """
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if output_path is None:
        output_path = input_path.parent / f"{input_path.stem}_normalized{input_path.suffix}"
    else:
        output_path = Path(output_path)

    df_raw = pd.read_excel(input_path, header=None, engine="openpyxl")

    # Remove Comment row (first col == "Comment")
    first_col = df_raw.iloc[:, 0].astype(str).str.strip()
    mask = first_col.str.lower() != "comment"
    df = df_raw[mask].reset_index(drop=True)

    # Row 0: No., Row 1: Type, Row 2+: data (Row 2 = time zero)
    no_row = df.iloc[[0]]
    type_row = df.iloc[[1]]
    data_df = df.iloc[2:].copy()

    type_col = data_df.iloc[:, 0]
    type_numeric = pd.to_numeric(type_col, errors="coerce")
    data_df = data_df.copy()
    data_df.iloc[:, 0] = type_numeric
    data_df = data_df.dropna(subset=[0]).reset_index(drop=True)

    time_zero_row = data_df.iloc[0]
    data_cols = list(range(1, data_df.shape[1]))

    max_ms = (max_seconds * 1000) if max_seconds is not None else None
    within_window = (
        (data_df.iloc[:, 0] <= max_ms) if max_ms is not None else pd.Series(True, index=data_df.index)
    )

    result_data = data_df.iloc[:, [0]].copy()
    for col in data_cols:
        t0 = time_zero_row[col]
        try:
            t0_val = float(t0)
        except (TypeError, ValueError):
            t0_val = 0

        if t0_val == 0:
            result_data[col] = data_df[col]
        else:
            normalized = (data_df[col] - t0_val) / t0_val
            result_data[col] = normalized.where(within_window, data_df[col])

    result = pd.concat([no_row, type_row, result_data], ignore_index=True)
    result.to_excel(output_path, index=False, header=False, engine="openpyxl")
    return output_path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python normalize.py <input.xlsx> [output.xlsx] [--max-seconds SECONDS]")
        print("  Normalizes data: (value - time_zero) / time_zero per column.")
        print("  Skips columns where time zero is 0.")
        print("  --max-seconds   Only normalize rows up to this many seconds; rest unchanged (default: all)")
        sys.exit(1)

    args = sys.argv[1:]
    max_seconds = None
    non_flag = []
    i = 0
    while i < len(args):
        if args[i] == "--max-seconds" and i + 1 < len(args):
            try:
                max_seconds = float(args[i + 1].strip())
            except ValueError:
                print(f"Invalid --max-seconds: {args[i + 1]}", file=sys.stderr)
                sys.exit(1)
            i += 2
            continue
        non_flag.append(args[i])
        i += 1

    input_file = non_flag[0] if non_flag else None
    output_file = non_flag[1] if len(non_flag) > 1 else None

    try:
        out = normalize_xlsx(input_file, output_file, max_seconds=max_seconds)
        print(f"Done. Normalized file saved to: {out}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
