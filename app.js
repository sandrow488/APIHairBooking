require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger'); // Importa tu swagger corregido

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
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Falta el token Bearer' });

    // Verificar el token con Supabase
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.user = data.user;
    next();
  } catch (err) {
    console.error('Error en requireAuth:', err);
    return res.status(401).json({ error: 'Error verificando token' });
  }
};

// ------------------------------------
// --- RUTAS DE AUTENTICACIÓN Y USUARIOS ---
// ------------------------------------

/**
 * @openapi
 * /api/register:
 *   post:
 *     summary: Registra un usuario en Supabase Auth y crea su perfil
 *     tags:
 *       - Usuarios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioRegistro'
 *     responses:
 *       '201':
 *         description: Usuario creado exitosamente
 *       '400':
 *         description: Error en el registro
 */
app.post('/api/register', async (req, res) => {
  const { email, password, Nombre, apellido_1, apellido_2, fecha_nacime } = req.body;

  try {
    // A. Crear usuario en Auth (Sistema de Login)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${Nombre} ${apellido_1}` }
    });

    if (authError) {
      console.error('Auth createUser error:', authError);
      return res.status(400).json({ error: 'Error Auth: ' + authError.message });
    }

    // B. Crear perfil en tabla Usuarios
    const { error: dbError } = await supabase
      .from('usuarios')
      .insert([
        {
          ID_Usuario: authData.user.id,
          Correo: email,
          Nombre,
          apellido_1,
          apellido_2,
          fecha_nacime
        }
      ]);

    if (dbError) {
      // Si falla la DB, borramos el usuario de Auth para no dejar basura
      await supabase.auth.admin.deleteUser(authData.user.id);
      console.error('DB insert error:', dbError);
      return res.status(400).json({ error: 'Error Base de Datos: ' + dbError.message });
    }

    res.status(201).json({
      message: 'Usuario registrado con éxito',
      userId: authData.user.id
    });
  } catch (err) {
    console.error('Registro - error inesperado:', err);
    res.status(500).json({ error: 'Error interno en el registro' });
  }
});

/**
 * @openapi
 * /api/login:
 *   post:
 *     summary: Inicia sesión y obtiene un JWT (Webtoken)
 *     tags:
 *       - Usuarios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 *     responses:
 *       '200':
 *         description: Login exitoso. Devuelve el JWT (access_token)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *       '400':
 *         description: Credenciales inválidas
 */
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(400).json({ error: 'Error de Login: ' + error.message });
    }

    res.json({
      access_token: data.session.access_token,
      expires_in: data.session.expires_in,
    });
  } catch (err) {
    console.error('Login - error inesperado:', err);
    res.status(500).json({ error: 'Error interno en el login' });
  }
});

/**
 * @openapi
 * /api/oauth/{provider}:
 *   get:
 *     summary: Inicia el flujo de autenticación social (GitHub o Google)
 *     tags:
 *       - Usuarios
 *     description: El cliente debe usar la URL devuelta para redirigirse al proveedor. (Solo inicio del flujo)
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, github]
 *         description: Proveedor de autenticación
 *     responses:
 *       '200':
 *         description: Devuelve la URL del proveedor para iniciar sesión.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 redirectUrl:
 *                   type: string
 *                   format: url
 *       '400':
 *         description: Proveedor no soportado.
 */
app.get('/api/oauth/:provider', async (req, res) => {
  const { provider } = req.params;
  const allowedProviders = ['google', 'github'];

  if (!allowedProviders.includes(provider)) {
    return res.status(400).json({ error: 'Proveedor de OAuth no soportado' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
      },
    });

    if (error) {
      console.error('OAuth init error:', error);
      return res.status(500).json({ error: 'Error al iniciar OAuth: ' + error.message });
    }

    res.json({ redirectUrl: data.url });
  } catch (err) {
    console.error('OAuth - error inesperado:', err);
    res.status(500).json({ error: 'Error interno al iniciar OAuth' });
  }
});

/**
 * @openapi
 * /api/perfil:
 *   get:
 *     summary: Obtener el perfil del usuario autenticado (Protegida por JWT)
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Perfil del usuario autenticado.
 *       '401':
 *         description: No autorizado (Token inválido o faltante).
 */
app.get('/api/perfil', requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('ID_Usuario', userId)
      .single();

    if (error) {
      console.error('Perfil - DB error:', error);
      return res.status(404).json({ error: 'Perfil no encontrado en DB' });
    }
    res.json(data);
  } catch (err) {
    console.error('Perfil - error inesperado:', err);
    res.status(500).json({ error: 'Error interno al obtener perfil' });
  }
});


/**
 * @openapi
 * /api/usuarios:
 *   get:
 *     summary: Obtener lista de perfiles de la DB (Acceso Público)
 *     tags:
 *       - Usuarios
 *     responses:
 *       '200':
 *         description: Lista de usuarios
 */
app.get('/api/usuarios', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*');

    if (error) {
      console.error('Usuarios list - DB error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (err) {
    console.error('Usuarios list - error inesperado:', err);
    res.status(500).json({ error: 'Error interno al listar usuarios' });
  }
});

/**
 * @openapi
 * /api/usuarios/{id}:
 *   get:
 *     summary: Obtener un perfil por ID (Acceso Público)
 *     tags:
 *       - Usuarios
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario (UUID de Supabase Auth)
 *     responses:
 *       '200':
 *         description: Datos del usuario
 *       '404':
 *         description: Usuario no encontrado
 */
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('ID_Usuario', req.params.id)
      .single();

    if (error) {
      console.error('Usuario get - DB error:', error);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(data);
  } catch (err) {
    console.error('Usuario get - error inesperado:', err);
    res.status(500).json({ error: 'Error interno al obtener usuario' });
  }
});

// --------------------------------------------
// --- RUTAS DE PRODUCTOS Y SERVICIOS (CRUD) ---
// --------------------------------------------

/**
 * @openapi
 * /api/servicios:
 *   post:
 *     summary: Crear un nuevo servicio (Ruta protegida)
 *     tags:
 *       - Productos y Servicios
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Servicio'
 *     responses:
 *       '201':
 *         description: Servicio creado exitosamente.
 *       '401':
 *         description: No autorizado.
 */
app.post('/api/servicios', requireAuth, async (req, res) => {
  const { nombre, descripcion, precio, duracion } = req.body;

  try {
    const { data, error } = await supabase
      .from('servicios')
      .insert([{ nombre, descripcion, precio, duracion }])
      .select();

    if (error) {
      console.error('Servicios create - DB error:', error);
      return res.status(400).json({ error: error.message });
    }
    res.status(201).json(data[0]);
  } catch (err) {
    console.error('Servicios create - error inesperado:', err);
    res.status(500).json({ error: 'Error interno al crear servicio' });
  }
});

/**
 * @openapi
 * /api/servicios:
 *   get:
 *     summary: Obtener todos los servicios (Acceso público)
 *     tags:
 *       - Productos y Servicios
 *     responses:
 *       '200':
 *         description: Lista de servicios.
 */
app.get('/api/servicios', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*');

    if (error) {
      console.error('Servicios list - DB error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (err) {
    console.error('Servicios list - error inesperado:', err);
    res.status(500).json({ error: 'Error interno al listar servicios' });
  }
});

/**
 * @openapi
 * /api/servicios/{id}:
 *   put:
 *     summary: Actualizar un servicio por ID (Ruta protegida)
 *     tags:
 *       - Productos y Servicios
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del servicio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               precio:
 *                 type: number
 *               duracion:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Servicio actualizado.
 *       '404':
 *         description: Servicio no encontrado.
 *       '401':
 *         description: No autorizado.
 */
app.put('/api/servicios/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .update(req.body)
      .eq('ID_servicio', req.params.id)
      .select();

    if (error) {
      console.error('Servicios update - DB error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    res.json(data[0]);
  } catch (err) {
    console.error('Servicios update - error inesperado:', err);
    res.status(500).json({ error: 'Error interno al actualizar servicio' });
  }
});

/**
 * @openapi
 * /api/servicios/{id}:
 *   delete:
 *     summary: Eliminar un servicio por ID (Ruta protegida)
 *     tags:
 *       - Productos y Servicios
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del servicio
 *     responses:
 *       '204':
 *         description: Servicio eliminado exitosamente (No Content).
 *       '404':
 *         description: Servicio no encontrado.
 *       '401':
 *         description: No autorizado.
 */
app.delete('/api/servicios/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('servicios')
      .delete()
      .eq('ID_servicio', req.params.id);

    if (error) {
      console.error('Servicios delete - DB error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Servicios delete - error inesperado:', err);
    res.status(500).json({ error: 'Error interno al eliminar servicio' });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`📚 Swagger Docs en http://localhost:${port}/api-docs`);
});
