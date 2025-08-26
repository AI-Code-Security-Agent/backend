const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    fullname : {
        type :String,
        required :[true, "Please provide fullname.."]
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