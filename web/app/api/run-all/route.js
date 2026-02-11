import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function POST(request) {
  let inputPath;
  let transposedPath;
  let outputPath;
  let fpAucPath;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No file uploaded. Use form field 'file'." },
        { status: 400 }
      );
    }

    const startCell = (formData.get("startCell") || "B8").toString().trim() || "B8";

    const firstNReadsRaw = formData.get("firstNReads");
    let firstNReads = 30;
    if (firstNReadsRaw != null && firstNReadsRaw !== "") {
      const parsed = parseInt(String(firstNReadsRaw).trim(), 10);
      if (!isNaN(parsed) && parsed >= 1) firstNReads = parsed;
    }

    const projectRoot = join(process.cwd(), "..");
    const tmpDir = join(projectRoot, "tmp");
    const id = randomUUID();
    inputPath = join(tmpDir, `${id}_in.xlsx`);
    transposedPath = join(tmpDir, `${id}_transposed.xlsx`);
    outputPath = join(tmpDir, `${id}_out.xlsx`);

    await mkdir(tmpDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    const run = (pyCmd, args) =>
      new Promise((resolve, reject) => {
        const proc = spawn(pyCmd, args, {
          cwd: projectRoot,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        proc.stderr?.on("data", (d) => {
          stderr += d.toString();
        });
        proc.on("close", (code) => {
          if (code !== 0)
            reject(new Error(stderr || `Python exited with ${code}`));
          else resolve();
        });
        proc.on("error", (err) => reject(err));
      });

    const runPy = async (args) => {
      try {
        await run("python", args);
      } catch (err) {
        if (
          process.platform === "win32" &&
          (err.code === "ENOENT" || err.message.includes("python"))
        ) {
          await run("py", args);
        } else {
          throw err;
        }
      }
    };

    const transposeScript = join(projectRoot, "transpose_excel.py");
    const normalizeScript = join(projectRoot, "normalize.py");
    const fpAucScript = join(projectRoot, "fp_auc.py");

    fpAucPath = join(tmpDir, `${id}_fp_auc.xlsx`);

    await runPy([
      transposeScript,
      inputPath,
      transposedPath,
      "--start-cell",
      startCell,
    ]);

    const normArgs = [normalizeScript, transposedPath, outputPath];
    if (firstNReads !== 30) {
      normArgs.push("--first-n-reads", String(firstNReads));
    }
    const filterLetters = formData.get("filterLetters")?.toString().trim();
    const filterRange = formData.get("filterRange")?.toString().trim();
    if (filterLetters && filterRange) {
      normArgs.push("--filter-letters", filterLetters);
      normArgs.push("--filter-range", filterRange);
    }
    await runPy(normArgs);

    await runPy([fpAucScript, outputPath, fpAucPath]);

    const baseName = file.name ? String(file.name).replace(/\.[^.]+$/, "") : "file";
    const normalizedName = `${baseName}_normalized.xlsx`;
    const fpAucName = `${baseName}_FP_AUC.xlsx`;

    const normalizedBuffer = await readFile(outputPath);
    const fpAucBuffer = await readFile(fpAucPath);

    await unlink(inputPath).catch(() => {});
    await unlink(transposedPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await unlink(fpAucPath).catch(() => {});

    return NextResponse.json({
      normalized: {
        base64: normalizedBuffer.toString("base64"),
        filename: normalizedName,
      },
      fpAuc: {
        base64: fpAucBuffer.toString("base64"),
        filename: fpAucName,
      },
    });
  } catch (err) {
    if (inputPath) await unlink(inputPath).catch(() => {});
    if (transposedPath) await unlink(transposedPath).catch(() => {});
    if (outputPath) await unlink(outputPath).catch(() => {});
    if (fpAucPath) await unlink(fpAucPath).catch(() => {});
    console.error(err);
    return NextResponse.json(
      {
        error:
          err.message ||
          "Run all failed. Ensure Python and pandas/openpyxl are installed.",
      },
      { status: 500 }
    );
  }
}
