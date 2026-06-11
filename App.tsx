
import React, { useState, useEffect } from 'react';
import { vehicleService } from './services/vehicleService';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import FleetTable from './components/FleetTable';
import GeminiAssistant from './components/GeminiAssistant';
import VehicleWizard, { ConductorForm, VehicleEntry } from './components/VehicleWizard';
import QuickUpdate from './components/QuickUpdate';
import Automatizaciones from './components/Automatizaciones';
import { MOCK_VEHICLES } from './constants';
import { Vehicle } from './types';
import StatusBadge from './components/StatusBadge';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Cargar datos desde Supabase
  const loadFleet = async () => {
    try {
      const data = await vehicleService.fetchVehicles();
      setFleet(data);
    } catch (error) {
      console.error("Error al cargar la flota:", error);
      // Fallback a localStorage/Mock si falla Supabase en desarrollo
      const saved = localStorage.getItem('radiomovil_fleet');
      if (saved) {
        setFleet(JSON.parse(saved));
      } else {
        setFleet(MOCK_VEHICLES);
      }
    }
  };

  useEffect(() => {
    loadFleet();
  }, []);

  // Función auxiliar para actualizar estado local y recargar
  const refreshFleet = async () => {
    await loadFleet();
  };

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setIsModalOpen(true);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleDeleteVehicle = async (patente: string) => {
    if (confirm('¿Estás seguro de eliminar este vehículo?')) {
      try {
        await vehicleService.deleteVehicle(patente);
        refreshFleet();
      } catch (error) {
        alert('Error al eliminar vehículo');
      }
    }
  };

  const handleToggleStatus = async (patente: string) => {
    const vehicle = fleet.find(v => v.patente === patente);
    if (vehicle) {
      const newStatus = vehicle.statusOperativo === 'Activo' ? 'Inactivo' : 'Activo';
      try {
        await vehicleService.updateVehicle(patente, { statusOperativo: newStatus });
        refreshFleet();
      } catch (error) {
        console.error('Error updating status:', error);
      }
    }
  };

  const handleWizardSave = async (conductor: ConductorForm, vehicleEntries: VehicleEntry[]) => {
    try {
      for (const ve of vehicleEntries) {
        const vehicle: Vehicle = {
          id: conductor.numeroMovil,
          patente: ve.patente,
          tipo: ve.tipo, marca: ve.marca, modelo: ve.modelo, color: ve.color,
          año: ve.año, asientos: ve.asientos, estado: ve.estado, statusOperativo: ve.statusOperativo,
          nombrePropietario: ve.nombrePropietario, rutPropietario: ve.rutPropietario,
          vencimientoPadron: ve.vencimientoPadron,
          vencimientoPermisoCirculacion: ve.vencimientoPermisoCirculacion,
          municipalidadPermiso: ve.municipalidadPermiso,
          vencimientoRevisionTecnica: ve.vencimientoRevisionTecnica,
          vencimientoSOAP: ve.vencimientoSOAP,
          vencimientoControlTaximetro: ve.vencimientoControlTaximetro,
          certificadoAntecedentes: ve.certificadoAntecedentes as Vehicle['certificadoAntecedentes'],
          prestacionSS: ve.prestacionSS as Vehicle['prestacionSS'],
          contratoArriendo: ve.contratoArriendo as Vehicle['contratoArriendo'],
          vencimientoSeguroAccidentes: ve.vencimientoSeguroAccidentes,
          lugarSeguroAccidentes: ve.lugarSeguroAccidentes,
          vencimientoSeguroAsiento: ve.vencimientoSeguroAsiento,
          aseguradoraAsiento: ve.aseguradoraAsiento,
          vencimientoSeguroVidaConductor: conductor.vencimientoSeguroVida,
          aseguradoraVida: conductor.aseguradoraVida,
          nombreConductor: conductor.nombre,
          rutConductor: conductor.rut,
          fechaNacimiento: conductor.fechaNacimiento,
          celular: conductor.celular,
          email: conductor.email,
          direccion: conductor.direccion,
          comuna: conductor.comuna,
          claseLicencia: conductor.claseLicencia,
          leyLicencia: conductor.leyLicencia,
          municipalidadLicencia: conductor.municipalidadLicencia,
          vigenciaCarnetDesde: conductor.vigenciaCarnetDesde,
          vigenciaCarnetHasta: conductor.vigenciaCarnetHasta,
          vigenciaLicenciaDesde: conductor.vigenciaLicenciaDesde,
          vigenciaLicenciaHasta: conductor.vigenciaLicenciaHasta,
          conductorRut: conductor.rut || null,
        };
        const exists = fleet.some(fv => fv.patente === ve.patente);
        if (exists) {
          await vehicleService.updateVehicle(ve.patente, vehicle);
        } else {
          await vehicleService.createVehicle(vehicle);
        }
      }
      refreshFleet();
      setIsModalOpen(false);
      setEditingVehicle(null);
    } catch (error) {
      console.error('Error saving:', error);
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`Error al guardar: ${msg}`);
    }
  };

  const handleQuickUpdate = async (patente: string, updates: Partial<Vehicle>) => {
    try {
      await vehicleService.updateVehicle(patente, updates);
      refreshFleet();
    } catch (error) {
      console.error('Error updating vehicle:', error);
    }
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
      case 'automatizaciones':
        return <Automatizaciones fleet={fleet} />;
      case 'expirations':
        return (
          <div className="space-y-6">
            <div className="bg-[#1B1F24] p-8 rounded-2xl border border-white/5 flex justify-between items-center shadow-2xl">
              <div>
                <h3 className="text-xl font-black text-white italic uppercase tracking-widest">Monitor Global de Documentación</h3>
                <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Visibilidad de activos en servicio (Móviles Activos)</p>
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
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Padrón</span>
                      <StatusBadge dateStr={v.vencimientoPadron} />
                    </div>
                    <div className="flex justify-between items-center group/row">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">C. Antecedentes</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${v.certificadoAntecedentes === 'OK' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {v.certificadoAntecedentes || 'Sin Info'}
                      </span>
                    </div>
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
                <p className="text-[10px] font-black uppercase tracking-widest">No hay móviles operativos registrados</p>
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
      <VehicleWizard
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingVehicle(null); }}
        onSave={handleWizardSave}
        initialVehicles={
          editingVehicle
            ? (editingVehicle.rutConductor
                ? fleet.filter(v => v.rutConductor === editingVehicle.rutConductor)
                : [editingVehicle])
            : []
        }
      />
    </Layout>
  );
};

export default App;
