import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function POST(request) {
  let inputPath;
  let transposedPath;
  let outputPath;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No file uploaded. Use form field 'file'." },
        { status: 400 }
      );
    }

    const startCell = (formData.get("startCell") || "B9").toString().trim() || "B9";

    const maxSecondsRaw = formData.get("maxSeconds");
    let maxSeconds = null;
    if (maxSecondsRaw != null && maxSecondsRaw !== "") {
      const parsed = parseFloat(String(maxSecondsRaw).trim());
      if (!isNaN(parsed) && parsed > 0) maxSeconds = parsed;
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

    await runPy([
      transposeScript,
      inputPath,
      transposedPath,
      "--start-cell",
      startCell,
    ]);

    const normArgs = [normalizeScript, transposedPath, outputPath];
    if (maxSeconds != null) {
      normArgs.push("--max-seconds", String(maxSeconds));
    }
    await runPy(normArgs);

    const outBuffer = await readFile(outputPath);
    const baseName = file.name ? String(file.name).replace(/\.[^.]+$/, "") : "file";
    const filename = `${baseName}_normalized.xlsx`;

    await unlink(inputPath).catch(() => {});
    await unlink(transposedPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    return new NextResponse(outBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (inputPath) await unlink(inputPath).catch(() => {});
    if (transposedPath) await unlink(transposedPath).catch(() => {});
    if (outputPath) await unlink(outputPath).catch(() => {});
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
