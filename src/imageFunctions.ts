import { createCanvas, registerFont } from "canvas";
import { clientMistral } from "./connections/clientMistral";

/** Returns a PNG buffer of the text in the font */
export const generateSamplePng = async (
  ttfPath: string,
  printText: string = `The Quick Brown
  Fox jumps over 
   the lazy dog!`
): Promise<Buffer> => {
  // Register font with Canvas directly from local path
  registerFont(ttfPath, { family: "CustomFont" });
  const width = 512;
  const height = 256;
  const fontSize = 48;
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

  return buffer;
};

const bufferToString = (buffer: Buffer) => {
  return buffer.toString("base64");
};

/**
 * Takes a base64 image of a font and returns a list of descriptors.
 * Look up https://models.dev if changing the model name.
 */
export const getDescriptors = async (
  base64Image: string
): Promise<string[]> => {
  const MODEL = "pixtral-large-latest";
  const PROMPT_TEXT = `I'm going to share an image of a font with you. Please analyze the style and essence of the font typeface. Return a list of twenty descriptors that best capture it. Descriptors can capture the style, typographical characteristics, likely usage, and any thing else that defines the font in the image. Respond with lower-case words only. Format your response as a JSON object with the following structure:
  
  {
      "descriptors": ["descriptor1", "descriptor2", "descriptor3", ...]
  }
  
  No chit chat, just the JSON object.
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

const testImageAssess = async () => {
  const buffer = await generateSamplePng(
    "/Users/factions/dev/cloned-projects/fonts/ofl/akronim/Akronim-Regular.ttf"
  );
  const descriptors = await getDescriptors(bufferToString(buffer));
  console.log(descriptors);
};

// await testImageAssess();
