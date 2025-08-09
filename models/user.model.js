const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    firstname : {
        type :String,
        required :[true, "Please provide firstname.."]
    },
    lastname : {
        type :String,
    },
    email: {
        type: String,
        required: [true, "Please provide email"],
        unique: true,
    },
    password: {
        type: String,
    },
    gitAccessToken:{
        type : String
    }
});

const UserModel = mongoose.model('user',UserSchema);
module.exports = UserModel;