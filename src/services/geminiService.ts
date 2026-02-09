
import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { GeneratedContent } from "@/types.ts";
import { constructPrompt } from "@/src/utils/promptTemplates.ts";
import { fileToBase64, pcmToWav, extractAudioBlob } from "@/src/utils/audioHelpers.ts";
import { ComponentRegistry } from "@/src/animationComponents/registry";
import type { ComponentSelection, AnimationComponent, ComponentParams } from "@/src/animationComponents/types";

/* Import component library to register all components */
import '@/src/animationComponents/library/index';

export const validateGeminiConnection = async (apiKey: string, modelName: string): Promise<boolean> => {
  if (!apiKey) return false;
  const ai = new GoogleGenAI({ apiKey });
  try {
    // Simple verification call
    await ai.models.generateContent({
        model: modelName,
        contents: "Test connection.",
    });
    return true;
  } catch (e) {
    console.error("API Key Validation Failed:", e);
    return false;
  }
};

// Helper to convert seconds to SRT timestamp format (00:00:00,000)
const formatSRTTimestamp = (seconds: number): string => {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const iso = date.toISOString();
  // ISO is YYYY-MM-DDTHH:mm:ss.sssZ
  // We need HH:mm:ss,sss
  const timePart = iso.substr(11, 12).replace('.', ',');
  return timePart;
};

export const generateSRT = async (
  mediaFile: File | Blob,
  apiKey: string,
  subtitleLanguage: 'english' | 'hinglish' = 'english'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  // OPTIMIZATION: If input is a video, extract the audio track first.
  // Sending pure Audio (WAV) to Gemini significantly improves timestamp accuracy compared to processing video frames.
  let fileToProcess = mediaFile;
  let mimeType = mediaFile.type;

  if (mediaFile.type.startsWith('video/')) {
    try {
        console.log("Extracting audio from video for better transcription accuracy...");
        const audioBlob = await extractAudioBlob(mediaFile as File);
        fileToProcess = audioBlob;
        mimeType = 'audio/wav';
    } catch (e) {
        console.warn("Audio extraction failed, falling back to video processing.", e);
    }
  }

  const base64Data = await fileToBase64(fileToProcess);

  // Use Flash for speed and multimodal capability
  const model = 'gemini-2.5-flash';

  // Define a strict schema for subtitles to prevent formatting hallucinations
  const subtitleSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        start: { type: Type.NUMBER, description: "Start time in seconds (e.g. 1.5). Must be precise." },
        end: { type: Type.NUMBER, description: "End time in seconds (e.g. 3.0). Must be precise." },
        text: { type: Type.STRING, description: "The spoken text" }
      },
      required: ["start", "end", "text"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/mp3',
              data: base64Data
            }
          },
          {
            text: `You are a professional captioning assistant.
            Extract the transcript from this audio with EXTREME TIMING PRECISION.

            ${subtitleLanguage === 'hinglish' ? `
            LANGUAGE FORMAT: HINGLISH (Romanized Hindi)
            - Write Hindi words using ENGLISH/LATIN alphabet (Roman script)
            - DO NOT translate to English - keep the Hindi words but write them phonetically in English letters
            - Example: "तुम कैसे हो" should be "tum kaise ho" (NOT "how are you")
            - Example: "मैं ठीक हूं" should be "main theek hoon" (NOT "I am fine")
            - Use standard Hinglish transliteration conventions
            ` : `
            LANGUAGE FORMAT: ENGLISH
            - Transcribe in clear English
            `}

            CRITICAL RULES:
            1. Timestamps must align perfectly with the audio waveform.
            2. Break text into naturally spoken short chunks (max 3-5 words per chunk).
            3. Do NOT hallucinate. Only transcribe what is clearly spoken.
            4. If there is silence, do not create segments.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: subtitleSchema
      }
    });

    const segments = JSON.parse(response.text || "[]");

    // Convert JSON segments to SRT String
    let srtOutput = "";
    segments.forEach((seg: any, index: number) => {
       const id = index + 1;
       const startTime = formatSRTTimestamp(seg.start);
       const endTime = formatSRTTimestamp(seg.end);
       const text = seg.text.trim();

       srtOutput += `${id}\n${startTime} --> ${endTime}\n${text}\n\n`;
    });

    return srtOutput.trim();
  } catch (error: any) {
    console.error("SRT Generation Error:", error);
    // Propagate the actual error message from the API so the UI can display "Payload too large" etc.
    throw new Error(error.message || "Failed to auto-generate subtitles.");
  }
};

export const generateTTS = async (
  text: string,
  voice: 'male' | 'female',
  apiKey: string
): Promise<Blob> => {
  const ai = new GoogleGenAI({ apiKey });
  // Correct model for TTS
  const model = 'gemini-2.5-flash-preview-tts';

  // Map to Gemini Voices
  // Female: Kore, Male: Charon
  const voiceName = voice === 'female' ? 'Kore' : 'Charon';

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    // Convert Base64 to Uint8Array (PCM Data)
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Wrap raw PCM in WAV header so browsers can play/download it
    return pcmToWav(bytes, 24000);
  } catch (error: any) {
    console.error("TTS Generation Error:", error);
    throw new Error(`Failed to generate speech: ${error.message || "Unknown error"}`);
  }
};

export const generateReelContent = async (
  srtText: string,
  topicContext: string,
  apiKey: string,
  modelName: string,
  existingHtml?: string,
  existingLayout?: any,
  isAudioOnly: boolean = false
): Promise<GeneratedContent> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please enter it in the settings.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a world-class Motion Graphics Designer and Creative Technologist for high-retention social media video (Reels/TikTok).
    Your goal is to generate or refine a visual composition that transforms a raw transcript into an immersive, "edutainment" style video experience.

    ### 📱 CRITICAL: MOBILE PHONE DISPLAY CONSTRAINTS
    **THE HTML RENDERS IN A MOBILE PHONE-SIZED CONTAINER:**
    - Container: 405px width × 432px height (top 60% of 720px phone screen)
    - This is SMALL! Think mobile-first, compact design
    - **NO HORIZONTAL OVERFLOW** - Everything must fit within 405px width
    - **NO VERTICAL OVERFLOW** - Keep within 432px height (60% of 720px)
    
    **SIZE RULES (CRITICAL):**
    1. **Max widths**: Containers should be **70-80vw MAX** (never 90vw or 100vw!)
    2. **Font sizes**: Keep SMALL
       - Titles: **1.5em - 2em MAX**
       - Body text: **0.9em - 1.1em**
       - Labels: **0.7em - 0.8em**
    3. **Padding/Margins**: Use **1-2em** (not 3-4em!)
    4. **Test mentally**: "Will this fit in 405px × 432px?" If no, make it SMALLER!

    ### DESIGN SYSTEM & AESTHETIC
    You must output high-fidelity, polished UI/UX animation.
    1. **Color Palette**: Use CSS variables. Dark background (#050505), Neon accents.
       - \`:root { --bg-deep: #050505; --primary: #00f3ff; --success: #00ff9d; --warning: #ffd700; --danger: #ff0055; --white: #ffffff; }\`
    2. **Typography**: Mix 'Oswald' (Headers) and 'JetBrains Mono' (Data/Code).
       - **KEEP SIZES SMALL** - phone display is only 405px wide!
    3. **Animation Style (GSAP)**: No static slides. Things must pulse, float, or glow.
    4. **Simplicity**: Use color-coded boxes instead of labels when possible. Not every element needs text.

    ### JAVASCRIPT ROBUSTNESS RULES (CRITICAL)
    To prevent "Uncaught TypeError" and "SyntaxError" loops, you MUST strictly follow these patterns:

    1. **NEVER use \`element.children\` or \`document.getElementsBy...\` for looping.**
       These return HTMLCollections which crash on \`.forEach\`.

    2. **ALWAYS use \`gsap.utils.toArray(selector)\` for selection.**
       - ❌ WRONG: \`document.querySelectorAll('.box').forEach(...)\`
       - ✅ CORRECT: \`gsap.utils.toArray('.box').forEach(...)\`

    3. **NEVER use unquoted values in GSAP objects.**
       - ❌ WRONG: \`{ width: 100% }\` (Crash)
       - ❌ WRONG: \`{ duration: 0.5s }\` (Crash)
       - ✅ CORRECT: \`{ width: '100%', duration: 0.5 }\`

    4. **Use the injected \`ReelHelper\` if needed:**
       - The environment has a helper: \`ReelHelper.createGrid(container, items)\`.

    ### OUTPUT DELIVERABLES
    1. **HTML5 Animation**: A single, self-contained string (HTML/CSS/JS).
    2. **Layout Timeline**: A JSON array defining how the screen is split.

    ### HTML/ANIMATION REQUIREMENTS
    - **Library**: YOU MUST USE **GSAP (GreenSock)** with plugins. Include:
      <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
    - **Structure**: Create multiple "Scenes" (#s1, #s2, #s3).
    - **Synchronization**: The JS **MUST** control the timeline via 'message' event.
      - \`window.addEventListener('message', (e) => { if(e.data.type==='timeupdate') tl.seek(e.data.time); ... });\`

    ### CODING RULES
    - **NO SINGLE-LINE COMMENTS**: Use \`/* */\` block comments only.
    - **USE TEMPLATE LITERALS**: Backticks (\`) for all strings.
    - **NO OVERFLOW**: Everything must fit within 405px width × 432px height (60% of phone screen)
    - **COMPACT DESIGN**: Use smaller containers, tighter spacing, mobile-first thinking
    
    ### VISUAL SIMPLIFICATION TIPS
    - **Color-code instead of labeling**: Use different colored boxes (cyan, green, yellow, red) to show different components
    - **Not every box needs text**: Sometimes just a colored rectangle with an icon or symbol is enough
    - **Use shapes wisely**: Circles, squares, arrows - let color and position tell the story
    - **Example**: Instead of "Database" text in a box, use a green square. Instead of "API" text, use a cyan circle.
    
    ### LAYOUT CONFIG REQUIREMENTS
    - 'layoutMode': 'split', 'full-video', 'full-html'.
    - 'splitRatio': e.g., 0.60 (HTML takes top 60% = 432px height on 720px phone screen).

    ${isAudioOnly ? `
    ### AUDIO ONLY MODE
    - FORCE 'layoutMode': 'full-html' FOR ALL SCENES.
    - The visuals must be continuously active.
    ` : ''}
  `;

  let prompt = constructPrompt(topicContext, srtText);

  if (existingHtml && existingLayout) {
      prompt = `
      I have an existing HTML animation and Layout Config that I want to REFINE.

      *** CRITICAL FIX INSTRUCTIONS ***
      1. FIX: "Uncaught SyntaxError: identifier starts immediately after numeric literal" (Quote your CSS units!)
      2. FIX: "TypeError: x.forEach is not a function" (Use gsap.utils.toArray)

      *** CURRENT HTML ***
      ${existingHtml}

      *** CURRENT LAYOUT JSON ***
      ${JSON.stringify(existingLayout)}

      *** REFINEMENT INSTRUCTIONS ***
      ${topicContext || "Fix syntax errors and improve smooth animation."}

      *** TRANSCRIPT CONTEXT ***
      ${srtText}

      TASK: Return the FULLY UPDATED HTML and Layout JSON.
      `;
  }

  const layoutStepSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      startTime: { type: Type.NUMBER },
      endTime: { type: Type.NUMBER },
      layoutMode: { type: Type.STRING, enum: ['split', 'full-video', 'full-html', 'pip-html'] },
      splitRatio: { type: Type.NUMBER },
      captionPosition: { type: Type.STRING, enum: ['top', 'bottom', 'center', 'hidden'] },
      note: { type: Type.STRING }
    },
    required: ["startTime", "endTime", "layoutMode", "splitRatio", "captionPosition"]
  };

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      html: { type: Type.STRING },
      layoutConfig: { type: Type.ARRAY, items: layoutStepSchema },
      reasoning: { type: Type.STRING }
    },
    required: ["html", "layoutConfig"]
  };

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const result = JSON.parse(response.text || "{}");

    // --- REEL HELPER API INJECTION ---
    // Instead of just a shim, we inject a robust helper library to prevent common AI mistakes.
    if (result.html) {
        const reelHelperScript = `<script>
            /* REEL COMPOSER STANDARD LIBRARY */
            (function() {
                // 1. Polyfill Collection Methods (Shim)
                if (typeof HTMLCollection !== 'undefined' && !HTMLCollection.prototype.forEach) {
                    HTMLCollection.prototype.forEach = Array.prototype.forEach;
                }
                if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
                    NodeList.prototype.forEach = Array.prototype.forEach;
                }

                // 2. Global Helper Object (ReelHelper)
                window.ReelHelper = {
                    // Safe selection that always returns an Array (never null, never HTMLCollection)
                    select: function(selector, context) {
                        if (!window.gsap) return [];
                        return gsap.utils.toArray(selector, context);
                    },
                    // Safe cleanup
                    clear: function(element) {
                        if(element) element.innerHTML = '';
                    }
                };

                console.log("Reel Composer: Standard Library Loaded");
            })();
        </script>`;

        // Inject immediately after <head> for earliest execution
        result.html = result.html.replace('<head>', '<head>' + reelHelperScript);
    }
    // -----------------------------

    return result as GeneratedContent;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    let message = "Failed to generate content.";
    if (error.message?.includes("404")) message = "Model not found. Please check API availability.";
    else if (error.message?.includes("400")) message = "Bad Request. The prompt might be too long.";
    else if (error.message?.includes("429")) message = "Too many requests. Please wait a moment.";
    else if (error.message?.includes("API key")) message = "Invalid API Key.";
    throw new Error(message);
  }
};

/**
 * Regenerate animation for a specific subtitle segment
 */
export const regenerateSegment = async (
  segmentText: string,
  segmentStartTime: number,
  segmentEndTime: number,
  customPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ html: string; layoutStep: any }> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a Motion Graphics Designer creating a SHORT animation for a single subtitle segment.
    
    ### RULES
    1. Generate HTML/CSS/GSAP for THIS SPECIFIC SEGMENT ONLY
    2. Animation MUST start at time 0 in the timeline (will be adjusted by parent)
    3. Keep it SIMPLE and FOCUSED for this one piece of text
    4. Use GSAP for animations
    5. Use dark backgrounds and neon colors
    6. NO SINGLE-LINE COMMENTS - use /* */ only
    7. Use gsap.utils.toArray() for selections
    
    ### OUTPUT
    Return ONLY the HTML for this segment's scene and ONE layout config step.
  `;

  const prompt = `
    Generate animation for this specific subtitle segment:
    
    Text: "${segmentText}"
    Duration: ${(segmentEndTime - segmentStartTime).toFixed(2)} seconds
    
    User's creative direction: ${customPrompt || "Create an engaging animation that matches the content"}
    
    Create a SINGLE scene (HTML) with GSAP animations that:
    1. Starts at timeline position 0
    2. Lasts for the exact duration
    3. Visually represents the text content
    4. Follows the user's direction
    
    The HTML should be a complete standalone animation (with <html>, <head>, <style>, <body>, <script>).
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      html: { type: Type.STRING, description: "Complete HTML for this segment" },
      layoutMode: { type: Type.STRING, enum: ['split', 'full-video', 'full-html', 'pip-html'] },
      splitRatio: { type: Type.NUMBER, description: "0-1, how much space for HTML" },
      captionPosition: { type: Type.STRING, enum: ['top', 'bottom', 'center', 'hidden'] },
      reasoning: { type: Type.STRING }
    },
    required: ["html", "layoutMode", "splitRatio", "captionPosition"]
  };

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const result = JSON.parse(response.text || "{}");

    // Create layout step with actual times
    const layoutStep = {
      startTime: segmentStartTime,
      endTime: segmentEndTime,
      layoutMode: result.layoutMode,
      splitRatio: result.splitRatio,
      captionPosition: result.captionPosition,
      note: segmentText.substring(0, 50)
    };

    return {
      html: result.html,
      layoutStep
    };
  } catch (error: any) {
    console.error("Segment regeneration error:", error);
    throw new Error(`Failed to regenerate segment: ${error.message}`);
  }
};

/**
 * NEW: Auto-generate video description from subtitles
 * Helps users create a good description that improves animation quality
 */
export const generateVideoDescription = async (
  srtText: string,
  apiKey: string,
  modelName: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are an expert content analyzer who creates concise, informative descriptions for videos.
Your task is to analyze subtitle text and generate a clear, detailed description that will help an AI create better animations.

### GOAL:
Create a description that includes:
1. **Main topic** - What is the video about?
2. **Key concepts** - What specific things are covered?
3. **Relationships** - How do things connect? (e.g., "X flows to Y")
4. **Structure** - Any comparisons, processes, or architecture?
5. **Animation opportunities** - What can be visualized? (arrows, boxes, flows, comparisons, diagrams)

### INSTRUCTIONS:
- Be specific about technical terms, component names, and relationships
- **EXPLICITLY mention data flow** if present ("A sends to B", "flows from X to Y", "connects via arrows")
- Include comparisons if any ("X vs Y can be shown side-by-side")
- Mention architecture/system design ("system has 3 components: A, B, C that connect")
- **Suggest visualizations**: "can be animated with boxes and arrows", "comparison layout", "step-by-step flow"
- Keep it concise (3-5 sentences)
- Focus on visual elements that can be animated and HOW they relate

### EXAMPLES:

**Subtitles**: "Welcome to Kafka tutorial. Kafka is a message broker. Producers send messages. Consumers read messages."
**Good Description**: "Kafka message streaming tutorial: producers send messages to Kafka topics (can animate with boxes and arrows showing data flow), and consumers read from those topics. The system has 3 main components (Producer → Kafka → Consumer) that can be visualized with connecting arrows showing message flow."

**Subtitles**: "React hooks are powerful. useState manages state. useEffect handles side effects."
**Good Description**: "React hooks explanation covering useState for state management and useEffect for handling side effects. Can show comparison layout with two hooks side-by-side, demonstrating how they work together in functional components with animated examples."

**Subtitles**: "Instagram scales to billions. Uses CDN. Caches images. Serves from edge locations."
**Good Description**: "Instagram's scaling architecture with 4-step data flow: images are uploaded → processed by CDN → cached → served from edge locations to billions of users. Can animate with boxes connected by arrows showing the journey from upload to delivery across the infrastructure."

**Subtitles**: "HTTPS secures connections. Client connects to server. TLS certificate is exchanged. Data is encrypted with public key."
**Good Description**: "HTTPS connection process with step-by-step flow: client establishes connection → server sends TLS certificate → client verifies it → public key encrypts data → server decrypts with private key. Can animate as vertical flow with 5 boxes connected by arrows, showing secure handshake and data encryption process."

### OUTPUT:
Return ONLY the description text, no markdown, no extra formatting.
  `;

  const prompt = `
### SUBTITLE TEXT:
${srtText}

### TASK:
Analyze the subtitles above and generate a clear, detailed description (3-5 sentences) that will help create better animations.
Focus on: main topic, key concepts, relationships/flow, structure, AND animation opportunities.
EXPLICITLY mention: data flow connections, components/boxes, arrows between elements, comparisons, step-by-step processes.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    const description = response.text?.trim() || "";
    return description;
  } catch (error: any) {
    console.error("Video description generation error:", error);
    throw new Error(`Failed to generate description: ${error.message}`);
  }
};

/**
 * NEW: Optimize subtitles into animation-friendly segments
 * LLM Call 1: Analyzes the content and creates better segments for animation
 */
export const optimizeSegmentsForAnimation = async (
  srtText: string,
  topicContext: string,
  apiKey: string,
  modelName: string
): Promise<Array<{
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  animationType: string;
  originalSubtitles: number[];
}>> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are an expert in video animation segmentation and motion graphics timing.
Your task is to analyze subtitle timing and content, then create OPTIMIZED, SENTENCE-AWARE segments for animation purposes.

### OPTIMIZATION GOALS:
1. **Sentence-Aware Grouping**: Combine subtitles to form COMPLETE SENTENCES or complete thoughts
   - Never split in the middle of a sentence
   - Group 2-4 subtitles if they form one coherent sentence
   - Each segment should be a self-contained idea

2. **Identify Animation Types**: Analyze the MEANING of each segment to choose the right visual:
   - **Look for data flow**: "X sends to Y", "flows from A to B", "transmitted"
   - **Look for comparisons**: "vs", "versus", "compared to", "difference"
   - **Look for processes**: "first, then, finally", "steps", "process"
   - **Look for questions**: Starts with "What", "How", "Why"

3. **Natural Timing**: Ensure segments have enough duration for animations (2-3s minimum)
   - Combine very short subtitles (<1s) with neighbors
   - Keep segments under 8 seconds for focused animations

4. **Logical Breaks**: Split at natural pause points (end of sentences, topic changes)
   - Break when topic shifts
   - Break at punctuation (. ! ?)
   - Keep related concepts together

### ANIMATION TYPE CATEGORIES (Choose based on segment meaning):

**🔄 "data_flow"** - Use when segment describes data/information moving between systems:
  - Indicators: "sends to", "flows from X to Y", "transmits", "receives", "goes to"
  - Example: "Kafka sends messages to the processing service"
  - Visual: Boxes with animated arrows between them

**⚖️ "comparison"** - Use when segment contrasts two or more things:
  - Indicators: "vs", "versus", "compared to", "difference between", "A or B"
  - Example: "SQL databases versus NoSQL databases"
  - Visual: Side-by-side or stacked boxes

**📝 "list_items"** - Use when segment enumerates multiple points:
  - Indicators: "first, second", "and", multiple items listed, "includes"
  - Example: "The system has three parts: API, cache, and database"
  - Visual: Vertical list with stagger animation

**🔷 "diagram"** - Use when segment describes system architecture or components:
  - Indicators: "architecture", "system", "consists of", "components"
  - Example: "The architecture has four layers"
  - Visual: Connected boxes showing structure

**❓ "question_answer"** - Use when segment poses a question:
  - Indicators: Starts with "What", "How", "Why", "When", "Where", "?"
  - Example: "How does caching improve performance?"
  - Visual: Question at top, answer below

**✨ "emphasis"** - Use when segment highlights a key point:
  - Indicators: "important", "key", "critical", "remember", "note that"
  - Example: "The most important factor is latency"
  - Visual: Large centered text with effects

**🎯 "conclusion"** - Use for final summary or wrap-up:
  - Indicators: "in conclusion", "finally", "to summarize", "overall"
  - Visual: Summary with decorative elements

**🌊 "transition"** - Use for bridges between topics:
  - Indicators: "but", "however", "next", "now", "moving on"
  - Visual: Simple morphing text

**💬 "text_focus"** - Use for simple statements without special structure:
  - Default choice when no other type fits
  - Visual: Kinetic typography with movement

### OUTPUT REQUIREMENTS:
Return a JSON array of optimized segments. Each segment should:
- Have a unique id (starting from 1)
- Span one or more original subtitles
- Include the combined text
- Specify the animation type
- List which original subtitle indices it combines (0-indexed)

Example: If subtitle 0 (0-2s) says "Do you know" and subtitle 1 (2-4s) says "quantum physics?", 
combine them into one segment: { id: 1, startTime: 0, endTime: 4, text: "Do you know quantum physics?", animationType: "question_answer", originalSubtitles: [0, 1] }
  `;

  const segmentSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.NUMBER },
      startTime: { type: Type.NUMBER },
      endTime: { type: Type.NUMBER },
      text: { type: Type.STRING },
      animationType: { type: Type.STRING },
      originalSubtitles: { 
        type: Type.ARRAY, 
        items: { type: Type.NUMBER } 
      }
    },
    required: ["id", "startTime", "endTime", "text", "animationType", "originalSubtitles"]
  };

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      segments: {
        type: Type.ARRAY,
        items: segmentSchema
      }
    },
    required: ["segments"]
  };

  const prompt = `
### CONTEXT
Topic: ${topicContext}

### ORIGINAL SUBTITLES (SRT FORMAT)
${srtText}

### TASK
Analyze the above subtitles and create SENTENCE-AWARE, optimized animation segments.

**STEP-BY-STEP PROCESS:**

1. **Read for Complete Sentences**: 
   - Combine subtitles that form complete sentences
   - Don't break mid-sentence

2. **Identify Data Flow Patterns** (CRITICAL):
   - Look for: "X sends to Y", "flows from A to B", "goes to", "transmits"
   - Mark these as "data_flow" type
   - Example: "Data flows from the API to Kafka to the database" → data_flow

3. **Identify Structure Patterns**:
   - Comparisons: "X vs Y", "compared to" → comparison
   - Lists: "first, second, third" or multiple items → list_items
   - Questions: "What...", "How..." → question_answer
   - Architecture: "system has X components" → diagram

4. **Check Timing**:
   - Minimum 2 seconds per segment
   - Maximum 8 seconds per segment
   - Combine very short subtitles

5. **Natural Breaks**:
   - Break at periods (.)
   - Break at topic changes
   - Keep related ideas together

**KEY REQUIREMENT**: If the segment describes data/information moving between things, USE "data_flow" type!

Return the optimized segments array with proper animation types.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result.segments || [];
  } catch (error: any) {
    console.error("Segment optimization error:", error);
    throw new Error(`Failed to optimize segments: ${error.message}`);
  }
};

/**
 * NEW: Generate HTML for a specific animation segment
 * LLM Call 2: Creates targeted HTML/GSAP code for one segment
 */
export const generateSegmentHTML = async (
  segment: {
    startTime: number;
    endTime: number;
    text: string;
    animationType: string;
  },
  customPrompt: string,
  apiKey: string,
  modelName: string
): Promise<{ html: string; layoutMode: string; splitRatio: number }> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are a specialist Motion Graphics Designer focused on creating HIGH-QUALITY segment-specific animations.

### YOUR MISSION:
Create a self-contained HTML/CSS/GSAP animation ONLY for this specific time segment.
The animation should be POLISHED and PURPOSEFUL - not generic.

### DESIGN RULES:
1. **Color Palette**: Dark background (#050505), neon accents (#00f3ff, #00ff9d, #ffd700, #ff0055)
2. **Typography**: 'Oswald' for headers, 'JetBrains Mono' for data/code
3. **Animation Style**: Smooth, intentional GSAP animations - NO static content

### ANIMATION TYPE-SPECIFIC GUIDANCE:
- **data_flow**: Use arrows, connecting lines, glowing paths, sequential reveals
- **comparison**: Split screen, side-by-side, highlight differences with color
- **emphasis**: Scale, pulse, glow effects, spotlight focus
- **list_items**: Staggered entrance, numbered/bulleted reveals
- **diagram**: Build complexity step-by-step, use geometric shapes
- **text_focus**: Kinetic typography, word-by-word reveals, text effects

### TECHNICAL REQUIREMENTS:
1. **Include GSAP CDN with plugins**:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
   <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
2. **Time Sync**: Listen to postMessage for time updates:
   \`\`\`javascript
   let tl = gsap.timeline({ paused: true });
   window.addEventListener('message', (e) => {
     if (e.data.type === 'timeupdate') {
       const relativeTime = e.data.time - ${segment.startTime};
       if (relativeTime >= 0 && relativeTime <= ${segment.endTime - segment.startTime}) {
         tl.seek(relativeTime);
       }
     }
   });
   \`\`\`
3. **Use gsap.utils.toArray()** for selections - NEVER use .children or getElementsBy*
4. **Quote all CSS values** in GSAP objects: { width: '100%', duration: 0.5 }
5. **Block comments only**: Use /* */ not //

### OUTPUT:
- Fully self-contained HTML (HTML + <style> + <script>)
- Layout recommendation (layoutMode and splitRatio)
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      html: { type: Type.STRING },
      layoutMode: { 
        type: Type.STRING,
        enum: ['split', 'full-video', 'full-html']
      },
      splitRatio: { type: Type.NUMBER },
      captionPosition: { type: Type.STRING }
    },
    required: ["html", "layoutMode", "splitRatio"]
  };

  const prompt = `
### SEGMENT DETAILS
Duration: ${segment.startTime}s - ${segment.endTime}s (${segment.endTime - segment.startTime}s total)
Text: "${segment.text}"
Animation Type: ${segment.animationType}

### CUSTOM INSTRUCTIONS
${customPrompt || 'Create an engaging animation that matches the segment type.'}

### TASK
Generate HTML/CSS/GSAP code SPECIFICALLY for this ${segment.endTime - segment.startTime}-second segment.
Make it visually striking and perfectly timed to the duration.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    // Inject ReelHelper if not present
    if (result.html && !result.html.includes('ReelHelper')) {
      const reelHelperScript = `<script>
/* REEL HELPER LIBRARY */
(function() {
  if (typeof HTMLCollection !== 'undefined' && !HTMLCollection.prototype.forEach) {
    HTMLCollection.prototype.forEach = Array.prototype.forEach;
  }
  if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }
  window.ReelHelper = {
    select: function(selector, context) {
      if (!window.gsap) return [];
      return gsap.utils.toArray(selector, context);
    },
    clear: function(element) {
      if(element) element.innerHTML = '';
    }
  };
})();
</script>`;
      result.html = result.html.replace('</head>', `${reelHelperScript}</head>`);
    }

    return {
      html: result.html,
      layoutMode: result.layoutMode || 'split',
      splitRatio: result.splitRatio || 0.6
    };
  } catch (error: any) {
    console.error("Segment HTML generation error:", error);
    throw new Error(`Failed to generate segment HTML: ${error.message}`);
  }
};

/**
 * NEW: Generate HTML for ALL segments in a single LLM call (BATCH)
 * Much faster and cheaper than individual calls
 */
export const generateAllSegmentHTMLs = async (
  segments: Array<{
    id: number;
    startTime: number;
    endTime: number;
    text: string;
    animationType: string;
  }>,
  overallContext: string,
  apiKey: string,
  modelName: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
🎬 **ANIMATIONS ARE THE PRIMARY FEATURE** 🎬
You are creating an ANIMATED VIDEO EXPERIENCE. Animations must be VISIBLE, MOVING, and SYNCED to video time.

⚠️ **CRITICAL REQUIREMENTS - ANIMATIONS MUST WORK AND BE TIMED CORRECTLY:**

**TIMING SYNCHRONIZATION (MOST CRITICAL):**
1. **Each segment has startTime and endTime** - These are the EXACT video timestamps
2. **Create scenes array EXACTLY matching segments** - Example format:
   const scenes = [ { id: 's1', start: 0.672, end: 3.001 }, { id: 's2', start: 3.522, end: 6.871 } ];
   MUST use actual segment times, not placeholders!
3. **Scene visibility**: Show scene when (time >= scene.start AND time < scene.end)
4. **Timeline seeking**: Calculate relative time = currentTime - scene.start
5. **Seek timeline**: timeline.seek(relativeTime) makes animations play at correct moment!

**ANIMATION REQUIREMENTS:**
1. **CREATE PAUSED TIMELINES**: Every animation function MUST return gsap.timeline({ paused: true })
2. **RETURN THE TIMELINE**: Each animateS1(), animateS2(), etc. MUST return the timeline
3. **STORE IN sceneTimelines**: Initialize with sceneTimelines.s1 = animateS1();
4. **SEEK ON TIME UPDATE**: timeline.seek(relativeTime) in the message handler (see example below)
5. **VISIBLE ELEMENTS**: Ensure elements are visible from the start (not display:none by default)
6. **TEST WITH console.log**: Add debugging to confirm timelines are created and seeked

**WHY TIMING MATTERS (Example):**
- Video plays at time 5.2s
- Segment 2 starts at 3.522s, ends at 6.871s
- Scene 2 should be visible (5.2 >= 3.522 AND 5.2 < 6.871) - YES
- Relative time = 5.2 - 3.522 = 1.678s
- Timeline seeks to 1.678s position, animation plays at correct point!

🚨 **EVERY SEGMENT MUST HAVE VISIBLE ANIMATIONS - NO EXCEPTIONS:**
1. **NEVER create empty segments** - Even simple content needs animation
2. **COMPLETE visual elements**: If showing data flow, create BOXES + ARROWS (not just arrows floating in space!)
3. **Boxes MUST be drawn**: Use divs with borders, backgrounds, text - make them visible!
4. **Every segment needs movement**: Scale, slide, fade, rotate - something MUST animate
5. **Minimum per segment**: At least 2-3 visual elements that move/appear
6. **If content seems simple**: Add emphasis animation (scale, glow, pulse) at minimum

### YOUR MISSION:
Generate ONE final, complete HTML document that contains MOVING, DYNAMIC animations for ALL video segments.
Each segment should be in its own scene <div> with time-based visibility control.
ANIMATIONS MUST ACTUALLY PLAY AND BE VISIBLE!

⚠️ IMPORTANT: SKIP CLOSING/OUTRO SEGMENTS
- DO NOT generate HTML for segments containing personal info like "I'm [Name]", "Follow for more", "Subscribe"
- These closing statements will be handled by a separate end screen component
- Only generate HTML for the main content segments, NOT personal outros or calls to action

🚨 **ABSOLUTE REQUIREMENTS - NO COMPROMISE:**
- **EVERY segment MUST have animations** - No empty segments allowed
- **Data flow MUST show boxes + arrows** - Never arrows alone floating in space
- **Boxes MUST be visible** - Use backgrounds, borders, text content
- **Something MUST move** - Scale, slide, fade, rotate - every segment needs motion
- **Minimum quality bar**: 2-3 visual elements, 2-3 animation steps, 0.8s+ duration per segment

### 💡 HEIGHT FLEXIBILITY:
**You have FULL freedom to use the screen height as needed for great animations!**
- Create animations that need space - don't constrain yourself
- The user can adjust the video size via layout controls if needed
- Think: "What animations would tell this story best?" not "How can I squeeze this into 60vh?"
- Use vertical space effectively to show processes, flows, and relationships
- If you need 80vh or even 90vh for a great animation, use it!

### 🚨 CRITICAL CONSTRAINT - MOBILE PHONE DISPLAY (405px × 720px):
⚠️ **The HTML will be rendered in a PHONE-SIZED CONTAINER - Think MOBILE-FIRST!**

**ACTUAL DIMENSIONS**: 405px width × 720px height (9:16 aspect ratio - iPhone/Android size)

**SIZING RULES (VERY IMPORTANT):**
1. **Font Sizes** (Keep SMALL!):
   - Titles/Headers: **1.5em - 2em MAX** (NOT 3em, NOT 4em!)
   - Body text: **0.9em - 1.1em** (slightly smaller than default)
   - Small labels: **0.7em - 0.8em**
   - If text is cut off, make it SMALLER, not bigger!

2. **Container Sizes** (Keep COMPACT!):
   - Boxes/Cards: **max-width: 75vw** (leave 25% margins)
   - Card height: **max-height: 20vh** (5 cards could fit vertically)
   - Padding inside boxes: **padding: 1em 1.5em** (not 3em!)
   - Margins between elements: **margin: 1em** (compact spacing)

3. **Layout Constraints:**
   - **Use vertical space as needed** - Don't artificially constrain height
   - If your animation needs 85vh to tell the story well, use it!
   - Safe margins: **padding: 3vh 5vw** on main container
   - NO horizontal scrolling: \`overflow-x: hidden; max-width: 100vw;\`
   - User can adjust video size if more animation space is needed

4. **Positioning (Flexible):**
   - Spread elements vertically as makes sense for the content
   - Top elements: **top: 5vh - 30vh**
   - Middle elements: **top: 35vh - 55vh**
   - Bottom elements: **top: 60vh - 85vh**
   - Use the full height if it creates better animations!

### DESIGN RULES:
1. **Color Palette**: Dark background (#050505), neon accents (#00f3ff, #00ff9d, #ffd700, #ff0055)
2. **Typography**: 'Oswald' for headers, 'JetBrains Mono' for data/code
   - **SMALL SIZES**: h1: **1.5-2em MAX**, p: **0.9-1.1em**, labels: **0.7-0.8em**
   - Better to be TOO SMALL than too big (user can zoom if needed)
3. **Animation Style**: HIGH-QUALITY GSAP animations with ACTUAL MOVEMENT - not just fades!
4. **Transitions**: Ensure smooth transitions between segments
5. **Sizing**: Use vw/vh units or percentages, NOT fixed px widths
   - **Default box width: 70vw** (NOT 90vw, NOT 100vw)
   - **Default box height: 18vh** (NOT 30vh, NOT 40vh)

### 🎯 SEGMENT-AWARE ANIMATION RULES:

**CRITICAL SPACING & COLLISION RULES:**
1. **Height Usage: Use what you need for great animations!**
   - Feel free to use 80vh, 85vh, or even 90vh if the content benefits from it
   - Don't artificially compress animations into small spaces
   - Position elements using: \`padding: 3vh 5vw;\` for safe margins
   - User can adjust video/animation split ratio if needed

2. **Element Spacing** (Clear but not cramped!):
   - Between items: **2em - 3em gap** for good readability
   - Use: \`gap: 2em;\` or \`margin: 1em;\` between items
   - Give animations breathing room

3. **NO Collisions - Position with good spacing**:
   - Top zone: \`top: 5vh - 30vh\`
   - Middle zone: \`top: 35vh - 60vh\`
   - Bottom zone: \`top: 65vh - 85vh\`
   - Use full vertical space if it makes the animation better!

4. **Container Sizing** (SMALLER!):
   - Boxes/Cards: \`max-width: 70vw; max-height: 18vh;\` (NOT 25vh!)
   - Text blocks: \`width: 75vw; padding: 1em 1.5em;\` (NOT 2em!)
   - Small boxes: \`width: 12vw; height: 12vw;\` for diagrams (NOT 15vw!)

**DATA FLOW VISUALIZATION (CRITICAL):**
When segment text mentions data moving between components/blocks:
- **Draw animated lines/arrows** between elements
- Example keywords: "sends to", "flows to", "goes from X to Y", "transmits", "communicates"
- **Implementation**:
  \`\`\`html
  <!-- Source box -->
  <div class="box box-source">Source</div>
  
  <!-- Animated arrow/line -->
  <svg class="flow-line" width="100%" height="200">
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5">
        <polygon points="0 0, 10 5, 0 10" fill="#00f3ff"/>
      </marker>
    </defs>
    <path class="line-path" d="M 50,50 L 50,150" 
          stroke="#00f3ff" stroke-width="2" 
          marker-end="url(#arrowhead)"/>
  </svg>
  
  <!-- Destination box -->
  <div class="box box-dest">Destination</div>
  
  <script>
    /* Animate the line drawing and particles moving along it */
    tl.from('.line-path', { strokeDasharray: '10 10', duration: 1 })
      .from('.box-dest', { opacity: 0, scale: 0, duration: 0.5 });
  </script>
  \`\`\`

### ANIMATION TYPE-SPECIFIC GUIDANCE (MOBILE-OPTIMIZED):

**🎯 CRITICAL: BOX CONTENT & LINE DRAWING RULES**

**Box Content Fitting (MUST FOLLOW):**
1. **Text MUST fit inside boxes** - Use proper sizing:
   - Set box dimensions carefully: width: 60vw; height: 12vh; padding: 0.8em;
   - Adjust font-size: Start with 1.1em, reduce to 0.9em or 0.8em if text is long
   - Add: overflow: hidden; text-overflow: ellipsis; word-wrap: break-word;
   - Center content: display: flex; align-items: center; justify-content: center;
2. **Test mentally**: "Will this text fit in a 60vw × 12vh box?"
3. **If text is long**: Reduce font-size to 0.9em or 0.8em
4. **Multi-line**: Use line-height: 1.2; for compact multi-line text

**Line/Arrow Drawing (MUST FOLLOW):**
1. **Start from CENTER of source box**:
   - If box is at top: 15vh, height: 12vh → Center Y is at 15vh + 6vh = 21vh
   - Use: <path d="M 50,21vh ..." (50 = center horizontally in %)
   
2. **End at CENTER of destination box**:
   - If destination at top: 35vh, height: 12vh → Center Y is at 35vh + 6vh = 41vh
   - Connect: <path d="M 50,21vh L 50,41vh" (straight vertical line center-to-center)
   
3. **Horizontal offset** (if side-by-side):
   - Left box center-x: 25% (if positioned at left: 25vw)
   - Right box center-x: 75% (if positioned at right: 75vw)
   - Arrow: <path d="M 25,30vh L 75,30vh" (horizontal center-to-center)

4. **SVG Container Setup**: Create absolute positioned SVG layer with arrowhead markers
   - Position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 5;
   - Define arrowhead marker with proper refX/refY for proper arrow positioning
   - Use stroke="#00f3ff" stroke-width="2" fill="none" marker-end="url(#arrowhead)"

5. **Calculate box centers properly**:
   - Center Y = Box top position + (box height / 2)
   - Center X = Box left position + (box width / 2)

**🔄 data_flow** (When data moves between systems):
🚨 **CRITICAL: ALWAYS CREATE BOXES + ARROWS, NEVER JUST ARROWS ALONE!**
- **You MUST create visible boxes/containers** for each component in the flow
- **NEVER draw arrows without boxes** - arrows connect boxes, they don't float in space!

**Required Elements for Data Flow:**
1. **Create the boxes FIRST**:
   - Use div elements with position: absolute, background color, borders
   - Example: div with class "box" styled with: width: 60vw, height: 12vh, background: #1a1a2e, border: 2px solid #00f3ff
   - Inside: span with text label like "Client" or "Server"
   - Center content with: display: flex, align-items: center, justify-content: center

2. **Then create the arrows** connecting box centers:
   - Use SVG with position: absolute covering full container
   - Add path element: d="M 50,21vh L 50,41vh" (adjust for your box positions)
   - Style with: stroke="#00f3ff", stroke-width="2", marker-end="url(#arrowhead)"

3. **Animate both boxes AND arrows**:
   - Boxes: tl.from('.box-source', opacity: 0, scale: 0.5, duration: 0.5)
   - Arrows: tl.from('.arrow', strokeDashoffset: 100, duration: 0.8)
   - Destination: tl.from('.box-destination', opacity: 0, scale: 0.5, duration: 0.5)

- **Box Size**: **width: 60vw; height: 12vh; padding: 0.8em;**
- **Font**: **1.1em** for box labels, **reduce to 0.9em if text doesn't fit**
- **Spacing**: **2.5em minimum** between boxes
- **Colors**: Boxes (#1a1a2e background, #00f3ff border), Arrows (#00f3ff)

**⚖️ comparison** (Comparing two things):
- **Layout**: Vertical stack (safer) OR side-by-side if short text
- **Box Size**: **width: 65vw; height: 15vh; font: 1.1em**
- **Spacing**: **2em gap** between items
- **Animation**: Slide in from opposite sides, subtle scale (1.05x, not 1.2x)
- **Total Height**: Max 35vh for both items

**✨ emphasis** (Highlighting key point):
- **Layout**: Center, single focused element
- **Font Size**: **1.8em title** (NOT 2.5em!), **1em body text**
- **Total Height**: Max 30vh
- **Animation**: Scale from 0 → 1.1 → 1 (subtle), soft glow
- **Spacing**: Padding: 3vh top/bottom

**📝 list_items** (Multiple points):
- **Layout**: Vertical list, left-aligned
- **Item Size**: **font: 1em; padding: 0.5em 1em; margin: 0.8em 0**
- **Spacing**: **1.5em between items** (clear spacing!)
- **Animation**: Stagger slide-in, quick bounce
- **Max Items**: 6-8 items if needed; adjust font size for readability
- **Container**: Use vertical space as needed

**🔷 diagram** (System architecture/flow):
- **Layout**: Grid with 3-4 TINY boxes
- **Box Size**: **10vw × 10vw** (very small squares!) or **12vw × 8vh** (small rectangles)
- **Font**: **0.7-0.8em** for labels inside boxes (small text to fit!)
- **Content Fitting**: Keep labels SHORT (1-2 words max) or use smaller font
- **Positioning**: Calculate exact positions for center-to-center connections
  - Example: Box A at (left: 20vw, top: 20vh, size: 10vw × 10vw) → Center: (25vw, 25vh)
  - Example: Box B at (left: 50vw, top: 20vh, size: 10vw × 10vw) → Center: (55vw, 25vh)
  - Arrow: \`<path d="M 25vw,25vh L 55vw,25vh"\` (connects centers!)
- **Spacing**: **1.5em gaps** between boxes
- **Animation**: Quick grow in (0.3s), then thin lines connect between centers
- **Total Height**: 2 rows max (35vh total)

**💬 text_focus** (Kinetic typography):
- **Layout**: Center, words as separate spans
- **Font Size**: **1.6em** (NOT 3em!), max 3 lines
- **Animation**: Words fly in quickly, small rotations (15deg max)
- **Spacing**: \`line-height: 1.4; word-spacing: 0.3em;\`

**❓ question_answer** (Q&A format):
- **Layout**: Question at top (15vh), answer below (40vh)
- **Spacing**: **4vh gap** between Q and A
- **Animation**: Q slides in, A fades + scales in
- **Sizes**: Q: **1.5em**, A: **1.2em**
- **Total Height**: Use what's needed (60-70vh is fine)

**🎯 conclusion** (Final summary):
- **Layout**: Center, minimal decorations
- **Font Size**: **1.8em title, 1em text** (smaller!)
- **Animation**: Gentle zoom (1.05x), tiny particle dots (3-5 dots only)
- **Total Height**: Max 40vh

**🌊 transition** (Bridge between topics):
- **Layout**: Single text element, very minimal
- **Font**: **1.4em** (small!)
- **Animation**: Quick fade/morph (0.5s)
- **Keep ultra-simple**: Just text, no decorations

**💡 REMINDER FOR ALL ANIMATION TYPES:**
- ✅ **You have FULL vertical space** - use 80vh, 85vh, or more if needed!
- Create animations that effectively show the content - don't artificially compress
- Think: "What animations would best visualize this concept?" not "How small can I make this?"
- User can adjust the video/animation split ratio via layout controls

### 🧠 ANALYZING SEGMENT TEXT FOR SMART ANIMATIONS:

**READ EACH SEGMENT TEXT CAREFULLY and identify:**

1. **Data Flow Indicators** → Use data_flow animation with arrows:
   - Keywords: "sends", "receives", "flows", "goes from X to Y", "transmits"
   - Example: "Data flows from Kafka to the processing service"
   - **Action**: Create boxes for each component + animated arrow between them

2. **Comparison Indicators** → Use comparison animation:
   - Keywords: "versus", "compared to", "vs", "difference between", "A or B"
   - Example: "SQL databases versus NoSQL databases"
   - **Action**: Two boxes side-by-side with contrasting colors

3. **Process/Steps Indicators** → Use list_items or diagram:
   - Keywords: "first", "then", "next", "finally", "steps", "process"
   - Example: "First we cache, then we query, finally we aggregate"
   - **Action**: Numbered vertical list or connected diagram

4. **Architecture Indicators** → Use diagram with connections:
   - Keywords: "architecture", "components", "system design", "consists of"
   - Example: "The system has three components: API, Database, and Cache"
   - **Action**: 3-4 boxes in a grid with optional connecting lines

5. **Key Point/Emphasis** → Use emphasis animation:
   - Keywords: "important", "key", "critical", "remember", "note"
   - Example: "The most important thing is consistency"
   - **Action**: Large centered text with glow/pulse

6. **Question** → Use question_answer:
   - Starts with: "What", "How", "Why", "When", "Where"
   - Example: "How does Instagram handle billions of requests?"
   - **Action**: Question at top, answer below

**SMART LAYOUT BASED ON CONTENT:**
- **1-2 items**: Center them (take up 40-50vh)
- **3-4 items**: Grid 2×2 or vertical list (use 60-75vh)
- **5+ items**: Vertical list with good spacing (80-85vh is fine)
- **Complex flow**: Use vertical timeline with arrows (use full height as needed)

### 🚨 MANDATORY: EVERY SEGMENT MUST HAVE ANIMATIONS

**NO SEGMENT CAN BE EMPTY OR STATIC - FOLLOW THESE RULES:**

1. **If segment mentions components/systems** → Create BOXES with labels
   - Example: "Client connects to server" → 2 boxes labeled "Client" and "Server"
   - Add arrow connecting them
   - Animate: boxes scale in, arrow draws, text fades in

2. **If segment explains a concept** → Create visual metaphor
   - Example: "Data is encrypted" → Box with "Data" + padlock icon, glowing effect
   - Animate: box appears, lock clicks, glow pulses

3. **If segment is just text/explanation** → Use emphasis animation
   - Create styled text container with border/background
   - Animate: scale from 0.8 → 1.1 → 1, fade in, maybe rotate slightly
   - Add subtle particle effects or glow

4. **If segment has multiple points** → Create list with icons/bullets
   - Even 2 points deserve a staggered animation
   - Each item slides in with delay

5. **If segment seems "boring"** → GET CREATIVE!
   - Add background animations (gradient shift, particles)
   - Create abstract shapes that pulse/move
   - Use kinetic typography (words fly in, assemble)
   - NEVER leave a segment with just static text

**❌ FORBIDDEN: These are NOT acceptable:**
- Empty segment with just the scene div
- Static text with no animation
- Arrows without boxes
- A single line of text with no visual treatment

**✅ MINIMUM for any segment:**
- At least 1 visual container/box/shape
- At least 2 animation steps (appear + move/scale/rotate)
- At least 0.8 seconds of animation duration

### TECHNICAL REQUIREMENTS:
1. **Structure**: ONE <html> document with:
   - Single <head> with combined styles
   - Mobile-responsive viewport: \`<meta name="viewport" content="width=device-width, initial-scale=1.0">\`
   - Base styles: 
     \`\`\`css
     body { 
       margin: 0; 
       padding: 0; 
       overflow-x: hidden; 
       width: 100vw; 
       min-height: 100vh;
       background-color: #050505;
     }
     .scene { 
       display: none; /* Hidden by default, JS shows them */
       opacity: 0;
       position: absolute;
       top: 0;
       left: 0;
       width: 100%;
       height: 100%;
       justify-content: center;
       align-items: center;
       text-align: center;
     }
     \`\`\`
   - Single <body> with ALL segment divs (each has unique ID like s1, s2, etc.)
   - Scene manager script that shows/hides segments based on video time
2. **Include GSAP CDN** once in <head>
3. **Include fonts** once (Oswald, JetBrains Mono)
4. **Use gsap.utils.toArray()** for selections - NEVER use .children or getElementsBy*
5. **Quote all CSS values**: { width: '100%', duration: 0.5 }
6. **Block comments only**: Use /* */ not //
7. **UNIQUE variable names** per segment (tl_seg1, tl_seg2, etc.) to avoid collisions
8. **NO pseudo-element animations**: Use real DOM elements (GSAP can't animate ::before/::after)
9. **PAUSED timelines**: ALL animation functions MUST return paused timelines - NOT auto-playing!
10. **Mobile sizing** (CRITICAL - BE CONSERVATIVE!):
   - Titles: **1.5-2em MAX** (prefer 1.5em-1.8em!)
   - Body text: **0.9-1.1em** (closer to 1em is safest)
   - Labels/small text: **0.7-0.8em**
   - Boxes/Cards: **max-width: 70vw, padding: 1em 1.5em** (NOT 2em, NOT 90vw!)
   - Use flexbox with \`flex-wrap: wrap\` for responsive layouts
   - **When in doubt, go SMALLER!** User prefers fitting on screen over big text
11. **Add helpful comments** marking each segment:

\`\`\`html
<!-- ========================================
     SEGMENT 1: 0.5s - 3.2s
     "How Instagram scales"
     Type: question_answer
     ======================================== -->
\`\`\`

### COMPLETE WORKING EXAMPLE (FOLLOW THIS PATTERN):

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    body { margin: 0; background: #050505; }
    .scene { display: none; opacity: 0; position: absolute; 
             top: 0; left: 0; width: 100%; height: 100%;
             justify-content: center; align-items: center; }
  </style>
</head>
<body>
  <!-- Scenes - CREATE ONE FOR EACH SEGMENT! -->
  <!-- If you have 10 segments, create s1 through s10! -->
  <div id="s1" class="scene">
    <h1 class="title1">Scene 1</h1>
  </div>
  <div id="s2" class="scene">
    <h1 class="title2">Scene 2</h1>
  </div>
  <!-- ... continue for ALL segments ... -->

  <script>
    console.log('🎬 Scene manager loading...');
    
    /* CRITICAL: Use EXACT times from your segments data, NOT placeholder times! */
    const scenes = [
      { id: 's1', start: 0.672, end: 3.001 },    /* Example: Use actual segment 1 times */
      { id: 's2', start: 3.522, end: 6.871 }     /* Example: Use actual segment 2 times */
    ];
    console.log('📋 Scenes with timing:', scenes);

    let currentScene = null;
    let sceneTimelines = {};

    /* Animation functions - CREATE ONE FOR EACH SEGMENT! */
    /* If you have 10 segments, create animateS1() through animateS10()! */
    /* Each MUST return gsap.timeline({ paused: true }) */
    
    function animateS1() {
      const tl = gsap.timeline({ paused: true });
      /* 🚨 CRITICAL TIMING RULE: Use RELATIVE times starting at 0, NOT absolute video times! */
      /* Segment duration: 2.329s (3.001 - 0.672) */
      tl.from('.title1', { scale: 0, duration: 1 }, 0);          /* Start at 0s (relative) */
      tl.from('.subtitle1', { opacity: 0, duration: 0.8 }, 0.5); /* Start at 0.5s (relative) */
      /* Spread animations across segment duration for smooth playback */
      return tl;
    }

    function animateS2() {
      const tl = gsap.timeline({ paused: true });
      /* ❌ WRONG: tl.from('.title2', { x: -500 }, 3.522); -- This is absolute video time! */
      /* ✅ CORRECT: tl.from('.title2', { x: -500 }, 0); -- Start at 0 (segment start) */
      tl.from('.title2', { x: -500, duration: 1 }, 0);
      return tl;
    }
    
    /* ... continue for ALL segments ... */

    /* CRITICAL: Initialize ALL timelines - one for EACH segment */
    try {
      sceneTimelines.s1 = animateS1();
      sceneTimelines.s2 = animateS2();
      /* ... continue for ALL segments - if you have 10 segments, initialize s1 through s10! */
      console.log('✅ Timelines initialized:', Object.keys(sceneTimelines));
      console.log('Expected count: ' + scenes.length + ', Actual count: ' + Object.keys(sceneTimelines).length);
    } catch (err) {
      console.error('❌ Timeline init error:', err);
    }

    function showScene(sceneId) {
      if (currentScene === sceneId) return;
      document.querySelectorAll('.scene').forEach(el => {
        el.style.display = 'none';
        el.style.opacity = '0';
      });
      const el = document.getElementById(sceneId);
      if (el) {
        el.style.display = 'flex';
        el.style.opacity = '1';
        currentScene = sceneId;
        console.log('👁️ Showing scene:', sceneId);
      } else {
        console.error('❌ Scene not found:', sceneId);
      }
    }

    /* CRITICAL: Handle time updates from video - THIS MAKES ANIMATIONS SYNC! */
    window.addEventListener('message', (e) => {
      if (e.data.type === 'timeupdate') {
        const time = e.data.time;  /* Current video playback time */
        
        /* Find which scene should be active */
        for (const scene of scenes) {
          if (time >= scene.start && time < scene.end) {
            /* Show this scene (hides others) */
            showScene(scene.id);
            
            /* CRITICAL: Seek timeline to correct position */
            const timeline = sceneTimelines[scene.id];
            if (timeline) {
              const relativeTime = time - scene.start;  /* Time within this segment */
              const segmentDuration = scene.end - scene.start;
              timeline.seek(relativeTime);  /* Sync animation to this exact moment */
              
              /* 🔍 Debug logging to verify timing (helpful for debugging): */
              if (Math.random() < 0.05) { /* Log 5% of updates to avoid spam */
                console.log('⏰ Video: ' + time.toFixed(2) + 's | Scene: ' + scene.id + 
                           ' | Relative: ' + relativeTime.toFixed(2) + 's / ' + segmentDuration.toFixed(2) + 's');
              }
            }
            break;  /* Found the right scene, stop searching */
          }
        }
      }
    });

    // Fallback
    setTimeout(() => {
      if (!currentScene) showScene('s1');
    }, 1000);
  </script>
</body>
</html>
\`\`\`

FOLLOW THIS EXACT PATTERN! Just expand it for all your segments.
\`\`\`

### CRITICAL: TIME-SYNCED ANIMATIONS
Each segment's GSAP timeline MUST be:
1. Created as PAUSED (paused: true option)
2. **Seeked** to the correct position based on video time
3. Updated **continuously** as the video plays

### SCENE MANAGER PATTERN (CRITICAL):
Include this script at the end of <body>:

\`\`\`javascript
const scenes = [
  { id: 's1', start: 0.5, end: 3.2 },
  { id: 's2', start: 3.5, end: 6.8 },
  // ... more scenes
];

let currentScene = null;
let sceneTimelines = {}; // Store timelines

// Initialize all timelines (PAUSED) - wrap in try-catch for safety
try {
  sceneTimelines.s1 = animateS1(); 
  sceneTimelines.s2 = animateS2();
  // ... for all scenes
} catch (err) {
  console.error('Timeline init error:', err);
}

function showScene(sceneId) {
  if (currentScene === sceneId) return;
  
  // Hide all scenes
  document.querySelectorAll('.scene').forEach(el => {
    el.style.display = 'none';
    el.style.opacity = '0';
  });
  
  // Show target scene
  const el = document.getElementById(sceneId);
  if (el) {
    console.log('👁️ Showing scene:', sceneId);
    el.style.display = 'flex';
    el.style.opacity = '1';
    currentScene = sceneId;
  }
}

// CRITICAL: Handle time updates from parent - THIS IS THE CORE SYNCHRONIZATION!
window.addEventListener('message', (e) => {
  if (e.data.type === 'timeupdate') {
    const time = e.data.time;  // Current video time (e.g., 5.2 seconds)
    
    // Find which scene should be active based on video time
    for (const scene of scenes) {
      // Check if current time falls within this scene's time range
      if (time >= scene.start && time < scene.end) {
        // 1. Show this scene (hide all others)
        showScene(scene.id);
        
        // 2. CRITICAL: Seek the timeline to correct position within this segment
        const relativeTime = time - scene.start;  // Convert to segment-relative time
        const timeline = sceneTimelines[scene.id];
        if (timeline) {
          try {
            timeline.seek(relativeTime);  // Sync animation to this exact moment!
            // Log timing info using template literals: scene.id, time.toFixed(2), relativeTime.toFixed(2)
          } catch (err) {
            console.error('Seek error for scene:', scene.id, err);
          }
        } else {
          console.warn('No timeline found for scene:', scene.id);
        }
        break;  // Found the right scene, stop searching
      }
    }
  }
});

// FALLBACK: Show first scene if no message received within 1 second
setTimeout(() => {
  if (!currentScene && scenes.length > 0) {
    showScene(scenes[0].id);
    console.log('Fallback: showing first scene');
  }
}, 1000);
\`\`\`

### 📱 REMEMBER: MOBILE PHONE DIMENSIONS
**Your HTML renders in**: 405px × 720px container (9:16 aspect ratio)
- This is an ACTUAL PHONE SIZE (iPhone/Android)
- Think small! Elements that look good on desktop will be HUGE on this
- **Test mentally**: "Would this fit on my phone screen?"

### 🎬 ANIMATION COMPLETENESS CHECKLIST (CRITICAL - CHECK EVERY SEGMENT):
**Review EACH segment before finalizing:**

For **EVERY** segment, verify:
- ✅ Does this segment have visible HTML elements? (boxes, shapes, text containers)
- ✅ Does this segment have GSAP animations that MOVE/SCALE/FADE elements?
- ✅ If showing data flow, did I create BOTH boxes AND arrows? (not just arrows!)
- ✅ Are the boxes actually VISIBLE? (background color, border, text inside)
- ✅ Does the animation timeline have at least 2-3 animation steps?
- ✅ Is the animation duration at least 0.8 seconds?

**If ANY segment fails these checks → FIX IT IMMEDIATELY!**
- Add boxes with proper styling (background, border, text)
- Add animations (scale, slide, fade, rotate)
- Never submit HTML with empty or static segments

### ⚠️ FINAL SIZE CHECKLIST (Before generating):
- ✅ Are titles **1.5-2em** (readable but not overwhelming)?
- ✅ Are boxes **max 70vw wide** (not 90vw)?
- ✅ Are gaps between elements **2-3em** (good spacing)?
- ✅ Are box heights **appropriate for content** (12-20vh typically)?
- ✅ Does the vertical layout effectively show the process/flow?
- ✅ Are animations using enough space to be clear and impactful?

**GOLDEN RULE**: Create GREAT animations that effectively communicate the content! 
**Remember**: User can adjust video/animation ratio if needed - prioritize animation quality.

### DEBUGGING REQUIREMENTS (CRITICAL):
**Add these console.log statements for verification (REQUIRED):**
1. At start: console.log('🎬 Scene manager loaded');
2. After scenes array: console.log('📋 Scenes:', scenes);
3. After init: console.log('✅ Timelines initialized:', Object.keys(sceneTimelines));
4. In showScene: console.log('👁️ Showing scene:', sceneId);
5. In message handler: Use template literals to log time and relativeTime
6. Check GSAP: console.log('GSAP loaded:', typeof gsap !== 'undefined');

**These logs will help debug timing issues and verify scene timing is correct!**

**OPTIONAL but HELPFUL**: Add a debug panel (hidden by default, can be shown with URL param):
\`\`\`html
<div id="debug" style="position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.8);
  color:#0f0;padding:10px;font-size:10px;display:none;">
  Scene: <span id="dbg-scene">-</span><br>
  Time: <span id="dbg-time">0</span>s
</div>
<script>
  if (window.location.search.includes('debug')) {
    document.getElementById('debug').style.display = 'block';
  }
</script>
\`\`\`

### ⏱️ CRITICAL TIMING VALIDATION (READ THIS CAREFULLY!):

**🚨 UNDERSTAND THE TIMING MODEL:**

**The Problem:**
- Video plays at absolute times: 0s, 1s, 2s, 5.2s, 10.5s, etc.
- Each segment has absolute start/end times (e.g., Segment 2: 3.522s - 6.871s)
- But GSAP timelines within each segment use RELATIVE time starting at 0!

**How Synchronization Works:**
1. Video plays at absolute time: **5.0s**
2. System finds active segment: Segment 2 (3.522s - 6.871s) ✅
3. Calculate relative time: **5.0 - 3.522 = 1.478s**
4. Seek timeline to: **1.478s** (relative position within segment)
5. Timeline plays animations from 1.478s position

**🚨 CRITICAL RULE - USE RELATIVE TIMES IN ANIMATIONS:**

\`\`\`javascript
/* ❌ WRONG - Using absolute video times: */
function animateS2() {
  const tl = gsap.timeline({ paused: true });
  tl.from('.box1', { scale: 0, duration: 0.5 }, 3.522);  /* ❌ This is segment START time! */
  tl.from('.box2', { x: -100, duration: 0.6 }, 4.0);     /* ❌ Absolute video time! */
  return tl;
  /* Problem: Timeline only plays when relativeTime reaches 3.522s+, but segment is only 3.349s long! */
}

/* ✅ CORRECT - Using relative times starting at 0: */
function animateS2() {
  const tl = gsap.timeline({ paused: true });
  /* Segment 2: 3.522s - 6.871s (duration: 3.349s) */
  tl.from('.box1', { scale: 0, duration: 0.5 }, 0);      /* ✅ Start immediately (0s relative) */
  tl.from('.box2', { x: -100, duration: 0.6 }, 0.5);     /* ✅ Start 0.5s into segment */
  tl.to('.box1', { rotation: 360, duration: 0.8 }, 1.2); /* ✅ Start 1.2s into segment */
  return tl;
  /* When video time = 5.0s → relativeTime = 1.478s → timeline shows animations from 1.478s position */
}
\`\`\`

**💡 TIMING BEST PRACTICES:**

1. **Start animations at time 0** (or very close to 0):
   \`\`\`javascript
   tl.from('.element', { opacity: 0, duration: 0.5 }, 0); /* ✅ Appears immediately */
   \`\`\`

2. **Spread animations across segment duration**:
   \`\`\`javascript
   /* Segment duration: 3.5s */
   tl.from('.box1', { scale: 0 }, 0);       /* 0.0s - 0.5s */
   tl.from('.box2', { x: -100 }, 0.8);      /* 0.8s - 1.4s */
   tl.from('.arrow', { drawSVG: 0 }, 1.5);  /* 1.5s - 2.2s */
   tl.to('.box2', { scale: 1.1 }, 2.5);     /* 2.5s - 3.0s */
   /* Animations span 0s to ~3.0s, covering most of segment duration */
   \`\`\`

3. **Calculate segment duration for reference**:
   \`\`\`javascript
   function animateS1() {
     const tl = gsap.timeline({ paused: true });
     const segmentDuration = 2.329; /* 3.001 - 0.672 = 2.329s */
     
     /* Use duration as guide for animation timing */
     tl.from('.box', { scale: 0, duration: segmentDuration * 0.3 }, 0);
     /* ... */
     
     return tl;
   }
   \`\`\`

4. **Add debug logging to verify timing**:
   \`\`\`javascript
   window.addEventListener('message', (e) => {
     if (e.data.type === 'timeupdate') {
       const time = e.data.time;
       
       for (const scene of scenes) {
         if (time >= scene.start && time < scene.end) {
           showScene(scene.id);
           const timeline = sceneTimelines[scene.id];
           
           if (timeline) {
             const relativeTime = time - scene.start;
             timeline.seek(relativeTime);
             
             /* 🔍 DEBUG LOGGING (helpful for verification): */
             console.log(\`⏰ Video: \${time.toFixed(2)}s | Scene: \${scene.id} | Relative: \${relativeTime.toFixed(2)}s / \${(scene.end - scene.start).toFixed(2)}s\`);
           }
           break;
         }
       }
     }
   });
   \`\`\`

**✅ TIMING VALIDATION CHECKLIST:**
Before submitting, verify for EACH animation function:
- [ ] Does the timeline start at or near 0? (first animation at 0-0.2s)
- [ ] Are all position parameters < segment duration? (e.g., if duration is 3s, no animations at 5s)
- [ ] Do animations spread across the segment? (not all bunched at 0s)
- [ ] Is the timeline returned properly? (\`return tl;\`)
- [ ] Are there NO absolute video times used? (no 3.522, 6.871, etc.)

**IF YOU USE ABSOLUTE VIDEO TIMES IN ANIMATIONS → TIMING WILL BE COMPLETELY BROKEN!**

### 🎬 FINAL VERIFICATION BEFORE SUBMITTING:
**COUNT VERIFICATION (CRITICAL):**
- Scene divs: _____ (must equal number of CONTENT segments, excluding closing/outro)
- Animation functions: _____ (must equal number of CONTENT segments)
- Timeline initializations: _____ (must equal number of CONTENT segments)
- Scenes array entries: _____ (must equal number of CONTENT segments)
- Times in scenes array: Are they EXACT segment times? (not 0,5,10)
- Closing segments: EXCLUDED from HTML (handled separately)

**IF ANY COUNT IS WRONG OR TIMES ARE PLACEHOLDERS → YOU FAILED!**

### OUTPUT:
Return ONLY the complete HTML (no markdown fences, no explanations).
Make it clean, well-commented, visually STUNNING with lots of MOVEMENT.
ENSURE:
✅ EVERY CONTENT segment has a scene div (excluding closing/outro)
✅ EVERY CONTENT segment has an animation function
✅ EVERY CONTENT segment is initialized in sceneTimelines
✅ EVERY CONTENT segment has an entry in scenes array with EXACT times
✅ CLOSING segments (personal info, follow/subscribe) are EXCLUDED
✅ ANIMATIONS ACTUALLY PLAY - not just static elements!
  `;

  // Filter out closing/outro segments
  const contentSegments = segments.filter(seg => {
    const text = seg.text.toLowerCase();
    // Skip segments that are likely closing statements
    const isClosing = text.includes("i'm ") || 
                      text.includes("follow") || 
                      text.includes("subscribe") ||
                      text.includes("my name") ||
                      text.match(/i'?m \w+/i); // Matches "I'm [Name]"
    return !isClosing;
  });
  
  // Build segment descriptions (only for content segments)
  const segmentDescriptions = contentSegments.map((seg, idx) => `
**Segment ${idx + 1}:**
- Time: ${seg.startTime}s - ${seg.endTime}s (${(seg.endTime - seg.startTime).toFixed(1)}s duration)
- Text: "${seg.text}"
- Animation Type: ${seg.animationType}
  `).join('\n');

  const prompt = `
### OVERALL CONTEXT
${overallContext}

### ALL SEGMENTS TO ANIMATE
${segmentDescriptions}

### TASK
Create ONE complete HTML document with HIGH-QUALITY, MOVING animations for **ALL ${contentSegments.length} segments above** (closing segments excluded).

🚨 **MANDATORY REQUIREMENTS:**

1. **EVERY SEGMENT MUST HAVE ANIMATIONS** - You have ${contentSegments.length} segments, create ${contentSegments.length} animation functions!
   - Create: animateS1(), animateS2(), animateS3(), ... animateS${contentSegments.length}()
   - Each function MUST return a GSAP timeline
   - Each timeline MUST have actual animations (not empty!)

2. **EVERY SEGMENT MUST HAVE A SCENE DIV**:
   - Create: <div id="s1">, <div id="s2">, ... <div id="s${contentSegments.length}">
   - Each div MUST contain HTML elements that get animated
   - Scene IDs MUST match the animation function names

3. **CRITICAL TIMING REQUIREMENT:**
You MUST create the scenes array with the EXACT startTime and endTime values from the segments above:
\`\`\`javascript
const scenes = [
${segments.map((seg, idx) => `  { id: 's${idx + 1}', start: ${seg.startTime}, end: ${seg.endTime} }`).join(',\n')}
];
\`\`\`
DO NOT use placeholder times like 0, 5, 10. USE THE EXACT TIMES PROVIDED!
This is CRITICAL for animation synchronization!

4. **INITIALIZE ALL TIMELINES** - You MUST create this initialization block:
\`\`\`javascript
const sceneTimelines = {};
try {
  sceneTimelines.s1 = animateS1();
  sceneTimelines.s2 = animateS2();
  sceneTimelines.s3 = animateS3();
  // ... continue for ALL ${segments.length} segments
  sceneTimelines.s${segments.length} = animateS${segments.length}();
  console.log('✅ Timelines initialized:', Object.keys(sceneTimelines));
} catch (err) {
  console.error('Timeline init error:', err);
}
\`\`\`

5. **VERIFY COMPLETENESS BEFORE SUBMITTING:**
   - Count: Do you have ${segments.length} scene divs? ✓
   - Count: Do you have ${segments.length} animation functions? ✓
   - Count: Do you have ${segments.length} timeline initializations? ✓
   - Count: Do you have ${segments.length} entries in scenes array? ✓
   - IF ANY COUNT IS WRONG, YOU FAILED THE TASK!

🚨 **CRITICAL - MOBILE VIEW CONSTRAINTS:**
- This HTML will be rendered in a MOBILE-SIZED CONTAINER (phone screen)
- Keep everything COMPACT and SMALL - use 2-3em for titles (NOT 5-8em!)
- Use viewport units (vw, vh) or percentages for sizing
- Boxes/cards should be SMALL (max-width: 90vw)
- Vertical layouts preferred over wide horizontal ones
- NO horizontal overflow - everything must fit within mobile width

CRITICAL REQUIREMENTS:
1. **PAUSED TIMELINES**: ALL animation functions (animateS1, animateS2, etc.) MUST create and return PAUSED timelines:
   \`const tl = gsap.timeline({ paused: true });\`
   Then \`return tl;\`
2. **Scene manager**: Must initialize all timelines in sceneTimelines object and seek them based on video time
3. **Each segment**: Gets its own scene <div> with unique ID (s1, s2, s3, etc.), class="scene"
4. **Scene styling**: All scenes have display:none by default, JS shows them with display:flex and opacity:1
5. **Fallback visibility**: Scene manager includes 1-second timeout to show first scene if no messages received
6. **Comment headers**: Add clear comments for each segment (see format in system instruction)
7. **SMOOTH animations**: ACTUAL MOVEMENT - things should slide, rotate, bounce, grow, morph!
8. **UNIQUE variables**: per segment (tl_seg1, tl_seg2, etc.)
9. **MOBILE-SIZED**: Keep everything compact for mobile view!
10. **Error handling**: Wrap timeline init and seek calls in try-catch blocks
11. **Console logging**: Add console.log statements for debugging (e.g., "Scene manager initialized", "Showing scene: s1")

Return ONLY the complete HTML (no markdown fences, no explanations).
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    let finalHTML = response.text?.trim() || "";
    
    if (!finalHTML || finalHTML.length < 100) {
      throw new Error("LLM returned empty or invalid HTML");
    }

    // Remove markdown code fences if LLM added them despite instructions
    if (finalHTML.startsWith('```html')) {
      finalHTML = finalHTML.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    } else if (finalHTML.startsWith('```')) {
      finalHTML = finalHTML.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return finalHTML;
  } catch (error: any) {
    console.error("Final HTML generation error:", error);
    throw new Error(`Failed to generate final HTML: ${error.message}`);
  }
};

/**
 * NEW: Merge multiple segment HTMLs into one cohesive HTML
 * Combines all segment animations with proper scene switching
 */
export const mergeSegmentHTMLs = (
  segments: Array<{
    id: number;
    startTime: number;
    endTime: number;
    html: string;
    layoutMode: string;
    splitRatio: number;
  }>
): { html: string; layoutConfig: any[] } => {
  // Extract body content from each segment HTML
  const extractBodyContent = (html: string): string => {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return bodyMatch ? bodyMatch[1].trim() : html;
  };

  // Extract style content
  const extractStyles = (html: string): string => {
    const styleMatch = html.match(/<style[^>]*>([\s\S]*)<\/style>/i);
    return styleMatch ? styleMatch[1].trim() : '';
  };

  // Extract script content (excluding GSAP CDN and ReelHelper)
  const extractScript = (html: string): string => {
    const scriptMatches = html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi);
    let allScripts = '';
    for (const match of scriptMatches) {
      allScripts += match[1].trim() + '\n\n';
    }
    return allScripts;
  };

  // Build combined HTML
  let combinedStyles = '';
  let combinedBody = '';
  let combinedScripts = '';

  segments.forEach((segment, index) => {
    const sceneId = `s${index + 1}`;
    
    // Extract and namespace styles (but NOT hex colors!)
    const styles = extractStyles(segment.html);
    // Only namespace CSS selectors (. and # followed by letter/underscore), NOT hex colors (# followed by digit/a-f)
    const namespacedStyles = styles
      .replace(/([.#])(?![0-9a-fA-F]{3,6}\b)/g, `#${sceneId} $1`); // Don't namespace hex colors
    combinedStyles += `\n/* Segment ${index + 1}: ${segment.startTime}s - ${segment.endTime}s */\n${namespacedStyles}\n`;
    
    // Extract body content and wrap in scene div
    const bodyContent = extractBodyContent(segment.html);
    combinedBody += `
<!-- Segment ${index + 1}: ${segment.startTime}s - ${segment.endTime}s -->
<div id="${sceneId}" class="scene" data-start="${segment.startTime}" data-end="${segment.endTime}" style="display: none;">
  ${bodyContent}
</div>
`;
    
    // Extract script and namespace common variables to avoid collisions
    const script = extractScript(segment.html);
    if (script) {
      // Replace ONLY variable declarations and standalone usage, NOT method calls
      let namespacedScript = script
        // Replace variable declarations
        .replace(/\b(let|const|var)\s+tl\b/g, `$1 tl_s${index + 1}`)
        .replace(/\b(let|const|var)\s+timeline\b/g, `$1 timeline_s${index + 1}`)
        // Replace standalone variable usage (but NOT object.method calls)
        .replace(/\btl\./g, `tl_s${index + 1}.`) // tl.method()
        .replace(/\btl\s*\(/g, `tl_s${index + 1}(`) // tl()
        .replace(/\btl\s*;/g, `tl_s${index + 1};`) // tl;
        .replace(/\btl\s*\)/g, `tl_s${index + 1})`) // ...tl)
        .replace(/\btl\s*,/g, `tl_s${index + 1},`) // ...tl,
        // Same for timeline
        .replace(/\btimeline\./g, `timeline_s${index + 1}.`)
        .replace(/\btimeline\s*\(/g, `timeline_s${index + 1}(`)
        .replace(/\btimeline\s*;/g, `timeline_s${index + 1};`)
        .replace(/\btimeline\s*\)/g, `timeline_s${index + 1})`)
        .replace(/\btimeline\s*,/g, `timeline_s${index + 1},`);
      
      combinedScripts += `\n/* Segment ${index + 1} Script */\n(function() {\n  const sceneEl_${index + 1} = document.getElementById('${sceneId}');\n${namespacedScript}\n})();\n`;
    }
  });

  // Create layout config
  const layoutConfig = segments.map(seg => ({
    startTime: seg.startTime,
    endTime: seg.endTime,
    layoutMode: seg.layoutMode,
    splitRatio: seg.splitRatio,
    captionPosition: 'bottom'
  }));

  // Build final HTML
  const finalHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg-deep: #050505;
      --primary: #00f3ff;
      --success: #00ff9d;
      --warning: #ffd700;
      --danger: #ff0055;
      --white: #ffffff;
    }
    
    body {
      margin: 0;
      padding: 0;
      background: var(--bg-deep);
      color: var(--white);
      font-family: 'Oswald', sans-serif;
      overflow: hidden;
      width: 100%;
      height: 100%;
    }
    
    .scene {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
    
    ${combinedStyles}
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
  <script>
    gsap.registerPlugin(MotionPathPlugin);
  </script>
  <script>
    /* REEL HELPER LIBRARY */
    (function() {
      if (typeof HTMLCollection !== 'undefined' && !HTMLCollection.prototype.forEach) {
        HTMLCollection.prototype.forEach = Array.prototype.forEach;
      }
      if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
        NodeList.prototype.forEach = Array.prototype.forEach;
      }
      window.ReelHelper = {
        select: function(selector, context) {
          if (!window.gsap) return [];
          return gsap.utils.toArray(selector, context);
        },
        clear: function(element) {
          if(element) element.innerHTML = '';
        }
      };
    })();
  </script>
</head>
<body>
  ${combinedBody}
  
  <script>
    /* SCENE MANAGER */
    let currentScene = null;
    const scenes = ${JSON.stringify(segments.map((s, i) => ({
      id: `s${i + 1}`,
      start: s.startTime,
      end: s.endTime
    })))};
    
    function showScene(sceneId) {
      if (currentScene === sceneId) return;
      
      /* Hide all scenes */
      document.querySelectorAll('.scene').forEach(el => {
        el.style.display = 'none';
      });
      
      /* Show target scene */
      const sceneEl = document.getElementById(sceneId);
      if (sceneEl) {
        sceneEl.style.display = 'block';
        currentScene = sceneId;
      }
    }
    
    /* Time update listener - CRITICAL FOR TIMING */
    window.addEventListener('message', (e) => {
      if (e.data.type === 'timeupdate') {
        const time = e.data.time;
        
        /* Find which scene should be active based on current video time */
        for (const scene of scenes) {
          if (time >= scene.start && time < scene.end) {
            showScene(scene.id);
            
            /* CRITICAL: Seek timeline to correct position within this segment */
            const relativeTime = time - scene.start;
            const timeline = sceneTimelines[scene.id];
            if (timeline) {
              timeline.seek(relativeTime);
              /* Log timing: use template literals for scene.id, time, and relativeTime */
            }
            break;
          }
        }
      }
    });
    
    /* Segment-specific scripts */
    ${combinedScripts}
  </script>
</body>
</html>
  `.trim();

  return {
    html: finalHTML,
    layoutConfig
  };
};

/**
 * Use LLM to merge all segment HTMLs into one final HTML with helpful comments
 * This replaces the manual mergeSegmentHTMLs function
 */
export const mergeSegmentsWithLLM = async (
  segments: Array<{
    id: number;
    startTime: number;
    endTime: number;
    text: string;
    html: string;
  }>,
  apiKey: string,
  modelName: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are an expert HTML/CSS/JavaScript developer specializing in merging multiple animation segments into ONE cohesive HTML document.

### YOUR MISSION:
Merge all provided segment HTMLs into a SINGLE, well-organized HTML document.
The final HTML must be easy to read and edit.

### TECHNICAL REQUIREMENTS:
1. **Combine all styles** into one <style> block in the <head>
2. **Combine all body content** - wrap each segment in a <div> with unique ID and timing data
3. **Combine all scripts** - ensure no variable name conflicts (use unique names per segment)
4. **Add helpful comments** - clearly mark where each segment starts/ends, including:
   - Segment number
   - Time range
   - Brief description of what the segment does
5. **Scene Manager** - Include a script that shows/hides segments based on video time
6. **Include GSAP CDN** once in the <head>
7. **Include font imports** once (Oswald, JetBrains Mono)

### COMMENT STYLE:
Use clear section dividers like:
\`\`\`html
<!-- ========================================
     SEGMENT 1: 0.5s - 3.2s
     "How does Instagram scale?"
     ======================================== -->
\`\`\`

### OUTPUT:
Return ONLY the complete merged HTML as plain text.
No markdown code fences, no explanations - just the HTML.
  `;

  // Build segment descriptions
  const segmentDescriptions = segments.map((seg, idx) => `
**Segment ${seg.id}:**
Time: ${seg.startTime}s - ${seg.endTime}s
Text: "${seg.text}"

HTML Code:
\`\`\`html
${seg.html}
\`\`\`
  `).join('\n\n---\n\n');

  const prompt = `
### SEGMENTS TO MERGE
${segmentDescriptions}

### TASK
Merge all ${segments.length} segments into ONE final HTML document.
Make it clean, well-commented, and easy to edit.

Return ONLY the complete HTML (no markdown, no explanations).
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const mergedHTML = response.text?.trim() || "";
    
    if (!mergedHTML || mergedHTML.length < 100) {
      throw new Error("LLM returned empty or invalid HTML");
    }

    // Remove markdown code fences if LLM added them despite instructions
    let cleanHTML = mergedHTML;
    if (cleanHTML.startsWith('```html')) {
      cleanHTML = cleanHTML.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    } else if (cleanHTML.startsWith('```')) {
      cleanHTML = cleanHTML.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return cleanHTML;
  } catch (error: any) {
    console.error("LLM merge error:", error);
    throw new Error(`Failed to merge segments: ${error.message}`);
  }
};

/**
 * NEW: Component-based animation generation
 * LLM selects pre-built components and provides parameters (returns JSON, not HTML!)
 */
/**
 * Generate final HTML using selected components
 * LLM creates complete HTML by creatively using the available components
 */
export const generateHTMLWithComponents = async (
  srtText: string,
  overallContext: string,
  selectedComponentIds: string[],
  apiKey: string,
  modelName: string
): Promise<{ html: string; closingSegmentStartTime?: number }> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // FILTER OUT CLOSING STATEMENTS - Don't generate HTML for these lines
  // They will be handled by the EndScreen component
  const srtBlocks = srtText.split('\n\n').filter(block => block.trim());
  let closingSegmentStartTime: number | undefined = undefined;
  
  const filteredSrtBlocks = srtBlocks.filter(block => {
    const lines = block.split('\n');
    if (lines.length < 3) return true;
    
    const text = lines.slice(2).join(' ').toLowerCase();
    
    // Skip personal intro/outro lines - improved detection
    const isClosing = text.includes("i'm") || 
                      text.includes("i am") ||
                      text.includes("follow for") || 
                      text.includes("subscribe") ||
                      text.includes("my name is") ||
                      text.includes("prithvi") ||
                      text.includes("software engineer") ||
                      text.includes("technical architect");
    
    // Capture the start time of the first closing segment
    if (isClosing && closingSegmentStartTime === undefined) {
      const timingLine = lines[1];
      const match = timingLine.match(/^([\d.]+)\s*-->/);
      if (match) {
        closingSegmentStartTime = parseFloat(match[1]);
        console.log(`🎯 Found closing segment: "${text.substring(0, 50)}..." at ${closingSegmentStartTime}s`);
      }
    }
    
    return !isClosing;
  });
  
  const filteredSrtText = filteredSrtBlocks.join('\n\n');
  
  console.log(`📝 Filtered closing statements: ${srtBlocks.length} → ${filteredSrtBlocks.length} blocks (removed ${srtBlocks.length - filteredSrtBlocks.length} closing lines)`);
  if (closingSegmentStartTime !== undefined) {
    console.log(`🎯 Closing segment starts at: ${closingSegmentStartTime}s`);
  }
  
  // Get selected components with their code
  const selectedComponents = selectedComponentIds
    .map(id => ComponentRegistry.get(id))
    .filter(Boolean);
  
  // Generate component examples with COMPLETE CODE (no truncation)
  const componentExamples = selectedComponents.map(c => {
    const exampleParams: any = {};
    Object.entries(c!.paramsSchema).forEach(([key, schema]) => {
      if (schema.default !== undefined) {
        exampleParams[key] = schema.default;
      }
    });
    
    const { html, css, script } = c!.render(exampleParams, 3);
    
    return `
════════════════════════════════════════════════════════════════
### Component: ${c!.id}
Description: ${c!.description}

⚠️ COPY THIS ENTIRE SECTION - DO NOT MODIFY ANYTHING! ⚠️

HTML (Copy EXACTLY):
${html}

CSS (Copy EXACTLY):
${css}

Script (Copy EXACTLY):
${script}

════════════════════════════════════════════════════════════════
`;
  }).join('\n\n');
  
  const systemInstruction = `
You are a master HTML/CSS/GSAP animator. Create a complete, synchronized video overlay.

════════════════════════════════════════════════════════════════
⚠️ BEFORE YOU READ COMPONENTS - UNDERSTAND THIS:
════════════════════════════════════════════════════════════════

The components below are FINAL, PRODUCTION-READY code.
They have been carefully designed, tested, and optimized.

YOUR JOB: Select the right component and copy-paste it EXACTLY.
NOT YOUR JOB: Modify, improve, optimize, or adjust component code.

THINK OF IT LIKE LEGO BLOCKS:
- You choose which block fits
- You place it in the right spot (timing)
- You DO NOT reshape the block itself

════════════════════════════════════════════════════════════════
AVAILABLE COMPONENTS (Copy these EXACTLY as shown):
════════════════════════════════════════════════════════════════
${componentExamples}

IMPORTANT: text_display is ALWAYS available as a universal fallback!
- Use it for segments where no other component fits
- It's a simple, clean text display

YOUR TASK:
Generate a complete HTML document with timed animations for each segment.

🚨 ABSOLUTELY CRITICAL - READ THIS CAREFULLY:

YOU ARE NOT ALLOWED TO WRITE ANY COMPONENT CODE!
YOU ARE NOT AN ANIMATOR - YOU ARE A COPY-PASTE ASSEMBLER!

YOUR ONLY JOB:
1. SELECT which component to use for each subtitle (read component descriptions)
2. COPY the component HTML/CSS/Script EXACTLY CHARACTER-BY-CHARACTER (100% exact copy)
3. SET data-start and data-end from SRT timing in the scene wrapper
4. DO NOT CHANGE ANYTHING ELSE

🚫 YOU MUST NEVER MODIFY COMPONENT CODE:
- ❌ DO NOT change ANY CSS values (sizes, colors, fonts, padding, margin, width, height)
- ❌ DO NOT change ANY HTML structure (classes, elements, nesting)
- ❌ DO NOT change ANY JavaScript/GSAP code (durations, easing, animations)
- ❌ DO NOT add new styles or elements
- ❌ DO NOT remove any styles or elements
- ❌ DO NOT adjust layouts, spacing, or positioning
- ❌ DO NOT "optimize" or "improve" component code
- ✅ ONLY ALLOWED: Set timing (data-start, data-end) on scene wrapper

⚠️ CRITICAL: The component code you receive is FINAL and TESTED.
Your job is to copy-paste it exactly and set timing. That's it.
If you change anything, the components will break or misalign.
- Modify base html/body styles (flexbox centering is CRITICAL)
- Change .scene class styles (positioning is CRITICAL)
- Add any container wrappers around components
- Change viewport dimensions (405px × 432px is FIXED)

✅ YOU CAN ONLY:
- Copy component code exactly as shown (character-by-character)
- Change text in <div class="text-display-text">...</div>
- Change text in <h1 class="emphasis-text">...</h1>
- Set data-start and data-end attributes
- Choose which component to use for each subtitle

TECHNICAL REQUIREMENTS:
- Mobile: 405px × 432px viewport (EXACT dimensions)
- Dark theme: #050505 bg, #00f3ff primary, #00ff9d success
- Font: 'Oswald', 'JetBrains Mono'
- GSAP 3.12.5 for animations
- Each segment = one scene with data-start/data-end
- Scene manager handles showing/hiding based on video time
- CRITICAL: Must include postMessage listener for video sync
- CRITICAL: ALWAYS include base HTML/body styles for centering (see structure below)

MANDATORY OUTPUT STRUCTURE - FOLLOW EXACTLY:
You MUST use this exact structure. Do NOT change any base styles!

<!DOCTYPE html>
<html>
<head>
  <title>Animation Overlay</title>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    /* ⚠️ DO NOT MODIFY THESE BASE STYLES - REQUIRED FOR CENTERING ⚠️ */
    html, body {
      margin: 0;
      padding: 0;
      width: 405px;
      height: 432px;
      overflow: hidden;
      font-family: 'Oswald', sans-serif;
      background-color: #050505;
      color: #eeeeee;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    
    .scene {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      display: none;
      box-sizing: border-box;
      padding: 20px;
    }
    
    /* ⬇️ PASTE COMPONENT CSS HERE (EXACT COPY) ⬇️ */
    /* DO NOT change any values - copy-paste only */
    
  </style>
</head>
<body>
  <!-- ⬇️ PASTE COMPONENT HTML HERE (EXACT COPY) ⬇️ -->
  <div id="s1" class="scene" data-start="0.0" data-end="2.5">
    <!-- Component HTML goes here - EXACT COPY -->
  </div>
  <div id="s2" class="scene" data-start="2.5" data-end="5.0">
    <!-- Next component HTML - EXACT COPY -->
  </div>
  <!-- More scenes... -->
  
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script>
    /* ⬇️ PASTE COMPONENT SCRIPTS HERE (EXACT COPY) ⬇️ */
    /* DO NOT modify animations - copy-paste only */
    
    function animateS1() {
      // Component animation code - EXACT COPY
      return tl;
    }
    
    function animateS2() {
      // Next component animation - EXACT COPY
      return tl;
    }
    
    /* ⬇️ SCENE MANAGER (from below) - EXACT COPY ⬇️ */
  </script>
</body>
</html>
`;

  const sceneManager = `
// SCENE MANAGER (Include this at end of script):
const scenes = document.querySelectorAll('.scene');
let currentTime = 0;
let currentScene = null;
let currentTimeline = null;

function updateScene(time) {
  currentTime = time;
  
  for (const scene of scenes) {
    const start = parseFloat(scene.dataset.start);
    const end = parseFloat(scene.dataset.end);
    
    if (time >= start && time < end) {
      if (currentScene !== scene) {
        // Hide previous
        if (currentScene) {
          currentScene.style.display = 'none';
          if (currentTimeline) currentTimeline.kill();
        }
        
        // Show new
        currentScene = scene;
        scene.style.display = 'block';
        
        // Start animation
        const animFunc = window[\`animateS\${scene.id.substring(1)}\`];
        if (animFunc) {
          currentTimeline = animFunc();
          if (currentTimeline) currentTimeline.play();
        }
      }
      break;
    }
  }
}

window.updateScene = updateScene;

// CRITICAL: Listen for video time updates from parent window
window.addEventListener('message', (e) => {
  if (e.data.type === 'timeupdate') {
    updateScene(e.data.time);
  }
});

// Initialize first scene
updateScene(0);
`;

  const prompt = `
⚠️⚠️⚠️ CRITICAL WARNING - READ THIS FIRST ⚠️⚠️⚠️

YOU ARE NOT WRITING CODE - YOU ARE ASSEMBLING PRE-MADE COMPONENTS!

Think of yourself as working with LEGO blocks:
- Each component is a finished LEGO piece
- You CANNOT modify the LEGO pieces
- You can ONLY choose which pieces to use and where to place them
- You CANNOT reshape, recolor, or rebuild the pieces

YOUR MOST IMPORTANT TASK: SELECT THE RIGHT COMPONENT!
- Read each subtitle carefully
- Identify the CORE CONCEPT
- Match to the component guide (see below)
- ⚠️ IF UNCERTAIN, USE text_display - it's your safe fallback

DO NOT GENERATE ANY ANIMATIONS OR CSS!
DO NOT MODIFY ANY COMPONENT CODE!
ONLY COPY-PASTE EXACTLY AS SHOWN!
COMPONENT SELECTION ACCURACY IS CRITICAL!

⚠️ IMPORTANT: SKIP CLOSING/OUTRO LINES
- Do NOT generate HTML for lines like "I'm [Name]", "Follow for more", "Subscribe"
- These closing statements will be handled by a separate end screen
- Only generate HTML for the main content, NOT for personal outros

════════════════════════════════════════════════════════════════

VIDEO CONTEXT: ${overallContext}

SUBTITLE TIMING (SRT Format):
${filteredSrtText}

NOTE: Closing/outro statements have been removed - do NOT create HTML for them.

═══════════════════════════════════════════════════════════════════
🎯 COMPONENT SELECTION GUIDE
═══════════════════════════════════════════════════════════════════

RULE: If you can't confidently pick a visual component, use text_display.

COMPONENT SELECTION:

For each subtitle, read the available components below.
Choose the component whose DESCRIPTION best matches the subtitle's meaning.
If unsure → use text_display

═══════════════════════════════════════════════════════════════════

STEP-BY-STEP INSTRUCTIONS (FOLLOW EXACTLY):

🔴 CRITICAL WARNING BEFORE YOU START:
You will receive complete component code (HTML, CSS, JavaScript).
These components are PRODUCTION-READY and must NOT be modified.
Your ONLY job is to SELECT and COPY-PASTE them with correct timing.
DO NOT CHANGE: sizes, colors, fonts, spacing, animations, structure.
ONLY SET: data-start and data-end timing values.

STEP 1: Start with the MANDATORY OUTPUT STRUCTURE (see below)
   - Copy the entire HTML template
   - Keep ALL base styles UNCHANGED (html, body, .scene)
   - These base styles ensure components are centered

STEP 2: Read SRT subtitles and extract timing for each line

   ⚠️ CRITICAL: SKIP CLOSING/OUTRO STATEMENTS
   - If subtitle contains personal info like "I'm [Name]", "Follow for more", social handles, etc.
   - DO NOT generate HTML for these lines - they will be handled separately
   - Skip them entirely from your output
   - Look for: personal introductions, calls to action, "follow", "subscribe", social media mentions
   
   FOR EACH SUBTITLE (except closing):
   ✓ Read the subtitle
   ✓ Check if it matches a component description above
   ✓ If it matches → use that component
   ✓ If unsure → use text_display

STEP 3: For each subtitle - COMPONENT SELECTION & ASSEMBLY:
   
   a) Read the subtitle - what does it describe?
   b) Look at component descriptions below
   c) Pick the component whose description best matches
   d) If unsure → use text_display
   
   e) 🚨 COPY EXACTLY - CHARACTER BY CHARACTER:
      - Copy component HTML → paste into <div id="sX" class="scene" data-start="X" data-end="Y">
      - Copy component CSS → paste into #sX { } wrapper in <style> section
      - Copy component Script → paste into function animateSX() { }
      
   f) Set ONLY data-start and data-end from SRT timing on scene wrapper
   
   ⚠️ CSS SCOPING RULE:
   Component CSS must be wrapped in: #s1 { [component CSS here] }
   This ensures styles don't leak between scenes.
   DO NOT modify the CSS itself - just wrap it in the scene ID selector.
   
   🚫 ABSOLUTELY NO MODIFICATIONS TO COMPONENT CODE!
   - Do NOT change font sizes, even by 1px
   - Do NOT change colors, even slightly
   - Do NOT change padding, margin, gap, width, height
   - Do NOT add or remove any elements
   - Do NOT modify GSAP animations at all
   - Do NOT change any CSS classes or styles
   
   ✅ ONLY CHANGE: data-start="X" data-end="Y" timing on <div class="scene">

STEP 4: For text_display/emphasis components ONLY:
   - Find the text content in HTML (usually inside <p> or <div>)
   - Replace ONLY the text string (keep all HTML tags and structure)

STEP 5: Add scene manager code (copy from template below)

🎯 REMEMBER: Components are already perfectly sized and aligned.
Your modifications will BREAK them. Just select and copy-paste exactly!

═══════════════════════════════════════════════════════════════
CONCRETE EXAMPLE - CORRECT WAY TO USE COMPONENTS:
═══════════════════════════════════════════════════════════════

Subtitle: "WebSocket establishing connection" (1.5s → 4.2s)
Component: websocket_handshake

❌ WRONG - Modifying CSS:
<style>
  #s1 {
    .ws-container { gap: 2rem; /* MODIFIED - BREAKS ALIGNMENT */ }
  }
</style>

✅ CORRECT - Exact copy:
<style>
  #s1 {
    .ws-container { gap: 0.8rem; } /* EXACT COPY FROM COMPONENT */
    /* ... rest of CSS EXACTLY as provided ... */
  }
</style>

GOLDEN RULE: If component CSS says gap: 0.8rem, YOUR output must say gap: 0.8rem.
Not 0.9rem, not 1rem, not "approximately 0.8rem" - EXACTLY 0.8rem!

═══════════════════════════════════════════════════════════════
EXAMPLE - HOW TO PROCESS ONE SUBTITLE:

Input: "1\n00:00:00,000 --> 00:00:03,500\n200 million followers need notifications"

THINKING PROCESS (this is what you should do mentally):
- "200 million followers" → mentions LARGE NUMBERS and SCALE
- Look at component guide above → massive_scale is for "scale/numbers"
- This is a PERFECT match!

Process:
1. Timing → start=0.0, end=3.5
2. Choose → massive_scale (matches scale/large numbers concept)
3. Scroll up to find massive_scale in component examples
4. Copy the ENTIRE HTML block from massive_scale
5. Paste into <div id="s1" class="scene" data-start="0.0" data-end="3.5">
6. Copy the ENTIRE CSS block from massive_scale
7. Paste into <style> section (after base styles)
8. Copy the ENTIRE Script block from massive_scale
9. Paste as function animateS1() in <script> section
10. Done - move to next subtitle

Result: massive_scale component renders EXACTLY as designed, centered properly

ANOTHER EXAMPLE:

Input: "2\n00:00:03,500 --> 00:00:06,000\nEngaged users get notified first"

THINKING:
- "engaged users" + "first" → mentions PRIORITIZATION
- Look at guide → priority_queue is for "priority, engaged vs inactive"
- PERFECT match!
- Choose priority_queue and follow same steps

❌ BAD SELECTION EXAMPLES:
- "200 million followers" → text_display (WRONG - ignores scale concept!)
- "ML decides" → smart_tradeoffs (WRONG - should be ml_relevance!)
- "prevents crashes" → rate_limiting (WRONG - should be cascading_failure!)

✅ GOOD SELECTION:
- Read subtitle → Identify CORE CONCEPT → Match to guide → Select component

❌ WRONG APPROACH:
- "Let me adjust the badge size for mobile" → NO!
- "I'll change colors to be more vibrant" → NO!
- "Let me speed up the animation" → NO!
- "I'll add margin for better spacing" → NO!

✅ CORRECT APPROACH:
- Find component → Copy → Paste → Set timing → Next subtitle
- Zero modifications to any code

SCENE MANAGER CODE (copy this exactly):
${sceneManager}

════════════════════════════════════════════════════════════════
⚠️⚠️⚠️ FINAL CRITICAL CHECKLIST BEFORE YOU START ⚠️⚠️⚠️

✅ Base html/body styles UNCHANGED (flexbox centering is essential)
✅ Base .scene styles UNCHANGED (positioning is essential)
✅ Component CSS copied EXACTLY (no size/color/padding changes)
✅ Component HTML copied EXACTLY (no structure changes)
✅ Component Scripts copied EXACTLY (no animation changes)
✅ Only changed: text content & data-start/data-end timing

🚫 COMMON MISTAKES THAT BREAK CENTERING:
- Removing display: flex from body
- Removing align-items: center from body
- Removing justify-content: center from body
- Changing component container widths
- Adding wrapper divs around components
- Modifying padding/margin values
- Changing font-sizes or icon sizes

IF YOU MAKE ANY CSS CHANGES, COMPONENTS WILL:
- Go off-screen (only partially visible)
- Be misaligned (not centered)
- Have broken animations
- Wrong sizes for mobile viewport

════════════════════════════════════════════════════════════════

🎯 FINAL CHECKLIST BEFORE YOU OUTPUT:
□ Did you copy component HTML exactly? (No changes to structure, classes, or elements?)
□ Did you copy component CSS exactly? (No changes to any values?)
□ Did you copy component JavaScript exactly? (No changes to GSAP animations?)
□ Did you ONLY change data-start and data-end timing?
□ Did you keep all base HTML/body/scene styles unchanged?

If you answered "No" to any question, GO BACK and fix it!

════════════════════════════════════════════════════════════════

Generate the complete HTML document now (literal exact copy-paste only):
`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${systemInstruction}\n\n${prompt}`
    });
    
    let html = response.text || "";
    
    // Extract HTML from markdown if present
    if (html.includes('```html')) {
      const match = html.match(/```html\n([\s\S]*?)```/);
      if (match) html = match[1];
    } else if (html.includes('```')) {
      const match = html.match(/```\n([\s\S]*?)```/);
      if (match) html = match[1];
    }
    
    return {
      html: html.trim(),
      closingSegmentStartTime
    };
  } catch (error: any) {
    console.error("HTML generation error:", error);
    throw new Error(`Failed to generate HTML: ${error.message}`);
  }
};

/**
 * Auto-generate multiple components based on video script/description
 * 
 * OPTIMIZED 2-STEP PROCESS:
 * Step 1: Analyze script → generate component ideas (specs only)
 * Step 2: Batch generate ALL components in one LLM call
 * 
 * Final flow will be 3 total LLM calls:
 * 1. This function (2 calls: analyze + batch generate)
 * 2. Final HTML generation (uses selected components + text_display fallback)
 */
export const autoGenerateComponentsForVideo = async (
  videoDescription: string,
  scriptText: string,
  apiKey: string,
  modelName: string
): Promise<AnimationComponent[]> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `
You are an animation component designer. Analyze the video content and suggest 5-6 custom animation components.

CONSTRAINTS (components will run on):
- Mobile screen: 405px × 432px
- Short segments: 2-5 seconds each
- Animations: Fast, punchy, clear

YOUR TASK:
1. Read the video description and script
2. Identify visual patterns that would help explain the content
3. Design 5-6 specific, SIMPLE animation components
4. Return JSON array with component specs

THINK CREATIVELY BUT SIMPLE:
- What simple visuals would help explain this content?
- Prefer clear, fast animations over complex ones
- Think: icons, shapes, arrows, text effects
- Animations should be obvious within 1-2 seconds

GOOD EXAMPLES:
- "scaling" → "ServerCluster": 3 boxes appearing one by one
- "API calls" → "RequestResponse": arrow bouncing between 2 boxes
- "user growth" → "GrowthChart": 3 bars growing upward
- "data flow" → "Pipeline": dot moving through connected boxes
- "encryption" → "LockUnlock": padlock closing with particles

BAD EXAMPLES (too complex):
- Detailed 3D graphs
- Multiple simultaneous animations
- Tiny text or intricate details

OUTPUT FORMAT (JSON array):
[
  {
    "id": "component_id",
    "name": "Component Name",
    "description": "What it shows and when to use it",
    "visualPattern": "SIMPLE, detailed description: what elements, what movement, what timing"
  }
]

Keep IDs lowercase_with_underscores
`;

  const prompt = `
VIDEO DESCRIPTION:
${videoDescription}

SCRIPT PREVIEW:
${scriptText.substring(0, 800)}...

TASK: Analyze this content and design 5-6 custom animation components that would help visualize the concepts.

Return JSON array of component specifications:
`;

  console.log('📋 LLM Call 1/3: Analyzing script for component ideas...');
  
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${systemInstruction}\n\n${prompt}`,
    });
    
    let text = response.text || "[]";
    
    // Extract JSON
    if (text.includes('```json')) {
      const match = text.match(/```json\n([\s\S]*?)```/);
      if (match) text = match[1];
    } else if (text.includes('```')) {
      const match = text.match(/```\n([\s\S]*?)```/);
      if (match) text = match[1];
    }
    
    const specs = JSON.parse(text.trim());
    
    if (!Array.isArray(specs)) {
      throw new Error("LLM did not return an array");
    }
    
    console.log(`✅ Got ${specs.length} component ideas`);
    
    // STEP 2: Generate ALL components at once (batch generation)
    console.log(`🎨 LLM Call 2/3: Batch generating ${specs.length} components...`);
    const components = await batchGenerateComponents(specs, apiKey, modelName);
    
    console.log(`✅ Successfully generated ${components.length} components`);
    console.log(`💡 Final call (3/3) will happen when you click "Generate Reel"`);
    return components;
    
  } catch (error: any) {
    console.error("Auto-generation error:", error);
    throw new Error(`Failed to auto-generate components: ${error.message}`);
  }
};

/**
 * Batch generate multiple components in one LLM call
 * Much more efficient than generating one at a time
 */
const batchGenerateComponents = async (
  specs: Array<{ id: string; name: string; description: string; visualPattern: string }>,
  apiKey: string,
  modelName: string
): Promise<AnimationComponent[]> => {
  const ai = new GoogleGenAI({ apiKey });
  
  // Get a complete reference component as example
  const emphasisComp = ComponentRegistry.get('emphasis');
  const exampleRender = emphasisComp ? emphasisComp.render({ text: 'Sample' }, 3) : null;
  
  const completeExample = exampleRender ? `
COMPLETE WORKING EXAMPLE:
{
  "id": "emphasis",
  "name": "Emphasis",
  "description": "Emphasize key text",
  "category": "text",
  "paramsSchema": {
    "text": { "type": "string", "description": "Text to emphasize", "required": true, "default": "Important" },
    "color": { "type": "string", "description": "Text color", "required": false, "default": "#00ff9d" }
  },
  "html": "${exampleRender.html.replace(/"/g, '\\"').replace(/\n/g, ' ')}",
  "css": "${exampleRender.css.replace(/"/g, '\\"').replace(/\n/g, ' ')}",
  "script": "${exampleRender.script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
}
` : '';
  
  const specsList = specs.map((spec, idx) => `
${idx + 1}. ${spec.name}
   ID: ${spec.id}
   Description: ${spec.description}
   Visual: ${spec.visualPattern}
`).join('\n');
  
  const prompt = `
Generate ${specs.length} GSAP animation components as a JSON array.

🚨 CRITICAL REQUIREMENT - ANIMATIONS MUST WORK:
Your script MUST include these 3 lines:
1. var tl = gsap.timeline();
2. [your animation code using tl.from() / tl.to()]
3. return tl;  ← WITHOUT THIS, NOTHING WILL ANIMATE!

EXACT DIMENSIONS & CONSTRAINTS:
- Container: 405px width × 432px height (FIXED, mobile phone screen)
- Font sizes: 16-24px for titles, 12-16px for body text
- Content max-width: Use "max-width: 60%; margin: 0 auto;" for centering with margins
- Component elements: Keep compact (70-150px width for boxes)
- Animations: Fast and punchy (0.3-0.8s per step)
- Must fit in viewport WITHOUT scrolling
- Use emojis/icons for visual clarity instead of large text

${completeExample}

COMPONENTS TO CREATE:
${specsList}

ANIMATION TIMING RULES:
1. \${duration} = total segment duration (e.g., 3.5 seconds)
2. Split animations into steps that fit within \${duration}
3. Example for 3s duration:
   - 0-0.5s: Elements appear
   - 0.5-2.5s: Main animation/hold
   - 2.5-3s: Exit (optional)

SCRIPT STRUCTURE (CRITICAL - THIS IS THE MOST IMPORTANT PART):

🚨 YOUR SCRIPT MUST:
1. Create a timeline: var tl = gsap.timeline();
2. Add animations to the timeline using tl.from() or tl.to()
3. RETURN THE TIMELINE: return tl;

⚠️ IF YOU DON'T RETURN THE TIMELINE, ANIMATIONS WON'T PLAY!

TEMPLATE (COPY THIS STRUCTURE):
var tl = gsap.timeline();

// Step 1: Entrance animation (fast, 0.3-0.5s)
tl.from('.element', { 
  scale: 0, 
  opacity: 0, 
  duration: 0.4, 
  ease: 'back.out(1.7)' 
});

// Step 2: Main animation (use remaining \${duration} - 0.8)
tl.to('.element', { 
  rotation: 360, 
  duration: \${duration} - 0.8, 
  ease: 'none' 
}, '+=0.2');

// CRITICAL: ALWAYS return the timeline
return tl;

CSS REQUIREMENTS:
- Main container: width: 100%; max-width: 60%; margin: 0 auto; (for centered layout with side margins)
- Use flexbox: display: flex; align-items: center; justify-content: center;
- Visibility: opacity: 1 by default (GSAP will animate FROM hidden using tl.from())
- Size: Exact px values (no vh/vw), keep elements small and compact
- Colors: Use gradients, glows (box-shadow) for modern look

MANDATORY HTML STRUCTURE (COPY THIS):
<div class="unique-container" style="width: 100%; max-width: 60%; height: 100%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
  <div class="unique-content" style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
    <!-- Your animated elements here -->
  </div>
</div>

⚠️ The max-width: 60% ensures proper margins on left/right sides!

EXAMPLE COMPLETE COMPONENT (COPY THIS PATTERN):
{
  "id": "bounce_text",
  "name": "Bounce Text",
  "description": "Text that bounces in",
  "category": "text",
  "paramsSchema": {
    "text": { "type": "string", "required": true, "default": "Hello" }
  },
  "html": "<div class='bounce-container'><div class='bounce-text'>\${params.text}</div></div>",
  "css": ".bounce-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; } .bounce-text { font-size: 2rem; font-weight: bold; color: #00ff9d; opacity: 1; }",
  "script": "var tl = gsap.timeline(); tl.from('.bounce-text', { y: -100, opacity: 0, duration: 0.5, ease: 'bounce.out' }); tl.to('.bounce-text', { scale: 1.1, duration: 0.3, yoyo: true, repeat: Math.floor(\${duration} / 0.6) }); return tl;"
}

⚠️ NOTICE: The script ALWAYS ends with "return tl;" - THIS IS MANDATORY!

OUTPUT FORMAT (JSON array with ${specs.length} components):
`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    
    let text = response.text || "[]";
    console.log('📝 Raw LLM response (first 500 chars):', text.substring(0, 500));
    
    // Extract JSON
    if (text.includes('```json')) {
      const match = text.match(/```json\n([\s\S]*?)```/);
      if (match) text = match[1];
    } else if (text.includes('```')) {
      const match = text.match(/```\n([\s\S]*?)```/);
      if (match) text = match[1];
    }
    
    console.log('🔍 Extracted JSON (first 500 chars):', text.substring(0, 500));
    
    const componentsData = JSON.parse(text.trim());
    console.log(`📦 Parsed ${componentsData.length} component data objects`);
    
    if (!Array.isArray(componentsData)) {
      throw new Error("LLM did not return an array");
    }
    
    // Convert to AnimationComponent objects
    const components: AnimationComponent[] = [];
    
    for (const data of componentsData) {
      if (!data.id || !data.html || !data.css || !data.script) {
        console.warn(`⚠️ Skipping incomplete component:`, data.id || 'unknown');
        continue;
      }
      
      console.log(`✓ Creating component: ${data.id}`);
      
      // Validate the component structure
      const component: AnimationComponent = {
        id: data.id,
        name: data.name || 'Generated Component',
        description: data.description || '',
        category: data.category || 'custom',
        paramsSchema: data.paramsSchema || {},
        render: (params: ComponentParams, duration: number) => {
          let html = data.html;
          let css = data.css;
          let script = data.script;
          
          // Replace param placeholders
          Object.keys(params).forEach(key => {
            const value = params[key];
            const placeholder = new RegExp(`\\$\\{params\\.${key}\\}`, 'g');
            html = html.replace(placeholder, String(value));
            css = css.replace(placeholder, String(value));
            script = script.replace(placeholder, String(value));
          });
          
          // Replace duration
          script = script.replace(/\$\{duration\}/g, String(duration));
          
          // CRITICAL FIX: Ensure script returns timeline
          if (!script.includes('return tl') && script.includes('var tl = gsap.timeline()')) {
            console.warn(`⚠️ Auto-fixing: Adding 'return tl;' to component ${data.id}`);
            script = script.trim();
            if (!script.endsWith(';')) {
              script += ';';
            }
            script += ' return tl;';
          }
          
          return { html, css, script };
        }
      };
      
      // Test render to ensure it works
      try {
        const testParams: any = {};
        Object.keys(component.paramsSchema).forEach(key => {
          const schema = component.paramsSchema[key];
          testParams[key] = schema.default || 'test';
        });
        
        const testResult = component.render(testParams, 3);
        if (!testResult.html || !testResult.css || !testResult.script) {
          console.error(`❌ Component ${data.id} render failed - missing html/css/script`);
          continue;
        }
        
        // Validate GSAP structure
        if (!testResult.script.includes('gsap.timeline()')) {
          console.warn(`⚠️ Component ${data.id} missing gsap.timeline() - might not animate`);
        }
        if (!testResult.script.includes('return tl')) {
          console.warn(`⚠️ Component ${data.id} missing 'return tl' - might not animate`);
        }
        
        console.log(`✅ Component ${data.id} validated successfully`);
        components.push(component);
      } catch (error) {
        console.error(`❌ Component ${data.id} render test failed:`, error);
      }
    }
    
    console.log(`📦 Successfully created ${components.length}/${componentsData.length} components`);
    return components;
    
  } catch (error: any) {
    console.error("Batch component generation error:", error);
    throw new Error(`Failed to batch generate: ${error.message}`);
  }
};

/**
 * Generate a new animation component using LLM (single component)
 */
export const generateAnimationComponent = async (
  description: string,
  exampleUsage: string,
  apiKey: string,
  modelName: string
): Promise<AnimationComponent> => {
  const ai = new GoogleGenAI({ apiKey });
  
  // Get a few reference components for the LLM to learn from
  const referenceComponents = ComponentRegistry.getAll().slice(0, 3);
  const references = referenceComponents.map(comp => {
    const { html, css, script } = comp.render({}, 3);
    return `
### EXAMPLE: ${comp.name}
ID: ${comp.id}
Category: ${comp.category}
Description: ${comp.description}

HTML:
${html}

CSS:
${css}

Script:
${script}
`;
  }).join('\n\n');

  const prompt = `
Create a GSAP animation component.

DESCRIPTION: ${description}
VISUAL: ${exampleUsage || 'N/A'}

EXACT CONSTRAINTS:
- Viewport: 405px × 432px (mobile, FIXED size)
- Font: 16-24px titles, 14-18px body
- Container: Max 320px wide (80% of viewport)
- Animation: Fast (0.3-0.8s), use \${duration} for total time
- Theme: Dark (#050505 bg, #00ff9d accent, #00f3ff primary)

ANIMATION TIMING:
- Total: \${duration} seconds (e.g., 3.5s)
- Entrance: 0.3-0.5s (quick appear)
- Main: \${duration} - 0.8s (core animation)
- Exit: Optional, last 0.3s

SCRIPT TEMPLATE:
var tl = gsap.timeline();
tl.from('.element', { scale: 0, opacity: 0, duration: 0.4, ease: 'back.out(1.7)' });
tl.to('.element', { /* main animation */, duration: \${duration} - 0.8 });
return tl;

CSS RULES:
- Elements visible by default (opacity: 1)
- Use flexbox for centering
- Exact px sizes, no vh/vw
- Position absolute or flex

REFERENCE:
${references}

JSON OUTPUT:
{
  "id": "snake_case_id",
  "name": "Component Name",
  "description": "What it does",
  "category": "text|animation|viz",
  "paramsSchema": { "text": { "type": "string", "required": true, "default": "Sample" } },
  "html": "<div class='unique-container'><div class='unique-content'>\${params.text}</div></div>",
  "css": ".unique-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; } .unique-content { font-size: 1.5rem; color: #00ff9d; opacity: 1; }",
  "script": "var tl = gsap.timeline(); tl.from('.unique-content', { y: -50, opacity: 0, duration: 0.4 }); return tl;"
}

CRITICAL RULES:
- HTML: Use semantic IDs like #main-box, #arrow, #label-text
- CSS: Set initial visibility (opacity: 1, not 0) - GSAP handles animations
- Script: MUST use "var tl = gsap.timeline();" (not const/let)
- Script: MUST return the timeline at the end
- Script: Use params like \${params.sourceLabel}, \${params.color}
- Script: Timeline should fit within the duration parameter
- Animations: Use .from() for entrance effects (elements start visible)
- Sizing: Keep text 14-24px, containers max 80vw width
- Colors: Use CSS variables or param colors

OUTPUT: Valid JSON only, no markdown, no explanation.
`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    
    let text = response.text || "{}";
    
    // Extract JSON from markdown if present
    if (text.includes('```json')) {
      const match = text.match(/```json\n([\s\S]*?)```/);
      if (match) text = match[1];
    } else if (text.includes('```')) {
      const match = text.match(/```\n([\s\S]*?)```/);
      if (match) text = match[1];
    }
    
    const componentData = JSON.parse(text.trim());
    
    // Validate required fields
    if (!componentData.id || !componentData.name || !componentData.html || !componentData.css || !componentData.script) {
      throw new Error("LLM did not return all required component fields");
    }
    
    // Create the component object
    const component: AnimationComponent = {
      id: componentData.id,
      name: componentData.name,
      description: componentData.description || '',
      category: componentData.category || 'custom',
      paramsSchema: componentData.paramsSchema || {},
      render: (params: ComponentParams, duration: number) => {
        // Replace param placeholders in HTML
        let html = componentData.html;
        let css = componentData.css;
        let script = componentData.script;
        
        // Simple template replacement
        Object.keys(params).forEach(key => {
          const value = params[key];
          const placeholder = new RegExp(`\\$\\{params\\.${key}\\}`, 'g');
          html = html.replace(placeholder, String(value));
          css = css.replace(placeholder, String(value));
          script = script.replace(placeholder, String(value));
        });
        
        // Replace duration placeholder
        script = script.replace(/\$\{duration\}/g, String(duration));
        
        return { html, css, script };
      }
    };
    
    return component;
  } catch (error: any) {
    console.error("Component generation error:", error);
    throw new Error(`Failed to generate component: ${error.message}`);
  }
};
