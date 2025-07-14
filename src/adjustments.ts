import { clientSupabase } from "./connections/clientSupabase";
import { getEmbeddings, getSummaryText } from "./script";

/** Script that goes through every entry in the fonts table and creates a new "summary" (based on a new formula) and a fresh embedding based on that. */
const rewriteSummaries20250714 = async (startIndex: number = 0) => {
  const { data, error } = await clientSupabase
    .from("fonts")
    .select("*")
    .limit(5000);
  if (error) {
    console.error(error);
    return;
  }
  const sortedData = data.sort((a, b) => a.id - b.id);

  let index = startIndex;

  for (const font of sortedData.slice(startIndex)) {
    const fontBasics = {
      name: font.name,
      category: font.category,
      copyright: font.copyright,
      designer: font.designer,
      license: font.license,
      stroke: font.stroke,
      year: font.year,
    };
    const newSummary = getSummaryText(
      fontBasics,
      font.description_p1 || "",
      font.ai_descriptors || []
    );
    // console.log(newSummary);

    const newEmbedding = await getEmbeddings([newSummary])[0];

    const { error: updateError } = await clientSupabase
      .from("fonts")
      .update({
        summary_text_v2: newSummary,
        embedding_mistral_v2: newEmbedding,
      })
      .eq("id", font.id);

    if (updateError) {
      console.error(updateError);
    } else {
      console.log(
        `${index}/${sortedData.length}: Updated font ${font.name} (id: ${font.id})`
      );
    }
    index++;
  }
};

rewriteSummaries20250714(100);
