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
                    description: "Se requiere un token JWT válido (Access Token de Supabase)."
                },
            },
        },
        security: [
            // Aplicar seguridad JWT por defecto a todas las rutas, excepto las de login/registro
            // Las rutas protegidas requerirán el header: Authorization: Bearer <token>
            {
                bearerAuth: [],
            },
        ],
        tags: [
            { name: "Usuarios", description: "Gestión de perfiles y autenticación." },
            { name: "Productos y Servicios", description: "Gestión de la oferta de la empresa." },
        ]
    },
    // Aquí indicamos dónde buscar los comentarios para generar la doc
    apis: ["./app.js"],
};

const specs = swaggerJsdoc(options);
module.exports = specs;