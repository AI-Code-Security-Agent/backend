const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const demoSessionSchema = new Schema({
  demoSessionID: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  chat_count: {
    type: Number,
    default: 0
  }
}); 

const DemoSessionModel = mongoose.model("demo_session", demoSessionSchema);
module.exports = DemoSessionModel;
