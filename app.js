require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger'); // Importamos tu archivo swagger.js

// Inicialización
const app = express();
const port = process.env.PORT || 3000;

// 1. Conexión a Supabase (Modo Admin)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

app.use(express.json());

// 2. Ruta de Documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
console.log(`📄 Documentación disponible en http://localhost:${port}/api-docs`);

// --- MIDDLEWARE DE SEGURIDAD (Para rutas protegidas - JWT) ---
/**
 * Verifica y valida el JWT de Supabase.
 * Nota: El token debe ser el 'access_token' devuelto por /api/login o el OAuth.
 */
const requireAuth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Falta el token Bearer' });

    // En el backend, usamos supabase.auth.getUser(token) para verificar el JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.user = user; // Adjuntamos la info del usuario a la request
    next();
};

// ------------------------------------
// --- RUTAS DE AUTENTICACIÓN Y USUARIOS ---
// ------------------------------------

// [RUTA EXISTENTE] /api/register

/**
 * @swagger
 * /api/login:
 * post:
 * summary: Inicia sesión y obtiene un JWT (Webtoken)
 * tags: [Usuarios]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [email, password]
 * properties:
 * email:
 * type: string
 * password:
 * type: string
 * responses:
 * 200:
 * description: Login exitoso. Devuelve el JWT (access_token)
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * access_token:
 * type: string
 * expires_in:
 * type: integer
 * 400:
 * description: Credenciales inválidas
 */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // Supabase sign in: usa la clave ANÓNIMA por seguridad, pero en este caso 
    // como usamos una clave ADMIN, debemos usar el auth.signInWithPassword para
    // simular el flujo normal (en lugar de auth.admin.signIn)
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) return res.status(400).json({ error: 'Error de Login: ' + error.message });

    // El objeto de sesión contiene el access_token (JWT) y el refresh_token
    res.json({
        access_token: data.session.access_token,
        expires_in: data.session.expires_in,
    });
});

// ------------------------------------
// --- RUTAS DE OAUTH (GITHUB Y GMAIL) ---
// ------------------------------------

/**
 * @swagger
 * /api/oauth/{provider}:
 * get:
 * summary: Inicia el flujo de autenticación social (GitHub o Google)
 * tags: [Usuarios]
 * description: El cliente debe redirigirse a esta URL para iniciar el flujo. Devuelve la URL de redirección al proveedor.
 * parameters:
 * - in: path
 * name: provider
 * required: true
 * schema:
 * type: string
 * enum: [google, github]
 * description: Proveedor de autenticación
 * responses:
 * 200:
 * description: Devuelve la URL del proveedor para iniciar sesión.
 * 400:
 * description: Proveedor no soportado.
 */
app.get('/api/oauth/:provider', async (req, res) => {
    const { provider } = req.params;
    const allowedProviders = ['google', 'github'];

    if (!allowedProviders.includes(provider)) {
        return res.status(400).json({ error: 'Proveedor de OAuth no soportado' });
    }

    // Nota: El 'redirectTo' es la URL a la que Supabase redirigirá *después* del login.
    // Usualmente es una URL de tu frontend que maneja la respuesta (ej. /auth/callback)
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: 'http://localhost:3000/auth/callback', // Cambia esto por tu URL de frontend
        },
    });

    if (error) {
        return res.status(500).json({ error: 'Error al iniciar OAuth: ' + error.message });
    }

    // Redirigimos al cliente a la URL generada por Supabase
    res.json({ redirectUrl: data.url });
});

// [RUTA EXISTENTE] /api/register
// [RUTA EXISTENTE] /api/usuarios
// [RUTA EXISTENTE] /api/usuarios/{id}

/**
 * @swagger
 * /api/perfil:
 * get:
 * summary: Obtener el perfil del usuario autenticado (Protegida por JWT)
 * tags: [Usuarios]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Perfil del usuario autenticado.
 * 401:
 * description: No autorizado (Token inválido o faltante).
 */
app.get('/api/perfil', requireAuth, async (req, res) => {
    // req.user contiene la información del usuario del JWT validado
    const userId = req.user.id; 

    const { data, error } = await supabase
        .from('Usuarios')
        .select('*')
        .eq('ID_Usuario', userId)
        .single();

    if (error) return res.status(404).json({ error: 'Perfil no encontrado en DB' });
    res.json(data);
});

// --------------------------------------------
// --- RUTAS DE PRODUCTOS Y SERVICIOS (CRUD) ---
// --------------------------------------------

/**
 * Basado en tu DB:
 * Tabla: servicios (ID_servicio, nombre, descripcion, precio, duracion)
 * Tabla: productos (ID_producto, ID_empresa, producto, precio, cantidad, servicios)
 * * Usaremos la tabla 'servicios' para el CRUD. Asumiremos que es la entidad principal de 'HairBooking'.
 * Estas rutas deberían ser protegidas (solo para empleados/administradores, no para clientes).
 */

/**
 * @swagger
 * /api/servicios:
 * post:
 * summary: Crear un nuevo servicio (Ruta protegida)
 * tags: [Productos y Servicios]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [nombre, descripcion, precio, duracion]
 * properties:
 * nombre: { type: string }
 * descripcion: { type: string }
 * precio: { type: number, format: float }
 * duracion: { type: string, format: time }
 * responses:
 * 201:
 * description: Servicio creado exitosamente.
 * 401:
 * description: No autorizado.
 */
app.post('/api/servicios', requireAuth, async (req, res) => {
    const { nombre, descripcion, precio, duracion } = req.body;

    const { data, error } = await supabase
        .from('servicios')
        .insert([{ nombre, descripcion, precio, duracion }])
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data[0]);
});

/**
 * @swagger
 * /api/servicios:
 * get:
 * summary: Obtener todos los servicios (Acceso público)
 * tags: [Productos y Servicios]
 * responses:
 * 200:
 * description: Lista de servicios.
 */
app.get('/api/servicios', async (req, res) => {
    const { data, error } = await supabase
        .from('servicios')
        .select('*');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

/**
 * @swagger
 * /api/servicios/{id}:
 * put:
 * summary: Actualizar un servicio por ID (Ruta protegida)
 * tags: [Productos y Servicios]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: integer
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * nombre: { type: string }
 * descripcion: { type: string }
 * precio: { type: number, format: float }
 * duracion: { type: string, format: time }
 * responses:
 * 200:
 * description: Servicio actualizado.
 * 404:
 * description: Servicio no encontrado.
 * 401:
 * description: No autorizado.
 */
app.put('/api/servicios/:id', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('servicios')
        .update(req.body)
        .eq('ID_servicio', req.params.id)
        .select();

    if (error) return res.status(400).json({ error: error.message });
    if (data.length === 0) return res.status(404).json({ error: 'Servicio no encontrado' });

    res.json(data[0]);
});

/**
 * @swagger
 * /api/servicios/{id}:
 * delete:
 * summary: Eliminar un servicio por ID (Ruta protegida)
 * tags: [Productos y Servicios]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: integer
 * responses:
 * 204:
 * description: Servicio eliminado exitosamente.
 * 404:
 * description: Servicio no encontrado.
 * 401:
 * description: No autorizado.
 */
app.delete('/api/servicios/:id', requireAuth, async (req, res) => {
    const { error } = await supabase
        .from('servicios')
        .delete()
        .eq('ID_servicio', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    
    // Supabase no devuelve un indicador de si se eliminó o no, 
    // pero podemos asumir 204 No Content si la operación es exitosa
    res.status(204).send(); 
});


// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
    console.log(`📚 Swagger Docs en http://localhost:${port}/api-docs`);
});