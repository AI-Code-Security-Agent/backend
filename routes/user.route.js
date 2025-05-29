const express =  require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const {authenticateToken} = require('../auth/authToken')

//create user endpoint
router.post('/createuser', userController.handleCreateUserPostRequest);

router.get('/loguser',authenticateToken, (req, res) => {
  console.log('Logged-in user:', req.user);  // 👈 This logs the user info to the console
  res.status(200).json({
    isSuccess :true,
    message:"Token authnticate successfully.",
    content : {
        user: req.user
    }
  })
});


module.exports = router