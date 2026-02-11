import sys
from pathlib import Path

import pandas as pd


def col_letter_to_index(s: str) -> int:
    n = 0
    for c in s.upper():
        if not c.isalpha():
            continue
        n = n * 26 + (ord(c) - ord("A") + 1)
    return n - 1  # 0-based


def transpose_xlsx(
    input_path: str | Path,
    output_path: str | Path | None = None,
    data_start_cell: str = "B8",
) -> Path:
    """
    Read data from input_path starting at data_start_cell (default cell B8).
    The column starting there (e.g. No., A1, A2, ...) becomes the first row of the output file.
    Removes Comment and Type rows after transposing.

    If output_path is None, it is derived from input_path by appending '_transposed'.
    """
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if output_path is None:
        output_path = input_path.parent / f"{input_path.stem}_transposed{input_path.suffix}"
    else:
        output_path = Path(output_path)

    col_letter = "".join(c for c in data_start_cell if c.isalpha()).upper()
    row_str = "".join(c for c in data_start_cell if c.isdigit())
    start_row_1based = int(row_str) if row_str else 1
    start_row = start_row_1based - 1  # 0-based
    start_col = col_letter_to_index(col_letter)

    # Read entire first sheet as raw values (no header)
    df_raw = pd.read_excel(input_path, header=None, engine="openpyxl")

    # Slice from start cell to end
    data = df_raw.iloc[start_row:, start_col:].copy()

    # Remove Comment and Type rows (same logic as Step 2)
    first_col = data.iloc[:, 0].astype(str).str.strip()
    mask = (first_col.str.lower() != "comment") & (first_col.str.lower() != "type")
    data = data[mask].reset_index(drop=True)

    # Trim only trailing empty rows and columns
    while len(data) and data.iloc[-1].isna().all():
        data = data.iloc[:-1]
    while len(data.columns) and data.iloc[:, -1].isna().all():
        data = data.iloc[:, :-1]

    # Transpose: first column (No., A1, A2, ...) becomes first row
    transposed = data.T
    transposed.reset_index(drop=True, inplace=True)

    # Drop leading empty columns (move all columns left by one)
    while len(transposed.columns) and transposed.iloc[:, 0].isna().all():
        transposed = transposed.iloc[:, 1:].reset_index(drop=True)

    transposed.to_excel(output_path, index=False, header=False, engine="openpyxl")
    return output_path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python transpose_excel.py <input.xlsx> [output.xlsx] [--start-cell CELL]")
        print("  Default: data starts at B8; first column (No., A1, A2, ...) becomes first row of output.")
        print("  --start-cell   Start cell (e.g. B9 if your No. column is in B). Default: A9")
        sys.exit(1)

    args = sys.argv[1:]
    start_cell = "B8"
    non_flag = []
    i = 0
    while i < len(args):
        if args[i] == "--start-cell" and i + 1 < len(args):
            start_cell = args[i + 1].strip()
            i += 2
            continue
        non_flag.append(args[i])
        i += 1
    input_file = non_flag[0] if non_flag else None
    output_file = non_flag[1] if len(non_flag) > 1 else None

    try:
        out = transpose_xlsx(
            input_file,
            output_file,
            data_start_cell=start_cell,
        )
        print(f"Done. Transposed file saved to: {out}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
