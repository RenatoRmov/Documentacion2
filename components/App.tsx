
import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import Dashboard from './Dashboard';
import FleetTable from './FleetTable';
import GeminiAssistant from './GeminiAssistant';
import VehicleModal from './VehicleModal';
import QuickUpdate from './QuickUpdate';
import { MOCK_VEHICLES } from '../constants';
import { Vehicle } from '../types';
import StatusBadge from './StatusBadge';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Inicializar datos desde localStorage o mock
  useEffect(() => {
    const saved = localStorage.getItem('radiomovil_fleet');
    if (saved) {
      try {
        setFleet(JSON.parse(saved));
      } catch (e) {
        console.error("Error al cargar la flota:", e);
        setFleet(MOCK_VEHICLES);
      }
    } else {
      setFleet(MOCK_VEHICLES);
      localStorage.setItem('radiomovil_fleet', JSON.stringify(MOCK_VEHICLES));
    }
  }, []);

  const saveFleet = (newFleet: Vehicle[]) => {
    setFleet(newFleet);
    localStorage.setItem('radiomovil_fleet', JSON.stringify(newFleet));
  };

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setIsModalOpen(true);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleDeleteVehicle = (id: string) => {
    const newFleet = fleet.filter(v => v.id !== id);
    saveFleet(newFleet);
  };

  const handleToggleStatus = (id: string) => {
    const newFleet = fleet.map(v => {
      if (v.id === id) {
        const newStatus = v.statusOperativo === 'Activo' ? 'Inactivo' : 'Activo';
        return { ...v, statusOperativo: newStatus as 'Activo' | 'Inactivo' };
      }
      return v;
    });
    saveFleet(newFleet);
  };

  const handleSaveVehicle = (vehicle: Vehicle) => {
    const isEditing = editingVehicle !== null;
    let newFleet;

    if (isEditing) {
      // Usamos el ID del vehículo que estábamos editando para encontrarlo y reemplazarlo
      newFleet = fleet.map(v => v.id === editingVehicle.id ? vehicle : v);
    } else {
      // Si es nuevo, validamos que el ID no esté duplicado
      if (fleet.find(v => v.id === vehicle.id)) {
        alert(`El N° de Móvil ${vehicle.id} ya existe en el sistema.`);
        return;
      }
      newFleet = [...fleet, vehicle];
    }
    saveFleet(newFleet);
  };

  const handleQuickUpdate = (vehicleId: string, updates: Partial<Vehicle>) => {
    const newFleet = fleet.map(v => {
      if (v.id === vehicleId) {
        return { ...v, ...updates };
      }
      return v;
    });
    saveFleet(newFleet);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard fleet={fleet} onSelectVehicle={handleEditVehicle} />;
      case 'fleet':
        return (
          <FleetTable 
            fleet={fleet} 
            onEdit={handleEditVehicle} 
            onAdd={handleAddVehicle} 
            onDelete={handleDeleteVehicle}
            onToggleStatus={handleToggleStatus}
          />
        );
      case 'quick-update':
        return <QuickUpdate fleet={fleet} onUpdate={handleQuickUpdate} />;
      case 'assistant':
        return <GeminiAssistant fleet={fleet} />;
      case 'expirations':
        return (
          <div className="space-y-6">
            <div className="bg-[#1B1F24] p-8 rounded-2xl border border-white/5 flex justify-between items-center shadow-2xl">
              <div>
                <h3 className="text-xl font-black text-white italic uppercase tracking-widest">Monitor Global de Documentación</h3>
                <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Vista detallada de activos en servicio (Activos)</p>
              </div>
              <button onClick={handleAddVehicle} className="btn-premium px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">
                + Nuevo Móvil
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fleet.filter(v => v.statusOperativo === 'Activo').map(v => (
                <div key={v.id} className="bg-[#1B1F24] rounded-2xl border border-white/5 overflow-hidden flex flex-col hover:border-[#C29329]/30 transition-all group shadow-xl">
                  <div className="p-5 bg-black/20 text-white flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="bg-[#C29329] text-black font-black px-2 py-0.5 rounded-md text-[10px] italic">{v.id}</span>
                      <span className="font-black uppercase tracking-[0.2em] text-xs italic">{v.patente}</span>
                    </div>
                    <button onClick={() => handleEditVehicle(v)} className="text-[8px] font-black text-zinc-600 hover:text-white transition-colors uppercase tracking-widest">Auditar</button>
                  </div>
                  <div className="p-6 space-y-4 flex-1 bg-black/5">
                    <div className="flex justify-between items-center group/row">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Revisión Técnica</span>
                      <StatusBadge dateStr={v.vencimientoRevisionTecnica} />
                    </div>
                    <div className="flex justify-between items-center group/row">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Permiso Circ.</span>
                      <StatusBadge dateStr={v.vencimientoPermisoCirculacion} />
                    </div>
                    <div className="flex justify-between items-center group/row">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">SOAP</span>
                      <StatusBadge dateStr={v.vencimientoSOAP} />
                    </div>
                    <div className="flex justify-between items-center group/row">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Seguro Asientos</span>
                      <StatusBadge dateStr={v.vencimientoSeguroAsiento} />
                    </div>
                    <div className="pt-4 border-t border-white/5 flex justify-between items-center group/row">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Licencia Operador</span>
                      <StatusBadge dateStr={v.vigenciaLicenciaHasta} />
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-black/20 border-t border-white/5">
                    <div className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">Responsable</div>
                    <div className="text-[10px] font-bold text-zinc-300 truncate uppercase tracking-tight">{v.nombreConductor}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {fleet.filter(v => v.statusOperativo === 'Activo').length === 0 && (
              <div className="p-32 text-center opacity-20">
                <div className="text-4xl mb-4">📡</div>
                <p className="text-[10px] font-black uppercase tracking-widest">No hay móviles en servicio operativo activo</p>
              </div>
            )}
          </div>
        );
      default:
        return <Dashboard fleet={fleet} onSelectVehicle={handleEditVehicle} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
      <VehicleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveVehicle}
        initialData={editingVehicle}
      />
    </Layout>
  );
};

export default App;
