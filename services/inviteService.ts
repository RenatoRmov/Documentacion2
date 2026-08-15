import { supabase } from '../lib/supabaseClient';

export interface Invite {
  token: string;
  numeroMovil: string;
  expiresAt: string;
  usedAt: string | null;
}

const mapInvite = (data: Record<string, unknown>): Invite => ({
  token:       String(data.token ?? ''),
  numeroMovil: String(data.numero_movil ?? ''),
  expiresAt:   String(data.expires_at ?? ''),
  usedAt:      data.used_at ? String(data.used_at) : null,
});

export const inviteService = {
  // Crea una invitación de un solo uso para dar de alta un móvil nuevo.
  async createInvite(numeroMovil: string): Promise<string> {
    const { data, error } = await supabase
      .from('onboarding_invites')
      .insert({ numero_movil: numeroMovil })
      .select('token')
      .single();
    if (error) throw error;
    return String((data as Record<string, unknown>).token);
  },

  async fetchInvite(token: string): Promise<Invite | null> {
    const { data, error } = await supabase
      .from('onboarding_invites')
      .select('*')
      .eq('token', token)
      .single();
    if (error || !data) return null;
    return mapInvite(data as Record<string, unknown>);
  },

  async markUsed(token: string, conductorRut: string): Promise<void> {
    const { error } = await supabase
      .from('onboarding_invites')
      .update({ used_at: new Date().toISOString(), conductor_rut: conductorRut })
      .eq('token', token);
    if (error) throw error;
  },
};
