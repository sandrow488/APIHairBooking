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

// --- MIDDLEWARE DE SEGURIDAD (Opcional para rutas protegidas) ---
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Falta el token Bearer' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido o expirado' });
  
  req.user = user;
  next();
};

// --- RUTAS DE USUARIOS ---

/**
 * @swagger
 * /api/register:
 * post:
 * summary: Registra un usuario en Supabase Auth y crea su perfil
 * tags: [Usuarios]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [email, password, Nombre, apellido_1]
 * properties:
 * email:
 * type: string
 * password:
 * type: string
 * Nombre:
 * type: string
 * apellido_1:
 * type: string
 * fecha_nacime:
 * type: string
 * format: date
 * responses:
 * 201:
 * description: Usuario creado exitosamente
 * 400:
 * description: Error en el registro
 */
app.post('/api/register', async (req, res) => {
  const { email, password, Nombre, apellido_1, apellido_2, fecha_nacime } = req.body;

  // A. Crear usuario en Auth (Sistema de Login)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirmar email para pruebas
    user_metadata: { full_name: `${Nombre} ${apellido_1}` }
  });

  if (authError) return res.status(400).json({ error: 'Error Auth: ' + authError.message });

  // B. Crear perfil en tabla Usuarios (Tu base de datos)
  const { error: dbError } = await supabase
    .from('Usuarios')
    .insert([
      {
        ID_Usuario: authData.user.id, // Usamos el mismo ID que Auth
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
    return res.status(400).json({ error: 'Error Base de Datos: ' + dbError.message });
  }

  res.status(201).json({ 
    message: 'Usuario registrado con éxito', 
    userId: authData.user.id 
  });
});

/**
 * @swagger
 * /api/usuarios:
 * get:
 * summary: Obtener lista de perfiles
 * tags: [Usuarios]
 * responses:
 * 200:
 * description: Lista de usuarios
 */
app.get('/api/usuarios', async (req, res) => {
  const { data, error } = await supabase
    .from('Usuarios')
    .select('*');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * @swagger
 * /api/usuarios/{id}:
 * get:
 * summary: Obtener un perfil por ID
 * tags: [Usuarios]
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Datos del usuario
 */
app.get('/api/usuarios/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('Usuarios')
    .select('*')
    .eq('ID_Usuario', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(data);
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`📚 Swagger Docs en http://localhost:${port}/api-docs`);
});