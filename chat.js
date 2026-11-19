import { GoogleGenAI, Type } from 'https://esm.run/@google/genai';
import { marked } from 'https://esm.run/marked';
import DOMPurify from 'https://esm.run/dompurify';

//import { use } from 'react';

let STORAGE_KEY = 'tally_chit_chats';
let title;
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

- chatTitle: Name the homework in 2 to 5 words based on the math topic (for example "Multiplying by 3s" or "Adding fractions"). Keep it short and friendly, with no quotes, emojis, or ending punctuation.
- chatIcon: Pick exactly one icon from the allowed list that best matches the main math topic of the homework: ➕ addition, ➖ subtraction, ✖️ multiplication, ➗ division, 🍕 fractions, 🔢 place value or counting, 📏 measurement, 🕒 time, 💰 money, 🔺 shapes and geometry, 📊 data and graphs, 🧩 word problems or patterns, ⭐ mixed topics or anything else. If the worksheet mixes topics, choose the one that appears most. Choose the icon once, in your first response, and never change it. Return only the single icon, with no extra text.

Math formatting rules:
- Write equations inline with single dollar signs, for example $\\frac{3}{4} \\times \\frac{3}{4} = ?$.
- Never use double dollar signs ($$).
- Also avoid using \n in your response just use Markdown line breaks (two spaces at the end of a line) to create new lines in your reply.

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
            chatTitle: {
                type: Type.STRING,
                description: "A short, friendly name for this homework, 4 to 7 words and under 30 characters, like 'Multiplying by 3s' or 'Fraction word problems'. No quotes, no emojis, no ending punctuation.",
            },

            chatIcon: {
                type: Type.STRING,
                format: "enum",
                enum: ["➕", "➖", "✖️", "➗", "🍕", "🔢", "📏", "🕒", "💰", "🔺", "📊", "🧩", "⭐"],
                description: "One icon from the list that best matches the main math topic of the homework. Chosen once and never changed.",
            },
            
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

        required: ["chatTitle", "problemSolved", "solvedProblems", "questionsCompleted", "totalQuestions", "currentProblem", "reply"],
        propertyOrdering: ["chatTitle", "problemSolved", "solvedProblems", "questionsCompleted", "totalQuestions", "currentProblem", "reply"],
    },
};

const triggerMathJax = () => {
    if (window.MathJax && window.MathJax.typesetPromise) {
        // Force MathJax to scan the chatbox DOM element element specifically
        window.MathJax.typesetPromise([chatbox]).then(() => {
            console.log("MathJax typesetting ran successfully!");
        }).catch((err) => {
            console.error("MathJax typesetting failed:", err);
        });
    } else {
        // Keep checking until the network download finishes
        setTimeout(triggerMathJax, 50);
    }
};

const mathExtension = {
    name: 'math',
    level: 'inline',
    start(src) { return src.indexOf('$'); },
    tokenizer(src) {
        const match = /^(?:\$\$(.*?)\$\$|\$(.*?)\$)/.exec(src);
        if (match) {
            return {
                type: 'math',
                raw: match[0],
                text: match[1] || match[2],
                isBlock: match[0].startsWith('$$')
            };
        }
    },
    renderer(token) { return token.raw; }
};

marked.use({ extensions: [mathExtension] });

const renderMarkdown = (text) => DOMPurify.sanitize(marked.parse(String(text ?? '')));

function newChatId() { return crypto.randomUUID(); }

function addItemToStorage(key, newItem){
    const existingData = localStorage.getItem(key);
    const itemsArray = existingData ? JSON.parse(existingData) : [];

    itemsArray.push(newItem);

    localStorage.setItem(key, itemsArray);
}

function loadChats(key){
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
}

function saveChat(chat){
    const chats = loadChats(STORAGE_KEY);
    chats[chat.id] = { ...chats[chat.id], ...chat, updatedAt: Date.now()};
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (e) {
        console.error(`Could not save chats (storage full?): ${e}`);
    }
}

function deleteChat(id){
    const chats = loadChats(STORAGE_KEY);
    delete chats[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

let chatSession = null;
const chatbox = document.getElementById("tutorChatBox");

const chatTitleEl = document.getElementById("chatTitle");

const savedResponse = sessionStorage.getItem('intialTutorResponse');
const originalQuestion = sessionStorage.getItem('userQuestion');
const originalImage = sessionStorage.getItem('userImage');
const rawOriginalImage = sessionStorage.getItem('rawUserImage');

let savedResponseData = null;
try { savedResponseData = JSON.parse(savedResponse); } catch (e) { console.warn(e); }

/*let originalImageData = null;
try { originalImageData = JSON.parse(originalImage); } catch (e) { console.warn(e); }*/

const originalImageData = JSON.parse(originalImage);

const originalQuestionBox = document.getElementById('originalQuestionBox');
const chatInput = document.getElementById('chatInput');
const userQuestionSubmit = document.getElementById('userQuestionSubmit');
const completedEl = document.getElementById('completed-count');
const totalEl = document.getElementById('total-count');
const progressBarContainer = document.getElementById('progress-bar-container');
const fillEl = document.getElementById('progress-fill');

chatInput.value = "";

function updateProgressUI(data) {
    if(!completedEl) return;
    if(!totalEl) return;
    if(!fillEl) return;
    
    if(data.questionsCompleted !== data.totalQuestions){
        completedEl.textContent = data.questionsCompleted + 1;
    }else{
        completedEl.textContent = data.questionsCompleted;
    }
    totalEl.textContent = data.totalQuestions;

    progressBarContainer.innerHTML = "";
    for(let i = 0; i < data.totalQuestions; i++){
        const segment = document.createElement('div');
        const num = i + 1;
        const solved = data.solvedProblems || [];

        segment.className = 'progress-segment';
        segment.style.width = `${100 / data.totalQuestions}%`;
        //segment.style.backgroundColor = '#DCE4F7';
        progressBarContainer.appendChild(segment);

        /*
        // OLD WAY TO CHECK FOR SOLVED QUESTIONS
        if(i < data.questionsCompleted){
            segment.style.backgroundColor = '#4B5BFF';
        }*/

        if(solved.includes(num)){
            segment.style.backgroundColor = '#4B5BFF';
        }else if(num === data.currentProblem){
            segment.style.backgroundColor = '#FFC83D';
        }else{
            segment.style.backgroundColor = '#DCE4F7';
        }
    }

    /*
    ANOTHER OLD WAY
    if(fillEl) {
        const pct = (data.questionsCompleted / data.totalQuestions) * 100;
        fillEl.style.width = `${28}%`;
    }*/
}

function appendMessageToUI(sender, data){
    let messageBubble = document.createElement('div');
    
    let cleantext = renderMarkdown(data.reply);
    
    if(sender === 'tutor'){
        messageBubble.innerHTML = `<strong>📐 Tutor:</strong> <br> ${cleantext}`;
        messageBubble.style = "width: fit-content";

        chatbox.appendChild(messageBubble);
    }else{
        let userMessageParent = document.createElement('div');
        userMessageParent.style.display = "flex";
        userMessageParent.style.flexDirection = "column";
        userMessageParent.style.alignItems = "flex-end";
        userMessageParent.style.margin = "20px";
        userMessageParent.style.gap = "12px";``
        userMessageParent.style.backgroundColor = "transparent";

        messageBubble.innerHTML = `<strong>👤 You:</strong> <br> ${cleantext}`;
        messageBubble.style.display = "flex";
        messageBubble.style.flexDirection = "column";
        messageBubble.style.margin = "20px";
        messageBubble.style.borderRadius = "20px 20px 6px 20px";
        //messageBubble.style.backgroundColor = "#2d96fb";
        messageBubble.style.backgroundColor = "#4B5BFF";
        messageBubble.style.color = "white";
        userMessageParent.appendChild(messageBubble);
        chatbox.appendChild(userMessageParent);
    }

    messageBubble.scrollIntoView({ behavior: "smooth" });
    messageBubble.style.width = "fit-content";
    messageBubble.style.boxSizing = "border-box";
    messageBubble.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";

    chatbox.scrollTop = chatbox.scrollHeight;

    updateProgressUI(data);

    triggerMathJax();
}

function displayOriginalImage(){
    const originalImage = document.createElement('img');
    originalQuestionBox.appendChild(originalImage);
    originalImage.alt = "Original image";
    originalImage.src = URL.createObjectURL(rawOriginalImage);

    originalImage.onload = () => {}

    originalImage.style.maxWidth = "100%";
    originalImage.style.height = "auto";
    console.log("Original image displayed.");
}

function restoreChat(chat){
    chatbox.innerHTML = '';
    
    /*const topLevelKeys = Object.keys(chat.history);
    const length = topLevelKeys.length;
    const lastObj = topLevelKeys[length - 1];
    const parts = lastObj[0];
    const data = parts[0];

    console.log(topLevelKeys);
    console.log(length);
    console.log(lastObj);
    console.log(parts);
    console.log(data);
    console.log(data.text);*/

    chat.history.forEach((entry) => {
        //const text = entry.parts[0].text;/*\]
        const text = entry.parts?.find((p) => typeof p.text === 'string')?.text;
        if(!text) return;
        if(entry.role === 'user'){
            const clean = text.replace(/^\[Worksheet state:.*?\]\s*/s, '');
            appendMessageToUI('user', { reply: clean });
        }else{
            let data;
            try { data = JSON.parse(text); } catch { data = { reply: text }; }
            if(typeof data.reply !== 'string') data = { ...data, reply: text };
            appendMessageToUI('tutor', data);
            updateProgressUI(data);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    originalQuestionBox.innerHTML = '';

    const id = new URLSearchParams(window.location.search).get('id');
    const chat = loadChats(STORAGE_KEY)[id];

    console.log(typeof chat.history[1].parts[0].text)
    const cleanHistory = chat.history.map((entry) => ({
        role: entry.role,
        parts: entry.parts.map((p) =>
            typeof p.text === 'object' ? { text: JSON.stringify(p.text) } : p
        ),
    }));

    chatbox.innerHTML = '';
    //originalQuestionBox.innerHTML = originalQuestionBox.innerHTML + marked.parse(originalQuestion);
    //appendMessageToUI('tutor', savedResponseData);

    if(!chat){
        console.log("Couldn't find that homework. Please go back and upload it again.");
        chatbox.textContent = "Couldn't find that homework. Please go back and upload it again.";
    }else{
        chatTitleEl.textContent = `📐 ${chat.title}`;

        chatSession = ai.chats.create({
            model: "models/gemini-3.6-flash",
            history: cleanHistory,
            config: config,
        })

        restoreChat(chat);
    }

    if(chatSession){
        //STORAGE_KEY = chatSession[2][1][0].chatTitle; just didnt work ig
        //STORAGE_KEY = chatSession.history[1].parts[0].chatTitle; lol why did I make this so complicated
        //STORAGE_KEY = savedResponseData.chatTitle; it did work just wrong variable oops
        //title = savedResponseData.chatTitle; // initally i set the variable to output an integer by accident lmao i was wondering why it outputted '1'
        title = chat.title; //the other one was also wrong var again lol
        //chatTitleEl.textContent = title;
        //console.log(STORAGE_KEY); nope wrong var again
        //console.log(title);
    }
});

async function handleStudentReply(message){
    const messageText = message.trim();
    const inputData = {"reply": messageText}; // Turn raw message input text into an object so it can be passed to appendMessageToUI
    if(!messageText || !chatSession) return;

    appendMessageToUI('user', inputData);
    chatInput.value = '';

    const id = new URLSearchParams(window.location.search).get('id');

    const loadingBubble = document.createElement('div');
    loadingBubble.id = 'tutor-loading-indicator';
    loadingBubble.innerHTML = '<em>Tutor is thinking... 📝</em>';
    chatbox.appendChild(loadingBubble);
    chatbox.scrollTop = chatbox.scrollHeight;

    try{
        const response = await chatSession.sendMessage({
            message: messageText
        });

        loadingBubble.remove();

        const data = JSON.parse(response.text)
        appendMessageToUI('tutor', data);

        saveChat({
            id,
            history: chatSession.getHistory(),
            solvedProblems: data.solvedProblems,
            questionsCompleted: data.questionsCompleted,
            totalQuestions: data.totalQuestions,
            currentProblem: data.currentProblem,
        });
    } catch (error) {
        console.error("Error sending chat reply message:", error);
        const loader = document.getElementById('tutor-loading-indicator');
        if (loader) loader.innerHTML = '<span style="color:red;">Error getting tutor response. Please try again.</span>';
    }
}

chatInput.addEventListener('keydown', (event) => {
    if(event.key === 'Enter' && !event.shiftKey){
        event.preventDefault();
        userQuestionSubmit.click();
        console.log("Enter key clicked!");
    }
});

userQuestionSubmit.addEventListener('click', (e) => {
    e.preventDefault();
    handleStudentReply(chatInput.value);
    console.log("Button Pressed!");
});
