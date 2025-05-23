const LocalStratergy = require('passport-local').Strategy;
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');


module.exports = function(passport){
    passport.use(
        new LocalStratergy({usernameField:'email',passwordField:'password'}, async (email , password ,done)=> {
            // user matching
            const userResponse = await User.findOne({email:email});
            if(!userResponse){
                return done(null , false , {message : ' Please check your email again.'})
            }

            // password matching
            const isMatch = await bcrypt.compare(password, userResponse.password)
            if(isMatch){
                return done(null ,userResponse)
            }else{
                return done(null ,false , {message : 'Invalid Password.!'})
            }
        })
    );

    // serialization & deserialization
    passport.serializeUser((user ,done) => {
        done(null , user.id)
    })

    passport.deserializeUser(async (id ,done) => {
        try {
            const user = await User.findById(id);
            done(null,user);
        } catch (err) {
            console.log(err);
            done(err, false);
        }
    })
}