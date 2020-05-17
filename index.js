const jwt = require('jsonwebtoken');

const bcrypt = require('bcrypt');

const Sequelize = require('sequelize');
const sequelize = new Sequelize('mysql://root@localhost:3306/delilahResto')

const express = require('express');
const app = express();
app.use(express.json());

// Usuarios
app.post('/register', async (req, res) => {
    const { usuario, nombre, email, telefono, direccion, contraseña } = req.body;
    const hash = await bcrypt.hash(contraseña, 10);
    sequelize.query('INSERT INTO usuarios (nombre, direccion, hash, nombre_usuario, telefono, correo) VALUES (?, ?, ?, ?, ?, ?)', {replacements: [nombre, direccion, hash, usuario, telefono, email]})
    .then((resultados) => {
        console.log(resultados);
        res.json("Bienvenido!!!");
    }).catch((err) => {
        res.json("error al crear el usuario")
    })
});
app.post('/login', async (req, res) => {
    const { usuario, contraseña } = req.body;
    const hash = await bcrypt.hash(contraseña, 10);
    switch (usuario) {
        case 'admin':
            sequelize.query(`SELECT nombre, usuario, hash FROM administradores WHERE usuario = "${usuario}"`, {type: sequelize.QueryTypes.SELECT})
            .then(async (resultados) => {
                const datos = resultados[0];
                if (!datos) {
                    res.json("Datos incorrectos!");
                } else{
                    if (await bcrypt.compare(contraseña, datos.hash)) {
                        res.json(`¡¡¡Bienvenido/a administrador/a ${datos.nombre}!!!`);
                    } else{
                        res.json("inicio de sesion incorrecto!!");
                    }
                }
            });    
            break;
        default:
            sequelize.query(`SELECT nombre, nombre_usuario, hash FROM usuarios WHERE nombre_usuario = "${usuario}"`, {type: sequelize.QueryTypes.SELECT})
            .then(async (resultados) => {
                const datos = resultados[0];
                if (!datos) {
                    res.json("Datos incorrectos!");
                } else{
                    if (await bcrypt.compare(contraseña, datos.hash)) {
                        res.json(`¡¡¡Bienvenido/a usuario/a ${datos.nombre}!!!`);
                    } else{
                        res.json("inicio de sesion incorrecto!!");
                    }
                }
            });    
            break;
    }
});
app.get('/ver', (req, res) => {
    sequelize.query(`SELECT * FROM usuarios`, {type: sequelize.QueryTypes.SELECT})
    .then((resultados) => {
        res.json(resultados)
    })
});
// Productos

app.listen(3000, () => {
    console.log('Servidor iniciado!!!');
});