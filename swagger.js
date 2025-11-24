const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HairBooking API Pro",
      version: "1.0.0",
      description:
        "API para gestión de HairBooking con Autenticación JWT y OAuth",
      contact: {
        name: "Soporte TI",
        email: "soporte@hairbooking.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Servidor Local",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Aquí indicamos dónde buscar los comentarios para generar la doc
  apis: ["./app.js"],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
