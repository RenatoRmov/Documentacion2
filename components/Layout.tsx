
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard',       label: 'Centro de Comando', icon: '📊' },
    { id: 'fleet',           label: 'Flota Operativa',   icon: '🚗' },
    { id: 'quick-update',    label: 'Sincronizador',      icon: '⚡' },
    { id: 'expirations',     label: 'Monitor Auditoría',  icon: '⏰' },
    { id: 'automatizaciones', label: 'Alertas Auto',      icon: '🔔' },
    { id: 'assistant',       label: 'Operaciones IA',     icon: '✨' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#111418]">
      {/* Sidebar Tecnológico */}
      <aside className="w-64 bg-[#0A0C0E] flex flex-col z-30 border-r border-white/5 shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 brand-gradient rounded-lg flex items-center justify-center shadow-lg shadow-amber-900/20">
              <span className="text-[#0A0C0E] font-black text-lg">R</span>
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white uppercase italic leading-none">RadioMovil</h1>
              <p className="text-[7px] font-bold text-zinc-600 uppercase tracking-[0.4em] mt-1">Global Assets</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 mt-2 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group ${
                activeTab === item.id 
                ? 'bg-white/5 text-white font-semibold' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
              }`}
            >
              <span className={`text-lg transition-transform ${activeTab === item.id ? 'opacity-100 scale-105' : 'opacity-20 group-hover:opacity-100'}`}>
                {item.icon}
              </span>
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold">{item.label}</span>
              {activeTab === item.id && (
                <div className="ml-auto w-1 h-3 bg-[#C29329] rounded-full shadow-[0_0_10px_rgba(194,147,41,0.4)]"></div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 mt-auto bg-black/20">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="relative">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" className="w-8 h-8 rounded-lg bg-zinc-900" alt="Avatar" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-600 border-2 border-[#0A0C0E] rounded-full"></div>
            </div>
            <div className="overflow-hidden">
              <p className="text-[9px] font-black text-zinc-200 truncate uppercase tracking-tight">OPERADOR_MASTER</p>
              <p className="text-[7px] text-zinc-600 uppercase font-bold tracking-tighter">Nodo Central SCL</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-[#0A0C0E]/60 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-10 z-20">
          <div className="flex items-center gap-3">
             <div className="h-4 w-[1px] bg-[#C29329]/50"></div>
             <h2 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.5em] italic">
               {menuItems.find(m => m.id === activeTab)?.label}
             </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-md bg-white/[0.02] border border-white/5">
               <div className="flex items-center gap-1.5">
                 <span className="text-[8px] font-bold text-zinc-600 uppercase">Status:</span>
                 <span className="text-[8px] font-black text-emerald-600 uppercase">Operational</span>
               </div>
               <div className="w-[1px] h-3 bg-white/5"></div>
               <div className="flex items-center gap-1.5">
                 <span className="text-[8px] font-bold text-zinc-600 uppercase">Ping:</span>
                 <span className="text-[8px] font-black text-emerald-600 uppercase">12ms</span>
               </div>
            </div>
            <button className="text-zinc-500 hover:text-white transition-colors text-lg relative group">
              🔔
              <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#C29329] rounded-full border border-[#0A0C0E] group-hover:animate-pulse"></span>
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#111418]">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
