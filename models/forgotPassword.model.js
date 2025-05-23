const mongoos = require('mongoose');
const Schema = mongoos.Schema;

const ForgotPasswordSchema = new Schema({
    email : {
        type : String,
        required : true,
        unique : true
    },
    verificationCode : {
        type : String,
        required : true
    }
})

const ForgotPasswordModel = mongoos.model('forgotPassword', ForgotPasswordSchema);
module.exports = ForgotPasswordModel;