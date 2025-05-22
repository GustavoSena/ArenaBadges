import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/interfaces'

export class DBInitError extends Error {
  constructor() {
    super('Supabase client not initialized');
  }
}

let supabase :SupabaseClient<Database,"public"> 

export function setupSupabase(url: string, key: string) {
  supabase = createClient<Database>(url, key)
  return supabase;
}

export function isDatabaseInitialized() {
  return supabase !== undefined;
}


export async function queryWallets(wallets: string[]) {
    if (!supabase) {
        throw new DBInitError();
    }

    const { data, error } = await supabase
    .from('users')
    .select("twitter_handle, wallet")
    .in('wallet', wallets)
    if (error) throw error;
    return data;
}