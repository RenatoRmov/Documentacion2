import { supabase } from '../lib/supabaseClient';
import { Conductor } from '../types';
import { fromISODate } from '../constants';

export const mapConductorFromDB = (data: Record<string, unknown>): Conductor => ({
  rut:                  String(data.rut ?? ''),
  numeroMovil:          String(data.numero_movil ?? ''),
  nombre:               String(data.nombre ?? ''),
  fechaNacimiento:      fromISODate(String(data.fecha_nacimiento ?? '')) || String(data.fecha_nacimiento ?? ''),
  celular:              String(data.celular ?? ''),
  email:                String(data.email ?? ''),
  direccion:            String(data.direccion ?? ''),
  comuna:               String(data.comuna ?? ''),
  claseLicencia:        String(data.clase_licencia ?? ''),
  leyLicencia:          String(data.ley_licencia ?? ''),
  municipalidadLicencia:String(data.municipalidad_licencia ?? ''),
  vigenciaCarnetDesde:  fromISODate(String(data.vigencia_carnet_desde ?? '')) || String(data.vigencia_carnet_desde ?? ''),
  vigenciaCarnetHasta:  fromISODate(String(data.vigencia_carnet_hasta ?? '')) || String(data.vigencia_carnet_hasta ?? ''),
  vigenciaLicenciaDesde:fromISODate(String(data.vigencia_licencia_desde ?? '')) || String(data.vigencia_licencia_desde ?? ''),
  vigenciaLicenciaHasta:fromISODate(String(data.vigencia_licencia_hasta ?? '')) || String(data.vigencia_licencia_hasta ?? ''),
  vencimientoSeguroVida:fromISODate(String(data.vencimiento_seguro_vida ?? '')) || String(data.vencimiento_seguro_vida ?? ''),
  aseguradoraVida:      String(data.aseguradora_vida ?? ''),
  conductorToken:       data.conductor_token ? String(data.conductor_token) : undefined,
});

export const conductorService = {
  async fetchConductors(): Promise<Conductor[]> {
    const { data, error } = await supabase
      .from('conductores')
      .select('*')
      .order('numero_movil', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapConductorFromDB);
  },

  async fetchConductorByRut(rut: string): Promise<Conductor | null> {
    const { data } = await supabase
      .from('conductores')
      .select('*')
      .eq('rut', rut)
      .single();
    return data ? mapConductorFromDB(data as Record<string, unknown>) : null;
  },

  async fetchConductorByToken(token: string): Promise<Conductor | null> {
    const { data } = await supabase
      .from('conductores')
      .select('*')
      .eq('conductor_token', token)
      .single();
    return data ? mapConductorFromDB(data as Record<string, unknown>) : null;
  },

  async updateConductor(rut: string, updates: Partial<Conductor>): Promise<void> {
    const dbData: Record<string, unknown> = {};
    if (updates.vigenciaCarnetDesde   !== undefined) dbData.vigencia_carnet_desde   = updates.vigenciaCarnetDesde   || null;
    if (updates.vigenciaCarnetHasta   !== undefined) dbData.vigencia_carnet_hasta   = updates.vigenciaCarnetHasta   || null;
    if (updates.vigenciaLicenciaDesde !== undefined) dbData.vigencia_licencia_desde = updates.vigenciaLicenciaDesde || null;
    if (updates.vigenciaLicenciaHasta !== undefined) dbData.vigencia_licencia_hasta = updates.vigenciaLicenciaHasta || null;
    if (updates.vencimientoSeguroVida !== undefined) dbData.vencimiento_seguro_vida = updates.vencimientoSeguroVida || null;
    if (updates.aseguradoraVida       !== undefined) dbData.aseguradora_vida        = updates.aseguradoraVida;
    if (updates.celular               !== undefined) dbData.celular                 = updates.celular;
    if (updates.email                 !== undefined) dbData.email                   = updates.email;
    await supabase.from('conductores').update(dbData).eq('rut', rut);
  },
};
