const express = require('express');
const app = express();

const Sequelize = require('sequelize');
const sequelize = new Sequelize('mysql://root@localhost:3306/delilahResto')
try{
    sequelize.query('SELECT * FROM usuarios',
        { type: sequelize.QueryTypes.SELECT}
    ).then(function (resultados) {
        console.log(resultados);
    });
}catch(err){
    console.error('Ocurrio un error!', err)
};

app.use(express.json());

app.get('/productos', (req, res) => {
    res.json(listaProductos);
});

app.listen(3000, () => {
    console.log('Servidor iniciado!!!');
});