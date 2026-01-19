const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sci-Request System API',
      version: '1.0.0',
      description: 'API Documentation สำหรับระบบคำร้องคณะวิทยาศาสตร์ (รองรับ E2EE)',
      contact: {
        name: 'Developer Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080/api/v1',
        description: 'Local Development',
      },
      {
        url: 'https://sci-request-system-466086429766.asia-southeast1.run.app/api/v1',
        description: 'Production Server',
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
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'ประเภทของข้อผิดพลาด',
              example: 'Bad Request'
            },
            message: {
              type: 'string',
              description: 'รายละเอียดของปัญหา',
              example: 'Invalid input provided.'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // ระบุ Path ให้ชัดเจน
  apis: [path.join(__dirname, '../routes/*.js')], 
};

console.log('⏳ Generating Swagger Spec...');
try {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  const outputPath = path.join(__dirname, '../swagger.json');
  fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
  console.log(`✅ Documentation built successfully at: ${outputPath}`);
} catch (err) {
  console.error('❌ Error generating docs:', err);
}