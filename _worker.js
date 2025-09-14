import { neon } from '@neondatabase/serverless';
import * as bcrypt from 'bcryptjs';

let isDbSetup = false;

// Utility function to validate username
function isValidUsername(username) {
    return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

// Utility function to validate name/surname
function isValidName(name) {
    return /^[а-яА-ЯёЁіІїЇєЄa-zA-Z]+$/.test(name);
}

// Function to set up the database table if it doesn't exist
async function setupDatabase(db) {
    if (isDbSetup) {
        return;
    }
    // Відновлено стовпець session_token
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            surname VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            session_token VARCHAR(255) UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    try {
        await db(createTableQuery);
        isDbSetup = true;
        console.log("Database table 'users' is ready.");
    } catch (error) {
        console.error("Failed to set up database:", error);
        throw error; // Re-throw the error to halt execution if the DB setup fails
    }
}

// Handlers for API routes
async function handleRegistration(request, db) {
    try {
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
        }
        const { username, name, surname, email, password } = await request.json();

        // Basic validation
        if (!username || !name || !surname || !email || !password) {
            return new Response(JSON.stringify({ error: 'All fields are required' }), { status: 400 });
        }
        if (!isValidUsername(username)) {
            return new Response(JSON.stringify({ error: 'Username must contain only A-Z, 0-9, _, - and be 3-20 characters long' }), { status: 400 });
        }
        if (!isValidName(name) || !isValidName(surname)) {
            return new Response(JSON.stringify({ error: 'Name and Surname must contain only letters' }), { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();

        const insertQuery = `INSERT INTO users (id, username, name, surname, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6)`;
        await db(insertQuery, [userId, username, name, surname, email, hashedPassword]);

        return new Response(JSON.stringify({ message: 'User registered successfully' }), { status: 201 });
    } catch (error) {
        console.error('Registration error:', error);
        return new Response(JSON.stringify({ error: 'Failed to register user' }), { status: 500 });
    }
}

async function handleLogin(request, db) {
    try {
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
        }
        const { username, password } = await request.json();
        const userQuery = `SELECT id, password_hash FROM users WHERE username = $1`;
        const user = await db(userQuery, [username]);

        if (!user || user.length === 0) {
            return new Response(JSON.stringify({ error: 'Invalid username or password' }), { status: 401 });
        }

        const isValid = await bcrypt.compare(password, user[0].password_hash);
        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Invalid username or password' }), { status: 401 });
        }

        // Відновлення логіки сесійного токена
        const sessionToken = crypto.randomUUID();
        const updateSessionQuery = `UPDATE users SET session_token = $1 WHERE id = $2`;
        await db(updateSessionQuery, [sessionToken, user[0].id]);

        return new Response(JSON.stringify({ message: 'Login successful' }), {
            status: 200,
            headers: { 'Set-Cookie': `session_token=${sessionToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=3600` }
        });
    } catch (error) {
        console.error('Login error:', error);
        return new Response(JSON.stringify({ error: 'Failed to log in' }), { status: 500 });
    }
}

async function handleLogout(request) {
    // Очистити сесійний cookie
    return new Response(JSON.stringify({ message: 'Logout successful' }), {
        status: 200,
        headers: { 'Set-Cookie': 'session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0' }
    });
}

async function handleGetUser(request, db) {
    // Отримання сесійного токена з cookie
    const sessionToken = request.headers.get('Cookie')?.split('; ').find(row => row.startsWith('session_token='))?.split('=')[1];
    if (!sessionToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const userQuery = `SELECT id, username, name, surname, email FROM users WHERE session_token = $1`;
    const user = await db(userQuery, [sessionToken]);

    if (!user || user.length === 0) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    return new Response(JSON.stringify(user[0]), { status: 200 });
}

async function handleProfileUpdate(request, db) {
    if (request.method !== 'PUT') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }
    // Отримання сесійного токена з cookie
    const sessionToken = request.headers.get('Cookie')?.split('; ').find(row => row.startsWith('session_token='))?.split('=')[1];
    if (!sessionToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const { username, name, surname, email, new_password } = await request.json();

    const userQuery = `SELECT id FROM users WHERE session_token = $1`;
    const user = await db(userQuery, [sessionToken]);
    if (!user || user.length === 0) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const userId = user[0].id;

    // Build the query dynamically
    let updates = [];
    let params = [];
    let paramIndex = 1;

    if (username) {
        if (!isValidUsername(username)) {
            return new Response(JSON.stringify({ error: 'Invalid username' }), { status: 400 });
        }
        updates.push(`username = $${paramIndex++}`);
        params.push(username);
    }
    if (name) {
        if (!isValidName(name)) {
            return new Response(JSON.stringify({ error: 'Invalid name' }), { status: 400 });
        }
        updates.push(`name = $${paramIndex++}`);
        params.push(name);
    }
    if (surname) {
        if (!isValidName(surname)) {
            return new Response(JSON.stringify({ error: 'Invalid surname' }), { status: 400 });
        }
        updates.push(`surname = $${paramIndex++}`);
        params.push(surname);
    }
    if (email) {
        updates.push(`email = $${paramIndex++}`);
        params.push(email);
    }
    if (new_password) {
        const newHashedPassword = await bcrypt.hash(new_password, 10);
        updates.push(`password_hash = $${paramIndex++}`);
        params.push(newHashedPassword);
    }

    if (updates.length > 0) {
        const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        params.push(userId);
        await db(updateQuery, params);
    }

    return new Response(JSON.stringify({ message: 'Profile updated successfully' }), { status: 200 });
}

async function handleDeleteAccount(request, db) {
    if (request.method !== 'DELETE') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }
    // Отримання сесійного токена з cookie
    const sessionToken = request.headers.get('Cookie')?.split('; ').find(row => row.startsWith('session_token='))?.split('=')[1];
    if (!sessionToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const userQuery = `SELECT id FROM users WHERE session_token = $1`;
    const user = await db(userQuery, [sessionToken]);
    if (!user || user.length === 0) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const userId = user[0].id;

    const deleteQuery = `DELETE FROM users WHERE id = $1`;
    await db(deleteQuery, [userId]);

    return new Response(JSON.stringify({ message: 'Account deleted successfully' }), {
        status: 200,
        headers: { 'Set-Cookie': 'session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0' }
    });
}


export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const db = neon(env.DATABASE_URL);

        // CORS headers
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie', // Додано Cookie
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers });
        }

        try {
            await setupDatabase(db);
        } catch (error) {
            return new Response('Database setup failed', { status: 500, headers });
        }

        // API routes
        if (path.startsWith('/api/')) {
            const apiPath = path.substring(5); // remove '/api/'
            switch (apiPath) {
                case 'register':
                    return handleRegistration(request, db);
                case 'login':
                    return handleLogin(request, db);
                case 'logout':
                    return handleLogout(request);
                case 'user':
                    return handleGetUser(request, db);
                case 'profile/update':
                    return handleProfileUpdate(request, db);
                case 'account/delete':
                    return handleDeleteAccount(request, db);
                default:
                    return new Response('Not Found', { status: 404, headers });
            }
        }

        // Serve static assets for all other paths
        return env.ASSETS.fetch(request);
    },
};