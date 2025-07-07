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

type MetadataPbFont = {
  weight: string | null;
  style: string | null;
  full_name: string | null;
  filename: string | null;
  copyright: string | null;
};

type MetadataPbInfo = {
  date_added: Date | null;
  name: string;
  designer: string | null;
  license: string | null;
  fonts: MetadataPbFont[];
  category: string | null;
  stroke: string | null;
  subsets: string[] | null;
};

type FontBasicInfo = {
  published_at: Date | null;
  name: string;
  designer: string | null;
  license: string | null;
  copyright: string | null;
  category: string | null;
  stroke: string | null;
  subsets: string[] | null;
  default_weight: number | null;
  filename: string | null;
  additional_weights: number[] | null;
  min_weight: number | null;
  max_weight: number | null;
  is_variable: boolean | null;
  has_italic: boolean | null;
};

// // Alternative cleaner parser using a more structured approach
// const parsePbFileStructured = (content: string): MetadataPbInfo => {
//   const result: MetadataPbInfo = {
//     date_added: null,
//     name: "",
//     designer: null,
//     license: null,
//     fonts: [],
//     category: null,
//     stroke: null,
//     subsets: null,
//   };

//   // Split into lines and filter empty ones
//   const lines = content.split("\n").filter((line) => line.trim());

//   let currentFont: MetadataPbFont | null = null;
//   let inFontsBlock = false;

//   for (const line of lines) {
//     const trimmed = line.trim();
//     if (!trimmed) continue;

//     // Handle block boundaries
//     if (trimmed === "fonts {") {
//       inFontsBlock = true;
//       currentFont = {
//         weight: null,
//         style: null,
//         full_name: null,
//         filename: null,
//         copyright: null,
//       };
//       continue;
//     }

//     if (trimmed === "}") {
//       if (inFontsBlock && currentFont) {
//         result.fonts.push(currentFont);
//         currentFont = null;
//       }
//       inFontsBlock = false;
//       continue;
//     }

//     // Parse key-value pairs
//     const colonIndex = trimmed.indexOf(":");
//     if (colonIndex === -1) continue;

//     const key = trimmed.substring(0, colonIndex).trim();
//     const value = trimmed
//       .substring(colonIndex + 1)
//       .trim()
//       .replace(/^"|"$/g, "");

//     if (inFontsBlock && currentFont) {
//       // Handle font properties
//       if (key in currentFont) {
//         (currentFont as any)[key] = value;
//       }
//     } else {
//       // Handle top-level properties
//       switch (key) {
//         case "name":
//           result.name = value;
//           break;
//         case "designer":
//           result.designer = value;
//           break;
//         case "license":
//           result.license = value;
//           break;
//         case "category":
//           result.category = value;
//           break;
//         case "stroke":
//           result.stroke = value;
//           break;
//         case "date_added":
//           result.date_added = new Date(value);
//           break;
//         case "subsets":
//           if (!result.subsets) result.subsets = [];
//           result.subsets.push(value);
//           break;
//       }
//     }
//   }

//   return result;
// };

// // Original parser (kept for comparison)
// const parsePbFile = (content: string): MetadataPbInfo => {
//   // Parse the protobuf-style metadata
//   const lines = content.split("\n").filter((line) => line.trim());
//   const result: MetadataPbInfo = {
//     date_added: null,
//     name: "",
//     designer: null,
//     license: null,
//     fonts: [],
//     category: null,
//     stroke: null,
//     subsets: null,
//   };

//   let currentFont: MetadataPbFont = {
//     weight: null,
//     style: null,
//     full_name: null,
//     filename: null,
//     copyright: null,
//   };
//   let inFontsBlock = false;

//   for (const line of lines) {
//     const trimmed = line.trim();
//     if (!trimmed) continue;

//     // Check if we're entering a fonts block
//     if (trimmed === "fonts {") {
//       inFontsBlock = true;
//       currentFont = {
//         weight: null,
//         style: null,
//         full_name: null,
//         filename: null,
//         copyright: null,
//       };
//       continue;
//     }

//     // Check if we're exiting a fonts block
//     if (trimmed === "}") {
//       if (inFontsBlock) {
//         inFontsBlock = false;
//         result.fonts.push(currentFont);
//       }
//       continue;
//     }

//     // Parse key-value pairs
//     const colonIndex = trimmed.indexOf(":");
//     if (colonIndex !== -1) {
//       const key = trimmed.substring(0, colonIndex).trim();
//       const value = trimmed.substring(colonIndex + 1).trim();

//       // Remove quotes if present
//       const cleanValue = value.replace(/^"|"$/g, "");

//       if (inFontsBlock) {
//         currentFont[key as keyof MetadataPbFont] = cleanValue;
//       } else {
//         // Handle repeated fields like subsets
//         if (key === "subsets") {
//           if (!result.subsets) result.subsets = [];
//           result.subsets.push(cleanValue);
//         } else {
//           (result as any)[key] = cleanValue;
//         }
//       }
//     }
//   }

//   return result;
// };

// Parse as JSON (simplest and safest)
const parsePbFileAsJson = (content: string): MetadataPbInfo => {
  // Parse the content line by line to build a proper JSON structure
  const lines = content.split("\n").filter((line) => line.trim());
  const result: any = {
    fonts: [],
    subsets: [],
  };

  let inFontsBlock = false;
  let currentFont: any = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Handle fonts block
    if (trimmed === "fonts {") {
      inFontsBlock = true;
      currentFont = {};
      continue;
    }

    if (trimmed === "}") {
      if (inFontsBlock && Object.keys(currentFont).length > 0) {
        result.fonts.push(currentFont);
        currentFont = {};
      }
      inFontsBlock = false;
      continue;
    }

    // Parse key-value pairs
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    const value = trimmed
      .substring(colonIndex + 1)
      .trim()
      .replace(/^"|"$/g, "");

    if (inFontsBlock) {
      // Handle font properties
      if (key === "weight") {
        currentFont[key] = parseInt(value);
      } else {
        currentFont[key] = value;
      }
    } else {
      // Handle top-level properties
      switch (key) {
        case "name":
        case "designer":
        case "license":
        case "category":
        case "stroke":
        case "classifications":
        case "date_added":
          result[key] = value;
          break;
        case "subsets":
          result.subsets.push(value);
          break;
      }
    }
  }

  // Convert to our expected format
  const parsed: MetadataPbInfo = {
    date_added: result.date_added ? new Date(result.date_added) : null,
    name: result.name || "",
    designer: result.designer || null,
    license: result.license || null,
    fonts: result.fonts || [],
    category: result.category || null,
    stroke: result.stroke || null,
    subsets: result.subsets.length > 0 ? result.subsets : null,
  };

  return parsed;
};

const testParsePbFileAsJson = async () => {
  const metadata = await fs.readFile(
    path.join(
      __dirname,
      "../../cloned-projects/fonts/apache/aclonica/METADATA.pb"
    ),
    "utf8"
  );
  const parsedData = await parsePbFileAsJson(metadata);
  console.log("complete");
  console.log(parsedData);
};

testParsePbFileAsJson();

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
