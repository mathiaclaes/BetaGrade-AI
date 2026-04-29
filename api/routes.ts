import { createClient } from '@supabase/supabase-js';

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_PUBLIC_ANON_KEY');

// GET method to fetch data
export const getHandler = async (req, res) => {
    const { data, error } = await supabase.from('your_table').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
};

// POST method to insert data
export const postHandler = async (req, res) => {
    const { data, error } = await supabase.from('your_table').insert([req.body]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
};

// PATCH method to update data
export const patchHandler = async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase.from('your_table').update(req.body).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
};