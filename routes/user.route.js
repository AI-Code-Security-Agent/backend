const express =  require('express');
const router = express.Router();
const userController = require('../controllers/user.controller')

//create user endpoint
router.post('/createuser', userController.handleCreateUserPostRequest);

module.exports = router