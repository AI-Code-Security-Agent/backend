const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/user.model');

module.exports = {
    authenticateToken : async(req,res,next)=>{
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({
                    isSuccess: false,
                    message: 'Token is null or missing',
                });
            }

            jwt.verify(token ,process.env.ACCESS_TOKEN_SECRET, async(err, user) =>{
                console.log(token)
                if (err) {
                    console.log('error :',err)
                    return res.status(403).json({
                        isSuccess: false,
                        message: 'Token is invalid or expired',
                    });
                }
                
                try {
                    
                    const currentUser = await User.findById(user.id);
                    if (!currentUser) {
                        return res.status(404).json({
                            isSuccess: false,
                            message: 'User not found in token verification',
                        });
                    }
                    req.user = currentUser;
                    next();
                } catch (error) {
                    console.log(error)
                    return res.status(500).json({
                        isSuccess: false,
                        message: 'Error finding user in token verification',
                    });
                }
            })
        } catch (error) {
            console.error('Unexpected error in token authentication:', error);
            return res.status(500).json({
                isSuccess: false,
                message: 'Internal server error',
            });
        }
        
    }
}