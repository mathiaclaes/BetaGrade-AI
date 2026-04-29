// Handler code for the API routes

import { createClient } from './routes/_supabase.js';

const supabase = createClient();

export const handler = async (event) => {
    const { data, error } = await supabase
        .from('your_table')
        .select('*');

    if (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(error),
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(data),
    };
};