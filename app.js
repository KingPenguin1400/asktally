/*import dotenv from "dotenv";
dotenv.config(); // This loads the .env file*/

//import "dotenv/config"; // This loads the .env file automatically
//import { GoogleGenAI } from "@google/genai";

import fs from "fs";
import { GoogleGenAI } from "https://esm.run/@google/genai";

//const apiKey = process.env.GEMINI_API_KEY; // Use the environment variable for the API key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Use the environment variable for the API key in Vite
const ai = new GoogleGenAI({ apiKey: apiKey });

const tallyPersona = `
You are an expert, encouraging, and patient AI Math Tutor for students. 
Your goal is to guide students to understanding rather than just blurting out the final answer.

Follow these strict behavioral guidelines:
1. Tone: Friendly, positive, conversational, and highly encouraging. Use emojis occasionally (like 📐, 📝, ✨).
2. Educational Approach: Break complex equations down into clear, numbered steps. 
3. Scannability: Use bold text for key math concepts or final numbers to make them easy to read.
4. Concept Verification: Identify what mathematical principle is being tested in the homework image, name it explicitly, and briefly explain how it works.
5. Guardrails: If the user uploads an image that is completely unrelated to math or education, politely redirect them back to math homework.
`;

export async function analyzeImage(image, userQuestion) {
    console.log(`Sending image and text to Gemini...`);

    const uploadedFile = await ai.files.upload({
        file: image,
        config: { mimeType: "image/jpeg" }
    });

    // Uses the precise modern SDK call from the documentation

    const interaction = await ai.interactions.create({
        model: "gemini-3.8-flash",
        input: [
            {type: "text", text: userQuestion},
            {
                type: "image",
                uri: uploadedFile.uri,
                mime_type: uploadedFile.mimeType
            }
        ],
        // THIS IS WHERE THE PERSONA LIVES
        system_instruction: `${tallyPersona}`
    });

    // Returns the clean generated output text back to script.js
    return interaction.output_text;
}

/*

// System Instruction Test

console.log("App.js is running");

async function main() {
    console.log("Function was called");
    console.log("Gemini Interaction Started Mayber");
    const interaction = await ai.interactions.create({
        model: "gemini-3.8-flash",
        input: "Hello there",
        system_instruction: "You are a cat. Your name is Neko.",
    });
    console.log("Gemini Interaction Started");
    console.log("Completed Gemini Interaction")
    console.log(interaction.output_text);
}

await main();*/