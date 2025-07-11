import { clientMistral } from "./connections/clientMistral";
import { generateSamplePng } from "./imagePrint";

const bufferToString = (buffer: Buffer) => {
  return buffer.toString("base64");
};

const PROMPT_TEXT = `I'm going to share an image of a font with you. Please analyze the style and essence of the font typeface. Return a list of twenty descriptors that best capture it. Descriptors can capture the style, typographical characteristics, likely usage, and any thing else that defines the font in the image. Respond with lower-case words only. Format your response as a JSON object with the following structure:

{
    "descriptors": ["descriptor1", "descriptor2", "descriptor3", ...]
}

No chit chat, just the JSON object.
`;
// Thank you https://models.dev for helping me select the model

const getDescriptors = async (base64Image: string): Promise<string[]> => {
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: PROMPT_TEXT,
        },
        {
          type: "image_url",
          imageUrl: "data:image/jpeg;base64," + base64Image,
        },
      ],
    },
  ];

  const response = await clientMistral.chat.complete({
    model: "pixtral-large-latest",
    messages: messages as any,
  });
  console.log(response.usage);

  const content = response.choices[0].message.content;

  if (!content || typeof content !== "string") return [];

  // Clean the content by removing markdown code blocks if present
  let cleanedContent = content.trim();
  if (cleanedContent.startsWith("```json")) {
    cleanedContent = cleanedContent
      .replace(/^```json\n/, "")
      .replace(/\n```$/, "");
  } else if (cleanedContent.startsWith("```")) {
    cleanedContent = cleanedContent.replace(/^```\n/, "").replace(/\n```$/, "");
  }

  const parsedContent = JSON.parse(cleanedContent);

  if (!parsedContent.descriptors) return [];

  return parsedContent.descriptors;
};

const testImageAssess = async () => {
  const buffer = await generateSamplePng(
    "https://github.com/google/fonts/raw/refs/heads/main/ofl/eduauvicwantarrows/EduAUVICWANTArrows%5Bwght%5D.ttf"
  );
  const descriptors = await getDescriptors(bufferToString(buffer));
  console.log(descriptors);
};

// await testImageAssess();
