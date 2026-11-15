//import { analyzeImageGen } from "./app.js";
//import { analyzeImageInt } from "./app.js";

//import { config } from "dotenv";

import { GoogleGenAI, Type } from "https://esm.run/@google/genai";
//import { use } from "react";

//const apiKey = process.env.GEMINI_API_KEY; // Use the environment variable for the API key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Use the environment variable for the API key in Vite
const ai = new GoogleGenAI({ apiKey: apiKey });

const tallyPersona = `
You are Tally, a friendly, patient AI math tutor for elementary school students (grades K-5).
Your goal is to guide students to understand the problem, not to hand over the final answer.

Behavior guidelines:
1. Tone: Warm, positive, and encouraging. Use simple words and short sentences. Use an emoji now and then (like 📐, 📝, ✨).
2. Teaching approach: Explain ONE step at a time, then ask the student to try the next step or give their answer. Do not solve the whole problem for them. If they are stuck, give a bigger hint. Only walk through the full solution if they ask for it or have tried several times.
3. Scannability and spacing: Use bold text for key math ideas and important numbers. Use a short numbered list only to recap steps the student has already done. When the student solves a problem, write the celebration as its own short paragraph (for example, "Great job! ✨ That's 3 down!"), then leave a blank line and start the next problem in a separate paragraph. Never run the celebration and the next problem together in one block of text.
4. Concept check: When you first explain a problem, name the math idea being tested and briefly explain how it works in kid-friendly words.
5. Stay on topic: If a message or image is unrelated to math or schoolwork, kindly steer the student back to their math homework.
6. Money: In word problems, write amounts in words (for example "5 dollars" or "25 cents") and never use the dollar sign for money.
7. Problem order: By default, work through the worksheet problems in order, one at a time. The current problem is the lowest-numbered problem that is not yet solved. If the student asks to skip ahead or to work on a different problem, kindly say you'll finish the current one first (for example, "Let's finish problem 3 first, then we can do that one!"). Do not teach or solve later problems early.
   Override command: If the student types /ignoreordering, stop enforcing the order for the rest of the conversation, even in later messages. Check earlier messages in the conversation to see whether the command was already used. After the command, help with whichever problem the student chooses, in any order. In your first reply after the command, start with a short, friendly warning, such as: "Heads up! Working out of order might make the question counter less accurate." Show this warning only once. Never mention the /ignoreordering command unless the student types it first.
8. After the student solves a problem: celebrate briefly, then move on to the next unsolved problem without asking for confirmation. If the order rule is off, move on to the lowest-numbered unsolved problem unless the student picks another one.

Math formatting rules:
- Write equations inline with single dollar signs, for example $\\frac{3}{4} \\times \\frac{3}{4} = ?$.
- Never use double dollar signs ($$).

Progress tracking (the app reads these fields from your JSON response, and you keep them up to date yourself):
- Your most recent previous reply in the conversation holds the current solvedProblems and totalQuestions. Start from those values. If there is no previous reply with these fields, start with solvedProblems as an empty list and set totalQuestions to the number of problems on the worksheet.
- problemSolved: true ONLY on the turn the student first gives a correct final answer to a problem. Hints, partial steps, wrong answers, questions, and follow-up chat are always false.
- solvedProblems: the full list of worksheet problem numbers the student has correctly solved so far, in ascending order. When problemSolved is true, add the number of the problem they just solved. Never remove a number, never add the same number twice, and never add a number the student has not solved correctly. This works the same whether or not the order rule is on.
- questionsCompleted: exactly the number of items in solvedProblems.
- totalQuestions: the total number of problems on the worksheet. Never change it once it is set.
- reply: the message shown to the student, in Markdown. Put ALL of your teaching text here. Do not talk about these fields, except to celebrate progress naturally (for example "That's 3 down!").
`;

const config = {
    systemInstruction: tallyPersona,
    temperature: 0.4,
    responseMimeType: "application/json",
    responseSchema: {
        type: Type.OBJECT,
        properties: {
            problemSolved: {
                type: Type.BOOLEAN,
                description: "True only if the student's latest message is a correct final answer to the current problem.",
            },

            solvedProblems: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Every worksheet problem number the student has correctly solved so far, in ascending order, with no duplicates. Copy the list from your previous reply and add the newly solved problem number if problemSolved is true. Never remove numbers.",
            },
            
            questionsCompleted: {
                type: Type.INTEGER,
                description: "Number of worksheet problems fully solved so far, including this turn if problemSolved is true.",
            },

            totalQuestions: {
                type: Type.INTEGER,
                description: "Total number of problems on the worksheet, as given in the worksheet state.",
            },

            currentProblem: {
                type: Type.INTEGER,
                description: "The number of the current problem on the worksheet.",
            },

            reply: {
                type: Type.STRING,
                description: "What Tally says to the student. Short, friendly, one step at a time.",
            },
        },

        required: ["problemSolved", "solvedProblems", "questionsCompleted", "totalQuestions", "currentProblem", "reply"],
        propertyOrdering: ["problemSolved", "solvedProblems", "questionsCompleted", "totalQuestions", "currentProblem", "reply"],
    },
};

const day = new Date();
const dayElement = document.getElementById("day-label");
let savedName = localStorage.getItem("userName");
const nameSpan = document.getElementById("name-span");
const nameInput = document.getElementById("name-input");
const saveNameButton = document.getElementById("save-name-button");
const photoButton = document.getElementById("photo-button");
const typeButton = document.getElementById("type-button");
const photoPopupOverlay = document.querySelector(".photoPopupOverlay");
const imageInput = document.getElementById("imageInput");
const submitImageButton = document.getElementById("submitImageButton");
const closeImageButton = document.getElementById("closeImageButton");
const primaryTextInput = document.getElementById("primaryTextInput");
const primaryOutput = document.getElementById("primary-output");
const textPopupOverlay = document.querySelector(".textPopupOverlay");
const submitTextButton = document.getElementById("submitTextButton");
const closeTextButton = document.getElementById("closeTextButton");
const secondaryTextInput = document.getElementById("secondaryTextInput");
const secondaryOutput = document.getElementById("secondary-output");

dayElement.textContent = day.toLocaleDateString("en-US", {weekday: "long"});
imageInput.value = "";
primaryTextInput.value = "";
secondaryTextInput.value = "";

if(savedName){
    nameSpan.textContent = `${savedName}!`;
}

nameInput.value = savedName || "";

nameInput.addEventListener("keydown", function(event){
    if(event.key === 'Enter'){
        event.preventDefault();
        saveNameButton.click();
    }
});

saveNameButton.addEventListener("click", function() {
    const enteredName = nameInput.value.trim();
    if (!enteredName) return;
    localStorage.setItem("userName", enteredName);
    nameSpan.textContent = `${enteredName}!`;
});

photoButton.addEventListener("click", () => {
    photoPopupOverlay.classList.add("show");
});

typeButton.addEventListener("click", () => {
    textPopupOverlay.classList.add("show");
});

// Converts raw browser file object into the exact documentation structure
function fileToGenerativePart(file){
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // 1. Safety check added
            if (!reader.result) {
                reject("Failed to read file contents.");
                return;
            }

            // 2. Swapped split() for regex replace (Fixes the "Unable to process input image" crash)
            const base64DataString = reader.result.replace(/^data:image\/[a-z]+;base64,/, "");

            // 3. Added a console log so you can confirm it is working
            console.log("Base64 string preview:", base64DataString.substring(0, 30) + "...");

            resolve({
                inlineData: {
                    data: base64DataString,
                    mimeType: file.type
                }
            });
        };

        reader.onerror = () => reject("File Reading Error. Please try again.");
        reader.readAsDataURL(file);
    });
}

submitImageButton.addEventListener("click", async (e) => {
    e.preventDefault();

    const rawFile = imageInput.files[0];
    const userQuestion = primaryTextInput.value.trim() || "Please help me break down this problem step-by-step.";

    if(imageInput.files.length === 0){
        alert("Please select an image file.");
        console.log("No image file selected.");
        primaryOutput.innerHTML = "Please select an image file.";
        return;
    }

    try {
        const imagePayload = await fileToGenerativePart(rawFile);

        console.log("Uploading file via native Gemini Files service...");

        const uploadedFile = await ai.files.upload({
            file: rawFile
        });

        console.log("Upload complete! File reference URI:", uploadedFile.uri);

        console.log("Sending image and question to math tutor...");

        const response = await ai.models.generateContent({
            model: "models/gemini-3.6-flash",
            contents: [
                {
                    parts: [
                        { text: userQuestion},
                        {
                            fileData: {
                                fileUri: uploadedFile.uri,
                                mimeType: uploadedFile.mimeType
                            }
                        }
                    ]
                }
            ],
            
            config: config,
        });

        
        const data = JSON.parse(response.text); // Convert the response text to a JavaScript object but not necessary because it is converted back to JSON before storing it.

        console.log(`Full Tally Response: ${response.text}`);

        primaryOutput.innerHTML = "Success! Converting response from JSON...";
        console.log("Success! Converting response from JSON...");
        
        sessionStorage.setItem('userQuestion', userQuestion);
        console.log(`Success! Stored question...`);
        primaryOutput.innerHTML = "Success! Stored question...";
        //console.log(`Success! Stored question: ${sessionStorage.getItem('userQuestion')}`);
        sessionStorage.setItem('intialTutorResponse', JSON.stringify(data));
        console.log(`Success! Stored response...`);
        primaryOutput.innerHTML = "Success! Stored response...";
        //console.log(`Success! Stored response: ${sessionStorage.getItem('intialTutorResponse')}`);
        
        console.log("Success! Stored question and response...");
        primaryOutput.innerHTML = "Success! Stored question and response...";
        console.log(`Attempting to store uploaded image and raw image...`);
        primaryOutput.innerHTML = "Attempting to store uploaded image and raw image...";

        try {
            console.log(`Success! Storing image...`);
            primaryOutput.innerHTML = "Success! Storing image...";
            sessionStorage.setItem('userImage', JSON.stringify(uploadedFile));
            sessionStorage.setItem('rawUserImage', rawFile);
            //console.log(`Success! Stored image: ${sessionStorage.getItem('userImage')}`);
            console.log(`Success! Stored image...`);
            primaryOutput.innerHTML = "Success! Stored image...";
        } catch (error) {
            console.error(`Error storing image: ${error}`);
        }

        primaryOutput.innerHTML = "Success! Redirecting to chat...";
        console.log("Success! Redirecting to chat...");

        window.location.href = "chat.html";
    } catch (error) {
        console.error(`Error occurred while communicating with Tally: ${error}`);
        primaryOutput.innerHTML = `Error occurred while communicating with Tally. ${error}`;
    }
});

submitTextButton.addEventListener("click", async (e) => {
    e.preventDefault();

    const userQuestion = secondaryTextInput.value.trim();

    if(!userQuestion){
        alert("Please enter a question.");
        console.log("No question entered.");
        secondaryOutput.innerHTML = "Please enter a question.";
        return;
    }

    try {
        console.log("Sending question to math tutor...");

        const response = await ai.models.generateContent({
            model: "models/gemini-3.6-flash",
            contents: [
                {
                    parts: [
                        { text: userQuestion}
                    ]
                }
            ],

            config: config,
        });

        const data = JSON.parse(response.text); // Convert the response text to a JavaScript object but not necessary because it is converted back to JSON before storing it.

        console.log(`Full Tally Response: ${response.text}`);

        secondaryOutput.innerHTML = "Success! Converting response from JSON...";
        console.log("Success! Converting response from JSON...");

        sessionStorage.setItem('intialTutorResponse', JSON.stringify(data));
        sessionStorage.setItem('userQuestion', userQuestion);

        console.log("Success! Stored question and response...");
        secondaryOutput.innerHTML = "Success! Stored question and response...";

        secondaryOutput.innerHTML = "Success! Redirecting to chat...";

        window.location.href = "chat.html";
    } catch (error) {
        console.error(`Error communicating with Tally: ${error}`);
        secondaryOutput.innerHTML = `Error occurred while communicating with Tally. ${error}`;
    }
});

closeImageButton.addEventListener("click", () => {
    photoPopupOverlay.classList.remove("show");
});

closeTextButton.addEventListener("click", () => {
    textPopupOverlay.classList.remove("show");
});
