const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HairBooking API',
      version: '1.0.0',
      description: 'API RESTful para la gestión de usuarios, autenticación (JWT y OAuth) y servicios de una peluquería, utilizando Supabase como backend.',
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Servidor Local de Desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      // <-- Aquí van los schemas (IMPORTANTE)
      schemas: {
        UsuarioRegistro: {
          type: 'object',
          required: ['email', 'password', 'Nombre', 'apellido_1'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
            Nombre: { type: 'string' },
            apellido_1: { type: 'string' },
            apellido_2: { type: 'string' },
            fecha_nacime: { type: 'string', format: 'date' },
          },
        },
        Login: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        Servicio: {
          type: 'object',
          required: ['nombre', 'descripcion', 'precio', 'duracion'],
          properties: {
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            precio: { type: 'number', format: 'float' },
            duracion: { type: 'string', description: 'Formato HH:MM:SS' },
          },
        },
      },
    },
    tags: [
      { name: 'Usuarios', description: 'Operaciones de autenticación y perfiles' },
      { name: 'Productos y Servicios', description: 'Gestión de servicios de peluquería' },
    ],
  },
  apis: ['./app.js'],
};

const swaggerSpecs = swaggerJsdoc(options);
module.exports = swaggerSpecs;
