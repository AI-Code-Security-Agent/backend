const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// login post request
router.post('/login', authController.handleLogin);

// logout post request
router.post('/logout',(req, res , next) => {
    req.logOut((err) => {
        if(err){
            return next(err);
        }
        res.json({ 
            isSuccess:true,
            message: 'Successfully logged out!'
        });
    })
})

module.exports = router;