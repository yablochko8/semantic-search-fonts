import * as fs from "fs/promises";
import { clientSupabase } from "./connections/clientSupabase";
import { clientMistral } from "./connections/clientMistral";
import path from "path";

////////////////////////////////////
// Small Utility Functions
////////////////////////////////////

const getUrlFromName = (name: string) =>
  `https://fonts.googleapis.com/css2?family=${name.replace(/\s+/g, "+")}`;

const stripQuotes = (str: string | undefined) => str?.replace(/^"|"$/g, "");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  url: string | null; // Can be constructed from name, separated by +, e.g.: https://fonts.googleapis.com/css2?family=Family+Name&display=swap
  description_p1: string | null; // Take the first <p> element of DESCRIPTION.en_us.html
  ai_descriptors: string[]; // List of adjectives from multimodal AI assessment of visual
  summary_text_v1: string | null; // Combination of all relevant descriptive elements. This is what we will vectorize.
};

type FontDBReady = FontEnrichmentReady & {
  embedding_mistral_v1: string;
};

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
  return p1;
};

const getAiDescriptors = async (fontUrl: string): Promise<string[]> => {
  await delay(100);
  // TODO: This function will send an image of of the typeface to an AI model and ask for it to be characterized.

  return [];
};

const getSummaryText = (
  fontBasics: FontBasics,
  p1Description: string,
  descriptors: string[]
): string => {
  // Create an array that combines all the categories, stroke values, and descriptors.
  const allAdjectives = [
    ...new Set([
      ...(fontBasics.category?.split(" ") || []),
      ...(fontBasics.stroke?.split(" ") || []),
      ...descriptors,
    ]),
  ].filter((adjective) => adjective.length > 0);

  const allAdjectivesString = allAdjectives.join(", ");

  const { name, year, designer } = fontBasics;

  return `
  ${name} is a ${allAdjectivesString} font designed by ${designer} in ${year}.
  ${p1Description}
  `;
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

////////////////////////////////////
// Combination Functions
////////////////////////////////////

/** Parent script to pull the others together. */
const scrapeFolder = async (
  folderPath: string
): Promise<FontDBReady | null> => {
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

  const html = await fs.readFile(
    path.join(
      __dirname,
      `../../cloned-projects/fonts/${folderPath}/DESCRIPTION.en_us.html`
    ),
    "utf8"
  );
  const description_p1 = parseP1FromHtml(html);
  console.log(description_p1);

  const ai_descriptors = await getAiDescriptors(url);

  const summary_text_v1 = getSummaryText(
    fontBasics,
    description_p1 || "",
    ai_descriptors
  );

  const embeddings = await getEmbeddings([summary_text_v1]);

  const embedding_mistral_v1 = embeddings[0];

  const fontDBReady: FontDBReady = {
    ...fontBasics,
    url,
    description_p1,
    ai_descriptors,
    summary_text_v1,
    embedding_mistral_v1,
  };

  console.log(fontDBReady);

  return fontDBReady;
};

scrapeFolder("apache/aclonica");
