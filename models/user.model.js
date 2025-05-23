const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    firstname : {
        type :String,
        required :[true, "Please provide firstname.."]
    },
    lastname : {
        type :String,
        required :[true, "Please provide lastname.."]
    },
    email: {
        type: String,
        required: [true, "Please provide email"],
        unique: true,
    },
    password: {
        type: String,
        required: [true, "Please provide a password"],
    },
    gitAccessTiken:{
        type : String
    }
});

const UserModel = mongoose.model('user',UserSchema);
module.exports = UserModel;