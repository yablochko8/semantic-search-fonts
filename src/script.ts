import * as fs from "fs/promises";
import { clientSupabase } from "./connections/clientSupabase";
import { clientMistral } from "./connections/clientMistral";
import path from "path";
import { generateSamplePng } from "./imageFunctions";
import { getDescriptors } from "./imageFunctions";

////////////////////////////////////
// Types
////////////////////////////////////

type FontBasics = {
  name: string; // from METADATA.pb
  category: string | null; // from METADATA.pb (includes classifications here, space separated if multiple)
  copyright: string | null; // from METADATA.pb > fonts[0]
  designer: string | null; // from METADATA.pb
  license: string | null; // from METADATA.pb
  stroke: string | null; // from METADATA.pb
  year: number | null; // from METADATA.pb (first four digits of date_added)
};

type FontEnrichmentReady = FontBasics & {
  url: string | null; // Can be constructed from name, separated by +, e.g.: https://fonts.googleapis.com/css2?family=Family+Name
  description_p1: string | null; // Take the first <p> element of DESCRIPTION.en_us.html
  ai_descriptors: string[]; // List of adjectives from multimodal AI assessment of visual
  summary_text_v2: string | null; // Combination of all relevant descriptive elements. This is what we will vectorize.
};

type FontDBReady = FontEnrichmentReady & {
  embedding_mistral_v2: string;
};

////////////////////////////////////
// Small Utility Functions
////////////////////////////////////

const getUrlFromName = (name: string) =>
  `https://fonts.googleapis.com/css2?family=${name.replace(/\s+/g, "+")}`;

const stripQuotes = (str: string | undefined) => str?.replace(/^"|"$/g, "");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const cleanAdjective = (adjective: string) =>
  adjective
    .replace(/_/g, " ")
    .replace(/[^a-zA-Z ]/g, "")
    .toLowerCase()
    .trim();

const getStringTimestamp = () =>
  new Date()
    .toLocaleString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(/[/,]/g, "-")
    .replace(/:/g, "")
    .replace(/\s/g, "-")
    .replace(/--/g, "-");

////////////////////////////////////
// Single-Stage Functions
////////////////////////////////////

const parseFontBasicsFromPb = (content: string): FontBasics | null => {
  const lines = content.split("\n").filter((line) => line.trim());

  // Split each line into key-value pairs
  // If the key has already been seen ignore future mentions of, we only care about the first mention
  const keyValuePairs = lines.map((line) => {
    const [key, value] = line.split(":").map((s) => s.trim());
    return { key, value };
  });

  const getFirstValue = (key: string): string | null =>
    stripQuotes(keyValuePairs.find((pair) => pair.key === key)?.value) || null;

  const name = getFirstValue("name");
  const category = getFirstValue("category");
  const copyright = getFirstValue("copyright");
  const designer = getFirstValue("designer");
  const license = getFirstValue("license");
  const stroke = getFirstValue("stroke");
  const year = getFirstValue("date_added")
    ? parseInt(getFirstValue("date_added")?.substring(0, 4) || "0")
    : null;

  if (!name) return null;

  return {
    name,
    category,
    copyright,
    designer,
    license,
    stroke,
    year,
  };
};

const parseP1FromHtml = (content: string): string | null => {
  const p1 = content.split("<p>")[1].split("</p>")[0];
  // There may be other tags within p1 (e.g. <a>, <br>, <strong> etc). We want to remove the tags, but keep the text.
  const p1WithoutTags = p1.replace(/<[^>]*>?/g, "");
  return p1WithoutTags;
};

const getAiDescriptors = async (ttfUrl: string): Promise<string[]> => {
  const imageBuffer = await generateSamplePng(ttfUrl);
  const descriptors = await getDescriptors(imageBuffer.toString("base64"));
  return descriptors;
};

const getSummaryText = (
  fontBasics: FontBasics,
  p1Description: string,
  descriptors: string[]
): string => {
  // Create an array that combines all the categories, stroke values, and descriptors.
  const allAdjectives = [
    ...(fontBasics.category?.split(" ") || []),
    ...(fontBasics.stroke?.split(" ") || []),
    ...descriptors,
  ]
    .map(cleanAdjective)
    .filter((adjective) => adjective.length > 0);

  const uniqueAdjectives = [...new Set(allAdjectives)];

  const adjectivesCombined = uniqueAdjectives.join(", ");

  const { name, year, designer } = fontBasics;

  return `${name} is a ${adjectivesCombined} font designed by ${designer} in ${year}. ${p1Description}`;
};

/** Returns stringified embeddings, as that's what Supabase will want. Handles batches of inputs.
 * Returns empty array if there's any error.
 */
const getEmbeddings = async (inputs: string[]): Promise<string[]> => {
  const response = await clientMistral.embeddings.create({
    model: "mistral-embed",
    inputs: inputs,
  });

  const outputs = response.data;

  if (!outputs || outputs.length !== inputs.length) {
    console.error("Failed to get embedding, ref: ", inputs[0].slice(0, 20));
    return [];
  }

  const validOutputs = outputs.filter(
    (output) => output.object === "embedding" && output.index !== undefined
  );
  return validOutputs.map((output) => JSON.stringify(output.embedding));
};

const saveFontEntry = async (font: FontDBReady) => {
  const { error } = await clientSupabase
    .from("fonts")
    .upsert(font, { onConflict: "name" });
  if (error) {
    console.error(error);
  } else {
    console.log("Saved:", font.name, "\n");
  }
};

////////////////////////////////////
// Combination Functions
////////////////////////////////////

/** Parent script to pull the others together. */
const scrapeFolder = async (
  folderPath: string
): Promise<FontDBReady | null> => {
  // Let's first check if we have a /METADATA.pb and /DESCRIPTION.en_us.html
  // If either is missing, we will skip this font.
  const metadataPath = path.join(
    __dirname,
    `../../cloned-projects/fonts/${folderPath}/METADATA.pb`
  );
  const descriptionPath = path.join(
    __dirname,
    `../../cloned-projects/fonts/${folderPath}/DESCRIPTION.en_us.html`
  );
  const articlePath = path.join(
    __dirname,
    `../../cloned-projects/fonts/${folderPath}/article/ARTICLE.en_us.html`
  );

  const metadataExists = await fs
    .access(metadataPath)
    .then(() => true)
    .catch(() => false);
  const descriptionExists = await fs
    .access(descriptionPath)
    .then(() => true)
    .catch(() => false);
  const articleExists = await fs
    .access(articlePath)
    .then(() => true)
    .catch(() => false);

  // We definitely need a metadata file
  // We also need a description file OR an article file
  if (!metadataExists || (!descriptionExists && !articleExists)) {
    console.error(`Missing files for ${folderPath}`);
    return null;
  }

  try {
    const pbMetadata = await fs.readFile(
      path.join(
        __dirname,
        `../../cloned-projects/fonts/${folderPath}/METADATA.pb`
      ),
      "utf8"
    );
    const fontBasics = parseFontBasicsFromPb(pbMetadata);

    if (!fontBasics) {
      return null;
    }

    const url = getUrlFromName(fontBasics.name);

    const html = !descriptionExists
      ? null
      : await fs.readFile(
          path.join(
            __dirname,
            `../../cloned-projects/fonts/${folderPath}/DESCRIPTION.en_us.html`
          ),
          "utf8"
        );

    const usableHtml =
      html && html.length > 0
        ? html
        : await fs.readFile(
            path.join(
              __dirname,
              `../../cloned-projects/fonts/${folderPath}/article/ARTICLE.en_us.html`
            ),
            "utf8"
          );

    if (usableHtml.length === 0) {
      console.error(`No usable HTML for ${folderPath}`);
      return null;
    }

    const description_p1 = parseP1FromHtml(usableHtml);

    // Find all .ttf files in the folder
    const fontDir = path.join(
      __dirname,
      `../../cloned-projects/fonts/${folderPath}`
    );
    const files = await fs.readdir(fontDir);
    console.log({ files });
    const ttfFiles = files.filter((f) => f.endsWith(".ttf"));

    if (ttfFiles.length === 0) {
      console.error(`No .ttf files found in ${folderPath}`);
      return null;
    }

    let chosenTtf = ttfFiles[0]; // Default to first one

    if (ttfFiles.length > 1) {
      // Look for files with "Regular" in the name
      const regularFiles = ttfFiles.filter((f) => f.includes("Regular"));

      if (regularFiles.length === 1) {
        chosenTtf = regularFiles[0];
      } else if (regularFiles.length > 1) {
        // Filter out ones with Italic or Bold
        const cleanRegularFiles = regularFiles.filter(
          (f) => !f.includes("Italic") && !f.includes("Bold")
        );

        if (cleanRegularFiles.length >= 1) {
          if (cleanRegularFiles.length > 1) {
            console.warn(
              `Multiple candidate TTF files found in ${folderPath}, using first one`
            );
          }
          chosenTtf = cleanRegularFiles[0];
        }
      }
    }

    const ttfUrl = path.join(fontDir, chosenTtf);

    const ai_descriptors = await getAiDescriptors(ttfUrl);
    console.log(ai_descriptors);

    const summaryText = getSummaryText(
      fontBasics,
      description_p1 || "",
      ai_descriptors
    );

    const embeddings = await getEmbeddings([summaryText]);

    const embedding_mistral_v2 = embeddings[0] || "";

    const fontDBReady: FontDBReady = {
      ...fontBasics,
      url,
      description_p1,
      ai_descriptors,
      summary_text_v2: summaryText,
      embedding_mistral_v2,
    };

    return fontDBReady;
  } catch (error) {
    console.error(`Error processing folder ${folderPath}:`, error);
    return null;
  }
};

const scrapeAndSaveFont = async (
  folderPath: string
): Promise<{ name: string; success: boolean }> => {
  const font = await scrapeFolder(folderPath);

  if (!font) {
    return { name: folderPath, success: false };
  }

  await saveFontEntry(font);

  return { name: folderPath, success: true };
};

////////////////////////////////////
// FULL SCRIPT
////////////////////////////////////

const main = async (topLevelFolders: string[]) => {
  // Get all subfolders immediately in the top level folders
  const subfolders: string[] = (
    await Promise.all(
      topLevelFolders.map(async (folder) => {
        const subfolders = await fs.readdir(
          path.join(__dirname, `../../cloned-projects/fonts/${folder}`)
        );
        // Filter out system files and hidden files
        const validSubfolders = subfolders.filter(
          (subfolder) => !subfolder.startsWith(".")
        );
        return validSubfolders.map((subfolder) => `${folder}/${subfolder}`);
      })
    )
  ).flat();

  // Scrape and save each font consecutively
  const results: { name: string; success: boolean }[] = [];
  for (let i = 0; i < subfolders.length; i++) {
    const subfolder = subfolders[i];
    console.log(`Processing ${i + 1}/${subfolders.length}: ${subfolder}`);
    const result = await scrapeAndSaveFont(subfolder);
    results.push(result);
    await delay(100);
  }

  const successCount = results.filter((result) => result.success).length;
  const totalCount = results.length;
  console.log(
    `Successfully scraped and saved ${successCount} out of ${totalCount} fonts`
  );

  // Store the results in a file
  await fs.writeFile(
    path.join(__dirname, `../logs/font-scrape-${getStringTimestamp()}.json`),
    JSON.stringify(results, null, 2)
  );
};

// To run this, uncomment the line below and then in Terminal: bun src/script.ts

// main(["ufl", "apache", "ofl"]);
