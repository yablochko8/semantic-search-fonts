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

type FontEmbeddingReady = FontBasics & {
  url: string | null; // Can be constructed from name, separated by +, e.g.: https://fonts.googleapis.com/css2?family=Family+Name
  description_p1: string | null; // Take the first <p> element of DESCRIPTION.en_us.html
  ai_descriptors: string[]; // List of adjectives from multimodal AI assessment of visual
  summary_text_v2: string | null; // Combination of all relevant descriptive elements. This is what we will vectorize.
};

type FontDBReady = FontEmbeddingReady & {
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

/** If any part of the folderPath string (lower-cased) matches any of the exclusion strings, return true. */
const isExcluded = (folderPath: string, exclusionList: string[]) =>
  exclusionList.some((exclusion) =>
    folderPath.toLowerCase().includes(exclusion.toLowerCase())
  );

////////////////////////////////////
// Single-Stage Functions
////////////////////////////////////

const fetchPbMetadata = async (
  fontProjectRoot: string,
  folderPath: string
): Promise<string | null> => {
  try {
    const pbMetadata = await fs.readFile(
      path.join(__dirname, `${fontProjectRoot}/${folderPath}/METADATA.pb`),
      "utf8"
    );
    return pbMetadata;
  } catch (error) {
    console.error(`Error reading METADATA.pb for ${folderPath}:`, error);
    return null;
  }
};

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

const fetchDescriptiveHtml = async (
  fontProjectRoot: string,
  folderPath: string
): Promise<string | null> => {
  try {
    const descriptionHtml = await fs.readFile(
      path.join(
        __dirname,
        `${fontProjectRoot}/${folderPath}/DESCRIPTION.en_us.html`
      ),
      "utf8"
    );
    if (descriptionHtml.length > 0) return descriptionHtml;
  } catch (error) {}

  try {
    const articleHtml = await fs.readFile(
      path.join(
        __dirname,
        `${fontProjectRoot}/${folderPath}/article/ARTICLE.en_us.html`
      ),
      "utf8"
    );
    if (articleHtml.length > 0) return articleHtml;
  } catch (error) {
    console.error(
      `Error reading ARTICLE.en_us.html for a folder that has no DESCRIPTION.en_us.html, ${folderPath}:`,
      error
    );
    return null;
  }
  return null;
};

const parseP1FromHtml = (content: string): string | null => {
  const p1 = content.split("<p>")[1].split("</p>")[0];
  // There may be other tags within p1 (e.g. <a>, <br>, <strong> etc). We want to remove the tags, but keep the text.
  const p1WithoutTags = p1.replace(/<[^>]*>?/g, "");
  return p1WithoutTags;
};

const findRegularTtf = (fileNames: string[]) => {
  const ttfFiles = fileNames.filter((f) => f.endsWith(".ttf"));
  if (ttfFiles.length === 0) {
    console.error(`No .ttf files found among ${fileNames}`);
    return null;
  }

  // Sort the ttf files with the following rules:
  // 1. Regular fonts first
  // 2. Variant fonts (Italic, Bold, Black, etc) files second
  const sortedTtfFiles = ttfFiles.sort((a, b) => {
    const aHasRegular = a.includes("Regular");
    const bHasRegular = b.includes("Regular");
    const aIsVariant =
      a.includes("Italic") || a.includes("Bold") || a.includes("Black");
    const bIsVariant =
      b.includes("Italic") || b.includes("Bold") || b.includes("Black");

    // Remember: -1 means first, 1 means last
    // When comparing (a,b), the return value references the first argument (a)

    // If one is a variant and the other isn't, the non-variant goes first
    if (!aIsVariant && bIsVariant) return -1;
    if (aIsVariant && !bIsVariant) return 1;

    // If one mentions regular and the other doesn't, the regular goes first
    if (aHasRegular && !bHasRegular) return -1;
    if (!aHasRegular && bHasRegular) return 1;

    return 0;
  });
  return sortedTtfFiles[0];
};

const getAiDescriptors = async (ttfUrl: string): Promise<string[]> => {
  console.log("printing image", ttfUrl);
  const imageBuffer = await generateSamplePng(ttfUrl);
  console.log("image made with buffer length", imageBuffer.length);
  const descriptors = await getDescriptors(imageBuffer.toString("base64"));
  return descriptors;
};

export const getSummaryTextSimple = (
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

  return `${adjectivesCombined} font designed by ${designer} in ${year}. ${p1Description}`;
};

export const getSummaryTextAdvanced = async (
  simpleSummary: string
): Promise<string> => {
  const SYSTEM_PROMPT = `You are an expert in semantic embeddings for fonts. The user will provide a description of a font. Your task is to generate a highly descriptive, information-rich text that is ideal for use as an embedding. Focus on the essential characteristics of the font, including:

- The font's name and designer (if relevant and not misleading)
- Its style, category, and notable typographic features (e.g., "serif", "rounded", "condensed", "monoline")
- Descriptors that capture the mood, intended use, or unique qualities (e.g., "playful", "futuristic", "for headlines")
- Any relevant context, such as the year of creation or typical use cases

Do not use negations (e.g., "not serious"); only specify what the font is. Feel free to omit any information that may cause confusion. E.g. don't say "sans serif", just say "sans". Avoid markdown, code blocks, or extra commentary. Respond with a single, well-structured, comma-separated list or a short paragraph of 20 to 30 descriptors and relevant phrases that best capture the font's essence for semantic search. Do not repeat yourself.`;
  console.log(
    "attempting to get advanced summary with summary length",
    simpleSummary.length
  );
  try {
    const response = await clientMistral.chat.complete({
      model: "mistral-medium-latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: simpleSummary },
      ],
    });
    // Print some details about the response for debugging/inspection
    if (response.usage) {
      console.log("Mistral API usage:", response.usage);
    }
    if (
      response.choices &&
      response.choices[0] &&
      response.choices[0].message
    ) {
      console.log(
        "AI summary (first 200 chars):",
        response.choices[0].message.content?.slice(0, 200)
      );
    }

    const aiSummary = response.choices?.[0]?.message?.content || simpleSummary;
    // "Trim" in this context means remove any quotes that may be wrapping the summary
    const trimmedSummary = String(aiSummary).replace(/^"|"$/g, "");
    return trimmedSummary;
  } catch (error) {
    console.error("Error in getSummaryTextAdvanced:", error);
    // Fallback to the simple summary if there's an error
    return simpleSummary;
  }
};

/** Returns stringified embeddings, as that's what Supabase will want. Handles batches of inputs.
 * Returns empty array if there's any error.
 */
export const getEmbeddings = async (inputs: string[]): Promise<string[]> => {
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
  fontProjectRoot: string,
  folderPath: string
): Promise<FontDBReady | null> => {
  const EXCLUSION_LIST = ["jsmath"];
  if (isExcluded(folderPath, EXCLUSION_LIST)) {
    return null;
  }

  const fontDir = path.join(__dirname, `${fontProjectRoot}/${folderPath}`);
  const fileNames = await fs.readdir(fontDir);

  // Let's first check if we have a /METADATA.pb and /DESCRIPTION.en_us.html
  // article/ARTICLE.en_us.html is the fallback source for description
  // If either is missing, we will skip this font.
  const metadataExists = fileNames.includes("METADATA.pb");
  const descriptionExists = fileNames.includes("DESCRIPTION.en_us.html");
  const articleFolderExists = fileNames.includes("article");

  if (!metadataExists || (!descriptionExists && !articleFolderExists)) {
    console.error(`Missing files for ${folderPath}`);
    return null;
  }

  const pbMetadata = await fetchPbMetadata(fontProjectRoot, folderPath);
  if (!pbMetadata) return null;

  const fontBasics = parseFontBasicsFromPb(pbMetadata);
  if (!fontBasics) return null;

  const url = getUrlFromName(fontBasics.name);

  const descriptiveHtml = await fetchDescriptiveHtml(
    fontProjectRoot,
    folderPath
  );
  if (!descriptiveHtml) return null;

  const description_p1 = parseP1FromHtml(descriptiveHtml);

  const regularTtfFilename = findRegularTtf(fileNames);
  if (!regularTtfFilename) return null;

  const ttfUrl = path.join(fontDir, regularTtfFilename);
  const ai_descriptors = await getAiDescriptors(ttfUrl);

  const summaryTextSimple = getSummaryTextSimple(
    fontBasics,
    description_p1 || "",
    ai_descriptors
  );

  const summaryTextAdvanced = await getSummaryTextAdvanced(summaryTextSimple);

  const embeddings = await getEmbeddings([summaryTextAdvanced]);

  const embedding_mistral_v2 = embeddings[0] || "";

  const fontDBReady: FontDBReady = {
    ...fontBasics,
    url,
    description_p1,
    ai_descriptors,
    summary_text_v2: summaryTextAdvanced,
    embedding_mistral_v2,
  };

  return fontDBReady;
};

const scrapeAndSaveFont = async (
  fontProjectRoot: string,
  folderPath: string
): Promise<{ name: string; success: boolean }> => {
  const font = await scrapeFolder(fontProjectRoot, folderPath);

  if (!font) {
    console.warn(`Skipping ${folderPath} because it's missing files`);
    return { name: folderPath, success: false };
  }

  await saveFontEntry(font);

  return { name: folderPath, success: true };
};

////////////////////////////////////
// FULL SCRIPT
////////////////////////////////////

const main = async (
  fontProjectRoot: string,
  topLevelFolders: string[],
  skipCount: number = 0
) => {
  // Get all subfolders immediately in the top level folders
  const subfolders: string[] = (
    await Promise.all(
      topLevelFolders.map(async (folder) => {
        const subfolders = await fs.readdir(
          path.join(__dirname, `${fontProjectRoot}/${folder}`)
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
  for (let i = skipCount; i < subfolders.length; i++) {
    const subfolder = subfolders[i];
    console.log(`Processing ${i + 1}/${subfolders.length}: ${subfolder}`);
    const result = await scrapeAndSaveFont(fontProjectRoot, subfolder);
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

const FONT_PROJECT_ROOT = "../../cloned-projects/fonts";

// To run this, uncomment the line below and then in Terminal: bun src/script.ts

// main(FONT_PROJECT_ROOT, ["ufl", "apache", "ofl"]);

// main(FONT_PROJECT_ROOT, ["ufl"]);
// main(FONT_PROJECT_ROOT, ["apache"]);
// main(FONT_PROJECT_ROOT, ["ofl"], 474);
