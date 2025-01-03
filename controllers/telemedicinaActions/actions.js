//CONFIGS
const express = require('express');
const { sequelize, sandbox } = require('../../db');
const axios = require('axios');
const { faker } = require('@faker-js/faker');

//SCHEMAS
const Franqueado = require('../../schema/tb_franqueado');
const Clientes = require('../../schema/tb_clientes');
const Rapidoc = require('../../schema/tb_rapidoc');



module.exports = {
    ativar: async(req, res) => {
        
          console.log("chamar control");
          console.log("verificando....:", req.body == 1);
        
        ///ativar vida manualmente via painel oimed
    
          var cpfNumber = req.body.nu_documento;
        var numericCpfNumber = cpfNumber.replace(/\D/g, "");
        const cpf = numericCpfNumber;
  
  try {
      
      if(req.body == 1) {
          
            //configuracao da data
            const myDate = req.body.birthday;
            console.log(req.body)
            
            const dia = myDate.substr(0, 2);
            const mes = myDate.substr(2, 2);
            const ano = myDate.substr(4, 4);
        
            const dataVerify = /\//.test(myDate);
            
            var modifieData1 = () => {
                const dataSplit = myDate.split('/');
                const format = `${dataSplit[2]}-${dataSplit[1]}-${dataSplit[0]}`;
                
                return format;
            };
            
            var modifieData2 = `${ano}-${mes}-${dia}`;
        
            const birthdayFormat =  dataVerify ? modifieData1() : modifieData2; //formatar data para 0000-00-00
        
            //Array principal que vai para rapidoc
            const arrBD = [
              {
                "name": req.body.name,
                "cpf": req.body.cpf,
                "birthday": birthdayFormat,
                "phone": req.body.phone,
                "email": req.body.email,
                "zipCode": req.body.zipCode,
                "address": req.body.address,
                "city": req.body.city,
                "state": req.body.state,
                "paymentType": "S",
                "serviceType": "G",
                "holder": req.body.holder,
                "general": ""
              }
            ];


          
          const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
              headers: {
                'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
                'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
                'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
              }
            });
        
        
        
            if (response.data.success == true) {
              //acão para registrar ativaçao da vida na rapidoc
             /* const franqueado = await Franqueado.findAll({
                where: { id: cliente[0].id_franqueado }
              });
        
              let vidasAtivas = franqueado[0].vendas;
        
              const novaVida = await Franqueado.update({
                vendas: parseInt(vidasAtivas) + 1,
              }, {
                where: {
                  id: cliente[0].id_franqueado,
                }
              });*/
        
              //resposta para o cliente
              res.send(response.data);
              console.log(response.data)
              console.log("criado: ", response.data);
              return true;
            } else {
              res.send(response.data);
              console.log("erro ao criar: ", response.data);
              return false;
            }
      }
   
    //buscar dados pelo cpf na tabela de clientes
   const cliente = await Clientes.findAll({
      where: { nu_documento: cpf }
    });
    

 //console.log("my CPF", cliente)
    //configuracao da data
    const myDate = cliente[0].birthday;

    
    const dia = myDate.substr(0, 2);
    const mes = myDate.substr(2, 2);
    const ano = myDate.substr(4, 4);

    const dataVerify = /\//.test(myDate);
    
    var modifieData1 = () => {
        const dataSplit = myDate.split('/');
        const format = `${dataSplit[2]}-${dataSplit[1]}-${dataSplit[0]}`;
        
        return format;
    };
    
    var modifieData2 = `${ano}-${mes}-${dia}`;

    const birthdayFormat =  dataVerify ? modifieData1() : modifieData2; //formatar data para 0000-00-00

    //Array principal que vai para rapidoc
    const arrBD = [
      {
        "name": cliente[0].nm_cliente,
        "cpf": cliente[0].nu_documento,
        "birthday": birthdayFormat,
        "phone": cliente[0].telefone,
        "email": cliente[0].email,
        "zipCode": cliente[0].zip_code,
        "address": "rua do teste, 01",//cliente[0].address,
        "city": cliente[0].city,
        "state": cliente[0].state,
        "paymentType": cliente[0].paymentType,
        "serviceType": cliente[0].serviceType,
        "holder": "",
        "general": ""
      }
    ];





    //console.log("clientessssssssssssssss", cliente[0])
    const dataArr = JSON.parse(cliente[0].beneficiarios);
    //console.log(dataArr[0].birthday1)
    try {
        
           if (dataArr[0].nu_documento1 != null) {
        console.log("testando")
        const data = dataArr[0].birthday1.split('/');
      const birthdayFormat1 = data ? data : null;
      
      console.log("teste da data", dataArr[0].nu_documento1)

      const dep1 = {
        "name": dataArr[0].nm_cliente1,
        "cpf": dataArr[0].nu_documento1,
        "birthday": `${birthdayFormat1[2]}-${birthdayFormat1[1]}-${birthdayFormat1[0]}`,
        "phone": dataArr[0].telefone1,
        "email": dataArr[0].email1,
        "zipCode": dataArr[0].zipCode1,
        "address": dataArr[0].address1,
        "city": dataArr[0].city1,
        "state": dataArr[0].state1
      }

      arrBD.push(dep1);
    } else if (dataArr[1].nu_documento2 != null) {
        const data = dataArr[1].birthday1.split('/');
      const birthdayFormat2 = data ? data : null;

      const dep2 = {
        "name": dataArr[1].nm_cliente2,
        "cpf": dataArr[1].nu_documento2,
        "birthday": `${birthdayFormat2[2]}-${birthdayFormat2[1]}-${birthdayFormat2[0]}`,
        "phone": dataArr[1].telefone2,
        "email": dataArr[1].email2,
        "zipCode": dataArr[1].zipCode2,
        "address": dataArr[1].address2,
        "city": dataArr[1].city2,
        "state": dataArr[1].state2
      }

      arrBD.push(dep2);
    } else if (dataArr[2].nu_documento3 != null) {
        const data = dataArr[2].birthday1.split('/');
      const birthdayFormat3 = data ? data : null;

      const dep3 = {
        "name": dataArr[2].nm_cliente3,
        "cpf": dataArr[2].nu_documento3,
        "birthday": `${birthdayFormat3[2]}-${birthdayFormat3[1]}-${birthdayFormat3[0]}`,
        "phone": dataArr[2].telefone3,
        "email": dataArr[2].email3,
        "zipCode": dataArr[2].zipCode3,
        "address": dataArr[2].address3,
        "city": dataArr[2].city3,
        "state": dataArr[2].state3
      };

      arrBD.push(dep3);
    }
        
    } catch(err) {
        console.log(err)
    }
 
    
    console.log("origewm: ", arrBD);
    try{
               const response = await axios.post(`https://api.rapidoc.tech/tema/api/beneficiaries`, arrBD, {
          headers: {
        
            'Authorization': 'Bearer eyJhbGciOiJSUzUxMiJ9.eyJjbGllbnQiOiJXLlNPQVJFUyJ9.M3pdugJ8KoD-f-vaOUAeUjvq747cBqR1woeVAUFBqit8qUVvxdMVU9rf3TsVmuUxwBhPFgzU8drUnHlAEdkvF-GBclD_38lUYAUZBBQVqN3VCGcEjX1NRoNQ-Hsl4lxgics6DmNau05OqXE28066fKFWm9WLxpt_Xdj26O91tAde5XJxglq_9v__2A1DFdcUWfNZtAL_WD7kRVTO8XWhOBe9Eu_bbDL_OHGEnmbFEkxCPZ4K7gQk_zRRUr_5lQahNrTp7MnIL7bvydbRvfi5xTyLxuO1ZlzYH_GEy6y9EpyXAuYrOr2mdxJFD3PzkTwRqjKgxUKjXQv3r7924afogiAvNj4paOtiahS3LRqsfn4ywvHRA3zYIknmKsJfpOBy2Cp7o7OeHWV_QuRaVvplXjvLOtv9ptgVvguGtupZvOd7B8Q8rFIrx95FlKIZjbxnqPLiG8oYdz5UOMUpuVosEIuT4lxgCxYUdJOfZzMN82MsPYelezvmrqLnO_TATWuWmWOAvBUxdw72zm6ddlj3WjMmadEJI6lJ8nDQRMOBx32uPImv-oRYd0upQyX0bciWZGblSGh7jRfmwLlUN0XVn4zdiLI9j0IsYzcuNjeLil_y29rUyvZZvmaTl0RCKQNpdarpf4bzJbJUSV_4_pjnuNMT0GczFkdZE_cPmQ_rUCo',
                'clientId': '5fac4f05-0b92-450f-ad4a-ccd9b3ffce32',
            'Content-Type': 'application/vnd.rapidoc.tema-v2+json'
          }
        });
    
    console.log("resposta: ", response)

//console.log("0---------------> ", response.data)

    if (response.data.success == true) {
      //acão para registrar ativaçao da vida na rapidoc
      const franqueado = await Franqueado.findAll({
        where: { id: cliente[0].id_franqueado }
      });

      let vidasAtivas = franqueado[0].vendas;

      const novaVida = await Franqueado.update({
        vendas: parseInt(vidasAtivas) + 1,
      }, {
        where: {
          id: cliente[0].id_franqueado,
        }
      });

      //resposta para o cliente
      //res.send(response.data);
      console.log(response.data)
      console.log("criado: ", response.data);
      return true;
    } else {
      //res.send(response.data);
      console.log("erro ao criar: ", response.data);
      return false;
    }
 
    } catch (err) {
        console.log("executando", err)
    }


  } catch (err) {
    res.json(err);
    //res.status(400);
    
    //console.log(err)
  }

    }
}