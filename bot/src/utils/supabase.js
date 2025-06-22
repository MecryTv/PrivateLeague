const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Key is not defined");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
