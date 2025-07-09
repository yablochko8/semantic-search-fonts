import { clientMistral } from "./connections/clientMistral";
import { clientSupabase } from "./connections/clientSupabase";

const getSingleEmbedding = async (input: string): Promise<string> => {
  const response = await clientMistral.embeddings.create({
    model: "mistral-embed",
    inputs: [input],
  });

  const outputs = response.data;

  if (!outputs || outputs.length !== 1) {
    console.error("Failed to get embedding, ref: ", input.slice(0, 20));
    return "";
  }

  const output = outputs[0];
  if (output.object !== "embedding" || output.index === undefined) {
    return "";
  }

  return JSON.stringify(output.embedding);
};

const testQuery = async () => {
  const stringEmbedding = await getSingleEmbedding("punk eleganza");
  const { data, error } = await clientSupabase.rpc(
    "search_embedding_mistral_v1",
    {
      query_embedding: stringEmbedding,
      match_count: 10,
    }
  );

  console.log(data);
  console.log(error);
};

// To run this, uncomment the line below and then in Terminal: bun src/test.ts

// await testQuery();
