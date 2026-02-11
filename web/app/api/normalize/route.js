import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function POST(request) {
  let inputPath;
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

    const maxSecondsRaw = formData.get("maxSeconds");
    let maxSeconds = null;
    if (maxSecondsRaw != null && maxSecondsRaw !== "") {
      const parsed = parseFloat(String(maxSecondsRaw).trim());
      if (!isNaN(parsed) && parsed > 0) maxSeconds = parsed;
    }

    const projectRoot = join(process.cwd(), "..");
    const scriptPath = join(projectRoot, "normalize.py");
    const tmpDir = join(projectRoot, "tmp");
    const id = randomUUID();
    inputPath = join(tmpDir, `${id}_in.xlsx`);
    outputPath = join(tmpDir, `${id}_out.xlsx`);

    await mkdir(tmpDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    const args = [scriptPath, inputPath, outputPath];
    if (maxSeconds != null) {
      args.push("--max-seconds", String(maxSeconds));
    }

    const run = (pyCmd) =>
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

    try {
      await run("python");
    } catch (err) {
      if (
        process.platform === "win32" &&
        (err.code === "ENOENT" || err.message.includes("python"))
      ) {
        try {
          await run("py");
        } catch (e2) {
          throw new Error(
            "Python not found. Install Python and add it to PATH (or use 'py' on Windows)."
          );
        }
      } else throw err;
    }

    const outBuffer = await readFile(outputPath);
    let baseName = file.name ? String(file.name).replace(/\.[^.]+$/, "") : "file";
    baseName = baseName.replace(/_transposed$/, "");
    const filename = `${baseName}_normalized.xlsx`;

    await unlink(inputPath).catch(() => {});
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
    if (outputPath) await unlink(outputPath).catch(() => {});
    console.error(err);
    return NextResponse.json(
      {
        error:
          err.message ||
          "Normalization failed. Ensure Python and pandas/openpyxl are installed.",
      },
      { status: 500 }
    );
  }
}
