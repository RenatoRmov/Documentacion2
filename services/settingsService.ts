import { supabase } from '../lib/supabaseClient';
import { NotificationSettings } from '../types';

const KEY = 'portal_contact';

export interface PortalContact {
  companyName:     string;
  adminName:       string;
  adminTitle:      string;
  contactEmail:    string;
  contactWhatsApp: string;
}

export const settingsService = {
  async saveContact(s: NotificationSettings): Promise<void> {
    const value: PortalContact = {
      companyName:     s.companyName,
      adminName:       s.adminName,
      adminTitle:      s.adminTitle,
      contactEmail:    s.contactEmail,
      contactWhatsApp: s.contactWhatsApp,
    };
    await supabase.from('app_settings').upsert({ key: KEY, value });
  },

  async loadContact(): Promise<PortalContact | null> {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', KEY)
      .single();
    return (data?.value as PortalContact) ?? null;
  },
};
