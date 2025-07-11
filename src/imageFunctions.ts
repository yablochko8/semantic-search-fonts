import { createCanvas, registerFont } from "canvas";
import { clientMistral } from "./connections/clientMistral";
import fs from "fs";

/** Returns a PNG buffer of the text in the font */
export const generateSamplePng = async (
  ttfPath: string,
  printText: string = `The Quick Brown
Fox jumps over 
the lazy dog!`
): Promise<Buffer> => {
  // Register font with Canvas directly from local path
  registerFont(ttfPath, { family: "CustomFont" });
  const width = 1024;
  const height = 512;
  const fontSize = 96;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Render canvas
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.font = `${fontSize}px "CustomFont"`;
  ctx.textBaseline = "top";
  ctx.fillText(printText, 20, 20);

  const buffer = canvas.toBuffer("image/png");

  // Save the image to a .png file in logs
  const fileName = ttfPath.split("/").pop()?.split(".")[0];
  console.log({ fileName });
  fs.writeFileSync(`./logs/img-${fileName}.png`, buffer);

  return buffer;
};

/**
 * Takes a base64 image of a font and returns a list of descriptors.
 * Look up https://models.dev if changing the model name.
 */
export const getDescriptors = async (
  base64Image: string
): Promise<string[]> => {
  const MODEL = "pixtral-large-latest";
  const PROMPT_TEXT = `You are an expert typographer. I'm going to share an image of a font typeface with you. Please analyze the style and essence of the font typeface. Return between 15 and 25 unique, lower-case, hyphen-separated descriptors ranked from most to least characteristic. Descriptors can capture the style, typographical characteristics, likely usage, and anything else that defines the typeface. Hyphenated words and very short phrases are also ok. Format your response as a JSON object with the following structure:
  
  {
      "descriptors": ["descriptor1", "descriptor2", "descriptor3", ...]
  }
  
  Raw JSON, no markdown, no chit chat.
  `;
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
    model: MODEL,
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

// const testImageAssess = async () => {
//   const buffer = await generateSamplePng(
//     "/Users/factions/dev/cloned-projects/fonts/ofl/akronim/Akronim-Regular.ttf"
//   );
//   const descriptors = await getDescriptors(bufferToString(buffer));
//   console.log(descriptors);
// };

// await testImageAssess();
