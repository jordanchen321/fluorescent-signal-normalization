"""
Normalize xlsx data for fluorescent signal (Prism import).

Expects (from transpose; Comment/Type already removed):
- Row 1: No. row
- Row 2+: Data — first column = time in ms; rest = data

Workflow:
1. Time Corrected: divide time column by 1000 (ms → seconds)
2. Add row at top: average of first N reads per column
3. Normalized: (value − avg_first_N) / avg_first_N
"""

import re
import sys
from pathlib import Path

import pandas as pd


def parse_filter(letters_str: str | None, range_str: str | None) -> set[str] | None:
    """
    Parse letters (e.g. "A, B, C") and range (e.g. "1 to 12") into allowed column headers.
    Returns set like {"A1", "A2", ..., "A12", "B1", ..., "C12"} or None if no filter.
    """
    if not letters_str or not range_str:
        return None
    letters_str = letters_str.strip()
    range_str = range_str.strip()
    if not letters_str or not range_str:
        return None

    # Parse letters: "A, B, C" or "A,B,C" -> ["A", "B", "C"]
    letters = [c.strip().upper() for c in re.split(r"[,;\s]+", letters_str) if c.strip()]
    if not letters:
        return None

    # Parse range: "1 to 12", "1-12", "1:12" -> [1, 2, ..., 12]
    m = re.match(r"(\d+)\s*(?:to|-|:)\s*(\d+)$", range_str.strip())
    if not m:
        return None
    start, end = int(m.group(1)), int(m.group(2))
    if start > end:
        start, end = end, start
    nums = list(range(start, end + 1))

    return {f"{L}{n}" for L in letters for n in nums}


def _norm_header(v) -> str:
    """Normalize cell value for header matching (case-insensitive, handles Excel quirks)."""
    s = str(v).strip().upper()
    if s in ("NAN", "NAT", ""):
        return ""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        try:
            return str(int(v)) if v == int(v) else s
        except (ValueError, OverflowError):
            pass
    return s


def normalize_xlsx(
    input_path: str | Path,
    output_path: str | Path | None = None,
    first_n_reads: int = 30,
    filter_letters: str | None = None,
    filter_range: str | None = None,
) -> Path:
    """
    Step 3: Time → seconds. Step 4: Add avg-of-first-N row. Step 5: (value − avg) / avg.
    """
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if output_path is None:
        output_path = input_path.parent / f"{input_path.stem}_normalized{input_path.suffix}"
    else:
        output_path = Path(output_path)

    df_raw = pd.read_excel(input_path, header=None, engine="openpyxl")
    df = df_raw.copy()

    # Row 0: No., Row 1+: data
    no_row = df.iloc[[0]]
    data_df = df.iloc[1:].copy()

    # Filter columns (e.g. A1-A12, B1-B12, C1-C12)
    allowed = parse_filter(filter_letters, filter_range)
    if allowed:
        allowed_upper = {h.upper() for h in allowed}
        headers = no_row.iloc[0]
        keep = [0] + [
            i for i in range(1, len(headers))
            if _norm_header(headers.iloc[i]) in allowed_upper
        ]
        no_row = no_row.iloc[:, keep].copy()
        data_df = data_df.iloc[:, keep].copy()
        no_row.columns = range(no_row.shape[1])
        data_df.columns = range(data_df.shape[1])

    # Step 3: Time Corrected — ms → seconds
    type_col = data_df.iloc[:, 0]
    type_numeric = pd.to_numeric(type_col, errors="coerce")
    data_df = data_df.copy()
    data_df.iloc[:, 0] = type_numeric / 1000.0
    data_df = data_df.dropna(subset=[0]).reset_index(drop=True)

    data_cols = [c for c in data_df.columns if c != 0]
    n_reads = min(first_n_reads, len(data_df))

    # Step 4: Average of first N reads per column
    first_n = data_df.iloc[:n_reads]
    avg_row_values = first_n[data_cols].mean()

    # Step 5: Normalized — (value − avg) / avg
    result_data = data_df.iloc[:, [0]].copy()
    for col in data_cols:
        avg_val = avg_row_values[col]
        try:
            avg_val = float(avg_val)
        except (TypeError, ValueError):
            avg_val = 0

        if avg_val == 0:
            result_data[col] = data_df[col]
        else:
            result_data[col] = (data_df[col] - avg_val) / avg_val

    # Add average row at top
    avg_out = pd.DataFrame([["Average first " + str(n_reads)] + list(avg_row_values.values)])

    result = pd.concat([avg_out, no_row, result_data], ignore_index=True)
    result.to_excel(output_path, index=False, header=False, engine="openpyxl")
    return output_path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python normalize.py <input.xlsx> [output.xlsx] [--first-n-reads N]")
        print("  Time: ms → seconds. Adds avg-of-first-N row. Normalizes: (value − avg) / avg.")
        print("  --first-n-reads   Number of reads for baseline average (default: 30)")
        print("  --filter-letters  Letters for column filter, e.g. 'A, B, C'")
        print("  --filter-range    Range for filter, e.g. '1 to 12'")
        sys.exit(1)

    args = sys.argv[1:]
    first_n_reads = 30
    filter_letters = None
    filter_range = None
    non_flag = []
    i = 0
    while i < len(args):
        if args[i] == "--first-n-reads" and i + 1 < len(args):
            try:
                first_n_reads = int(args[i + 1].strip())
                if first_n_reads < 1:
                    raise ValueError("Must be >= 1")
            except ValueError:
                print(f"Invalid --first-n-reads: {args[i + 1]}", file=sys.stderr)
                sys.exit(1)
            i += 2
            continue
        if args[i] == "--filter-letters" and i + 1 < len(args):
            filter_letters = args[i + 1].strip() or None
            i += 2
            continue
        if args[i] == "--filter-range" and i + 1 < len(args):
            filter_range = args[i + 1].strip() or None
            i += 2
            continue
        non_flag.append(args[i])
        i += 1

    input_file = non_flag[0] if non_flag else None
    output_file = non_flag[1] if len(non_flag) > 1 else None

    try:
        out = normalize_xlsx(
            input_file,
            output_file,
            first_n_reads=first_n_reads,
            filter_letters=filter_letters,
            filter_range=filter_range,
        )
        print(f"Done. Normalized file saved to: {out}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
