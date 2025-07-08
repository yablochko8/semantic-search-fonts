import * as fs from "fs/promises";
import { clientSupabase } from "./connections/clientSupabase";
import { clientMistral } from "./connections/clientMistral";
import path from "path";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  url: string | null; // Can be constructed from name, separated by +, e.g.: https://fonts.googleapis.com/css2?family=Family+Name&display=swap
  description_p1: string | null; // Take the first <p> element of DESCRIPTION.en_us.html
  ai_descriptors: string | null; // List of adjectives from multimodal AI assessment of visual
  summary_text_v1: string | null; // Combination of all relevant descriptive elements. This is what we will vectorize.
};

type FontDBReady = FontEnrichmentReady & {
  embedding_mistral_v1: string;
};

const getUrlFromName = (name: string) =>
  `https://fonts.googleapis.com/css2?family=${name.replace(/\s+/g, "+")}`;

const stripQuotes = (str: string | undefined) => str?.replace(/^"|"$/g, "");

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
  return p1;
};

/** Parent script to pull the others together. */
const scrapeFolder = async (folderPath: string) => {
  const pbMetadata = await fs.readFile(
    path.join(
      __dirname,
      `../../cloned-projects/fonts/${folderPath}/METADATA.pb`
    ),
    "utf8"
  );
  const fontBasics = parseFontBasicsFromPb(pbMetadata);
  console.log(fontBasics);
  const html = await fs.readFile(
    path.join(
      __dirname,
      `../../cloned-projects/fonts/${folderPath}/DESCRIPTION.en_us.html`
    ),
    "utf8"
  );
  const description_p1 = parseP1FromHtml(html);
  console.log(description_p1);
};

scrapeFolder("apache/aclonica");

// const scrapeFontData = async (folderPath: string): Promise<FontBasicInfo> => {
//   const files = await fs.readdir(folderPath);
//   const fontFiles = files.filter((file) => file.endsWith(".ttf"));
//   const metadataFile = files.find((file) => file.endsWith(".pb"));
//   if (!metadataFile || !fontFiles.length) {
//     throw new Error("No metadata file found");
//   }

//   const name = metadataFile.split(".")[0];

//   const metadata = await fs.readFile(
//     path.join(folderPath, metadataFile),
//     "utf8"
//   );

//   const parsedData = parsePbFileAsJson(metadata);

//   // Extract font information from the first font in the fonts array
//   const firstFont = parsedData.fonts?.[0] || {};

//   // Parse date if present
//   let published_at: Date | null = null;
//   if (parsedData.date_added) {
//     try {
//       published_at = new Date(parsedData.date_added);
//     } catch (e) {
//       published_at = null;
//     }
//   }

//   // Parse numeric values
//   const default_weight = firstFont.weight ? parseInt(firstFont.weight) : null;
//   const min_weight = default_weight;
//   const max_weight = default_weight;

//   // Determine if font has italic
//   const has_italic =
//     firstFont.style === "italic" ||
//     firstFont.full_name?.toLowerCase().includes("italic") ||
//     false;

//   return {
//     published_at,
//     name: parsedData.name || name,
//     designer: parsedData.designer || null,
//     license: parsedData.license || null,
//     copyright: firstFont.copyright || null,
//     category: parsedData.category || null,
//     stroke: parsedData.stroke || null,
//     subsets: parsedData.subsets || null,
//     default_weight,
//     filename: firstFont.filename || null,
//     additional_weights: null, // Would need to parse all fonts to determine this
//     min_weight,
//     max_weight,
//     is_variable: false, // Would need additional logic to determine this
//     has_italic,
//   };
// };

// const getColorNames = async (
//   filePath: string,
//   omitHeader: boolean = true,
//   startRow: number,
//   stopRow: number
// ): Promise<string[]> => {
//   const file = await fs.readFile(filePath, "utf8");
//   const rows = file.split("\n");
//   const contentRows = omitHeader ? rows.slice(1) : rows;
//   if (startRow >= contentRows.length) {
//     return [];
//   }
//   const adjustedStopRow = Math.min(stopRow, contentRows.length);
//   const selectedRows = contentRows.slice(startRow, adjustedStopRow);
//   return selectedRows.map((row) => row.split(",")[0]);
// };

// type MistralUpdate = {
//   name: string;
//   embedding_mistral_1024: string;
// };

// const saveEmbeddingsToDB = async (updates: MistralUpdate[]) => {
//   const { error } = await clientSupabase
//     .from("colors")
//     .upsert(updates, { onConflict: "name" });

//   if (error) {
//     console.error("Error:", error);
//   } else {
//     // console.log(updates.length, "embeddings saved to DB");
//   }
// };

// const updateCycle = async (startRow: number, stopRow: number) => {
//   const colorNames = await getColorNames(
//     "src/colornames.csv",
//     true,
//     startRow,
//     stopRow
//   );
//   if (colorNames.length === 0) {
//     return 0;
//   }
//   const updates = await getEmbeddingMistral(colorNames);
//   await saveEmbeddingsToDB(updates);
//   console.log(`Updated rows ${startRow} to ${stopRow}`);
//   return colorNames.length;
// };

// const runFullScript = async (
//   stepSize: number,
//   startRow: number = 0,
//   endRow: number = 35000
// ) => {
//   for (let i = startRow; i < endRow; i += stepSize) {
//     await updateCycle(i, i + stepSize);
//     await delay(500);
//   }
// };

// // runFullScript(50);

// ////////////////////
// // TEST FUNCTIONS
// ////////////////////

// // const updates = await getEmbeddingMistral([
// //   "18th Century Green",
// //   "24 Carrot",
// //   "24 Karat",
// // ]);
// // console.log(updates);
// // saveEmbeddingsToDB(updates);

// // addMistralEmbedding("18th Century Green");

// const testQuery = async (logging: boolean = false) => {
//   const startTime = performance.now();
//   const mistralUpdate = await getEmbeddingMistral([
//     "the one holy religious order of catholic france and poland",
//   ]);

//   const testEmbeddingString = mistralUpdate[0]?.embedding_mistral_1024;
//   const checkpoint1 = performance.now();

//   const { data, error } = await clientSupabase.rpc(
//     "search_embedding_mistral_1024",
//     {
//       query_embedding: testEmbeddingString,
//       match_count: 10,
//     }
//   );

//   const checkpoint2 = performance.now();

//   const endTime = performance.now();
//   const duration = Math.round(endTime - startTime);
//   const duration1 = Math.round(checkpoint1 - startTime);
//   const duration2 = Math.round(checkpoint2 - checkpoint1);

//   if (error) {
//     console.error("RPC error:", error.details);
//   } else {
//     if (logging) {
//       console.log("Matches:", data);
//       console.log(`Query took ${duration}ms`);
//       console.log(`Mistral call to get embedding: ${duration1}ms`);
//       console.log(`Supabase call to get results: ${duration2}ms`);
//     }
//   }
// };

// // testQuery(true);

// ////////////////////
// // PIPELINE FUNCTIONS
// ////////////////////

// const readColorRow = (rowText: string): RawColor => {
//   const [name, hex, isGoodName] = rowText.split(",");
//   return {
//     name,
//     hex,
//     is_good_name: isGoodName === "x",
//   };
// };

// type RawColor = {
//   name: string;
//   hex: string;
//   is_good_name: boolean;
// };

// const validRawColor = (rawColor: RawColor): boolean => {
//   const validName = rawColor.name.length > 0 && rawColor.name.length < 100;
//   const validHex = rawColor.hex.length === 7 && rawColor.hex.startsWith("#");
//   const validIsGoodName = typeof rawColor.is_good_name === "boolean";
//   return validName && validHex && validIsGoodName;
// };

// const prepColorEntry = async (rawColor: RawColor): Promise<PreppedColor> => {
//   if (!validRawColor(rawColor)) {
//     throw new Error(`Invalid raw color: ${JSON.stringify(rawColor)}`);
//   }
//   const embeddingSmall = await getEmbedding(rawColor.name);
//   const noHashHex = rawColor.hex.replace("#", "");
//   return {
//     ...rawColor,
//     hex: noHashHex,
//     embedding_openai_1536: JSON.stringify(embeddingSmall),
//   };
// };

// type PreppedColor = {
//   name: string;
//   hex: string;
//   is_good_name: boolean;
//   embedding_openai_1536: string;
// };

// const saveColorEntry = async (preppedColor: PreppedColor) => {
//   const { error } = await clientSupabase
//     .from("colors")
//     .upsert(preppedColor, { onConflict: "name" });
//   if (error) {
//     console.error(error);
//   } else {
//     console.log("Saved color entry", preppedColor.name);
//   }
// };

// ////////////////////
// // TEST FUNCTIONS
// ////////////////////

// const testEmbedding = async () => {
//   const embedding = await getEmbedding("red");
//   fs.writeFile("embedding.txt", JSON.stringify(embedding, null, 2), "utf8");
//   console.log(embedding.length);
// };

// // testEmbedding();

// const testSaveColorEntry = async () => {
//   const rawColor = {
//     name: "100 Mph",
//     hex: "#aaabbb",
//     // hex: "#c93f38",
//     is_good_name: true,
//   };
//   const preppedColor = await prepColorEntry(rawColor);
//   await saveColorEntry(preppedColor);
//   console.log("Test sequence complete.");
// };

// // testSaveColorEntry();

// const testQuery = async (logging: boolean = false) => {
//   const startTime = performance.now();
//   const testEmbedding = await getEmbedding("very fast car");

//   const checkpoint1 = performance.now();

//   const { data, error } = await clientSupabase.rpc(
//     "search_embedding_openai_1536",
//     {
//       query_embedding: JSON.stringify(testEmbedding),
//       match_count: 10,
//     }
//   );

//   const checkpoint2 = performance.now();

//   const endTime = performance.now();
//   const duration = Math.round(endTime - startTime);
//   const duration1 = Math.round(checkpoint1 - startTime);
//   const duration2 = Math.round(checkpoint2 - checkpoint1);

//   if (error) {
//     console.error("RPC error:", error);
//   } else {
//     if (logging) {
//       data.forEach((d, i) => {
//         console.log(`${i + 1}. ${d.name}, ${d.distance}`);
//       });
//       console.log(`Query took ${duration}ms`);
//       console.log(`OpenAI call to get embedding: ${duration1}ms`);
//       console.log(`Supabase call to get results: ${duration2}ms \n`);
//     }
//   }
// };

// // testQuery(true);

// ////////////////////
// // UTILITY FUNCTIONS + FULL SCRIPT
// ////////////////////

// const getColorRows = async (
//   filePath: string,
//   omitHeader: boolean = true,
//   maxRows?: number
// ): Promise<string[]> => {
//   const file = await fs.readFile(filePath, "utf8");
//   const rows = file.split("\n");
//   const contentRows = omitHeader ? rows.slice(1) : rows;
//   const returnRows = maxRows ? contentRows.slice(0, maxRows) : contentRows;
//   return returnRows;
// };

// const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// const runFullScript = async (maxRows?: number, startRow?: number) => {
//   const colorRows = await getColorRows(COLORS_CSV_PATH, true, maxRows);
//   console.log(`Processing ${colorRows.length} color entries...`);

//   for (let i = startRow || 0; i < colorRows.length; i++) {
//     const row = colorRows[i];
//     try {
//       const rawColor = readColorRow(row);
//       const preppedColor = await prepColorEntry(rawColor);
//       await saveColorEntry(preppedColor);

//       // Add delay every 10 entries to avoid overwhelming the APIs
//       if ((i + 1) % 10 === 0) {
//         console.log(
//           `Processed ${i + 1}/${colorRows.length} entries. Adding delay...`
//         );
//         await delay(200); // this (in ms) is a delay between every 10 entries
//       }
//     } catch (error) {
//       console.error(`Error processing row ${i + 1}:`, error);
//       // Continue with next entry instead of stopping the entire script
//     }
//   }

//   console.log("Script completed!");
// };

// // runFullScript(100000, 2570);
