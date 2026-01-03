import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, AlertTriangle, ExternalLink, Key, Zap, Settings, PlayCircle, Sliders, CheckSquare, Square } from 'lucide-react';
import { validateGeminiConnection } from '../services/geminiService';
import { APP_CONFIG } from '../config';

interface WelcomeScreenProps {
  onComplete: (apiKey: string | null, model?: string, saveManualMode?: boolean) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const [mode, setMode] = useState<'selection' | 'custom'>('selection');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(APP_CONFIG.DEFAULT_MODEL);
  const [customModelString, setCustomModelString] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Manual Mode Preference
  const [manualModePermanent, setManualModePermanent] = useState(false);

  const handleFreeTier = () => {
    // Use the default key from config
    onComplete(APP_CONFIG.DEFAULT_API_KEY, APP_CONFIG.DEFAULT_MODEL);
  };

  const handleCustomValidation = async () => {
    if (!apiKey.trim()) {
      setError("Please enter a valid API Key.");
      return;
    }
    
    const modelToUse = selectedModel === 'custom' ? customModelString : selectedModel;
    if (!modelToUse.trim()) {
        setError("Please specify a model.");
        return;
    }

    setIsValidating(true);
    setError(null);
    
    const isValid = await validateGeminiConnection(apiKey, modelToUse);
    
    setIsValidating(false);
    
    if (isValid) {
      onComplete(apiKey, modelToUse);
    } else {
      setError("Connection failed. Please check your key or internet connection.");
    }
  };

  const handleManualSkip = () => {
    // Pass null to indicate manual mode (no API key)
    onComplete(null, undefined, manualModePermanent);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-pink-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="max-w-2xl w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10 animate-fade-in">
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-6 shadow-lg shadow-purple-900/50 rotate-3 transition-transform hover:rotate-6">
            <PlayCircle className="text-white fill-white/20" size={40} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-pink-200 tracking-tight">
            Reel Composer
          </h1>
          <p className="text-gray-400 mt-4 text-lg font-light max-w-lg mx-auto">
            Your AI-powered director for high-retention video content.
          </p>
        </div>

        {mode === 'selection' ? (
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Free Tier */}
                <button 
                  onClick={handleFreeTier}
                  className="group relative flex flex-col items-start p-6 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-purple-500 rounded-2xl transition-all hover:shadow-xl hover:shadow-purple-900/20 text-left"
                >
                   <div className="absolute top-4 right-4 bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                     Recommended
                   </div>
                   <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                      <Zap size={24} />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-1">Quick Start</h3>
                   <p className="text-sm text-gray-400 mb-4">Use the built-in free tier key. Instant access.</p>
                   <div className="mt-auto flex items-center gap-2 text-xs text-gray-500 font-mono">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Gemini 2.5 Flash
                   </div>
                </button>

                {/* Option 2: Custom Key */}
                <button 
                  onClick={() => setMode('custom')}
                  className="group relative flex flex-col items-start p-6 bg-transparent border border-gray-700 hover:border-gray-500 hover:bg-gray-800/50 rounded-2xl transition-all text-left"
                >
                   <div className="p-3 bg-gray-700/50 text-gray-300 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                      <Settings size={24} />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-1">Custom Key</h3>
                   <p className="text-sm text-gray-400 mb-4">Bring your own Google Gemini API Key for Pro models.</p>
                   <div className="mt-auto flex items-center gap-2 text-xs text-gray-500 font-mono">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Pro / Custom Models
                   </div>
                </button>
             </div>

             <div className="flex flex-col items-center gap-3 pt-4 border-t border-gray-800/50">
                <button 
                  onClick={handleManualSkip}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-4"
                >
                  Enter Manual Mode (No AI)
                </button>
                
                <button 
                    type="button"
                    onClick={() => setManualModePermanent(!manualModePermanent)}
                    className="flex items-center gap-2 cursor-pointer group select-none hover:bg-gray-800/50 px-3 py-1.5 rounded-lg transition-colors outline-none"
                >
                    <div className="text-gray-600 group-hover:text-purple-500 transition-colors">
                        {manualModePermanent ? <CheckSquare size={14} /> : <Square size={14} />}
                    </div>
                    <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors">
                        Don't ask again (Always start in Manual Mode)
                    </span>
                </button>
             </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
             {/* Custom Key Form */}
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-300">
                        Configuration
                    </label>
                    <button onClick={() => setMode('selection')} className="text-xs text-purple-400 hover:text-purple-300">
                        Back to Options
                    </button>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-400">Gemini API Key</label>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                            <ExternalLink size={10} /> Get Free Key
                        </a>
                    </div>
                    <div className="relative group">
                        <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-mono text-sm"
                        />
                        <div className="absolute inset-0 rounded-xl bg-purple-500/5 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-gray-400 flex items-center gap-1"><Sliders size={12}/> Model Selection</label>
                    <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none text-sm appearance-none"
                    >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Best Balance - Default)</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Fastest, Higher Limits)</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Complex Scenes, Lower Limits)</option>
                        <option value="custom">Custom...</option>
                    </select>

                    {selectedModel === 'custom' && (
                        <input
                            type="text"
                            value={customModelString}
                            onChange={(e) => setCustomModelString(e.target.value)}
                            placeholder="e.g. gemini-1.5-pro-latest"
                            className="w-full mt-2 bg-black/40 border border-gray-700 rounded-xl px-4 py-2 text-white focus:border-purple-500 outline-none text-sm"
                        />
                    )}
                </div>

                <div className="flex items-start gap-3 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                    <ShieldCheck className="text-green-400 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-gray-400 leading-relaxed">
                        Your key and preferences are stored locally in your browser.
                    </p>
                </div>
             </div>

             <button
                onClick={handleCustomValidation}
                disabled={isValidating}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                    isValidating 
                    ? 'bg-gray-700 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {isValidating ? (
                   <span className="flex items-center gap-2">
                     <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                     Verifying Connection...
                   </span>
                ) : (
                   <>Save & Continue <ArrowRight size={18} /></>
                )}
              </button>
              
             {error && (
              <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-xs flex items-center gap-3 animate-shake">
                <AlertTriangle size={16} /> {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};