require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 5432;
const { Pool } = require('pg'); // Usamos 'pg' en lugar de 'mysql2'

const connectionString = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL 
  : `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString: connectionString,
  // Supabase requiere SSL para conexiones externas
  ssl: { rejectUnauthorized: false } 
});

// Middleware para el anÃ¡lisis del cuerpo de solicitudes en formato JSON
app.use(express.json());

// Ruta para obtener todos los usuarios
app.get('/api/users', (req, res) => {
  pool.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error('Error al obtener usuarios:', err);
      res.status(500).json({ error: 'Error al obtener usuarios' });
    } else {
      res.json({ users: results.rows }); // Cambiado results por results.rows
    }
  });
});

// Ruta para obtener un usuario por su ID
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  pool.query('SELECT * FROM users WHERE id = $1', [userId], (err, results) => { // $1 en lugar de ?
    if (err) {
      console.error('Error al obtener el usuario:', err);
      res.status(500).json({ error: 'Error al obtener el usuario' });
    } else {
      if (results.rows.length === 0) {
        res.status(404).json({ message: 'Usuario no encontrado' });
      } else {
        res.json({ user: results.rows[0] }); // Cambiado results por results.rows
      }
    }
  });
});

// Ruta para crear un nuevo usuario
app.post('/api/users', (req, res) => {
  const newUser = req.body;
  pool.query('INSERT INTO users (nombre, email) VALUES ($1, $2)', [newUser.nombre, newUser.email], (err, results) => { // $1, $2 en lugar de ?
    if (err) {
      console.error('Error al crear el usuario:', err);
      res.status(500).json({ error: 'Error al crear el usuario' });
    } else {
      res.json({ message: 'Usuario creado con Ã©xito', user: newUser });
    }
  });
});

// Ruta para actualizar un usuario por su ID
app.put('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const updatedUser = req.body;
  pool.query('UPDATE users SET nombre = $1, email = $2 WHERE id = $3', [updatedUser.nombre, updatedUser.email, userId], (err, results) => { // $1, $2, $3 en lugar de ?
    if (err) {
      console.error('Error al actualizar el usuario:', err);
      res.status(500).json({ error: 'Error al actualizar el usuario' });
    } else {
      res.json({ message: 'Usuario actualizado con Ã©xito', user: updatedUser });
    }
  });
});

// Ruta para eliminar un usuario por su ID
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  pool.query('DELETE FROM users WHERE id = $1', [userId], (err, results) => { // $1 en lugar de ?
    if (err) {
      console.error('Error al eliminar el usuario:', err);
      res.status(500).json({ error: 'Error al eliminar el usuario' });
    } else {
      res.json({ message: 'Usuario eliminado con Ã©xito' });
    }
  });
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`El servidor estÃ¡ escuchando en el puerto ${port}`);
});