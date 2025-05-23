const fs = require('fs');
const path = require('path');

const email = {};

fs.readdirSync(__dirname)
  .filter((file) => {
    return (file.indexOf('.') !== 0) && (file !== 'index.js');
  })
  .forEach((file) => {
    const service = require(path.join(__dirname, file));
    email[file.split('.')[0]] = service;
  }); 


module.exports = email;