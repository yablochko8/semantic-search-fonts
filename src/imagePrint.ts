import { createCanvas, registerFont } from "canvas";
import fetch from "node-fetch";
import { writeFileSync } from "fs";
import path from "path";
import os from "os";
import fs from "fs/promises";

/** Returns a PNG buffer of the text in the font */
export const generateSamplePng = async (
  ttfUrl: string,
  printText: string = `The Quick Brown
  Fox jumps over 
   the lazy dog!`
): Promise<Buffer> => {
  // Download TTF files
  const response = await fetch(ttfUrl);
  if (!response.ok)
    throw new Error(`Failed to download font: ${response.statusText}`);
  const fontBuffer = await response.buffer();

  // Save TTF to a temporary file
  const tempFontPath = path.join(os.tmpdir(), `temp-font-${Date.now()}.ttf`);
  await fs.writeFile(tempFontPath, fontBuffer);

  // Register font with Canvas
  registerFont(tempFontPath, { family: "CustomFont" });

  // Set canvas dimensions (tweak as needed)
  const width = 1024;
  const height = 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Render text
  ctx.fillStyle = "#000000";
  ctx.font = '96px "CustomFont"';
  ctx.textBaseline = "top";
  ctx.fillText(printText, 20, 20);

  // Get PNG as buffer
  const buffer = canvas.toBuffer("image/png");

  // Optional: clean up temp font file
  await fs.unlink(tempFontPath);

  return buffer;
};

// const testAgain = getUrlFromName("Aclonica")

// const testPng = async () => {
//   const buffer = await generateSamplePng(
//     "https://github.com/google/fonts/raw/refs/heads/main/ofl/arvo/Arvo-Regular.ttf"
//   );
//   writeFileSync("output.png", buffer);
// };

// await testPng();
