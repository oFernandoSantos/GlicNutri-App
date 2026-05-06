import { supabase } from './configSupabase';

export async function listNutritionists({ limit = 80 } = {}) {
  const { data, error } = await supabase
    .from('nutricionista')
    .select('id_nutricionista_uuid, nome_completo_nutri, crm_numero, email_acesso')
    .order('nome_completo_nutri', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

