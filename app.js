require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

// Inicialización de la app
const app = express();
const port = process.env.PORT || 3000;

console.log("Intentando conectar a la base de datos...");

// Configuración de la conexión a PostgreSQL
// Prioriza DATABASE_URL (Producción/Supabase/Render) sobre variables individuales
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString: connectionString,
  // ssl: { rejectUnauthorized: false } // Descomenta esta línea si usas Render, Heroku o Supabase en producción
});

// Middleware
app.use(express.json());

// --- RUTAS PARA LA TABLA 'Usuarios' ---

// 1. Obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    // NOTA: Usamos comillas dobles en "Usuarios" porque PostgreSQL es case-sensitive si la tabla se creó con mayúsculas
    const results = await pool.query('SELECT * FROM "Usuarios"');
    res.json({ usuarios: results.rows });
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// 2. Obtener un usuario por su ID_Usuario
app.get('/api/usuarios/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const results = await pool.query('SELECT * FROM "Usuarios" WHERE "ID_Usuario" = $1', [userId]);
    
    if (results.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json({ user: results.rows[0] });
  } catch (err) {
    console.error('Error al obtener el usuario:', err);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
});

// 3. Crear un nuevo usuario
app.post('/api/usuarios', async (req, res) => {
  const {
    ID_Usuario,
    password,
    Correo,
    Nombre,
    apellido_1,
    apellido_2,
    fecha_nacime // Asumo que este es el nombre exacto de tu columna según tu código anterior
  } = req.body;

  // Validación básica
  if (!ID_Usuario || !password || !Correo || !Nombre || !apellido_1 || !fecha_nacime) {
    return res.status(400).json({ 
      error: 'Faltan campos obligatorios (ID_Usuario, password, Correo, Nombre, apellido_1, fecha_nacime)' 
    });
  }

  const query = `
    INSERT INTO "Usuarios"
    ("ID_Usuario", "password", "Correo", "Nombre", "apellido_1", "apellido_2", "fecha_nacime")
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  
  const values = [ID_Usuario, password, Correo, Nombre, apellido_1, apellido_2, fecha_nacime];

  try {
    const results = await pool.query(query, values);
    res.status(201).json({ message: 'Usuario creado con éxito', user: results.rows[0] });
  } catch (err) {
    console.error('Error al crear el usuario:', err);
    if (err.code === '23505') { // Código de error de Postgres para violación de unique constraint
       return res.status(409).json({ error: 'El ID_Usuario o Correo ya existe' });
    }
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// 4. Actualizar un usuario
app.put('/api/usuarios/:id', async (req, res) => {
  const userId = req.params.id;
  const {
    password,
    Correo,
    Nombre,
    apellido_1,
    apellido_2,
    fecha_nacime
  } = req.body;

  const query = `
    UPDATE "Usuarios"
    SET "password" = $1, "Correo" = $2, "Nombre" = $3, "apellido_1" = $4, "apellido_2" = $5, "fecha_nacime" = $6
    WHERE "ID_Usuario" = $7
    RETURNING *
  `;

  const values = [password, Correo, Nombre, apellido_1, apellido_2, fecha_nacime, userId];

  try {
    const results = await pool.query(query, values);
    if (results.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado para actualizar' });
    }
    res.json({ message: 'Usuario actualizado con éxito', user: results.rows[0] });
  } catch (err) {
    console.error('Error al actualizar el usuario:', err);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// 5. Eliminar un usuario
app.delete('/api/usuarios/:id', async (req, res) => {
  const userId = req.params.id;
  
  try {
    const results = await pool.query('DELETE FROM "Usuarios" WHERE "ID_Usuario" = $1', [userId]);
    
    if (results.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado con éxito' });
  } catch (err) {
    console.error('Error al eliminar el usuario:', err);
    if (err.code === '23503') { // Violación de Foreign Key
      return res.status(400).json({ 
        error: 'No se puede eliminar el usuario porque tiene registros relacionados (Empresa o Clientes).' 
      });
    }
    res.status(500).json({ error: 'Error al eliminar el usuario' });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`El servidor está escuchando en el puerto ${port}`);
});