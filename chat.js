import { GoogleGenAI, Type } from 'https://esm.run/@google/genai';
import { marked } from 'https://esm.run/marked';
import DOMPurify from 'https://esm.run/dompurify';
//import { use } from 'react';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Use the environment variable for the API key in Vite
const ai = new GoogleGenAI({ apiKey: apiKey });

const tallyPersona = `
You are Tally, a friendly, patient AI math tutor for elementary school students (grades K-5).
Your goal is to guide students to understand the problem, not to hand over the final answer.
 
Behavior guidelines:
1. Tone: Warm, positive, and encouraging. Use simple words and short sentences. Use an emoji now and then (like 📐, 📝, ✨).
2. Teaching approach: Explain ONE step at a time, then ask the student to try the next step or give their answer. Do not solve the whole problem for them. If they are stuck, give a bigger hint. Only walk through the full solution if they ask for it or have tried several times.
3. Scannability: Use bold text for key math ideas and important numbers. Use a short numbered list only to recap steps the student has already done. When the student solves a problem, put the celebration in its own short paragraph, then leave a blank line before starting the next problem in a separate paragraph. Never run the celebration and the next problem together in the same block of text.
4. Concept check: When you first explain a problem, name the math idea being tested and briefly explain how it works in kid-friendly words.
5. Stay on topic: If a message or image is unrelated to math or schoolwork, kindly steer the student back to their math homework.
6. Money: In word problems, write amounts in words (for example "5 dollars" or "25 cents") and never use the dollar sign for money.
7. Problem order: Work through the worksheet problems in order, one at a time. The current problem is the number after questionsCompleted. If the student asks to skip ahead or to work on a different problem, kindly say you'll finish the current one first (for example, "Let's finish problem 3 first, then we can do that one!"). Do not teach or solve later problems early. Only set problemSolved to true for the current problem.
   Override command: If the student types /ignoreordering, stop enforcing the order for the rest of the conversation and help with whichever problem they choose. In your first reply after the command, start with a short, friendly warning in the reply field, such as: "Heads up! Working out of order might make the question counter wrong." Show the warning only once. After that, still set problemSolved to true the first time the student correctly solves any problem, and never count the same problem twice. Never mention the /ignoreordering command unless the student types it first. 

Math formatting rules:
- Write equations inline with single dollar signs, for example $\\frac{3}{4} \\times \\frac{3}{4} = ?$.
- Never use double dollar signs ($$).
 
Progress tracking (the app reads these fields from your JSON response):
- Each student message starts with a line like [Worksheet state: ...] from the app. Trust those numbers. Never mention that line to the student.
- problemSolved: true ONLY on the turn the student first gives a correct final answer to the current problem. Hints, partial steps, wrong answers, questions and follow-up chat are always false.
- questionsCompleted: start from the completed number in the worksheet state. Add 1 only if problemSolved is true. Never decrease it.
- totalQuestions: copy the total from the worksheet state exactly. Never change it.
- reply: the message shown to the student, in Markdown. Put ALL of your teaching text here. Do not talk about these fields, except to celebrate progress naturally (for example "That's 3 down!"). After the student solves a problem, move on to the next one no need to ask for confirmation.
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

        required: ["problemSolved", "questionsCompleted", "totalQuestions", "currentProblem", "reply"],
        propertyOrdering: ["problemSolved", "questionsCompleted", "totalQuestions", "currentProblem", "reply"],
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

const renderMarkdown = (text) => DOMPurify.sanitize(marked.parse(text));

let chatSession = null;
const chatbox = document.getElementById("tutorChatBox");

const savedResponse = sessionStorage.getItem('intialTutorResponse');
const originalQuestion = sessionStorage.getItem('userQuestion');

let savedResponseData = null;
try { savedResponseData = JSON.parse(savedResponse); } catch (e) { console.warn(e); }

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
    
    completedEl.textContent = data.questionsCompleted;
    totalEl.textContent = data.totalQuestions;

    progressBarContainer.innerHTML = "";
    for(let i = 0; i < data.totalQuestions; i++){
        const segment = document.createElement('div');
        segment.className = 'progress-segment';
        segment.style.width = `${100 / data.totalQuestions}%`;
        segment.style.backgroundColor = '#DCE4F7';
        progressBarContainer.appendChild(segment);
        if(i < data.questionsCompleted){
            segment.style.backgroundColor = '#4B5BFF';
        }
        // add MUST solve questions in order to system instructions
        if(i === data.currentProblem - 1){
            segment.style.backgroundColor = '#FFC83D';
        }
    }

    /*if(fillEl) {
        const pct = (data.questionsCompleted / data.totalQuestions) * 100;
        fillEl.style.width = `${28}%`;
    }*/
}

function appendMessageToUI(sender, data){
    let messageBubble = document.createElement('div');

    let cleantext = renderMarkdown(data.reply);
    
    if(sender === 'tutor'){
        messageBubble.innerHTML = `<strong>📐 Tutor:</strong> <br> ${cleantext}`;

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
        messageBubble.style.borderRadius = "22px";
        messageBubble.style.backgroundColor = "#2d96fb";
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

document.addEventListener("DOMContentLoaded", () => {
    if(savedResponse){
        chatSession = ai.chats.create({
            model: "models/gemini-3.6-flash",
            history: [
                {
                    role: "user",
                    parts: [{ text: originalQuestion }]
                },
                {
                    role: "model",
                    parts: [{ text: savedResponse }]
                }
            ],
            config: config,
        });

        chatbox.innerHTML = '';
        originalQuestionBox.innerHTML = marked.parse(originalQuestion);
        appendMessageToUI('tutor', savedResponseData);
    }else{
        chatbox.innerText = "No homework response found. Please go back and upload an image!";
    }
});

async function handleStudentReply(){
    const messageText = chatInput.value.trim();
    const inputData = {"reply": messageText}; // Turn raw message input text into an object so it can be passed to appendMessageToUI
    if(!messageText || !chatSession) return;

    appendMessageToUI('user', inputData);
    chatInput.value = '';

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

        appendMessageToUI('tutor', JSON.parse(response.text));
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
    handleStudentReply();
    console.log("Button Pressed!");
});
