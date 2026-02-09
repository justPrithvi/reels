# 🎬 Reel Composer

**Reel Composer** is an AI-powered video production studio that transforms raw talking-head footage into high-retention educational content (Instagram Reels / TikToks / YouTube Shorts).

It leverages **Google Gemini AI** to intelligently analyze your transcript and synchronize professional-grade animations with your video — all in your browser.

---

## 🧠 The Philosophy: Quantity > Perfectionism

> *"In the world of algorithms, Volume is Leverage."*

To grow on social media, you must understand the **Statistics of Virality**.

### 1. The Probabilistic Reality
Going viral is a probabilistic event. It is a lottery where every video you post is a ticket. 
*   **Low Volume:** Posting 1 "Perfect" video a month = 12 chances/year.
*   **High Volume:** Posting 1 "Good Enough" video a day = 365 chances/year.

### 2. The Credibility Trap
Usually, increasing volume means sacrificing quality. However, low-quality content hurts your authority (Credibility). 
*   **The Dilemma:** High-end motion graphics (Edutainment) build trust but take days to edit in After Effects.
*   **The Solution:** **Reel Composer** automates the "Credibility Layer."

### 3. Automating Authority
This tool bridges the gap. It allows you to produce **High-Retention, Visually Intellectual Content** at the **Volume** required for statistical growth.

*   **Don't compromise on Credibility.**
*   **Don't compromise on Volume.**
*   **Let AI handle the pixels.**

---

## ✨ Key Features

### 📹 **Professional Video Recording**
- Built-in camera recorder with live preview
- Real-time filters (Warm, Cool, Vintage, Bright, Dramatic)
- Virtual backgrounds (Blur, Gradients)
- Mirror view with high-quality output

### 🎙️ **AI-Powered Subtitle Generation**
- One-click transcription using Google Gemini
- English and Hinglish (Romanized Hindi) support
- Precise timing and natural language processing
- Manual SRT upload support

### 🎨 **Animation Component Library**
- Pre-built professional animations
- Topic-specific components (Technical, Story Flow, Visual Metaphors)
- Real-time component preview
- Modular and reusable design

### 🤖 **Intelligent AI Composition**
- Automatic component-to-content mapping
- Context-aware animation selection
- Synchronized timing generation
- Scene transitions and layouts

### ✏️ **Advanced Editor**
- Manual mode for precise control
- Drag-and-drop interface
- Subtitle styling (fonts, colors, sizes, positioning)
- End screen with branding and social links
- Timeline control and live preview

### 📦 **Project Management**
- Workspace organization
- Multiple project support
- Auto-save and version history
- Component and subtitle management

### 🎬 **One-Click Export**
- High-quality video rendering (10 Mbps, 30fps)
- Original audio preservation
- All layers included (video + animations + subtitles + end screen)
- Automatic download in WebM format

---

## 🎬 Complete Production Workflow

### 1. **Create Project & Record Video**
- Create a new project in your workspace
- **Record directly in-app** using the built-in camera recorder
  - Apply real-time filters (Warm, Cool, Vintage, Bright, Dramatic)
  - Use virtual backgrounds (Blur, Gradients)
  - Professional camera controls
- Or upload existing video/audio files

### 2. **Generate Subtitles**
Choose your subtitle generation method:
- **AI-Generated**: One-click transcription with Gemini AI
  - English or Hinglish (Romanized Hindi) support
  - Accurate timing and natural language processing
- **Manual Upload**: Upload your own `.srt` file

### 3. **Select Animation Components**
Browse the component library and select animations that match your content:
- Pre-built, professionally designed components
- Topic-specific animations (Technical, Story Flow, Visual Metaphors)
- Real-time preview in Component Gallery
- Or build custom components for your specific needs

### 4. **AI Composition**
The AI intelligently maps your content to animations:
- Analyzes subtitle meaning and context
- Selects appropriate components for each segment
- Generates synchronized animation timelines
- Creates scene transitions and timing

### 5. **Fine-Tune in Editor**
Polish your reel with powerful editing tools:
- **Manual Mode**: Drag-and-drop component placement
- **Subtitle Styling**: Fonts, colors, sizes, backgrounds, positioning
- **End Screen**: Add profile, social links, and call-to-action
- **Timeline Control**: Adjust timing and transitions
- **Live Preview**: See changes in real-time

### 6. **Export Production-Ready Video**
One-click export with everything included:
- **High-Quality Rendering**: 10 Mbps bitrate, 30fps
- **Original Audio**: No re-encoding, perfect sync
- **All Layers**: Video + Animations + Subtitles + End Screen
- **Automatic Download**: WebM format, ready for upload

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/prasannathapa/reel-composer.git
cd reel-composer

# Install dependencies
npm install

# Start the application (runs both frontend and backend)
npm run dev
```

This will start:
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3001 (Express API server)

### Google Gemini API Key

You need a Google Gemini API key to use AI features (subtitle generation, component selection).

**Get your free API key:** Visit Google AI Studio and generate a key.

**Configure in the app:**
1. Open the app and create a workspace
2. Enter your API key when prompted
3. The key is stored securely in your browser's localStorage (session-only)

*Note: Your API key is never sent to any server except Google's Gemini API.*

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Animation Engine**: GSAP (GreenSock Animation Platform)
- **UI Components**: Custom-built with Lucide React icons
- **AI Integration**: Google GenAI SDK (Gemini 2.0 Flash)

### Backend
- **Runtime**: Node.js + Express
- **Database**: SQLite (file-based, zero configuration)
- **File Storage**: Local filesystem for videos and uploads
- **API Design**: RESTful endpoints for project management

### Key Features
- **Component System**: Modular, reusable animation components
- **Canvas Rendering**: Real-time video composition with filters
- **Audio Processing**: Web Audio API for video audio capture
- **Video Export**: MediaRecorder API with display capture
- **SRT Parsing**: Custom subtitle parser with precise timing
- **State Management**: React hooks and context

---

## 👨‍💻 About the Author

<p align="center">
  <img src="public/assets/profile.jpg" alt="Prithviraj" width="200" style="border-radius: 50%;" />
</p>

**Prithviraj**  
*Software Engineer*

Building tools that empower creators to produce professional content at scale.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---

## 📄 License

This project is open source and available for personal and commercial use.

---

## 🎯 Perfect For

- **Educators** creating explainer videos and tutorials
- **Content Creators** producing high-retention social media content
- **Technical Creators** building system design and coding content
- **Entrepreneurs** sharing business insights and growth strategies
- **Course Creators** developing engaging educational material

---

*Built with ❤️ for creators who want to scale quality content production.*
