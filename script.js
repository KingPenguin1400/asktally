import { analyzeImage } from "./app.js";
import fs from "fs";

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

dayElement.textContent = day.toLocaleDateString("en-US", {weekday: "long"});

if(savedName){
    nameSpan.textContent = `${savedName}!`;
}

saveNameButton.addEventListener("click", function() {
    const enteredName = nameInput.value.trim();
    if (!enteredName) return;
    localStorage.setItem("userName", enteredName);
    nameSpan.textContent = `${enteredName}!`;
});

photoButton.addEventListener("click", () => {
    photoPopupOverlay.classList.add("show");
});

// Converts raw browser file object into the exact documentation structure
function fileToGenerativePart(file){
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Strips out the "data:image/png;base64," prefix to grab the raw base64 string
            const base64DataString = reader.result.split(',')[1];

            // Matches the documentation's object payload exactly
            resolve({
                type: "image",
                data: base64DataString,
                mime_type: file.type
            });
        };
        reader.readAsDataURL(file);
    });
}

submitImageButton.addEventListener("click", async () => {
    const rawFile = imageInput.files[0];
    const question = primaryTextInput.value || "Please look at this math homework problem.";

    if(imageInput.files.length === 0){
        alert("Please select an image file.");
        console.log("No image file selected.");
        return;
    }

    try {
        console.log("Sending raw image and question to math tutor...");

        const resultText = await analyzeImage(rawFile, question);

        console.log(`Tally Response: ${resultText}`);
    } catch (error) {
        console.error(`Error communicating with Tally: ${error}`);
    }
});

closeImageButton.addEventListener("click", () => {
    photoPopupOverlay.classList.remove("show");
});
