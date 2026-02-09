import React from 'react';
import { Instagram, Youtube, Twitter, Code2, Sparkles } from 'lucide-react';

interface EndScreenProps {
  profileImage?: string;
  name?: string;
  tagline?: string;
  socialHandles?: {
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  showSocialIcons?: boolean;
}

export const EndScreen: React.FC<EndScreenProps> = ({
  profileImage = '/assets/profile.jpg', // Default to local project file
  name = "Prithvi Raj",
  tagline = "Follow for more",
  socialHandles,
  showSocialIcons = true
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center z-[100]" 
         style={{ 
           height: '100vh', 
           width: '100%',
           background: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 50%, #020617 100%)',
           paddingTop: '15vh',
           transform: 'scale(0.9)',
           transformOrigin: 'center top'
         }}>
      {/* Animated Grid Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }}></div>
      </div>

      {/* Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in">
        {/* Profile Circle with Enhanced Glow */}
        <div className="relative">
          {/* Rotating gradient ring */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-lg opacity-75 animate-spin-slow"></div>
          
          {/* Profile Image Container */}
          <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-slate-800 bg-slate-900 shadow-2xl">
            {profileImage ? (
              <img 
                src={profileImage} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
                <span className="text-6xl font-bold text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Name & Titles */}
        <div className="text-center space-y-4">
          <h2 className="text-5xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
            {name}
          </h2>
          
          {/* Professional Titles */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <Code2 size={20} className="animate-pulse" />
              <span className="text-lg font-semibold">Software Engineer</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-purple-400">
              <Sparkles size={20} className="animate-pulse" style={{ animationDelay: '0.5s' }} />
              <span className="text-lg font-semibold">Technical Architect</span>
            </div>
          </div>

          {/* Tagline */}
          <div className="mt-6 px-6 py-3 rounded-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 backdrop-blur-sm">
            <p className="text-xl text-gray-200 font-semibold">
              {tagline}
            </p>
          </div>
        </div>

        {/* Social Icons */}
        {showSocialIcons && (
          <div className="flex gap-4 mt-2">
            {socialHandles?.instagram && (
              <div className="p-3 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 hover:scale-110 transition-transform cursor-pointer shadow-lg hover:shadow-pink-500/50">
                <Instagram size={24} className="text-white" />
              </div>
            )}
            {socialHandles?.youtube && (
              <div className="p-3 rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:scale-110 transition-transform cursor-pointer shadow-lg hover:shadow-red-500/50">
                <Youtube size={24} className="text-white" />
              </div>
            )}
            {socialHandles?.twitter && (
              <div className="p-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 hover:scale-110 transition-transform cursor-pointer shadow-lg hover:shadow-blue-500/50">
                <Twitter size={24} className="text-white" />
              </div>
            )}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .animate-fade-in {
            animation: fade-in 1s ease-out;
          }
          
          @keyframes spin-slow {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          
          .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
          }
          
          @keyframes gridMove {
            0% { transform: translateY(0); }
            100% { transform: translateY(50px); }
          }
        `}
      </style>
    </div>
  );
};
