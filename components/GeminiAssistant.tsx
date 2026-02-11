
import React, { useState, useRef, useEffect } from 'react';
import { askGemini } from '../services/geminiService';
import { Vehicle } from '../types';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface GeminiAssistantProps {
  fleet: Vehicle[];
}

const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ fleet }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'SISTEMA OPERATIVO INICIALIZADO. Soy el Asistente Inteligente de RadioMovil. Puedo procesar consultas complejas sobre su flota global, detectar patrones de vencimiento y auditar el estado operativo en tiempo real. ¿Cuál es su requerimiento?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    const aiResponse = await askGemini(userMsg, fleet);
    setMessages(prev => [...prev, { role: 'ai', text: aiResponse || 'SISTEMA: ERROR DE RESPUESTA.' }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[700px] glass-panel rounded-[2.5rem] overflow-hidden max-w-4xl mx-auto shadow-[0_50px_100px_rgba(0,0,0,0.6)] border-white/5">
      <div className="p-6 bg-slate-950 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center text-slate-900 shadow-lg shadow-amber-500/10">
            <span className="text-xl">✨</span>
          </div>
          <div>
            <div className="font-black text-xs text-white uppercase tracking-widest italic">Operations Intelligence</div>
            <div className="text-[8px] text-slate-500 uppercase font-bold tracking-[0.3em] mt-0.5">GEMINI_ENGINE v4.2 PRO</div>
          </div>
        </div>
        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
           <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">ENCRIPTADO_SSL</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#020617] custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-2xl text-[11px] leading-relaxed tracking-wide shadow-2xl border ${
              m.role === 'user' 
              ? 'brand-gradient text-slate-950 font-black italic rounded-br-none border-amber-400/50' 
              : 'bg-white/[0.03] text-slate-300 border-white/5 rounded-bl-none font-medium'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl rounded-bl-none flex gap-1.5">
              <div className="w-1 h-1 bg-amber-500 rounded-full animate-ping"></div>
              <div className="w-1 h-1 bg-amber-500 rounded-full animate-ping [animation-delay:0.2s]"></div>
              <div className="w-1 h-1 bg-amber-500 rounded-full animate-ping [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-950 border-t border-white/5">
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Analizar estado de conductores, vencimientos de móviles o auditoría de registros..." 
            className="flex-1 px-6 py-4 bg-white/[0.03] border border-white/10 rounded-2xl focus:outline-none focus:border-amber-500/50 text-xs font-semibold text-white placeholder:text-slate-600 transition-all shadow-inner"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={loading}
            className="bg-white text-slate-950 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-amber-400 disabled:opacity-30 active:scale-[0.98]"
          >
            EXEC_QUERY
          </button>
        </div>
        <p className="text-[8px] text-slate-700 mt-4 text-center font-bold uppercase tracking-[0.4em] italic">
          Terminal de Inteligencia Operativa - RadioMovil Enterprise
        </p>
      </div>
    </div>
  );
};

export default GeminiAssistant;
