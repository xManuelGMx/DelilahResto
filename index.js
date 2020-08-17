const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Sequelize = require('sequelize');
const sequelize = new Sequelize('mysql://root@localhost:3306/delilahResto')

const express = require('express');
const app = express();
app.use(express.json());

const passJWT = "pass";

// Registrar usuario
app.post('/usuario/crear', async (req, res) => {
    const { usuario, nombre, email, telefono, direccion, contraseña } = req.body;
    const hash = await bcrypt.hash(contraseña, 10);

    sequelize.query('INSERT INTO usuarios (nombre, direccion, hash, nombre_usuario, telefono, correo) VALUES (?, ?, ?, ?, ?, ?)', {replacements: [nombre, direccion, hash, usuario, telefono, email]})
    .then((resultados) => {
        const info = {
            idUsuario: resultados[0],
            usuario: usuario,
            admin: 0
        };
        const token = jwt.sign(info, passJWT);
        res.status(201).json({ token });
    }).catch((err) => {
        res.status(422).json({error: "Datos inválidos"})
    })
});
// Login usuario
app.post('/usuario/login', async (req, res) => {
    const { usuario, contraseña } = req.body;
    const hash = await bcrypt.hash(contraseña, 10);
    console.log(hash)
    sequelize.query(`SELECT id, nombre, nombre_usuario, hash, admin FROM usuarios WHERE nombre_usuario = "${usuario}"`, {type: sequelize.QueryTypes.SELECT})
    .then(async (resultados) => {
        const datos = resultados[0];
        const info = {
            idUsuario: datos.id,
            usuario: usuario,
            admin: datos.admin
        };
        const token = jwt.sign(info, passJWT);
        if (!datos) {
            res.status(422).json("Datos incorrectos!");
        } else{
            if (datos.admin === 1) {
                if (await bcrypt.compare(contraseña, datos.hash)) {
                    res.status(200).json({"mensaje": `¡¡¡Bienvenido/a administrador/a ${datos.nombre}!!!`, token});
                }
            } else {
                if (await bcrypt.compare(contraseña, datos.hash)) {
                    res.status(200).json({"mensaje": `¡¡¡Bienvenido/a usuario/a ${datos.nombre}!!!`, token});
                }
            }
        }
    }).catch((err) => {
        res.status(401).json({error: "Inicio de sesion incorrecto!!"});
    });    
});
app.get('/usuario/ver', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const info = jwt.verify(token, passJWT);
    if (info.admin === 1) {
        sequelize.query(`SELECT * FROM usuarios`, {type: sequelize.QueryTypes.SELECT})
        .then((resultados) => {
            res.status(200).json(resultados)
        }).catch((err) => {
            res.status(500).json({error: "Internal Server Error"});
        })
    } else {
        res.status(403).json('No tiene permisos de realizar esta acción!')
    }
});
let listaProductos = [];
app.get('/producto/ver', (req, res) => {
    sequelize.query(`SELECT * FROM productos`, {type: sequelize.QueryTypes.SELECT})
    .then((resultados) => {
        listaProductos = resultados;
        res.status(200).json(resultados)
    }).catch((err) => {
        res.status(500).json({error: "Internal Server Error"});
    })
});
// Listar productos disponibles
let listaPedido = [];
function agregarProducto(id_usuario, cantidad){
    let producto = listaProductos.find(e => e.id === +id_usuario);
    if (producto.disponible === 1) {
        for (let i = 1; i <= cantidad; i++) {
            listaPedido.push(+id_usuario);
        }
    }
}
app.post('/pedido/crear', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const info = jwt.verify(token, passJWT);

    // Recibir objeto con id's y cantidad de los productos en lista
    const { lista, tipoPago } = req.body;
    const ids = Object.keys(lista);
    const cant = Object.values(lista);
    
    listaPedido = [];
    for (let i = 0; i < ids.length; i++) {
        agregarProducto(ids[i], cant[i]);
    }
    agregarProducto(1,1);

    console.log(listaPedido);
    let descp = "";
    let n = 1;
    let cantidadFinal = [];
    for (let i = 1; i < listaPedido.length; i++) {
        let productoAnterior = listaProductos.find(e => e.id === listaPedido[i-1]);
        let productoActual = listaProductos.find(e => e.id === listaPedido[i]);
        let nAnterior = n;
        if (productoAnterior.nombre === productoActual.nombre) {
            n++;
        } else{
            n=1;
        }
        let nActual = n;
        if (nActual <= nAnterior) { 
            cantidadFinal.push(nAnterior);
            descp += productoAnterior.nombre +" x "+ nAnterior + ", ";
        }
    }
    descp = descp.substr(0, descp.length-2)
    console.log(`Descripción: ${descp}`);
    
    listaPedido.pop();
    let valorTotal = 0;
    listaPedido.forEach(id => {
        let producto = listaProductos.find(e => e.id === id);
        valorTotal += producto.precio;
    })

    const fecha = new Date();
    let horaActual = fecha.getHours()+":"+fecha.getMinutes();
    sequelize.query('INSERT INTO pedidos (estado, hora, descripcion, tipo_pago, valor_total, id_usuario) VALUES (?, ?, ?, ?, ?, ?)', {replacements: ["Creado", horaActual, descp, tipoPago, valorTotal, info.idUsuario]})
    .then((resultados) => {
        console.log(resultados[0]);
        listaPedido.forEach(id => {
            sequelize.query('INSERT INTO pedidos_productos (id_pedido, id_producto) VALUES (?, ?)', {replacements: [resultados[0], id]})
            .then((resultados) => {
                res.status(200).json("Producto relacionado al pedido actual");
            }).catch((err) => {
                console.error("Ocurrió un error: "+err)
                res.status(500).json("error al relacionar productos con el pedido actual")
            })
        });
        res.status(201).json("Pedido creado");
    }).catch((err) => {
        console.error("Ocurrió un error: "+err)
        res.status(422).json("error al crear el pedido")
    })
});

app.put('/pedido/actualizar/estado', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const info = jwt.verify(token, passJWT);

    const { idPedido, nuevoEstado } = req.body;
    if (info.admin === 1) {
        sequelize.query('UPDATE pedidos SET estado = ? WHERE id = ?', {replacements: [nuevoEstado, idPedido]})
        .then((resultados) => {
            res.status(200).json('Estado del pedido actualizado con éxito');
        }).catch((err) => {
            res.status(500).json("error al actualizar estado")
        })
    } else {
        res.status(403).json('No tiene permisos de realizar esta acción!')
    }
});
app.post('/producto/crear', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const info = jwt.verify(token, passJWT);
    
    const { nombre, precio } = req.body
    if (info.admin === 1) {
        sequelize.query('INSERT INTO productos (nombre, precio) VALUES (?, ?)', {replacements: [nombre, precio]})
        .then((resultados) => {
            console.log(resultados);
            res.status(201).json("Producto creado");
        }).catch((err) => {
            res.status(422).json("Error al crear el producto, datos inválidos")
        })
    } else {
        res.status(403).json('No tiene permisos de realizar esta acción!')
    }
});
app.put('/producto/actualizar', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const info = jwt.verify(token, passJWT);
    
    const { idProducto, cambios, nombre, precio, disponibilidad } = req.body;
    if (info.admin === 1) {
        cambios.forEach(e => {
            switch (e) {
                case 'nombre':
                    sequelize.query('UPDATE productos SET nombre = ? WHERE id = ?', {replacements: [nombre, idProducto]})
                    .then((resultados) => {
                        res.status(200).json('Producto actualizado');
                    }).catch((err) => {
                        res.status(500).json("error al actualizar producto")
                    })
                    break;
                case 'precio':
                    sequelize.query('UPDATE productos SET precio = ? WHERE id = ?', {replacements: [precio, idProducto]})
                    .then((resultados) => {
                        res.status(200).json('Producto actualizado');
                    }).catch((err) => {
                        res.status(500).json("error al actualizar producto")
                    })
                    break;
                case 'disponibilidad':
                    sequelize.query('UPDATE productos SET disponible = ? WHERE id = ?', {replacements: [disponibilidad, idProducto]})
                    .then((resultados) => {
                        res.status(200).json('Producto actualizado');
                    }).catch((err) => {
                        res.status(500).json("error al actualizar producto")
                    })
                    break;
                default:
                    break;
            }
        })
    } else {
        res.status(403).json('No tiene permisos de realizar esta acción!')
    }
});
app.delete('/producto/eliminar', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const info = jwt.verify(token, passJWT);
    
    const { listaId } = req.body;
    if (info.admin === 1) {
        listaId.forEach(id => {
            sequelize.query('DELETE FROM productos WHERE id = ?', {replacements: [id]})
            .then((resultados) => {
                console.log(resultados);
                res.status(200).json("Producto eliminado");
            }).catch((err) => {
                res.status(500).json("Error al eliminar el producto")
            })
        })
    } else {
        res.status(403).json('No tiene permisos de realizar esta acción!')
    }
});
app.delete('/pedido/eliminar', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const info = jwt.verify(token, passJWT);
    
    const { listaId } = req.body;
    if (info.admin === 1) {
        listaId.forEach(id => {
            sequelize.query('DELETE FROM pedidos WHERE id = ?', {replacements: [id]})
            .then((resultados) => {
                console.log(resultados);
                res.status(200).json("Pedido eliminado");
            }).catch((err) => {
                res.status(500).json("Error al eliminar el pedido")
            })
        })
    } else {
        res.status(403).json('No tiene permisos de realizar esta acción!')
    }
});
app.put('/pedido/actualizar', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const info = jwt.verify(token, passJWT);
    
    const { idPedido, cambios, estado, hora, descripcion, tipo_pago, valor_total } = req.body;
    if (info.admin === 1) {
        cambios.forEach(e => {
            switch (e) {
                case 'estado':
                    sequelize.query('UPDATE pedidos SET estado = ? WHERE id = ?', {replacements: [estado, idPedido]})
                    .then((resultados) => {
                        res.status(200).json('Pedido actualizado');
                    }).catch((err) => {
                        res.status(500).json("error al actualizar pedido");
                    })
                    break;
                case 'hora':
                    sequelize.query('UPDATE pedidos SET hora = ? WHERE id = ?', {replacements: [hora, idPedido]})
                    .then((resultados) => {
                        res.status(200).json('Pedido actualizado');
                    }).catch((err) => {
                        res.status(500).json("error al actualizar pedido");
                    })
                    break;
                case 'descripcion':
                    sequelize.query('UPDATE pedidos SET descripcion = ? WHERE id = ?', {replacements: [descripcion, idPedido]})
                    .then((resultados) => {
                        res.status(200).json('Pedido actualizado');
                    }).catch((err) => {
                        res.status(500).json("error al actualizar pedido");
                    })
                    break;
                case 'tipo_pago':
                    sequelize.query('UPDATE pedidos SET tipo_pago = ? WHERE id = ?', {replacements: [tipo_pago, idPedido]})
                    .then((resultados) => {
                        res.status(200).json('Pedido actualizado');
                    }).catch((err) => {
                        res.status(500).json("error al actualizar pedido");
                    })
                    break;
                case 'valor_total':
                    sequelize.query('UPDATE pedidos SET valor_total = ? WHERE id = ?', {replacements: [valor_total, idPedido]})
                    .then((resultados) => {
                        res.status(200).json('Pedido actualizado');
                    }).catch((err) => {
                        res.status(500).json("error al actualizar pedido");
                    })
                    break;      
                default:
                    break;
            }
        })
    } else {
        res.status(403).json('No tiene permisos de realizar esta acción!')
    }
});
app.listen(3000, () => {
    console.log('Servidor iniciado!!!');
});