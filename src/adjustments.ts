import { clientSupabase } from "./connections/clientSupabase";
import {
  getEmbeddings,
  getSummaryTextAdvanced,
  getSummaryTextSimple,
} from "./script";

/** Script that goes through every entry in the fonts table and creates a new "summary" (based on a new formula) and a fresh embedding based on that. */
const rewriteSummaries20250714 = async (
  batchIndex: number = 0,
  indexWithinBatch: number = 0
) => {
  const { data, error } = await clientSupabase
    .from("fonts")
    .select("*")
    .range(batchIndex * 1000, (batchIndex + 1) * 1000);
  if (error) {
    console.error(error);
    return;
  }
  const sortedData = data.sort((a, b) => a.id - b.id);

  let trackingIndex = indexWithinBatch;

  for (const font of sortedData.slice(indexWithinBatch)) {
    const fontBasics = {
      name: font.name,
      category: font.category,
      copyright: font.copyright,
      designer: font.designer,
      license: font.license,
      stroke: font.stroke,
      year: font.year,
    };
    const newSummarySimple = getSummaryTextSimple(
      fontBasics,
      font.description_p1 || "",
      font.ai_descriptors || []
    );
    console.log("=====");
    console.log(newSummarySimple);
    const newSummaryAdvanced = await getSummaryTextAdvanced(newSummarySimple);
    console.log("=====");
    console.log(newSummaryAdvanced);
    console.log("=====");

    const embeddings = await getEmbeddings([newSummaryAdvanced]);
    const newEmbedding = embeddings[0];

    const { error: updateError } = await clientSupabase
      .from("fonts")
      .update({
        summary_text_v2: newSummaryAdvanced,
        embedding_mistral_v2: newEmbedding,
      })
      .eq("id", font.id);

    if (updateError) {
      console.error(updateError);
    } else {
      console.log(
        `${trackingIndex + 1}/${sortedData.length}: Updated font ${
          font.name
        } (id: ${font.id})`
      );
    }
    trackingIndex++;
  }
};

// Run these one at a time!
// bun --watch src/adjustments.ts
// rewriteSummaries20250714(0);
// rewriteSummaries20250714(1);
// rewriteSummaries20250714(2);
// etc
