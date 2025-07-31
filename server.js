const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = 4000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

//conexion a la db
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  reconnect: true,
});

db.connect((err) => {
  if (err) throw err;
  console.log('Conexion a la db estblecida');
});





//------ Funcion de envio mensual automatico
const enviarResumenMensual = () => {
  const query = `
    SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN LOWER(comentario) LIKE '%queja%' THEN 1 ELSE 0 END) AS total_quejas,
  SUM(CASE WHEN LOWER(comentario) LIKE '%reclamo%' THEN 1 ELSE 0 END) AS total_reclamos,
  SUM(CASE WHEN LOWER(comentario) LIKE '%sugerencia%' THEN 1 ELSE 0 END) AS total_sugerencias,
  SUM(CASE WHEN LOWER(comentario) LIKE '%felicitacion%' OR LOWER(comentario) LIKE '%felicitación%' THEN 1 ELSE 0 END) AS total_felicitaciones
  FROM quejas
  WHERE
  fechaQueja >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
  AND fechaQueja < DATE_FORMAT(CURDATE(), '%Y-%m-01');`;

  db.query(query, async (err, result) => {
    if (err) {
      console.error('❌ Error al contar quejas:', err);
      return;
    }

    const total = result[0].total;
    const total_quejas = result[0].total_quejas;
    const total_felicitaciones = result[0].total_felicitaciones;
    const total_sugerencias = result[0].total_sugerencias;
    const total_reclamos = result[0].total_reclamos;
    
    console.log(total)
    try {
      const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email: 'mercado.aviles@yahoo.com.mx',
          message: `Resumen del sistema CBN Buzón:\n
          Durante el mes pasado se registraron un total de ${total} comentarios.\n
          - Quejas: ${total_quejas}\n
          - Reclamos: ${total_reclamos}\n
          - Sugerencias: ${total_sugerencias}\n
          - Felicitaciones: ${total_felicitaciones}\n`
        }
      });

      console.log('Correo enviado', response.data);
    } catch (error) {
      console.error('error al enviar correo', error.response?.data || error.message);
    }
  });
};

//---- node cron de correo automatico
//  minuto/Hora/dia_mes/mes/dia_semana
cron.schedule('42 9 25 6 *', () => {
  console.log('ejecutando funcion de resumen mensual');
  enviarResumenMensual();
});


//rutas 
app.post('/quejas', (req, res) => {
  const {
    fechaIncidente, nombre, apellido, comentario,
    area, descripcion, anonimo, evidencia, firma
  } = req.body;

  const sql = `
    INSERT INTO quejas 
    (fechaIncidente, nombre, apellido, comentario, area, descripcion, anonimo, evidencia, firma)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [
    fechaIncidente, nombre, apellido, comentario,
    area, descripcion, anonimo === 'true' || anonimo === true, evidencia, firma
  ], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al guardar la queja' });
    res.json({ message: 'Queja guardada correctamente', id: result.insertId });
  });
});


app.get('/getquejas', (req, res) => {
  db.query('SELECT * FROM quejas ORDER BY fechaQueja DESC', (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener las quejas' });
    res.json(results);
  });
});
//------------------------------ del paneel del admin------------------------------------
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM admin WHERE correo = ? AND contrasena = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Error en el servidor' });
    }

    if (results.length > 0) {
      res.json({ success: true, admin: results[0] });
    } else {
      res.json({ success: false, message: 'Correo o contraseña incorrectos' });
    }
  });
});

// Endpoint filtrado para el panel de admin
app.get('/quejas-filtradas', (req, res) => {
  const { area, fecha } = req.query;

  let query = "SELECT * FROM quejas WHERE 1=1";
  let params = [];

  if (area) {
    query += " AND area LIKE ?";
    params.push(`%${area}%`);
  }

  if (fecha) {
    query += " AND DATE(fechaQueja) = ?";
    params.push(fecha);
  }

  query += " ORDER BY fechaQueja DESC";

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Error al obtener quejas filtradas:', err);
      return res.status(500).json({ error: 'Error al obtener quejas filtradas' });
    }

    res.json(results);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

