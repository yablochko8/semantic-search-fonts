// import * as fs from "fs/promises";
// import { clientSupabase } from "./connections/clientSupabase";
// import { clientMistral } from "./connections/clientMistral";

// const COLORS_CSV_PATH = "src/colornames.csv";

// const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// const getEmbeddingMistral = async (
//   inputs: string[]
// ): Promise<MistralUpdate[]> => {
//   const response = await clientMistral.embeddings.create({
//     model: "mistral-embed",
//     inputs: inputs,
//   });

//   const outputs = response.data;

//   if (!outputs || outputs.length === 0) {
//     console.error(
//       "No embedding in response from mistral-embed, for query starting with: ",
//       inputs.slice(0, 20)
//     );
//     return [];
//   }
//   //   for (const output of outputs) {
//   //     console.log(
//   //       `Output ${output.index} is ${output.object} with length ${output.embedding?.length}`
//   //     );
//   //   }
//   const validOutputs = outputs.filter(
//     (output) => output.object === "embedding" && output.index !== undefined
//   );
//   return validOutputs.map((output) => ({
//     name: inputs[output.index!],
//     embedding_mistral_1024: JSON.stringify(output.embedding),
//   }));
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

// const getEmbedding = async (inputText: string): Promise<number[]> => {
//   const embedding = await clientOpenai.embeddings.create({
//     model: "text-embedding-3-small",
//     input: inputText,
//     encoding_format: "float", // We would potentially prefer a string here to match Supabase expectation, but OpenAI only supports "float" | "base64" | undefined
//   });
//   return embedding.data[0].embedding;
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
