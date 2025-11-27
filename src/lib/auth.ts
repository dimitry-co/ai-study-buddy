import { supabase } from './supabase';

/**
 * Sign up new user
 */
const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  return { data, error };
};

/**
 * Sign in existing user
 */
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
};

/**
 * Sign out
 */
const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

/**
 * Get current user
 */
const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

/**
 * Check if user is admin
 */
const isAdmin = async (email: string) => {
  const ADMIN_EMAILS = [
    'gallegodimitry@gmail.com',
    'khinethandrazaw1998.ktz@gmail.com'
  ];

  return ADMIN_EMAILS.includes(email);
};

/**
 * Check if user has active subscription
 */
const hasActiveSubscription = async (userId: string) => {
  const { data, error } = await supabase
    .from('subscriptions') // Query the subscriptions table
    .select('status, current_period_end') // get these two columns
    .eq('user_id', userId) // Filter by user_id
    .single(); // expect exactly one result (get single subscription record)

  if (error || !data) return false;

  // Allow access if:
  // 1. Status is 'active' (actively paying), OR
  // 2. Status is 'canceled' (user canceled but still in paid period)
  // AND subscription hasn't expired yet (current_period_end is in future)
  const validStatuses = ['active', 'canceled'];
  const isActive = validStatuses.includes(data.status);
  const notExpired = new Date(data.current_period_end) > new Date();

  return isActive && notExpired;
};

export { signUp, signIn, signOut, getCurrentUser, isAdmin, hasActiveSubscription };